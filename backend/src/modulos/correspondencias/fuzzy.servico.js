/*
 * Fuzzy Match de publicações no PostgreSQL (RF-BE07 a RF-BE10), sem bibliotecas externas.
 *
 * Para cada publicação, procura candidatas (outras publicações ainda não mescladas e
 * sem autor em comum) e dá uma nota de 0 a 100, nesta ordem:
 *   1. DOI idêntico                                        → 100 (motivo DOI)
 *   2. mesmo veículo e título igual (inteiro ou sem subtítulo) → 100 (ISSN_TITULO)
 *   3. similaridade de trigramas do título (pg_trgm), mesmo tipo de veículo e ano ±janela
 *      → maior entre o título inteiro e o título sem subtítulo (SIMILARIDADE_TITULO)
 * Faixas (tabela `parametro`, ajustáveis): ≥ corte_confirmacao mescla automaticamente;
 * entre corte_revisao e corte_confirmacao vai para a fila de revisão; abaixo, descarta.
 *
 * Mesclar = mover as autorias da publicação mais nova para a mais antiga e marcar a nova
 * com id_mesclada_em. O que foi movido fica em correspondencia.autores_movidos, para
 * desfazer se a decisão mudar.
 */
const { Prisma } = require("@prisma/client");
const { Erros } = require("../../lib/erros");

const PADROES = { "fuzzy.corte_confirmacao": 92, "fuzzy.corte_revisao": 80, "fuzzy.janela_ano": 1 };

async function obterCortes(db) {
  const lista = await db.parametro.findMany({
    where: { chave: { in: Object.keys(PADROES) } },
    orderBy: { resolucao: { data_vigencia: "desc" } },
  });
  const valor = (chave) => Number(lista.find((p) => p.chave === chave)?.valor ?? PADROES[chave]);
  return { confirmacao: valor("fuzzy.corte_confirmacao"), revisao: valor("fuzzy.corte_revisao"), janelaAno: valor("fuzzy.janela_ano") };
}

/** Candidatas de uma publicação, já com nota e motivo, da maior para a menor nota. */
async function buscarCandidatas(db, idPublicacao, { revisao, janelaAno }) {
  return db.$queryRaw`
    WITH p AS (
      SELECT p.id_publicacao, p.doi, p.ano_publicacao, p.id_veiculo, p.titulo_normalizado,
             fn_titulo_sem_subtitulo(p.titulo) AS sem_sub, coalesce(v.tipo::text, 'PERIODICO') AS tipo
        FROM publicacao p LEFT JOIN veiculo v ON v.id_veiculo = p.id_veiculo
       WHERE p.id_publicacao = ${idPublicacao} AND p.id_mesclada_em IS NULL
    ),
    c AS (
      SELECT c.id_publicacao,
             CASE
               WHEN p.doi IS NOT NULL AND lower(c.doi) = lower(p.doi) THEN 'DOI'
               WHEN c.id_veiculo = p.id_veiculo
                    AND (c.titulo_normalizado = p.titulo_normalizado OR fn_titulo_sem_subtitulo(c.titulo) = p.sem_sub)
                 THEN 'ISSN_TITULO'
               ELSE 'SIMILARIDADE_TITULO'
             END AS motivo,
             greatest(similarity(c.titulo_normalizado, p.titulo_normalizado),
                      similarity(fn_titulo_sem_subtitulo(c.titulo), p.sem_sub)) AS similaridade
        FROM p
        JOIN publicacao c ON c.id_publicacao <> p.id_publicacao AND c.id_mesclada_em IS NULL
        LEFT JOIN veiculo cv ON cv.id_veiculo = c.id_veiculo
       WHERE ( (p.doi IS NOT NULL AND lower(c.doi) = lower(p.doi))
            OR ( coalesce(cv.tipo::text, 'PERIODICO') = p.tipo
                 AND abs(c.ano_publicacao - p.ano_publicacao) <= ${janelaAno}
                 AND c.titulo_normalizado % p.titulo_normalizado ) )
         -- Duas obras do mesmo autor com títulos parecidos são, em geral, obras diferentes.
         AND NOT EXISTS (
               SELECT 1 FROM autoria a1 JOIN autoria a2 ON a2.id_autor = a1.id_autor
                WHERE a1.id_publicacao = p.id_publicacao AND a2.id_publicacao = c.id_publicacao)
    )
    SELECT id_publicacao,
           motivo,
           CASE WHEN motivo IN ('DOI', 'ISSN_TITULO') THEN 100 ELSE round((similaridade * 100)::numeric, 2) END AS nota
      FROM c
     WHERE motivo IN ('DOI', 'ISSN_TITULO') OR similaridade * 100 >= ${revisao}
     ORDER BY nota DESC, id_publicacao`;
}

/** Segue a cadeia de mesclas até a publicação que ficou valendo. */
async function publicacaoVigente(db, idPublicacao) {
  let atual = await db.publicacao.findUnique({ where: { id_publicacao: idPublicacao } });
  for (let i = 0; atual?.id_mesclada_em && i < 20; i++) {
    atual = await db.publicacao.findUnique({ where: { id_publicacao: atual.id_mesclada_em } });
  }
  return atual;
}

/** Move as autorias de `origem` para `destino`. Devolve o que estava na origem, para desfazer. */
async function mesclar(tx, idOrigem, idDestino) {
  const [origem, destino] = await Promise.all([
    tx.publicacao.findUnique({ where: { id_publicacao: idOrigem }, include: { autorias: true } }),
    tx.publicacao.findUnique({ where: { id_publicacao: idDestino }, include: { autorias: true } }),
  ]);
  if (!origem || !destino) throw Erros.naoEncontrado("Publicação da correspondência não existe mais.");
  if (origem.id_mesclada_em || destino.id_mesclada_em) {
    throw Erros.conflito("Uma das publicações já foi mesclada em outra. Revise a correspondência mais recente.");
  }

  const autoresDestino = new Set(destino.autorias.map((a) => a.id_autor));
  let proximaOrdem = Math.max(0, ...destino.autorias.map((a) => a.ordem_autoria)) + 1;
  const registro = [];
  for (const a of origem.autorias) {
    await tx.autoria.delete({ where: { id_publicacao_id_autor: { id_publicacao: idOrigem, id_autor: a.id_autor } } });
    const movida = !autoresDestino.has(a.id_autor);
    if (movida) {
      await tx.autoria.create({ data: { id_publicacao: idDestino, id_autor: a.id_autor, ordem_autoria: proximaOrdem++ } });
    }
    registro.push({ id_autor: a.id_autor, ordem_autoria: a.ordem_autoria, movida });
  }

  // O DOI é único: tira da origem antes de passar para o destino.
  const doi = !destino.doi && origem.doi ? origem.doi : null;
  await tx.publicacao.update({ where: { id_publicacao: idOrigem }, data: { id_mesclada_em: idDestino, ...(doi ? { doi: null } : {}) } });
  if (doi) await tx.publicacao.update({ where: { id_publicacao: idDestino }, data: { doi } });
  // Quem já estava mesclado na origem passa a apontar para o destino.
  await tx.publicacao.updateMany({ where: { id_mesclada_em: idOrigem }, data: { id_mesclada_em: idDestino } });
  return { autorias: registro, doi_movido: Boolean(doi) };
}

/** Desfaz uma mescla a partir do registro guardado na correspondência. */
async function desfazerMescla(tx, correspondencia) {
  const { id_publicacao: idOrigem, id_publicacao_candidata: idDestino } = correspondencia;
  const movidos = correspondencia.autores_movidos || { autorias: [] };
  const origem = await tx.publicacao.findUnique({ where: { id_publicacao: idOrigem } });
  if (origem?.id_mesclada_em !== idDestino) {
    throw Erros.conflito("Esta mescla já foi alterada por outra decisão e não pode ser desfeita automaticamente.");
  }
  for (const a of movidos.autorias) {
    if (a.movida) {
      await tx.autoria.deleteMany({ where: { id_publicacao: idDestino, id_autor: a.id_autor } });
    }
    await tx.autoria.create({ data: { id_publicacao: idOrigem, id_autor: a.id_autor, ordem_autoria: a.ordem_autoria } });
  }
  let doi;
  if (movidos.doi_movido) {
    const destino = await tx.publicacao.findUnique({ where: { id_publicacao: idDestino } });
    doi = destino.doi;
    await tx.publicacao.update({ where: { id_publicacao: idDestino }, data: { doi: null } });
  }
  await tx.publicacao.update({ where: { id_publicacao: idOrigem }, data: { id_mesclada_em: null, ...(doi ? { doi } : {}) } });
}

function criarServicoFuzzy({ prisma }) {
  /**
   * Roda o pipeline para as publicações indicadas (ou para todas). Cada par é avaliado
   * uma única vez: decisões anteriores, inclusive rejeições, são respeitadas.
   */
  async function processar(ids) {
    const cortes = await obterCortes(prisma);
    const alvos =
      ids ??
      (await prisma.publicacao.findMany({ where: { id_mesclada_em: null }, select: { id_publicacao: true }, orderBy: { id_publicacao: "asc" } })).map(
        (p) => p.id_publicacao,
      );
    const resumo = { analisadas: 0, mescladas_automaticamente: 0, para_revisao: 0 };

    for (const id of alvos) {
      const candidatas = await buscarCandidatas(prisma, id, cortes);
      resumo.analisadas++;
      for (const c of candidatas) {
        // A mais nova é a origem e a mais antiga fica valendo (ordem fixa: o par é único).
        const origem = Math.max(id, c.id_publicacao);
        const destino = Math.min(id, c.id_publicacao);
        const nota = Number(c.nota);
        const automatica = nota >= cortes.confirmacao;

        const criada = await prisma.$transaction(async (tx) => {
          const existente = await tx.correspondencia.findFirst({
            where: { tipo: "PUBLICACAO", id_publicacao: origem, id_publicacao_candidata: destino },
          });
          if (existente) return null;
          const [o, d] = await Promise.all([
            tx.publicacao.findUnique({ where: { id_publicacao: origem } }),
            tx.publicacao.findUnique({ where: { id_publicacao: destino } }),
          ]);
          if (o.id_mesclada_em || d.id_mesclada_em) return null;
          const movidos = automatica ? await mesclar(tx, origem, destino) : null;
          return tx.correspondencia.create({
            data: {
              tipo: "PUBLICACAO",
              id_publicacao: origem,
              id_publicacao_candidata: destino,
              nota,
              motivo: c.motivo,
              decisao: automatica ? "AUTOMATICA" : "PENDENTE",
              autores_movidos: movidos ?? undefined,
            },
          });
        });
        if (criada && automatica) resumo.mescladas_automaticamente++;
        else if (criada) resumo.para_revisao++;
        // Se esta publicação foi mesclada, as demais candidatas dela já não importam.
        if (criada && automatica && origem === id) break;
      }
    }
    return { ...resumo, cortes };
  }

  /** Decisão humana na fila de revisão (RF-BE11). */
  async function decidir(idCorrespondencia, { decisao, justificativa }, idUsuario) {
    return prisma.$transaction(async (tx) => {
      const c = await tx.correspondencia.findUnique({ where: { id_correspondencia: idCorrespondencia } });
      if (!c) throw Erros.naoEncontrado("Correspondência não encontrada.");
      if (c.tipo !== "PUBLICACAO") throw Erros.regraDeNegocio("Só correspondências de publicação podem ser decididas por esta rota.");

      const mesclada = c.decisao === "AUTOMATICA" || c.decisao === "CONFIRMADA";
      let autoresMovidos; // undefined = mantém o que está gravado
      if (decisao === "CONFIRMADA" && !mesclada) {
        autoresMovidos = await mesclar(tx, c.id_publicacao, c.id_publicacao_candidata);
      } else if (decisao === "REJEITADA" && mesclada) {
        await desfazerMescla(tx, c);
        autoresMovidos = Prisma.DbNull;
      }
      return tx.correspondencia.update({
        where: { id_correspondencia: idCorrespondencia },
        data: {
          decisao,
          justificativa: justificativa ?? c.justificativa,
          autores_movidos: autoresMovidos,
          id_usuario: idUsuario,
          decidido_em: new Date(),
        },
      });
    });
  }

  /**
   * DOI já cadastrado em outra publicação: a nova (gravada sem DOI, por causa do índice
   * único) é mesclada na existente, com a correspondência registrada (nota 100, motivo DOI).
   */
  async function mesclarPorDoi(idNova, idExistente) {
    return prisma.$transaction(async (tx) => {
      const movidos = await mesclar(tx, idNova, idExistente);
      return tx.correspondencia.create({
        data: {
          tipo: "PUBLICACAO",
          id_publicacao: Math.max(idNova, idExistente),
          id_publicacao_candidata: Math.min(idNova, idExistente),
          nota: 100,
          motivo: "DOI",
          decisao: "AUTOMATICA",
          autores_movidos: movidos,
        },
      });
    });
  }

  return { processar, decidir, mesclarPorDoi };
}

module.exports = { criarServicoFuzzy, publicacaoVigente, obterCortes, buscarCandidatas };
