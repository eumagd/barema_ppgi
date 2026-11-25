/*
 * Conector OpenAlex (Conector 2 do RF-BE18): importa a produção de um docente pela API aberta
 * do OpenAlex, sem CAPTCHA e sem scraper, para as mesmas tabelas do QLattes.
 *
 *  1. Acha o autor: pelo id_openalex do cadastro ou, na falta dele, pelo ORCID (e grava o id).
 *  2. Busca as obras desde um ano e ignora preprints/repositórios.
 *  3. Coautores: docentes pelo ORCID/ID do OpenAlex; os demais pelo nome (variações de citação,
 *     docentes, discentes e externos). Quem não existe é cadastrado como EXTERNO, para entrar na
 *     revisão — se for discente, basta corrigir o cadastro.
 *  4. Publicação: mesmo DOI = mesma publicação; senão título normalizado + ano + veículo.
 *     Nunca remove autorias (as revisões ficam), e no fim roda o Fuzzy Match.
 *
 * O Qualis continua vindo das tabelas carregadas (periódico pelo ISSN, evento pela sigla).
 */
const crypto = require("node:crypto");
const { Erros } = require("../../../lib/erros");
const { normalizarTexto } = require("../../../lib/texto");
const { criarAutor } = require("../../cadastros/comum");
const { criarServicoFuzzy, publicacaoVigente } = require("../../correspondencias/fuzzy.servico");
const { criarClienteOpenAlex } = require("./cliente");
const { interpretarObra } = require("./mapeamento");

const ANOS_PADRAO = 6;
const SIMILARIDADE_NOME_EVENTO = 0.6;

const sha = (texto) => crypto.createHash("sha256").update(texto).digest("hex");
/** "Silva, Andressa T." e "Andressa T. Silva" viram a mesma chave (tokens ordenados). */
const chaveNome = (nome) => normalizarTexto(nome).split(" ").filter(Boolean).sort().join(" ");

function criarConectorOpenAlex({ prisma, cliente = criarClienteOpenAlex() }) {
  const fuzzy = criarServicoFuzzy({ prisma });

  /** Garante o id_openalex do docente (descobrindo pelo ORCID, se preciso). */
  async function autorDoDocente(docente) {
    if (docente.id_openalex) return docente.id_openalex;
    if (!docente.orcid) {
      throw Erros.regraDeNegocio("Cadastre o ORCID do docente (ou o ID do OpenAlex) para importar do OpenAlex.");
    }
    const autor = await cliente.autorPorOrcid(docente.orcid);
    if (!autor) throw Erros.regraDeNegocio(`O ORCID ${docente.orcid} não foi encontrado no OpenAlex.`);
    const dono = await prisma.docente.findUnique({ where: { id_openalex: autor.id } });
    if (dono && dono.id_docente !== docente.id_docente) throw Erros.conflito(`O autor ${autor.id} do OpenAlex já está ligado a ${dono.nome}.`);
    await prisma.docente.update({ where: { id_docente: docente.id_docente }, data: { id_openalex: autor.id } });
    return autor.id;
  }

  /** Índices para achar autores já cadastrados sem uma consulta por coautor. */
  async function carregarIndices(tx) {
    const [docentes, discentes, externos, variacoes] = await Promise.all([
      tx.docente.findMany({ select: { id_docente: true, nome: true, orcid: true, id_openalex: true, autor: { select: { id_autor: true } } } }),
      tx.discente.findMany({ select: { nome: true, autor: { select: { id_autor: true } } } }),
      tx.externo.findMany({ select: { nome: true, autor: { select: { id_autor: true } } } }),
      tx.autorNomeCitacao.findMany({ select: { id_autor: true, nome: true } }),
    ]);
    const porNome = new Map();
    const guardar = (nome, idAutor) => {
      const k = chaveNome(nome);
      if (k && idAutor && !porNome.has(k)) porNome.set(k, idAutor);
    };
    // Prioridade: docentes, discentes, externos, depois variações de citação.
    docentes.forEach((d) => guardar(d.nome, d.autor && d.autor.id_autor));
    discentes.forEach((d) => guardar(d.nome, d.autor && d.autor.id_autor));
    externos.forEach((e) => guardar(e.nome, e.autor && e.autor.id_autor));
    variacoes.forEach((v) => guardar(v.nome, v.id_autor));
    return { docentes, porNome };
  }

  async function resolverAutor(tx, a, { docente, idAutorDocente, indices, contagem }) {
    if ((a.id_openalex && a.id_openalex === docente.id_openalex) || (a.orcid && a.orcid === docente.orcid)) return idAutorDocente;
    const colega = indices.docentes.find((d) => (a.orcid && d.orcid === a.orcid) || (a.id_openalex && d.id_openalex === a.id_openalex));
    if (colega) {
      if (colega.autor) return colega.autor.id_autor;
      const novo = await tx.autor.create({ data: { tipo: "DOCENTE", nome_citacao: colega.nome, id_docente: colega.id_docente } });
      colega.autor = { id_autor: novo.id_autor };
      return novo.id_autor;
    }
    const conhecido = indices.porNome.get(chaveNome(a.nome));
    if (conhecido) return conhecido;

    const externo = await tx.externo.create({
      data: { nome: a.nome.slice(0, 150), inst_origem: a.instituicao ? a.instituicao.slice(0, 150) : null, autor: criarAutor("EXTERNO", a.nome.slice(0, 150)) },
      include: { autor: true },
    });
    indices.porNome.set(chaveNome(a.nome), externo.autor.id_autor);
    contagem.coautores_externos_criados++;
    return externo.autor.id_autor;
  }

  async function resolverVeiculo(tx, v) {
    let chave;
    if (v.tipo === "CONFERENCIA") {
      chave = v.sigla || v.issn;
      if (!chave) {
        // Sem sigla nem ISSN: tenta um evento já cadastrado com nome parecido (ex.: tabela Qualis Eventos).
        const [parecido] = await tx.$queryRaw`
          SELECT id_veiculo FROM veiculo
           WHERE tipo = 'CONFERENCIA' AND similarity(fn_normaliza_texto(nome), fn_normaliza_texto(${v.nome})) >= ${SIMILARIDADE_NOME_EVENTO}
           ORDER BY similarity(fn_normaliza_texto(nome), fn_normaliza_texto(${v.nome})) DESC LIMIT 1`;
        if (parecido) return parecido.id_veiculo;
        chave = `EVT-${sha(normalizarTexto(v.nome)).slice(0, 12)}`;
      }
    } else {
      // Mesma chave que o QLattes usa para periódico sem ISSN.
      chave = v.issn || `SEMISSN-${sha(normalizarTexto(v.nome)).slice(0, 12)}`;
    }
    const veiculo = await tx.veiculo.upsert({
      where: { tipo_issn_sigla: { tipo: v.tipo, issn_sigla: chave } },
      create: { tipo: v.tipo, issn_sigla: chave, nome: v.nome || chave },
      update: {},
    });
    return veiculo.id_veiculo;
  }

  async function encontrarPublicacao(tx, obra, idVeiculo) {
    const incluir = { autorias: { select: { id_autor: true, ordem_autoria: true } } };
    let pub = obra.doi ? await tx.publicacao.findFirst({ where: { doi: { equals: obra.doi, mode: "insensitive" } }, include: incluir }) : null;
    if (!pub) {
      pub = await tx.publicacao.findFirst({
        where: { titulo_normalizado: normalizarTexto(obra.titulo).slice(0, 500), ano_publicacao: obra.ano, id_veiculo: idVeiculo },
        include: incluir,
      });
    }
    if (pub && pub.id_mesclada_em) {
      const vigente = await publicacaoVigente(tx, pub.id_publicacao);
      pub = await tx.publicacao.findUnique({ where: { id_publicacao: vigente.id_publicacao }, include: incluir });
    }
    return pub;
  }

  async function gravar(tx, { docente, obras, idImportacao, contagem }) {
    const idAutorDocente =
      (await tx.autor.findUnique({ where: { id_docente: docente.id_docente } }))?.id_autor ??
      (await tx.autor.create({ data: { tipo: "DOCENTE", nome_citacao: docente.nome, id_docente: docente.id_docente } })).id_autor;
    const indices = await carregarIndices(tx);

    for (const obra of obras) {
      const idVeiculo = await resolverVeiculo(tx, obra.veiculo);
      contagem[obra.veiculo.tipo === "CONFERENCIA" ? "eventos" : "periodicos"]++;

      let pub = await encontrarPublicacao(tx, obra, idVeiculo);
      if (!pub) {
        pub = await tx.publicacao.create({
          data: { titulo: obra.titulo, titulo_normalizado: normalizarTexto(obra.titulo).slice(0, 500), ano_publicacao: obra.ano, doi: obra.doi, id_veiculo: idVeiculo, id_importacao: idImportacao },
          include: { autorias: { select: { id_autor: true, ordem_autoria: true } } },
        });
        contagem.novas++;
      } else {
        contagem.ja_existentes++;
        if (!pub.doi && obra.doi) {
          const comDoi = await tx.publicacao.findFirst({ where: { doi: { equals: obra.doi, mode: "insensitive" } } });
          if (!comDoi) await tx.publicacao.update({ where: { id_publicacao: pub.id_publicacao }, data: { doi: obra.doi } });
        }
      }

      const ids = [];
      for (const a of obra.autores) ids.push(await resolverAutor(tx, a, { docente, idAutorDocente, indices, contagem }));
      if (!ids.includes(idAutorDocente)) ids.push(idAutorDocente); // a busca foi pelo docente: ele é autor

      const presentes = new Set(pub.autorias.map((x) => x.id_autor));
      let ordem = Math.max(0, ...pub.autorias.map((x) => x.ordem_autoria));
      for (const idAutor of new Set(ids)) {
        if (presentes.has(idAutor)) continue;
        await tx.autoria.create({ data: { id_publicacao: pub.id_publicacao, id_autor: idAutor, ordem_autoria: ++ordem } });
        presentes.add(idAutor);
        if (idAutor !== idAutorDocente) contagem.coautorias_adicionadas++;
      }
    }
  }

  /** Importa a produção do docente desde `desde` (padrão: últimos 6 anos). */
  async function importar({ idDocente, desde, idUsuario }) {
    const docente = await prisma.docente.findUnique({ where: { id_docente: idDocente } });
    if (!docente) throw Erros.naoEncontrado("Docente não encontrado.");
    const idAutor = await autorDoDocente(docente);
    docente.id_openalex = idAutor;

    const anoInicial = desde ?? new Date().getFullYear() - ANOS_PADRAO;
    const brutas = await cliente.obrasDoAutor(idAutor, { desde: anoInicial });
    const ignoradas = {};
    const obras = [];
    for (const bruta of brutas) {
      const r = interpretarObra(bruta);
      if (r.ignorada) ignoradas[r.ignorada] = (ignoradas[r.ignorada] || 0) + 1;
      else obras.push(r.obra);
    }

    const hash = sha(JSON.stringify(obras.map((o) => [o.id_openalex, o.doi, o.titulo, o.ano, o.autores.map((a) => a.nome)]).sort()));
    const anterior = await prisma.importacao.findFirst({ where: { fonte: "OPENALEX", hash_arquivo: hash, id_docente: idDocente, status: "CONCLUIDO" } });
    if (anterior) return { importacao: anterior, reaproveitada: true };

    const importacao = await prisma.importacao.create({
      data: { fonte: "OPENALEX", nome_arquivo: `openalex:${idAutor}:desde-${anoInicial}`, hash_arquivo: hash, status: "PROCESSANDO", id_docente: idDocente, id_usuario: idUsuario ?? null, iniciado_em: new Date() },
    });
    const contagem = { obras_recebidas: brutas.length, obras_validas: obras.length, ignoradas, novas: 0, ja_existentes: 0, periodicos: 0, eventos: 0, coautorias_adicionadas: 0, coautores_externos_criados: 0 };

    try {
      await prisma.$transaction(
        async (tx) => {
          await gravar(tx, { docente, obras, idImportacao: importacao.id_importacao, contagem });
          await tx.docente.update({ where: { id_docente: idDocente }, data: { data_ultima_atualizacao: new Date() } });
        },
        { timeout: 180_000 },
      );
      const daProducao = await prisma.publicacao.findMany({
        where: { id_mesclada_em: null, autorias: { some: { autor: { id_docente: idDocente } } } },
        select: { id_publicacao: true },
      });
      const { cortes, ...correspondencias } = await fuzzy.processar(daProducao.map((p) => p.id_publicacao));
      void cortes;
      const concluida = await prisma.importacao.update({
        where: { id_importacao: importacao.id_importacao },
        data: { status: "CONCLUIDO", contagens: { ...contagem, autor_openalex: idAutor, desde: anoInicial, correspondencias }, finalizado_em: new Date() },
      });
      return { importacao: concluida, reaproveitada: false };
    } catch (erro) {
      await prisma.importacao.update({
        where: { id_importacao: importacao.id_importacao },
        data: { status: "FALHA", erros: { mensagem: String(erro.message).slice(0, 1000) }, finalizado_em: new Date() },
      });
      throw erro;
    }
  }

  return { importar };
}

module.exports = { criarConectorOpenAlex, chaveNome };
