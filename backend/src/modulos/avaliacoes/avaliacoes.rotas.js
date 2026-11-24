/*
 * Cálculo e processos avaliativos (calculo.html, verificacao.html, credenciamento.html, painel.html):
 *
 *   GET   /api/docentes/:id/calculo          ?tipo=&inicio=&fim=&referencia=  cálculo ao vivo (nada é gravado)
 *   GET   /api/avaliacoes                    ?status=&tipo=&id_docente=  resumo (view vw_resumo_avaliacao)
 *   GET   /api/avaliacoes/teto-colaboradores ranking do Art. 8º sobre o corpo docente atual
 *   GET   /api/avaliacoes/:id                processo + cálculo com o que foi desmarcado
 *   POST  /api/avaliacoes                    { id_docente, tipo? }      abre o processo e grava o cálculo
 *   POST  /api/avaliacoes/lote               { ids_docentes: [], tipo? } abertura em lote (resultado por docente)
 *   POST  /api/avaliacoes/:id/recalcular     refaz o cálculo (ex.: depois de importar ou revisar)
 *   PATCH /api/avaliacoes/:id/publicacoes/:idPublicacao  { considerada }  desmarcar/remarcar (RF13)
 *   PATCH /api/avaliacoes/:id                { status, valido_ate?, vinculo? }  tramitação
 *            DEFERIDO/INDEFERIDO só pela coordenação; deferir um credenciamento exige o vínculo.
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { exigirPerfil, PERFIS } = require("../../middlewares/autenticacao");
const { Erros } = require("../../lib/erros");
const { data, paramsId, id } = require("../cadastros/comum");
const { criarServicoCalculo } = require("./calculo.servico");

const TIPOS = ["CREDENCIAMENTO", "RECREDENCIAMENTO"];

const esquemaCalculo = z
  .object({
    tipo: z.enum(TIPOS).optional(),
    inicio: z.coerce.number().int().min(1950).max(2100).optional(),
    fim: z.coerce.number().int().min(1950).max(2100).optional(),
    referencia: data.optional(),
  })
  .refine((q) => !q.inicio || !q.fim || q.inicio <= q.fim, "O ano inicial não pode ser maior que o final.");

/** Vigente na data: a resolução mais recente com vigência até hoje. */
async function resolucaoVigente(db) {
  const r = await db.resolucao.findFirst({ where: { data_vigencia: { lte: new Date() } }, orderBy: { data_vigencia: "desc" } });
  if (!r) throw Erros.regraDeNegocio("Nenhuma resolução vigente cadastrada.");
  return r;
}

function criarRotasCalculoDocente({ prisma }) {
  const servico = criarServicoCalculo({ prisma });
  const rotas = Router();
  rotas.get("/:id/calculo", validar({ params: paramsId, query: esquemaCalculo }), async (req, res) => {
    res.json(await servico.calcular(req.validado.params.id, req.validado.query));
  });
  return rotas;
}

function criarRotasAvaliacoes({ prisma }) {
  const servico = criarServicoCalculo({ prisma });
  const rotas = Router();

  async function abrir(idDocente, tipoPedido) {
    const docente = await prisma.docente.findUnique({ where: { id_docente: idDocente } });
    if (!docente) throw Erros.naoEncontrado("Docente não encontrado.");
    const tipo = tipoPedido ?? (docente.vinculo ? "RECREDENCIAMENTO" : "CREDENCIAMENTO");
    if (tipo === "RECREDENCIAMENTO" && !docente.vinculo) throw Erros.regraDeNegocio(`${docente.nome} não tem vínculo com o PPGI: o processo cabível é o credenciamento.`);
    if (tipo === "CREDENCIAMENTO" && docente.vinculo) throw Erros.regraDeNegocio(`${docente.nome} já é ${docente.vinculo.toLowerCase()} do PPGI: o processo cabível é o recredenciamento.`);
    const aberta = await prisma.avaliacao.findFirst({ where: { id_docente: idDocente, status: "EM_ANDAMENTO" } });
    if (aberta) throw Erros.conflito(`${docente.nome} já tem um processo em andamento (nº ${aberta.id_processo}).`);

    const resolucao = await resolucaoVigente(prisma);
    return prisma.$transaction(async (tx) => {
      const avaliacao = await tx.avaliacao.create({ data: { tipo, id_docente: idDocente, id_resolucao: resolucao.id_resolucao } });
      const resultado = await servico.recalcularAvaliacao(avaliacao.id_processo, tx);
      return { id_processo: avaliacao.id_processo, ...resultado };
    }, { timeout: 60_000 });
  }

  rotas.get(
    "/",
    validar({
      query: z.object({
        status: z.enum(["EM_ANDAMENTO", "DEFERIDO", "INDEFERIDO", "CANCELADO"]).optional(),
        tipo: z.enum(TIPOS).optional(),
        id_docente: id.optional(),
      }),
    }),
    async (req, res) => {
      const { status, tipo, id_docente: idDocente } = req.validado.query;
      const linhas = await prisma.$queryRaw`
        SELECT v.*, a.data_solicitacao, a.pontuacao_pesquisa, a.valido_ate, a.status_relatorio
          FROM vw_resumo_avaliacao v JOIN avaliacao a ON a.id_processo = v.id_processo
         WHERE (${status ?? null}::text IS NULL OR v.status::text = ${status ?? null})
           AND (${tipo ?? null}::text IS NULL OR v.tipo::text = ${tipo ?? null})
           AND (${idDocente ?? null}::int IS NULL OR v.id_docente = ${idDocente ?? null})
         ORDER BY a.data_solicitacao DESC, v.id_processo DESC`;
      res.json(linhas.map((l) => ({ ...l, publicacoes_consideradas: Number(l.publicacoes_consideradas), publicacoes_desmarcadas: Number(l.publicacoes_desmarcadas), pontos_calculados: Number(l.pontos_calculados) })));
    },
  );

  rotas.get("/teto-colaboradores", async (_req, res) => {
    res.json(await servico.tetoColaboradores());
  });

  rotas.get("/:id", validar({ params: paramsId }), async (req, res) => {
    const avaliacao = await prisma.avaliacao.findUnique({
      where: { id_processo: req.validado.params.id },
      include: { publicacoes: true, resolucao: true, docente: { select: { nome: true } } },
    });
    if (!avaliacao) throw Erros.naoEncontrado("Avaliação não encontrada.");
    const consideradas = new Map(avaliacao.publicacoes.map((ap) => [ap.id_publicacao, ap.considerada]));
    const calculo = await servico.calcular(
      avaliacao.id_docente,
      { tipo: avaliacao.tipo, referencia: new Date(avaliacao.data_solicitacao) },
      { idResolucao: avaliacao.id_resolucao, consideradas },
    );
    const { publicacoes, ...processo } = avaliacao;
    res.json({ ...processo, calculo });
  });

  rotas.post("/", validar({ body: z.object({ id_docente: id, tipo: z.enum(TIPOS).optional() }) }), async (req, res) => {
    res.status(201).json(await abrir(req.validado.body.id_docente, req.validado.body.tipo));
  });

  rotas.post("/lote", validar({ body: z.object({ ids_docentes: z.array(id).min(1).max(200), tipo: z.enum(TIPOS).optional() }) }), async (req, res) => {
    const resultados = [];
    for (const idDocente of [...new Set(req.validado.body.ids_docentes)]) {
      try {
        const r = await abrir(idDocente, req.validado.body.tipo);
        resultados.push({ id_docente: idDocente, status: "ABERTO", id_processo: r.id_processo, apto: r.apto, pontuacao: r.pesquisa.total });
      } catch (erro) {
        if (!erro.status) throw erro;
        resultados.push({ id_docente: idDocente, status: "FALHA", erro: erro.message });
      }
    }
    res.status(207).json({ resultados });
  });

  rotas.post("/:id/recalcular", validar({ params: paramsId }), async (req, res) => {
    const avaliacao = await prisma.avaliacao.findUnique({ where: { id_processo: req.validado.params.id } });
    if (!avaliacao) throw Erros.naoEncontrado("Avaliação não encontrada.");
    if (avaliacao.status !== "EM_ANDAMENTO") throw Erros.regraDeNegocio("Só processos em andamento podem ser recalculados.");
    res.json(await prisma.$transaction((tx) => servico.recalcularAvaliacao(avaliacao.id_processo, tx), { timeout: 60_000 }));
  });

  rotas.patch(
    "/:id/publicacoes/:idPublicacao",
    validar({ params: paramsId.extend({ idPublicacao: id }), body: z.object({ considerada: z.boolean() }) }),
    async (req, res) => {
      const { id: idProcesso, idPublicacao } = req.validado.params;
      const avaliacao = await prisma.avaliacao.findUnique({ where: { id_processo: idProcesso } });
      if (!avaliacao) throw Erros.naoEncontrado("Avaliação não encontrada.");
      if (avaliacao.status !== "EM_ANDAMENTO") throw Erros.regraDeNegocio("O processo já foi encerrado.");
      const { count } = await prisma.avaliacaoPublicacao.updateMany({
        where: { id_processo: idProcesso, id_publicacao: idPublicacao },
        data: { considerada: req.validado.body.considerada },
      });
      if (!count) throw Erros.naoEncontrado("Esta publicação não faz parte da avaliação.");
      res.json(await prisma.$transaction((tx) => servico.recalcularAvaliacao(idProcesso, tx), { timeout: 60_000 }));
    },
  );

  rotas.patch(
    "/:id",
    validar({
      params: paramsId,
      body: z.object({
        status: z.enum(["DEFERIDO", "INDEFERIDO", "CANCELADO"]),
        valido_ate: data.optional(),
        vinculo: z.enum(["PERMANENTE", "COLABORADOR"]).optional(),
      }),
    }),
    async (req, res, next) => {
      if (req.validado.body.status !== "CANCELADO") return exigirPerfil(PERFIS.COORDENACAO)(req, res, next);
      return next();
    },
    async (req, res) => {
      const { id: idProcesso } = req.validado.params;
      const { status, valido_ate: validoAte, vinculo } = req.validado.body;
      const avaliacao = await prisma.avaliacao.findUnique({ where: { id_processo: idProcesso }, include: { docente: true } });
      if (!avaliacao) throw Erros.naoEncontrado("Avaliação não encontrada.");
      if (avaliacao.status !== "EM_ANDAMENTO") throw Erros.regraDeNegocio(`O processo já está ${avaliacao.status.toLowerCase().replace("_", " ")}.`);
      if (validoAte && status !== "DEFERIDO") throw Erros.requisicaoInvalida("Só processos deferidos têm data de validade.");
      if (status === "DEFERIDO" && avaliacao.tipo === "CREDENCIAMENTO" && !vinculo) {
        throw Erros.requisicaoInvalida("Para deferir um credenciamento, informe o vínculo (PERMANENTE ou COLABORADOR).");
      }

      const atualizada = await prisma.$transaction(async (tx) => {
        if (status === "DEFERIDO" && avaliacao.tipo === "CREDENCIAMENTO") {
          await tx.docente.update({ where: { id_docente: avaliacao.id_docente }, data: { vinculo, data_vinculo: new Date(new Date().toISOString().slice(0, 10)) } });
        }
        return tx.avaliacao.update({ where: { id_processo: idProcesso }, data: { status, valido_ate: validoAte ?? null } });
      });
      res.json(atualizada);
    },
  );

  return rotas;
}

module.exports = { criarRotasAvaliacoes, criarRotasCalculoDocente };
