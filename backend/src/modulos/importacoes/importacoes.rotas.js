/*
 * Importação do QLattes:
 *   POST /api/importacoes      multipart: arquivo (.csv de um docente ou .zip com vários),
 *                              id_docente (obrigatório para .csv), confirmar_nome? (true/false)
 *   GET  /api/importacoes      ?id_docente=&status=  histórico (só cargas de currículo)
 *   GET  /api/importacoes/:id  detalhe com contagens e erros por linha
 *   GET  /api/importacoes/lotes/:id  andamento de um .zip (202 no POST; processado em segundo plano)
 *   POST /api/importacoes/openalex/:id_docente  { desde? }  importa a produção pela API do OpenAlex
 *        (precisa do ORCID ou do ID do OpenAlex no cadastro do docente)
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { autenticar } = require("../../middlewares/autenticacao");
const { receberArquivo } = require("../../middlewares/upload");
const { Erros } = require("../../lib/erros");
const { criarServicoImportacao } = require("./importacao.servico");
const { criarConectorOpenAlex } = require("../conectores/openalex/conector.servico");

const FONTES_CURRICULO = ["QLATTES_CSV", "PLANILHA_TRANSICAO", "XML_LATTES", "OPENALEX"];

const receberCsvOuZip = receberArquivo({
  extensoes: ["csv", "zip"],
  tamanhoMaximoMb: 30,
  mensagemExtensao: "Envie o .csv exportado pelo QLattes ou um .zip com vários .csv.",
});

const esquemaUpload = z.object({
  id_docente: z.coerce.number().int().positive().optional(),
  confirmar_nome: z.enum(["true", "false"]).default("false").transform((v) => v === "true"),
});

function criarRotasImportacoes({ prisma, openalex }) {
  const servico = criarServicoImportacao({ prisma });
  const conectorOpenAlex = criarConectorOpenAlex({ prisma, ...(openalex ? { cliente: openalex } : {}) });
  const rotas = Router();
  rotas.use(autenticar);

  rotas.post("/", receberCsvOuZip, validar({ body: esquemaUpload }), async (req, res) => {
    const { id_docente: idDocente, confirmar_nome: confirmarNome } = req.validado.body;
    const resultado = await servico.importar({
      buffer: req.file.buffer,
      nomeArquivo: req.file.originalname,
      idDocente,
      confirmarNome,
      idUsuario: req.usuario.id,
    });
    const { concluido, ...corpo } = resultado;
    void concluido;
    const status = resultado.lote ? 202 : resultado.reaproveitada ? 200 : 201;
    res.status(status).json(corpo);
  });

  rotas.post(
    "/openalex/:id_docente",
    validar({
      params: z.object({ id_docente: z.coerce.number().int().positive() }),
      body: z.object({ desde: z.coerce.number().int().min(1950).max(2100).optional() }).default({}),
    }),
    async (req, res) => {
      const r = await conectorOpenAlex.importar({ idDocente: req.validado.params.id_docente, desde: req.validado.body.desde, idUsuario: req.usuario.id });
      res.status(r.reaproveitada ? 200 : 201).json(r);
    },
  );

  /** Andamento de um lote (.zip): status geral e de cada arquivo/docente. */
  rotas.get("/lotes/:id", validar({ params: z.object({ id: z.coerce.number().int().positive() }) }), async (req, res) => {
    const lote = await prisma.loteImportacao.findUnique({ where: { id_lote: req.validado.params.id } });
    if (!lote) throw Erros.naoEncontrado("Lote não encontrado.");
    res.json(lote);
  });

  rotas.get(
    "/",
    validar({
      query: z.object({
        id_docente: z.coerce.number().int().positive().optional(),
        status: z.enum(["PENDENTE", "PROCESSANDO", "CONCLUIDO", "FALHA"]).optional(),
      }),
    }),
    async (req, res) => {
      const { id_docente: idDocente, status } = req.validado.query;
      res.json(
        await prisma.importacao.findMany({
          where: { fonte: { in: FONTES_CURRICULO }, ...(idDocente ? { id_docente: idDocente } : {}), ...(status ? { status } : {}) },
          orderBy: { criado_em: "desc" },
          take: 200,
          include: { docente: { select: { id_docente: true, nome: true } }, usuario: { select: { nome: true } } },
        }),
      );
    },
  );

  rotas.get("/:id", validar({ params: z.object({ id: z.coerce.number().int().positive() }) }), async (req, res) => {
    const importacao = await prisma.importacao.findUnique({
      where: { id_importacao: req.validado.params.id },
      include: { docente: { select: { id_docente: true, nome: true } }, usuario: { select: { nome: true } } },
    });
    if (!importacao) throw Erros.naoEncontrado("Importação não encontrada.");
    res.json(importacao);
  });

  return rotas;
}

module.exports = { criarRotasImportacoes };
