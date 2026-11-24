/*
 * Disciplinas e turmas (critério de Docência, RF09):
 *   GET    /api/disciplinas            ?busca=&nivel=GRADUACAO|POS_GRADUACAO
 *   POST   /api/disciplinas            { codigo, nome, nivel, estudo_dirigido? }
 *   PATCH  /api/disciplinas/:id
 *   DELETE /api/disciplinas/:id        recusa se houver turmas
 *   GET    /api/turmas                 ?id_docente=&ano=
 *   POST   /api/turmas                 { id_disciplina, id_docente, ano, semestre }
 *   DELETE /api/turmas/:id
 *
 * "Estudo Dirigido" não conta para a Docência: o campo estudo_dirigido é marcado
 * automaticamente quando o nome da disciplina contém essa expressão.
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { Erros } = require("../../lib/erros");
const { normalizarTexto } = require("../../lib/texto");
const { id, paramsId, texto, exigir } = require("./comum");

const ehEstudoDirigido = (nome) => normalizarTexto(nome).includes("estudo dirigido");

const camposDisciplina = {
  codigo: texto(20).transform((v) => v.toUpperCase()),
  nome: texto(200, 3),
  nivel: z.enum(["GRADUACAO", "POS_GRADUACAO"]),
  estudo_dirigido: z.boolean(),
};

function criarRotasDisciplinas({ prisma }) {
  const rotas = Router();

  rotas.get(
    "/",
    validar({ query: z.object({ busca: z.string().trim().max(200).optional(), nivel: camposDisciplina.nivel.optional() }) }),
    async (req, res) => {
      const { busca, nivel } = req.validado.query;
      const where = { ...(nivel ? { nivel } : {}) };
      if (busca) {
        where.OR = [
          { nome: { contains: busca, mode: "insensitive" } },
          { codigo: { contains: busca, mode: "insensitive" } },
        ];
      }
      res.json(await prisma.disciplina.findMany({ where, orderBy: { codigo: "asc" }, include: { _count: { select: { turmas: true } } } }));
    },
  );

  rotas.post(
    "/",
    validar({ body: z.object({ ...camposDisciplina, estudo_dirigido: camposDisciplina.estudo_dirigido.optional() }) }),
    async (req, res) => {
      const dados = req.validado.body;
      dados.estudo_dirigido = dados.estudo_dirigido ?? ehEstudoDirigido(dados.nome);
      res.status(201).json(await prisma.disciplina.create({ data: dados }));
    },
  );

  rotas.patch(
    "/:id",
    validar({ params: paramsId, body: z.object(camposDisciplina).partial().refine((o) => Object.keys(o).length, "Informe ao menos um campo.") }),
    async (req, res) => {
      const dados = req.validado.body;
      if (dados.nome && dados.estudo_dirigido === undefined && ehEstudoDirigido(dados.nome)) dados.estudo_dirigido = true;
      res.json(await prisma.disciplina.update({ where: { id_disciplina: req.validado.params.id }, data: dados }));
    },
  );

  rotas.delete("/:id", validar({ params: paramsId }), async (req, res) => {
    const { id: idDisciplina } = req.validado.params;
    const turmas = await prisma.turma.count({ where: { id_disciplina: idDisciplina } });
    if (turmas) throw Erros.conflito(`A disciplina tem ${turmas} turma(s) registrada(s). Exclua as turmas antes.`);
    await prisma.disciplina.delete({ where: { id_disciplina: idDisciplina } });
    res.status(204).end();
  });

  return rotas;
}

function criarRotasTurmas({ prisma }) {
  const rotas = Router();

  rotas.get(
    "/",
    validar({ query: z.object({ id_docente: id.optional(), ano: z.coerce.number().int().optional() }) }),
    async (req, res) => {
      const { id_docente: idDocente, ano } = req.validado.query;
      res.json(
        await prisma.turma.findMany({
          where: { ...(idDocente ? { id_docente: idDocente } : {}), ...(ano ? { ano } : {}) },
          orderBy: [{ ano: "desc" }, { semestre: "desc" }],
          include: { disciplina: true, docente: { select: { id_docente: true, nome: true } } },
        }),
      );
    },
  );

  rotas.post(
    "/",
    validar({
      body: z.object({
        id_disciplina: id,
        id_docente: id,
        ano: z.coerce.number().int().min(1980).max(2100),
        semestre: z.coerce.number().int().refine((s) => s === 1 || s === 2, "O semestre deve ser 1 ou 2."),
      }),
    }),
    async (req, res) => {
      const dados = req.validado.body;
      await exigir(prisma.disciplina.findUnique({ where: { id_disciplina: dados.id_disciplina } }), "Disciplina não encontrada.");
      await exigir(prisma.docente.findUnique({ where: { id_docente: dados.id_docente } }), "Docente não encontrado.");
      res.status(201).json(await prisma.turma.create({ data: dados, include: { disciplina: true } }));
    },
  );

  rotas.delete("/:id", validar({ params: paramsId }), async (req, res) => {
    await prisma.turma.delete({ where: { id_turma: req.validado.params.id } });
    res.status(204).end();
  });

  return rotas;
}

module.exports = { criarRotasDisciplinas, criarRotasTurmas, ehEstudoDirigido };
