/*
 * Bases Qualis:
 *   POST /api/qualis/cargas      multipart: arquivo (.csv), fonte (CAPES|PUC_RS|SCOPUS|EVENTOS), ano_base, area?
 *   GET  /api/qualis/cargas      histórico das cargas
 *   GET  /api/qualis/veiculos    ?busca=&tipo=PERIODICO|CONFERENCIA&area=  → estratos por fonte e o vigente
 */
const { Router } = require("express");
const multer = require("multer");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { autenticar } = require("../../middlewares/autenticacao");
const { Erros } = require("../../lib/erros");
const { criarServicoQualis, AREA_PADRAO } = require("./qualis.servico");
const { FORMATOS } = require("./formatos");

const TAMANHO_MAXIMO = 25 * 1024 * 1024;

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: TAMANHO_MAXIMO, files: 1 },
  fileFilter: (_req, arquivo, cb) => {
    const ehCsv = /\.(csv|txt)$/i.test(arquivo.originalname);
    cb(ehCsv ? null : Erros.requisicaoInvalida("Envie um arquivo .csv (exporte a planilha como CSV)."), ehCsv);
  },
});

/** Converte erros do multer (tamanho, campo errado) em mensagens claras. */
function receberArquivo(req, res, next) {
  upload.single("arquivo")(req, res, (erro) => {
    if (!erro) return next();
    if (erro instanceof multer.MulterError) {
      const mensagem =
        erro.code === "LIMIT_FILE_SIZE"
          ? `Arquivo maior que ${TAMANHO_MAXIMO / 1024 / 1024} MB.`
          : `Envie um único arquivo no campo "arquivo" (${erro.code}).`;
      return next(Erros.requisicaoInvalida(mensagem));
    }
    return next(erro);
  });
}

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

  rotas.post("/cargas", receberArquivo, validar({ body: esquemaCarga }), async (req, res) => {
    if (!req.file) throw Erros.requisicaoInvalida('Envie o arquivo no campo "arquivo".');
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

  return rotas;
}

module.exports = { criarRotasQualis };
