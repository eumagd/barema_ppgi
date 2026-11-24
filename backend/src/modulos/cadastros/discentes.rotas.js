/*
 * Discentes, orientação e coorientação:
 *   GET    /api/discentes                 ?busca=&id_orientador=&situacao=EM_ANDAMENTO|CONCLUIDO
 *   GET    /api/discentes/:id
 *   POST   /api/discentes                 cria o discente e seu registro em AUTOR
 *   PATCH  /api/discentes/:id             inclui troca de orientador e data_conclusao (defesa)
 *   DELETE /api/discentes/:id
 *   POST   /api/discentes/:id/coorientacoes          { id_docente } ou { id_externo }
 *   DELETE /api/discentes/:id/coorientacoes/:idCoorientacao
 *
 * As regras "só PERMANENTE orienta", "máximo de 8 orientandos" e "orientador não é
 * coorientador" ficam nos gatilhos do banco; as mensagens deles chegam como 422.
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { Erros } = require("../../lib/erros");
const { id, paramsId, data, texto, criarAutor, exigir } = require("./comum");

const campos = {
  matricula: texto(20),
  nome: texto(150, 3),
  ano_ingresso: z.coerce.number().int().min(1980).max(2100),
  id_orientador: id.nullable(),
  data_conclusao: data.nullable(),
};

const esquemaCriar = z.object({
  ...campos,
  id_orientador: campos.id_orientador.optional(),
  data_conclusao: campos.data_conclusao.optional(),
  nome_citacao: texto(255).optional(),
});

const esquemaAtualizar = z
  .object(campos)
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Informe ao menos um campo para atualizar.");

const esquemaLista = z.object({
  busca: z.string().trim().max(150).optional(),
  id_orientador: id.optional(),
  situacao: z.enum(["EM_ANDAMENTO", "CONCLUIDO"]).optional(),
});

const esquemaCoorientacao = z
  .object({ id_docente: id.optional(), id_externo: id.optional() })
  .refine((o) => Boolean(o.id_docente) !== Boolean(o.id_externo), "Informe id_docente OU id_externo (apenas um).");

const incluirDetalhes = {
  orientador: { select: { id_docente: true, nome: true, vinculo: true } },
  coorientacoes: {
    include: {
      docente: { select: { id_docente: true, nome: true } },
      externo: { select: { id_externo: true, nome: true, inst_origem: true } },
    },
  },
};

function criarRotasDiscentes({ prisma }) {
  const rotas = Router();
  const buscar = (idDiscente) =>
    exigir(prisma.discente.findUnique({ where: { id_discente: idDiscente } }), "Discente não encontrado.");

  rotas.get("/", validar({ query: esquemaLista }), async (req, res) => {
    const { busca, id_orientador: idOrientador, situacao } = req.validado.query;
    const where = {};
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: "insensitive" } },
        { matricula: { contains: busca, mode: "insensitive" } },
      ];
    }
    if (idOrientador) where.id_orientador = idOrientador;
    if (situacao) where.data_conclusao = situacao === "CONCLUIDO" ? { not: null } : null;
    res.json(await prisma.discente.findMany({ where, orderBy: { nome: "asc" }, include: incluirDetalhes }));
  });

  rotas.get("/:id", validar({ params: paramsId }), async (req, res) => {
    res.json(
      await exigir(
        prisma.discente.findUnique({
          where: { id_discente: req.validado.params.id },
          include: { ...incluirDetalhes, autor: { include: { nomes_citacao: true } } },
        }),
        "Discente não encontrado.",
      ),
    );
  });

  rotas.post("/", validar({ body: esquemaCriar }), async (req, res) => {
    const { nome_citacao: nomeCitacao, ...dados } = req.validado.body;
    const discente = await prisma.discente.create({
      data: { ...dados, autor: criarAutor("DISCENTE", dados.nome, nomeCitacao) },
      include: incluirDetalhes,
    });
    res.status(201).json(discente);
  });

  rotas.patch("/:id", validar({ params: paramsId, body: esquemaAtualizar }), async (req, res) => {
    const { id: idDiscente } = req.validado.params;
    const atual = await buscar(idDiscente);
    const dados = req.validado.body;
    const ano = dados.ano_ingresso ?? atual.ano_ingresso;
    const conclusao = dados.data_conclusao === undefined ? atual.data_conclusao : dados.data_conclusao;
    if (conclusao && conclusao.getUTCFullYear() < ano) {
      throw Erros.regraDeNegocio("A data de conclusão não pode ser anterior ao ano de ingresso.");
    }
    res.json(await prisma.discente.update({ where: { id_discente: idDiscente }, data: dados, include: incluirDetalhes }));
  });

  rotas.delete("/:id", validar({ params: paramsId }), async (req, res) => {
    const { id: idDiscente } = req.validado.params;
    await buscar(idDiscente);
    await prisma.discente.delete({ where: { id_discente: idDiscente } });
    res.status(204).end();
  });

  rotas.post("/:id/coorientacoes", validar({ params: paramsId, body: esquemaCoorientacao }), async (req, res) => {
    const { id: idDiscente } = req.validado.params;
    await buscar(idDiscente);
    const coorientacao = await prisma.coorientacao.create({
      data: { id_discente: idDiscente, ...req.validado.body },
      include: incluirDetalhes.coorientacoes.include,
    });
    res.status(201).json(coorientacao);
  });

  rotas.delete(
    "/:id/coorientacoes/:idCoorientacao",
    validar({ params: paramsId.extend({ idCoorientacao: id }) }),
    async (req, res) => {
      const { id: idDiscente, idCoorientacao } = req.validado.params;
      const { count } = await prisma.coorientacao.deleteMany({ where: { id_coorientacao: idCoorientacao, id_discente: idDiscente } });
      if (!count) throw Erros.naoEncontrado("Coorientação não encontrada para este discente.");
      res.status(204).end();
    },
  );

  return rotas;
}

/*
 * Membros externos (coorientadores e coautores de fora do PPGI):
 *   GET /api/externos?busca=   GET /api/externos/:id   POST   PATCH /:id   DELETE /:id
 */
const camposExterno = { nome: texto(150, 3), inst_origem: texto(150).nullable().optional() };

function criarRotasExternos({ prisma }) {
  const rotas = Router();

  rotas.get("/", validar({ query: z.object({ busca: z.string().trim().max(150).optional() }) }), async (req, res) => {
    const { busca } = req.validado.query;
    res.json(
      await prisma.externo.findMany({
        where: busca ? { nome: { contains: busca, mode: "insensitive" } } : {},
        orderBy: { nome: "asc" },
      }),
    );
  });

  rotas.get("/:id", validar({ params: paramsId }), async (req, res) => {
    res.json(
      await exigir(
        prisma.externo.findUnique({ where: { id_externo: req.validado.params.id }, include: { coorientacoes: { include: { discente: true } } } }),
        "Membro externo não encontrado.",
      ),
    );
  });

  rotas.post("/", validar({ body: z.object({ ...camposExterno, nome_citacao: texto(255).optional() }) }), async (req, res) => {
    const { nome_citacao: nomeCitacao, ...dados } = req.validado.body;
    res.status(201).json(await prisma.externo.create({ data: { ...dados, autor: criarAutor("EXTERNO", dados.nome, nomeCitacao) } }));
  });

  rotas.patch(
    "/:id",
    validar({ params: paramsId, body: z.object(camposExterno).partial().refine((o) => Object.keys(o).length, "Informe ao menos um campo.") }),
    async (req, res) => {
      res.json(await prisma.externo.update({ where: { id_externo: req.validado.params.id }, data: req.validado.body }));
    },
  );

  rotas.delete("/:id", validar({ params: paramsId }), async (req, res) => {
    await prisma.externo.delete({ where: { id_externo: req.validado.params.id } });
    res.status(204).end();
  });

  return rotas;
}

module.exports = { criarRotasDiscentes, criarRotasExternos };
