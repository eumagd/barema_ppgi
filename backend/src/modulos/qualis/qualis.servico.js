/*
 * Carga versionada das bases Qualis (RF-BE04, RNF-BE05) e escolha do estrato vigente.
 *
 * Cada carga substitui os estratos anteriores da mesma fonte, ano-base e área,
 * fica registrada em `importacao` e é idempotente pelo hash do arquivo (RNF-BE02).
 * Como a classificação é sempre consultada na hora, uma nova carga reclassifica a
 * base inteira sem reabrir os currículos.
 */
const crypto = require("node:crypto");
const { lerCsv } = require("../../lib/csv");
const { Erros } = require("../../lib/erros");
const { normalizarIssn, normalizarSigla, normalizarTexto } = require("../../lib/texto");
const { PESOS_ESTRATO } = require("../../dominio/parametros-resolucao-1-2025");
const { FORMATOS, ESTRATOS, estratoDoPercentil, lerEstrato } = require("./formatos");

const AREA_PADRAO = "Ciência da Computação";
const MAX_ERROS_GUARDADOS = 200;
const LOTE = 5000;

/** Ordem hierárquica de busca (RF-BE04): CAPES → PUC-RS → Scopus; eventos pela tabela da SBC; manual por último. */
const PRIORIDADE_FONTE = { CAPES: 1, PUC_RS: 2, SCOPUS: 3, EVENTOS: 4, MANUAL: 5 };

/** Entre os estratos de um veículo, o da fonte de maior prioridade e, nela, o ano-base mais recente. */
function estratoVigente(estratos, area = AREA_PADRAO) {
  const alvo = normalizarTexto(area);
  const daArea = estratos.filter((e) => normalizarTexto(e.area_de_atuacao) === alvo);
  const ordenados = [...daArea].sort(
    (a, b) => PRIORIDADE_FONTE[a.fonte] - PRIORIDADE_FONTE[b.fonte] || b.ano_base - a.ano_base,
  );
  return ordenados[0] || null;
}

const ordemEstrato = (e) => ESTRATOS.indexOf(e);

/** Transforma as linhas do CSV em itens { chaves, nome, estrato }, acumulando erros por linha. */
function interpretarLinhas(formato, linhas, area) {
  const itens = new Map();
  const erros = [];
  const contagem = { linhas: linhas.length, validas: 0, outras_areas: 0, sem_estrato: 0, invalidas: 0, repetidas: 0 };
  const areaAlvo = normalizarTexto(area);

  for (const { numero, campos } of linhas) {
    if (campos.area !== undefined && campos.area !== "" && normalizarTexto(campos.area) !== areaAlvo) {
      contagem.outras_areas++;
      continue;
    }

    const estrato = lerEstrato(campos.estrato) || (campos.percentil ? estratoDoPercentil(campos.percentil) : null);
    if (!estrato) {
      contagem.sem_estrato++;
      erros.push({ linha: numero, motivo: `Estrato ausente ou inválido ("${campos.estrato ?? campos.percentil ?? ""}").` });
      continue;
    }

    let chaves;
    if (formato.tipo === "PERIODICO") {
      chaves = [campos.issn, campos.issn2].map(normalizarIssn).filter(Boolean);
      if (!chaves.length) {
        contagem.invalidas++;
        erros.push({ linha: numero, motivo: `ISSN inválido ("${campos.issn ?? ""}").` });
        continue;
      }
    } else {
      const sigla = normalizarSigla(campos.sigla);
      if (!sigla) {
        contagem.invalidas++;
        erros.push({ linha: numero, motivo: "Sigla do evento ausente." });
        continue;
      }
      chaves = [sigla.slice(0, 30)];
    }

    contagem.validas++;
    const nome = (campos.titulo || campos.nome || chaves[0]).slice(0, 255);
    for (const chave of new Set(chaves)) {
      const anterior = itens.get(chave);
      if (anterior) {
        contagem.repetidas++;
        // Mesmo veículo repetido no arquivo: fica o melhor estrato.
        if (ordemEstrato(estrato) < ordemEstrato(anterior.estrato)) anterior.estrato = estrato;
        continue;
      }
      itens.set(chave, { chave, nome, estrato });
    }
  }

  return { itens: [...itens.values()], erros, contagem };
}

function emLotes(lista, tamanho = LOTE) {
  const lotes = [];
  for (let i = 0; i < lista.length; i += tamanho) lotes.push(lista.slice(i, i + tamanho));
  return lotes;
}

function criarServicoQualis({ prisma }) {
  /** Pesos da resolução vigente mais recente; se não houver, os da Resolução nº 1/2025. */
  async function obterPesos() {
    const parametro = await prisma.parametro.findFirst({
      where: { chave: "pesos_estrato" },
      orderBy: { resolucao: { data_vigencia: "desc" } },
    });
    return parametro ? parametro.valor : PESOS_ESTRATO;
  }

  async function carregar({ buffer, nomeArquivo, fonte, anoBase, area = AREA_PADRAO, idUsuario }) {
    const formato = FORMATOS[fonte];
    if (!formato) throw Erros.requisicaoInvalida(`Fonte "${fonte}" inválida. Use: ${Object.keys(FORMATOS).join(", ")}.`);

    const hash = crypto.createHash("sha256").update(buffer).digest("hex");
    const anterior = await prisma.importacao.findFirst({
      where: { fonte: formato.fonteImportacao, hash_arquivo: hash, status: "CONCLUIDO" },
      orderBy: { criado_em: "desc" },
    });
    if (anterior && anterior.contagens?.ano_base === anoBase && normalizarTexto(anterior.contagens?.area) === normalizarTexto(area)) {
      return { carga: anterior, reaproveitada: true };
    }

    // Valida o arquivo antes de registrar a carga: cabeçalho errado não vira lixo no histórico.
    const { linhas, codificacao, delimitador } = lerCsv(buffer, formato);
    const { itens, erros, contagem } = interpretarLinhas(formato, linhas, area);
    const meta = { ano_base: anoBase, area, codificacao, delimitador, ...contagem };

    const carga = await prisma.importacao.create({
      data: {
        fonte: formato.fonteImportacao,
        nome_arquivo: nomeArquivo.slice(0, 255),
        hash_arquivo: hash,
        status: "PROCESSANDO",
        id_usuario: idUsuario ?? null,
        iniciado_em: new Date(),
      },
    });

    if (!itens.length) {
      const falha = await prisma.importacao.update({
        where: { id_importacao: carga.id_importacao },
        data: {
          status: "FALHA",
          contagens: meta,
          erros: { mensagem: "Nenhuma linha válida para a área informada.", linhas: erros.slice(0, MAX_ERROS_GUARDADOS) },
          finalizado_em: new Date(),
        },
      });
      throw Erros.regraDeNegocio(`Nenhuma linha válida para a área "${area}". Confira a área e o arquivo.`, { carga: falha });
    }

    try {
      const pesos = await obterPesos();
      const fonteQualis = fonte;
      const substituidos = await prisma.$transaction(
        async (tx) => {
          for (const lote of emLotes(itens)) {
            await tx.veiculo.createMany({
              data: lote.map((i) => ({ nome: i.nome, issn_sigla: i.chave, tipo: formato.tipo })),
              skipDuplicates: true,
            });
          }

          const idPorChave = new Map();
          for (const lote of emLotes(itens)) {
            const veiculos = await tx.veiculo.findMany({
              where: { tipo: formato.tipo, issn_sigla: { in: lote.map((i) => i.chave) } },
              select: { id_veiculo: true, issn_sigla: true },
            });
            veiculos.forEach((v) => idPorChave.set(v.issn_sigla, v.id_veiculo));
          }

          const { count } = await tx.estratoQualis.deleteMany({
            where: { fonte: fonteQualis, ano_base: anoBase, area_de_atuacao: area },
          });

          // Dois ISSNs (impresso e eletrônico) do mesmo veículo já cadastrado não podem gerar linhas repetidas.
          const linhasEstrato = new Map();
          for (const i of itens) {
            const id = idPorChave.get(i.chave);
            if (id && !linhasEstrato.has(id)) {
              linhasEstrato.set(id, {
                id_veiculo: id,
                ano_base: anoBase,
                area_de_atuacao: area,
                fonte: fonteQualis,
                estrato: i.estrato,
                pontuacao: pesos[i.estrato] ?? 0,
                id_importacao: carga.id_importacao,
              });
            }
          }
          for (const lote of emLotes([...linhasEstrato.values()])) await tx.estratoQualis.createMany({ data: lote });
          return count;
        },
        { timeout: 120_000 },
      );

      const concluida = await prisma.importacao.update({
        where: { id_importacao: carga.id_importacao },
        data: {
          status: "CONCLUIDO",
          contagens: { ...meta, veiculos: itens.length, estratos_substituidos: substituidos },
          erros: erros.length ? { total: erros.length, linhas: erros.slice(0, MAX_ERROS_GUARDADOS) } : undefined,
          finalizado_em: new Date(),
        },
      });
      return { carga: concluida, reaproveitada: false };
    } catch (erro) {
      await prisma.importacao.update({
        where: { id_importacao: carga.id_importacao },
        data: { status: "FALHA", erros: { mensagem: String(erro.message).slice(0, 1000) }, finalizado_em: new Date() },
      });
      throw erro;
    }
  }

  function listarCargas() {
    return prisma.importacao.findMany({
      where: { fonte: { in: Object.values(FORMATOS).map((f) => f.fonteImportacao) } },
      orderBy: { criado_em: "desc" },
      include: { usuario: { select: { nome: true } } },
    });
  }

  /** Busca veículos por nome, ISSN ou sigla, com todos os estratos e o vigente. */
  async function buscarVeiculos({ busca, tipo, area = AREA_PADRAO, limite = 50 }) {
    const termo = busca?.trim();
    const issn = normalizarIssn(termo);
    const where = {
      ...(tipo ? { tipo } : {}),
      ...(termo
        ? {
            OR: [
              { nome: { contains: termo, mode: "insensitive" } },
              { issn_sigla: { equals: issn || normalizarSigla(termo) } },
            ],
          }
        : {}),
    };
    const veiculos = await prisma.veiculo.findMany({
      where,
      take: limite,
      orderBy: { nome: "asc" },
      include: { estratos: { orderBy: [{ ano_base: "desc" }] } },
    });
    return veiculos.map((v) => ({ ...v, estrato_vigente: estratoVigente(v.estratos, area) }));
  }

  return { carregar, listarCargas, buscarVeiculos };
}

module.exports = { criarServicoQualis, estratoVigente, interpretarLinhas, AREA_PADRAO, PRIORIDADE_FONTE };
