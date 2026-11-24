/*
 * Docentes (professores.html, perfil.html):
 *   GET    /api/docentes                 ?busca=&vinculo=PERMANENTE|COLABORADOR|NENHUM&participando=true|false
 *   GET    /api/docentes/:id             com autor, nomes de citação, orientandos, coorientações e turmas
 *   POST   /api/docentes                 cria o docente e seu registro em AUTOR
 *   PATCH  /api/docentes/:id
 *   DELETE /api/docentes/:id             só coordenação; recusa se houver avaliações
 *   POST   /api/docentes/:id/desvincular devolve o vínculo anterior para "desfazer"
 *   PUT    /api/docentes/:id/recusa      sinaliza que não participará do ciclo (RF16)
 *   DELETE /api/docentes/:id/recusa      desfaz a sinalização
 *   POST   /api/docentes/:id/nomes-citacao       { nome }  nova variação (RF-BE09)
 *   DELETE /api/docentes/:id/nomes-citacao/:idNome
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { exigirPerfil, PERFIS } = require("../../middlewares/autenticacao");
const { Erros } = require("../../lib/erros");
const { normalizarTexto } = require("../../lib/texto");
const { id, paramsId, data, texto, textoOpcional, criarAutor, exigir } = require("./comum");

const VINCULOS = ["PERMANENTE", "COLABORADOR"];

const campos = {
  matricula: texto(20),
  nome: texto(150, 3),
  email: z.string().trim().toLowerCase().email("E-mail inválido.").max(150),
  departamento: textoOpcional(150),
  situacao_funcional: z.enum(["EFETIVO", "SUBSTITUTO", "VISITANTE", "APOSENTADO"]),
  url_lattes: z.string().trim().url("URL do Lattes inválida.").max(255).nullable().optional(),
  id_lattes: z
    .string()
    .trim()
    .regex(/^[0-9]{16}$/, "O ID Lattes deve ter exatamente 16 dígitos.")
    .nullable()
    .optional(),
  vinculo: z.enum(VINCULOS).nullable(),
  data_vinculo: data.nullable(),
};

const esquemaCriar = z.object({
  ...campos,
  situacao_funcional: campos.situacao_funcional.default("EFETIVO"),
  vinculo: campos.vinculo.default(null),
  data_vinculo: campos.data_vinculo.optional(),
  /** Como aparece nas publicações; padrão "SOBRENOME, I.". */
  nome_citacao: texto(255).optional(),
});

const esquemaAtualizar = z
  .object(campos)
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Informe ao menos um campo para atualizar.");

const esquemaLista = z.object({
  busca: z.string().trim().max(150).optional(),
  vinculo: z.enum([...VINCULOS, "NENHUM"]).optional(),
  participando: z.enum(["true", "false"]).transform((v) => v === "true").optional(),
});

const hoje = () => new Date(new Date().toISOString().slice(0, 10) + "T00:00:00Z");

function criarRotasDocentes({ prisma }) {
  const rotas = Router();
  const buscar = (idDocente) => exigir(prisma.docente.findUnique({ where: { id_docente: idDocente } }), "Docente não encontrado.");

  rotas.get("/", validar({ query: esquemaLista }), async (req, res) => {
    const { busca, vinculo, participando } = req.validado.query;
    const where = {};
    if (busca) {
      where.OR = [
        { nome: { contains: busca, mode: "insensitive" } },
        { email: { contains: busca, mode: "insensitive" } },
        { matricula: { contains: busca, mode: "insensitive" } },
      ];
    }
    if (vinculo) where.vinculo = vinculo === "NENHUM" ? null : vinculo;
    if (participando !== undefined) where.data_recusa_participacao = participando ? null : { not: null };

    const docentes = await prisma.docente.findMany({
      where,
      orderBy: { nome: "asc" },
      include: { _count: { select: { orientandos: true, coorientacoes: true, avaliacoes: true } } },
    });
    res.json(docentes);
  });

  rotas.get("/:id", validar({ params: paramsId }), async (req, res) => {
    const docente = await exigir(
      prisma.docente.findUnique({
        where: { id_docente: req.validado.params.id },
        include: {
          autor: { include: { nomes_citacao: { orderBy: { id_nome_citacao: "asc" } } } },
          orientandos: { orderBy: { nome: "asc" } },
          coorientacoes: { include: { discente: true } },
          turmas: { include: { disciplina: true }, orderBy: [{ ano: "desc" }, { semestre: "desc" }] },
        },
      }),
      "Docente não encontrado.",
    );
    res.json(docente);
  });

  rotas.post("/", validar({ body: esquemaCriar }), async (req, res) => {
    const { nome_citacao: nomeCitacao, ...dados } = req.validado.body;
    if (dados.vinculo && !dados.data_vinculo) dados.data_vinculo = hoje();
    const docente = await prisma.docente.create({
      data: { ...dados, autor: criarAutor("DOCENTE", dados.nome, nomeCitacao) },
      include: { autor: { include: { nomes_citacao: true } } },
    });
    res.status(201).json(docente);
  });

  rotas.patch("/:id", validar({ params: paramsId, body: esquemaAtualizar }), async (req, res) => {
    const { id: idDocente } = req.validado.params;
    const dados = { ...req.validado.body };
    const atual = await buscar(idDocente);
    // Mudou de categoria sem informar a data: o novo vínculo começa hoje.
    if (dados.vinculo !== undefined && dados.vinculo !== atual.vinculo && dados.data_vinculo === undefined) {
      dados.data_vinculo = dados.vinculo ? hoje() : null;
    }
    res.json(await prisma.docente.update({ where: { id_docente: idDocente }, data: dados }));
  });

  rotas.delete("/:id", exigirPerfil(PERFIS.COORDENACAO), validar({ params: paramsId }), async (req, res) => {
    const { id: idDocente } = req.validado.params;
    await buscar(idDocente);
    const avaliacoes = await prisma.avaliacao.count({ where: { id_docente: idDocente } });
    if (avaliacoes) {
      throw Erros.conflito(`O docente tem ${avaliacoes} avaliação(ões) registrada(s). Desvincule-o do PPGI em vez de excluir.`);
    }
    await prisma.docente.delete({ where: { id_docente: idDocente } });
    res.status(204).end();
  });

  rotas.post("/:id/desvincular", validar({ params: paramsId }), async (req, res) => {
    const { id: idDocente } = req.validado.params;
    const atual = await buscar(idDocente);
    if (!atual.vinculo) throw Erros.regraDeNegocio("O docente já não tem vínculo com o PPGI.");
    const orientandos = await prisma.discente.count({ where: { id_orientador: idDocente, data_conclusao: null } });
    if (orientandos) {
      throw Erros.regraDeNegocio(`O docente orienta ${orientandos} discente(s) em andamento. Transfira as orientações antes de desvincular.`);
    }
    const docente = await prisma.docente.update({ where: { id_docente: idDocente }, data: { vinculo: null, data_vinculo: null } });
    res.json({ docente, anterior: { vinculo: atual.vinculo, data_vinculo: atual.data_vinculo } });
  });

  rotas.put("/:id/recusa", validar({ params: paramsId, body: z.object({ data: data.optional() }).default({}) }), async (req, res) => {
    const { id: idDocente } = req.validado.params;
    await buscar(idDocente);
    const docente = await prisma.docente.update({
      where: { id_docente: idDocente },
      data: { data_recusa_participacao: req.validado.body.data || hoje() },
    });
    res.json(docente);
  });

  rotas.delete("/:id/recusa", validar({ params: paramsId }), async (req, res) => {
    const { id: idDocente } = req.validado.params;
    await buscar(idDocente);
    res.json(await prisma.docente.update({ where: { id_docente: idDocente }, data: { data_recusa_participacao: null } }));
  });

  rotas.post("/:id/nomes-citacao", validar({ params: paramsId, body: z.object({ nome: texto(255, 2) }) }), async (req, res) => {
    const autor = await exigir(
      prisma.autor.findUnique({ where: { id_docente: req.validado.params.id } }),
      "Docente não encontrado.",
    );
    const { nome } = req.validado.body;
    const variacao = await prisma.autorNomeCitacao.create({
      data: { id_autor: autor.id_autor, nome, nome_normalizado: normalizarTexto(nome).slice(0, 255) },
    });
    res.status(201).json(variacao);
  });

  rotas.delete(
    "/:id/nomes-citacao/:idNome",
    validar({ params: paramsId.extend({ idNome: id }) }),
    async (req, res) => {
      const { id: idDocente, idNome } = req.validado.params;
      const autor = await exigir(prisma.autor.findUnique({ where: { id_docente: idDocente } }), "Docente não encontrado.");
      const { count } = await prisma.autorNomeCitacao.deleteMany({ where: { id_nome_citacao: idNome, id_autor: autor.id_autor } });
      if (!count) throw Erros.naoEncontrado("Variação de nome não encontrada para este docente.");
      res.status(204).end();
    },
  );

  return rotas;
}

module.exports = { criarRotasDocentes };
