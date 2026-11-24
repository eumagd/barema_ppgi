/*
 * Resoluções e parâmetros versionados (RNF-BE05):
 *   GET /api/resolucoes                              → resoluções cadastradas
 *   GET /api/resolucoes/:id/parametros               → { chave: { valor, descricao } }
 *   PUT /api/resolucoes/:id/parametros/:chave        { valor } (só COORDENACAO)
 */
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { autenticar, exigirPerfil, PERFIS } = require("../../middlewares/autenticacao");
const { Erros } = require("../../lib/erros");

const ESTRATOS = ["A1", "A2", "A3", "A4", "B1", "B2", "B3", "B4", "C"];
const naoNegativo = z.number().min(0);
const meses = z.number().int().min(1).max(120);
const nota = z.number().min(0).max(100);
const minimoPorEstrato = z.object({ quantidade: z.number().int().min(0), estrato_minimo: z.enum(ESTRATOS) });

/** Formato aceito para cada chave conhecida; chaves fora daqui não podem ser alteradas pela API. */
const FORMATOS = {
  pesos_estrato: z.object(Object.fromEntries(ESTRATOS.map((e) => [e, naoNegativo]))).strict(),
  "pesquisa.janela_meses": meses,
  "credenciamento.pontuacao_minima": naoNegativo,
  "credenciamento.periodicos_minimos": minimoPorEstrato,
  "recredenciamento.pontuacao_minima": naoNegativo,
  "recredenciamento.periodicos_minimos": minimoPorEstrato,
  "recredenciamento.coautoria_discente_minima": z.number().int().min(0),
  "orientacao.janela_meses": meses,
  "orientacao.minimo": naoNegativo,
  "orientacao.peso_coorientacao": z.number().min(0).max(1),
  "orientacao.teto_permanente": z.number().int().min(1),
  "docencia.janela_meses": meses,
  "docencia.minimo_disciplinas": z.number().int().min(0),
  "recem_credenciado.meses": meses,
  "progressao_colaborador.meses_vinculo": meses,
  "colaboradores.teto_percentual": z.number().min(0).max(100),
  "fuzzy.corte_confirmacao": nota,
  "fuzzy.corte_revisao": nota,
  "fuzzy.janela_ano": z.number().int().min(0).max(5),
};

const params = z.object({ id: z.coerce.number().int().positive() });
const paramsChave = params.extend({ chave: z.string() });
const corpo = z.object({ valor: z.unknown() });

function criarRotasParametros({ prisma }) {
  const rotas = Router();
  rotas.use(autenticar);

  async function exigirResolucao(id) {
    const resolucao = await prisma.resolucao.findUnique({ where: { id_resolucao: id } });
    if (!resolucao) throw Erros.naoEncontrado("Resolução não encontrada.");
    return resolucao;
  }

  rotas.get("/", async (_req, res) => {
    res.json(await prisma.resolucao.findMany({ orderBy: { data_vigencia: "desc" } }));
  });

  rotas.get("/:id/parametros", validar({ params }), async (req, res) => {
    const { id } = req.validado.params;
    await exigirResolucao(id);
    const lista = await prisma.parametro.findMany({ where: { id_resolucao: id }, orderBy: { chave: "asc" } });
    res.json(Object.fromEntries(lista.map((p) => [p.chave, { valor: p.valor, descricao: p.descricao }])));
  });

  rotas.put(
    "/:id/parametros/:chave",
    exigirPerfil(PERFIS.COORDENACAO),
    validar({ params: paramsChave, body: corpo }),
    async (req, res) => {
      const { id, chave } = req.validado.params;
      const formato = FORMATOS[chave];
      if (!formato) throw Erros.naoEncontrado(`Parâmetro "${chave}" não existe.`);
      const valor = formato.parse(req.validado.body.valor);

      await exigirResolucao(id);
      if (chave.startsWith("fuzzy.corte_")) await validarCortesFuzzy(prisma, id, chave, valor);

      const atualizado = await prisma.parametro.update({
        where: { id_resolucao_chave: { id_resolucao: id, chave } },
        data: { valor },
      });
      res.json({ chave: atualizado.chave, valor: atualizado.valor, descricao: atualizado.descricao });
    },
  );

  return rotas;
}

/** O corte de revisão não pode ficar acima do corte de confirmação automática. */
async function validarCortesFuzzy(prisma, id, chave, valor) {
  const outra = chave === "fuzzy.corte_confirmacao" ? "fuzzy.corte_revisao" : "fuzzy.corte_confirmacao";
  const atual = await prisma.parametro.findUnique({ where: { id_resolucao_chave: { id_resolucao: id, chave: outra } } });
  if (!atual) return;
  const confirmacao = chave === "fuzzy.corte_confirmacao" ? valor : Number(atual.valor);
  const revisao = chave === "fuzzy.corte_revisao" ? valor : Number(atual.valor);
  if (revisao > confirmacao) {
    throw Erros.regraDeNegocio(`O corte de revisão (${revisao}) não pode ser maior que o de confirmação automática (${confirmacao}).`);
  }
}

module.exports = { criarRotasParametros, FORMATOS };
