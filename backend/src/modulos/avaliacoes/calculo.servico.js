/*
 * Carrega do banco o que o motor de cálculo precisa e grava o resultado nas avaliações.
 * As regras ficam em src/dominio/motor-barema.js.
 */
const { Erros } = require("../../lib/erros");
const { carregarParametros } = require("../../dominio/parametros-resolucao-1-2025");
const { avaliar, aplicarTetoColaboradores } = require("../../dominio/motor-barema");
const { estratoVigente, AREA_PADRAO } = require("../qualis/qualis.servico");

const incluirAutor = { autor: { include: { docente: { select: { id_docente: true, nome: true, vinculo: true } }, discente: { select: { nome: true } }, externo: { select: { nome: true } } } } };

/** Docente + produção + orientações + turmas no formato do motor. */
async function carregarDados(db, idDocente, { consideradas } = {}) {
  const docente = await db.docente.findUnique({ where: { id_docente: idDocente }, include: { autor: true } });
  if (!docente) throw Erros.naoEncontrado("Docente não encontrado.");

  const publicacoes = docente.autor
    ? await db.publicacao.findMany({
        where: { id_mesclada_em: null, autorias: { some: { id_autor: docente.autor.id_autor } } },
        orderBy: [{ ano_publicacao: "desc" }, { titulo: "asc" }],
        include: { veiculo: { include: { estratos: true } }, autorias: { orderBy: { ordem_autoria: "asc" }, include: incluirAutor } },
      })
    : [];

  const [orientandos, coorientacoes, turmas] = await Promise.all([
    db.discente.findMany({ where: { id_orientador: idDocente } }),
    db.coorientacao.findMany({ where: { id_docente: idDocente }, include: { discente: true } }),
    db.turma.findMany({ where: { id_docente: idDocente }, include: { disciplina: true } }),
  ]);

  const doDiscente = (d) => ({ id_discente: d.id_discente, nome: d.nome, ano_ingresso: d.ano_ingresso, data_conclusao: d.data_conclusao });
  return {
    docente,
    publicacoes: publicacoes.map((p) => {
      const vigente = p.veiculo ? estratoVigente(p.veiculo.estratos, AREA_PADRAO) : null;
      return {
        id_publicacao: p.id_publicacao,
        titulo: p.titulo,
        ano: p.ano_publicacao,
        veiculo: p.veiculo?.nome ?? null,
        tipo_veiculo: p.veiculo?.tipo ?? "PERIODICO",
        estrato: vigente?.estrato ?? null,
        fonte_estrato: vigente?.fonte ?? null,
        considerada: consideradas?.get(p.id_publicacao) ?? true,
        autores: p.autorias.map(({ autor: a }) => ({
          tipo: a.tipo,
          id_docente: a.docente?.id_docente,
          nome: a.docente?.nome ?? a.discente?.nome ?? a.externo?.nome ?? a.nome_citacao,
          ppgi: Boolean(a.docente?.vinculo),
          avaliado: a.docente?.id_docente === idDocente,
        })),
      };
    }),
    orientacoes: orientandos.map(doDiscente),
    coorientacoes: coorientacoes.map((c) => doDiscente(c.discente)),
    turmas: turmas.map((t) => ({
      ano: t.ano,
      semestre: t.semestre,
      codigo: t.disciplina.codigo,
      nome: t.disciplina.nome,
      nivel: t.disciplina.nivel,
      estudo_dirigido: t.disciplina.estudo_dirigido,
    })),
  };
}

function criarServicoCalculo({ prisma }) {
  /** Cálculo "ao vivo", sem gravar nada (tela de cálculo/verificação). */
  async function calcular(idDocente, opcoes = {}, { idResolucao, consideradas } = {}) {
    const { resolucao, valores } = await carregarParametros(prisma, idResolucao);
    const dados = await carregarDados(prisma, idDocente, { consideradas });
    const resultado = avaliar(dados, opcoes, valores);
    return { ...resultado, resolucao: resolucao ? { id_resolucao: resolucao.id_resolucao, numero_ano: resolucao.numero_ano } : null };
  }

  /** Recalcula uma avaliação aberta respeitando o que foi desmarcado, e grava o resultado. */
  async function recalcularAvaliacao(idProcesso, tx = prisma) {
    const avaliacao = await tx.avaliacao.findUnique({ where: { id_processo: idProcesso }, include: { publicacoes: true } });
    if (!avaliacao) throw Erros.naoEncontrado("Avaliação não encontrada.");
    const consideradas = new Map(avaliacao.publicacoes.map((ap) => [ap.id_publicacao, ap.considerada]));
    const resultado = await calcular(
      avaliacao.id_docente,
      { tipo: avaliacao.tipo, referencia: new Date(avaliacao.data_solicitacao) },
      { idResolucao: avaliacao.id_resolucao, consideradas },
    );

    await tx.avaliacaoPublicacao.deleteMany({
      where: { id_processo: idProcesso, id_publicacao: { notIn: resultado.pesquisa.linhas.map((l) => l.id_publicacao) } },
    });
    for (const l of resultado.pesquisa.linhas) {
      await tx.avaliacaoPublicacao.upsert({
        where: { id_processo_id_publicacao: { id_processo: idProcesso, id_publicacao: l.id_publicacao } },
        create: { id_processo: idProcesso, id_publicacao: l.id_publicacao, considerada: l.considerada, pontos_atribuidos: l.pontos },
        update: { pontos_atribuidos: l.pontos },
      });
    }
    const atendido = (codigo) => resultado.requisitos.find((r) => r.codigo === codigo)?.atendido;
    await tx.avaliacao.update({
      where: { id_processo: idProcesso },
      data: {
        pontuacao_pesquisa: resultado.pesquisa.total,
        possui_coautoria_discente: resultado.pesquisa.com_discente > 0,
        cumpriu_orientacao: resultado.orientacao ? (resultado.orientacao.isento ? true : atendido("ORIENTACAO_MINIMA")) : null,
        cumpriu_docencia: resultado.docencia ? (resultado.docencia.isento ? true : atendido("DOCENCIA_MINIMA")) : null,
      },
    });
    return resultado;
  }

  /** Teto de colaboradores (Art. 8º) sobre o cálculo ao vivo de todo o corpo docente. */
  async function tetoColaboradores() {
    const { valores } = await carregarParametros(prisma);
    const docentes = await prisma.docente.findMany({ where: { vinculo: { not: null }, data_recusa_participacao: null }, select: { id_docente: true } });
    const resultados = [];
    for (const d of docentes) resultados.push(await calcular(d.id_docente, { tipo: "RECREDENCIAMENTO" }));
    return aplicarTetoColaboradores(resultados, valores);
  }

  return { calcular, recalcularAvaliacao, tetoColaboradores };
}

module.exports = { criarServicoCalculo, carregarDados };
