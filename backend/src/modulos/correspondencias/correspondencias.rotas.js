/*
 * Fila de revisão do Fuzzy Match (RF-BE10, RF-BE11):
 *   GET   /api/correspondencias       ?faixa=revisao|automatica|decididas|todas&id_docente=
 *   PATCH /api/correspondencias/:id   { decisao: CONFIRMADA|REJEITADA, justificativa? }
 *                                     confirmar mescla as publicações; rejeitar uma mescla a desfaz
 *   POST  /api/correspondencias/processar   roda o pipeline em toda a base (ex.: após mudar os cortes)
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { autenticar } = require("../../middlewares/autenticacao");
const { criarServicoFuzzy } = require("./fuzzy.servico");

const FAIXAS = {
  revisao: { decisao: "PENDENTE" },
  automatica: { decisao: "AUTOMATICA" },
  decididas: { decisao: { in: ["CONFIRMADA", "REJEITADA"] } },
  todas: {},
};

const resumoPublicacao = {
  select: {
    id_publicacao: true,
    titulo: true,
    ano_publicacao: true,
    doi: true,
    id_mesclada_em: true,
    veiculo: { select: { nome: true, issn_sigla: true, tipo: true } },
    autorias: { select: { autor: { select: { id_autor: true, nome_citacao: true, docente: { select: { id_docente: true, nome: true } } } } } },
  },
};

function criarRotasCorrespondencias({ prisma }) {
  const servico = criarServicoFuzzy({ prisma });
  const rotas = Router();
  rotas.use(autenticar);

  rotas.get(
    "/",
    validar({
      query: z.object({
        faixa: z.enum(Object.keys(FAIXAS)).default("revisao"),
        id_docente: z.coerce.number().int().positive().optional(),
      }),
    }),
    async (req, res) => {
      const { faixa, id_docente: idDocente } = req.validado.query;
      const doDocente = idDocente ? { autorias: { some: { autor: { id_docente: idDocente } } } } : null;
      const lista = await prisma.correspondencia.findMany({
        where: {
          tipo: "PUBLICACAO",
          ...FAIXAS[faixa],
          ...(doDocente ? { OR: [{ publicacao: doDocente }, { publicacao_candidata: doDocente }] } : {}),
        },
        orderBy: [{ nota: "desc" }, { id_correspondencia: "asc" }],
        include: { publicacao: resumoPublicacao, publicacao_candidata: resumoPublicacao, usuario: { select: { nome: true } } },
      });
      res.json(lista);
    },
  );

  rotas.patch(
    "/:id",
    validar({
      params: z.object({ id: z.coerce.number().int().positive() }),
      body: z.object({ decisao: z.enum(["CONFIRMADA", "REJEITADA"]), justificativa: z.string().trim().max(2000).optional() }),
    }),
    async (req, res) => {
      res.json(await servico.decidir(req.validado.params.id, req.validado.body, req.usuario.id));
    },
  );

  rotas.post("/processar", async (_req, res) => {
    res.json(await servico.processar());
  });

  return rotas;
}

module.exports = { criarRotasCorrespondencias };
