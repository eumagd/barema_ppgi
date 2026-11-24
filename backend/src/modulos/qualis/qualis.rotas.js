/*
 * Bases Qualis:
 *   POST /api/qualis/cargas      multipart: arquivo (.csv), fonte (CAPES|PUC_RS|SCOPUS|EVENTOS), ano_base, area?
 *   GET  /api/qualis/cargas      histórico das cargas
 *   GET  /api/qualis/veiculos    ?busca=&tipo=PERIODICO|CONFERENCIA&area=  → estratos por fonte e o vigente
 *   GET  /api/qualis/pendentes   fila de classificação manual: veículos com publicações e sem estrato (RF-BE05)
 *   POST /api/qualis/classificacoes   { id_veiculo, estrato, justificativa, ano_base? } → estrato MANUAL
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { autenticar } = require("../../middlewares/autenticacao");
const { receberArquivo } = require("../../middlewares/upload");
const { Erros } = require("../../lib/erros");
const { criarServicoQualis, AREA_PADRAO } = require("./qualis.servico");
const { FORMATOS, ESTRATOS } = require("./formatos");
const { PESOS_ESTRATO } = require("../../dominio/parametros-resolucao-1-2025");

const receberCsv = receberArquivo({
  extensoes: ["csv", "txt"],
  tamanhoMaximoMb: 25,
  mensagemExtensao: "Envie um arquivo .csv (exporte a planilha como CSV).",
});

const esquemaCarga = z.object({
  fonte: z.enum(Object.keys(FORMATOS), { error: `Fonte inválida. Use: ${Object.keys(FORMATOS).join(", ")}.` }),
  ano_base: z.coerce.number().int().min(2000).max(2100),
  area: z.string().trim().min(2).max(100).default(AREA_PADRAO),
});

const esquemaBusca = z.object({
  busca: z.string().trim().max(200).optional(),
  tipo: z.enum(["PERIODICO", "CONFERENCIA"]).optional(),
  area: z.string().trim().max(100).default(AREA_PADRAO),
  limite: z.coerce.number().int().min(1).max(200).default(50),
});

function criarRotasQualis({ prisma }) {
  const servico = criarServicoQualis({ prisma });
  const rotas = Router();
  rotas.use(autenticar);

  rotas.post("/cargas", receberCsv, validar({ body: esquemaCarga }), async (req, res) => {
    const { fonte, ano_base: anoBase, area } = req.validado.body;
    const { carga, reaproveitada } = await servico.carregar({
      buffer: req.file.buffer,
      nomeArquivo: req.file.originalname,
      fonte,
      anoBase,
      area,
      idUsuario: req.usuario.id,
    });
    res.status(reaproveitada ? 200 : 201).json({ reaproveitada, carga });
  });

  rotas.get("/cargas", async (_req, res) => {
    res.json(await servico.listarCargas());
  });

  rotas.get("/veiculos", validar({ query: esquemaBusca }), async (req, res) => {
    res.json(await servico.buscarVeiculos(req.validado.query));
  });

  rotas.get("/pendentes", validar({ query: z.object({ area: z.string().trim().max(100).default(AREA_PADRAO) }) }), async (req, res) => {
    const { area } = req.validado.query;
    const veiculos = await prisma.veiculo.findMany({
      where: { publicacoes: { some: { id_mesclada_em: null } }, estratos: { none: { area_de_atuacao: area } } },
      orderBy: { nome: "asc" },
      include: {
        _count: { select: { publicacoes: true } },
        publicacoes: {
          take: 5,
          orderBy: { ano_publicacao: "desc" },
          select: { id_publicacao: true, titulo: true, ano_publicacao: true },
        },
      },
    });
    res.json(veiculos);
  });

  rotas.post(
    "/classificacoes",
    validar({
      body: z.object({
        id_veiculo: z.coerce.number().int().positive(),
        estrato: z.enum(ESTRATOS),
        justificativa: z.string().trim().min(10, "Explique a classificação (mínimo de 10 caracteres)."),
        ano_base: z.coerce.number().int().min(2000).max(2100).default(new Date().getFullYear()),
        area: z.string().trim().max(100).default(AREA_PADRAO),
      }),
    }),
    async (req, res) => {
      const { id_veiculo: idVeiculo, estrato, justificativa, ano_base: anoBase, area } = req.validado.body;
      const veiculo = await prisma.veiculo.findUnique({ where: { id_veiculo: idVeiculo } });
      if (!veiculo) throw Erros.naoEncontrado("Veículo não encontrado.");
      const pesos = (await prisma.parametro.findFirst({ where: { chave: "pesos_estrato" }, orderBy: { resolucao: { data_vigencia: "desc" } } }))?.valor || PESOS_ESTRATO;
      const chave = { id_veiculo: idVeiculo, ano_base: anoBase, area_de_atuacao: area, fonte: "MANUAL" };
      const dados = { estrato, justificativa, pontuacao: pesos[estrato] ?? 0 };
      const registro = await prisma.estratoQualis.upsert({
        where: { id_veiculo_ano_base_area_de_atuacao_fonte: chave },
        create: { ...chave, ...dados },
        update: dados,
      });
      res.status(201).json(registro);
    },
  );

  return rotas;
}

module.exports = { criarRotasQualis };
