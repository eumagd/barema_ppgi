/*
 * Importação do CSV do QLattes (RF-BE01 a RF-BE03, Conector 1 do RF-BE18).
 *
 * Para cada arquivo:
 *  1. identifica o docente (id_docente no upload individual; no lote, pelo ID Lattes
 *     da URL ou pelo nome) e valida que o CSV é dele (RF-BE03);
 *  2. grava veículo, estrato informado pelo QLattes, publicação e autoria;
 *  3. é idempotente (RNF-BE02): o mesmo arquivo não é reprocessado, e reimportar
 *     um CSV atualizado só acrescenta — nada que já foi revisado é apagado (RF-BE11).
 *
 * Publicações iguais (mesmo título normalizado, ano e veículo) vindas de CVs de
 * docentes diferentes viram uma única publicação com as duas autorias: é assim que
 * a coautoria entre docentes do PPGI aparece, já que o QLattes não exporta autores.
 * A correspondência aproximada (pg_trgm) fica para a etapa do Fuzzy Match.
 */
const crypto = require("node:crypto");
const AdmZip = require("adm-zip");
const { Erros } = require("../../lib/erros");
const { normalizarTexto } = require("../../lib/texto");
const { PESOS_ESTRATO } = require("../../dominio/parametros-resolucao-1-2025");
const { AREA_PADRAO } = require("../qualis/qualis.servico");
const { lerCsvQLattes } = require("./qlattes.leitor");
const { criarServicoFuzzy, publicacaoVigente } = require("../correspondencias/fuzzy.servico");

const LIMITES_ZIP = { arquivos: 200, bytesDescompactados: 50 * 1024 * 1024 };
const MAX_ERROS_GUARDADOS = 200;

const sha256 = (buffer) => crypto.createHash("sha256").update(buffer).digest("hex");

/** Mesmo nome, ou mesmo primeiro e último nome ("Bruno Costa e Silva Nogueira" ~ "Bruno Nogueira"). */
function nomesCompativeis(a, b) {
  const x = normalizarTexto(a).split(" ").filter(Boolean);
  const y = normalizarTexto(b).split(" ").filter(Boolean);
  if (!x.length || !y.length) return false;
  if (x.join(" ") === y.join(" ")) return true;
  return x[0] === y[0] && x[x.length - 1] === y[y.length - 1];
}

/** Abre o ZIP com limites contra arquivos-bomba; devolve [{ nome, buffer }] só dos .csv. */
function extrairZip(buffer) {
  let zip;
  try {
    zip = new AdmZip(buffer);
  } catch {
    throw Erros.requisicaoInvalida("Não foi possível abrir o .zip. Confira se o arquivo não está corrompido.");
  }
  const entradas = zip
    .getEntries()
    .filter((e) => !e.isDirectory && /\.csv$/i.test(e.entryName) && !/(^|\/)(__MACOSX|\.)/.test(e.entryName));
  if (!entradas.length) throw Erros.requisicaoInvalida("O .zip não contém arquivos .csv.");
  if (entradas.length > LIMITES_ZIP.arquivos) throw Erros.requisicaoInvalida(`O .zip tem mais de ${LIMITES_ZIP.arquivos} arquivos .csv.`);
  const total = entradas.reduce((s, e) => s + e.header.size, 0);
  if (total > LIMITES_ZIP.bytesDescompactados) throw Erros.requisicaoInvalida("O conteúdo do .zip passa de 50 MB.");
  return entradas.map((e) => ({ nome: e.entryName.split("/").pop(), buffer: e.getData() }));
}

function criarServicoImportacao({ prisma }) {
  const fuzzy = criarServicoFuzzy({ prisma });

  async function obterPesos() {
    const p = await prisma.parametro.findFirst({ where: { chave: "pesos_estrato" }, orderBy: { resolucao: { data_vigencia: "desc" } } });
    return p ? p.valor : PESOS_ESTRATO;
  }

  /** Upload individual: o docente foi escolhido na tela; conferimos se o CSV é dele. */
  async function validarDocenteEscolhido(idDocente, pesquisador, confirmarNome) {
    const docente = await prisma.docente.findUnique({ where: { id_docente: idDocente } });
    if (!docente) throw Erros.naoEncontrado("Docente não encontrado.");

    if (docente.id_lattes && pesquisador.id_lattes) {
      if (docente.id_lattes !== pesquisador.id_lattes) {
        throw Erros.regraDeNegocio(
          `Este CSV é do currículo ${pesquisador.id_lattes} (${pesquisador.nome}), mas ${docente.nome} está cadastrado com o ID Lattes ${docente.id_lattes}.`,
        );
      }
      return docente;
    }
    if (!nomesCompativeis(docente.nome, pesquisador.nome) && !confirmarNome) {
      throw Erros.regraDeNegocio(
        `O CSV é de "${pesquisador.nome}", que não parece ser ${docente.nome}. Se estiver certo, envie de novo com confirmar_nome=true.`,
        { nome_no_csv: pesquisador.nome, docente: docente.nome },
      );
    }
    return docente;
  }

  /** Lote: casa pelo ID Lattes e, se não houver, pelo nome (sem ambiguidade). */
  async function encontrarDocente(pesquisador) {
    if (pesquisador.id_lattes) {
      const porId = await prisma.docente.findUnique({ where: { id_lattes: pesquisador.id_lattes } });
      if (porId) return porId;
    }
    const candidatos = (await prisma.docente.findMany({ where: { id_lattes: null } })).filter((d) =>
      nomesCompativeis(d.nome, pesquisador.nome),
    );
    if (candidatos.length === 1) return candidatos[0];
    if (candidatos.length > 1) {
      throw Erros.regraDeNegocio(`Mais de um docente cadastrado combina com "${pesquisador.nome}". Importe este CSV individualmente.`);
    }
    throw Erros.naoEncontrado(`Nenhum docente cadastrado corresponde a "${pesquisador.nome}". Cadastre-o (com o ID Lattes) e importe de novo.`);
  }

  /** Grava os artigos de um docente; devolve as contagens. */
  async function gravarArtigos(tx, { docente, artigos, idImportacao, pesos }) {
    const autor =
      (await tx.autor.findUnique({ where: { id_docente: docente.id_docente } })) ||
      (await tx.autor.create({ data: { tipo: "DOCENTE", nome_citacao: docente.nome, id_docente: docente.id_docente } }));

    const c = { artigos: artigos.length, novas: 0, ja_importadas: 0, coautoria_com_outro_docente: 0, estratos_do_qlattes: 0, sem_issn: 0 };
    const veiculoPorChave = new Map();

    for (const a of artigos) {
      // 1. Veículo: pelo ISSN; sem ISSN, por uma chave estável do nome do periódico.
      let idVeiculo = null;
      const chave = a.issn || (a.periodico ? `SEMISSN-${sha256(normalizarTexto(a.periodico)).slice(0, 12)}` : null);
      if (!a.issn) c.sem_issn++;
      if (chave) {
        if (!veiculoPorChave.has(chave)) {
          const v = await tx.veiculo.upsert({
            where: { tipo_issn_sigla: { tipo: "PERIODICO", issn_sigla: chave } },
            create: { tipo: "PERIODICO", issn_sigla: chave, nome: a.periodico || chave },
            update: {},
          });
          veiculoPorChave.set(chave, v.id_veiculo);
        }
        idVeiculo = veiculoPorChave.get(chave);
      }

      // 2. Estrato já classificado pelo QLattes: entra se o servidor ainda não tiver o dessa fonte/ano.
      if (idVeiculo && a.estrato && a.origem) {
        const { count } = await tx.estratoQualis.createMany({
          data: [{
            id_veiculo: idVeiculo,
            ano_base: a.origem.ano_base,
            area_de_atuacao: AREA_PADRAO,
            fonte: a.origem.fonte,
            estrato: a.estrato,
            pontuacao: pesos[a.estrato] ?? 0,
            id_importacao: idImportacao,
          }],
          skipDuplicates: true,
        });
        c.estratos_do_qlattes += count;
      }

      // 3. Publicação: mesmo título normalizado + ano + veículo = mesma publicação.
      const tituloNormalizado = normalizarTexto(a.titulo).slice(0, 500);
      let publicacao = await tx.publicacao.findFirst({
        where: { titulo_normalizado: tituloNormalizado, ano_publicacao: a.ano, id_veiculo: idVeiculo },
        include: { autorias: { select: { id_autor: true, ordem_autoria: true } } },
      });
      // Já mesclada por uma correspondência confirmada: vale a publicação de destino.
      if (publicacao?.id_mesclada_em) {
        const vigente = await publicacaoVigente(tx, publicacao.id_publicacao);
        publicacao = await tx.publicacao.findUnique({
          where: { id_publicacao: vigente.id_publicacao },
          include: { autorias: { select: { id_autor: true, ordem_autoria: true } } },
        });
      }
      if (!publicacao) {
        publicacao = await tx.publicacao.create({
          data: { titulo: a.titulo, titulo_normalizado: tituloNormalizado, ano_publicacao: a.ano, id_veiculo: idVeiculo, id_importacao: idImportacao },
          include: { autorias: { select: { id_autor: true, ordem_autoria: true } } },
        });
        c.novas++;
      }

      // 4. Autoria do docente (nunca removemos autorias existentes: decisões manuais ficam).
      if (publicacao.autorias.some((x) => x.id_autor === autor.id_autor)) {
        c.ja_importadas++;
      } else {
        if (publicacao.autorias.length) c.coautoria_com_outro_docente++;
        // O QLattes não informa a ordem de autoria; usamos a próxima livre.
        const ordem = Math.max(0, ...publicacao.autorias.map((x) => x.ordem_autoria)) + 1;
        await tx.autoria.create({ data: { id_publicacao: publicacao.id_publicacao, id_autor: autor.id_autor, ordem_autoria: ordem } });
      }
    }

    // Artigos cujo veículo não tem estrato em nenhuma base: vão para a fila manual (RF-BE05).
    c.sem_estrato = await tx.publicacao.count({
      where: {
        autorias: { some: { id_autor: autor.id_autor } },
        id_mesclada_em: null,
        OR: [{ id_veiculo: null }, { veiculo: { estratos: { none: {} } } }],
      },
    });
    return c;
  }

  /** Processa um CSV. `idDocente` no upload individual; sem ele, casa o docente pelo arquivo. */
  async function importarArquivo({ buffer, nomeArquivo, idDocente, confirmarNome = false, idUsuario }) {
    const { artigos, erros, pesquisador } = lerCsvQLattes(buffer);
    if (!artigos.length) {
      throw Erros.regraDeNegocio("O CSV não tem nenhum artigo válido.", erros.length ? { erros: erros.slice(0, 20) } : undefined);
    }

    const docente = idDocente
      ? await validarDocenteEscolhido(idDocente, pesquisador, confirmarNome)
      : await encontrarDocente(pesquisador);

    const hash = sha256(buffer);
    const anterior = await prisma.importacao.findFirst({
      where: { fonte: "QLATTES_CSV", hash_arquivo: hash, id_docente: docente.id_docente, status: "CONCLUIDO" },
      orderBy: { criado_em: "desc" },
    });
    if (anterior) return { importacao: anterior, docente, reaproveitada: true };

    const importacao = await prisma.importacao.create({
      data: {
        fonte: "QLATTES_CSV",
        nome_arquivo: nomeArquivo.slice(0, 255),
        hash_arquivo: hash,
        status: "PROCESSANDO",
        id_docente: docente.id_docente,
        id_usuario: idUsuario ?? null,
        iniciado_em: new Date(),
      },
    });

    try {
      const pesos = await obterPesos();
      const contagens = await prisma.$transaction(
        async (tx) => {
          // Primeira importação com ID Lattes conhecido: guardamos no cadastro (RF-BE03).
          if (!docente.id_lattes && pesquisador.id_lattes) {
            const dono = await tx.docente.findUnique({ where: { id_lattes: pesquisador.id_lattes } });
            if (dono && dono.id_docente !== docente.id_docente) {
              throw Erros.conflito(`O ID Lattes ${pesquisador.id_lattes} já pertence a ${dono.nome}.`);
            }
            await tx.docente.update({ where: { id_docente: docente.id_docente }, data: { id_lattes: pesquisador.id_lattes } });
          }
          const c = await gravarArtigos(tx, { docente, artigos, idImportacao: importacao.id_importacao, pesos });
          await tx.docente.update({ where: { id_docente: docente.id_docente }, data: { data_ultima_atualizacao: new Date() } });
          return c;
        },
        { timeout: 120_000 },
      );

      // Fuzzy Match da produção do docente contra o resto da base (RF-BE07 a RF-BE10).
      const daProducao = await prisma.publicacao.findMany({
        where: { id_mesclada_em: null, autorias: { some: { autor: { id_docente: docente.id_docente } } } },
        select: { id_publicacao: true },
      });
      const { cortes, ...correspondencias } = await fuzzy.processar(daProducao.map((p) => p.id_publicacao));

      const concluida = await prisma.importacao.update({
        where: { id_importacao: importacao.id_importacao },
        data: {
          status: "CONCLUIDO",
          contagens: { ...contagens, linhas_com_erro: erros.length, pesquisador: pesquisador.nome, correspondencias },
          erros: erros.length ? { total: erros.length, linhas: erros.slice(0, MAX_ERROS_GUARDADOS) } : undefined,
          finalizado_em: new Date(),
        },
      });
      return { importacao: concluida, docente, reaproveitada: false };
    } catch (erro) {
      await prisma.importacao.update({
        where: { id_importacao: importacao.id_importacao },
        data: { status: "FALHA", erros: { mensagem: String(erro.message).slice(0, 1000) }, finalizado_em: new Date() },
      });
      throw erro;
    }
  }

  /**
   * Processa os arquivos de um lote, um por vez, gravando o andamento de cada docente em
   * lote_importacao.itens (pendente → processando → concluído/falha) para a tela acompanhar.
   */
  async function processarLote(idLote, arquivos, idUsuario) {
    const itens = arquivos.map((a) => ({ arquivo: a.nome, status: "PENDENTE" }));
    const salvar = (dados) => prisma.loteImportacao.update({ where: { id_lote: idLote }, data: { itens, ...dados } });
    await salvar({ status: "PROCESSANDO", iniciado_em: new Date() });

    for (const [i, arquivo] of arquivos.entries()) {
      itens[i] = { ...itens[i], status: "PROCESSANDO" };
      await salvar({});
      try {
        const r = await importarArquivo({ buffer: arquivo.buffer, nomeArquivo: arquivo.nome, idUsuario });
        itens[i] = {
          arquivo: arquivo.nome,
          status: r.reaproveitada ? "REAPROVEITADO" : "CONCLUIDO",
          docente: resumoDocente(r.docente),
          id_importacao: r.importacao.id_importacao,
          contagens: r.importacao.contagens,
        };
      } catch (erro) {
        // Erro inesperado (banco fora do ar etc.) também vira falha do arquivo, com mensagem clara.
        itens[i] = { arquivo: arquivo.nome, status: "FALHA", erro: erro.status ? erro.message : "Erro inesperado ao processar o arquivo." };
        if (!erro.status) console.error(erro);
      }
      await salvar({});
    }
    const falhas = itens.filter((x) => x.status === "FALHA").length;
    await salvar({ status: falhas === itens.length ? "FALHA" : "CONCLUIDO", finalizado_em: new Date() });
  }

  /** Um lote por vez, para não disputar o banco com o Fuzzy Match de outro lote. */
  let fila = Promise.resolve();
  function enfileirar(tarefa) {
    const execucao = fila.then(tarefa, tarefa);
    fila = execucao.catch((erro) => console.error("Falha no lote de importação:", erro));
    return execucao;
  }

  /** .csv individual (síncrono, exige id_docente) ou .zip (assíncrono: devolve o lote para acompanhar). */
  async function importar({ buffer, nomeArquivo, idDocente, confirmarNome, idUsuario }) {
    if (/\.zip$/i.test(nomeArquivo)) {
      const arquivos = extrairZip(buffer);
      const lote = await prisma.loteImportacao.create({
        data: {
          nome_arquivo: nomeArquivo.slice(0, 255),
          total: arquivos.length,
          itens: arquivos.map((a) => ({ arquivo: a.nome, status: "PENDENTE" })),
          id_usuario: idUsuario ?? null,
        },
      });
      const concluido = enfileirar(() => processarLote(lote.id_lote, arquivos, idUsuario));
      return { lote: true, assincrono: true, id_lote: lote.id_lote, status: lote.status, total: lote.total, itens: lote.itens, concluido };
    }

    if (!idDocente) throw Erros.requisicaoInvalida("Informe o docente (id_docente) para importar um CSV individual.");
    const r = await importarArquivo({ buffer, nomeArquivo, idDocente, confirmarNome, idUsuario });
    return { lote: false, reaproveitada: r.reaproveitada, docente: resumoDocente(r.docente), importacao: r.importacao };
  }

  /** Lotes que estavam em andamento quando o servidor parou não têm mais os arquivos: marcamos como falha. */
  async function encerrarLotesInterrompidos() {
    const presos = await prisma.loteImportacao.findMany({ where: { status: { in: ["PENDENTE", "PROCESSANDO"] } } });
    for (const lote of presos) {
      const itens = lote.itens.map((x) =>
        ["PENDENTE", "PROCESSANDO"].includes(x.status) ? { ...x, status: "FALHA", erro: "O servidor foi reiniciado durante o processamento. Envie o arquivo de novo." } : x,
      );
      await prisma.loteImportacao.update({ where: { id_lote: lote.id_lote }, data: { status: "FALHA", itens, finalizado_em: new Date() } });
    }
    return presos.length;
  }

  return { importar, encerrarLotesInterrompidos };
}

const resumoDocente = (d) => ({ id_docente: d.id_docente, nome: d.nome });

module.exports = { criarServicoImportacao, nomesCompativeis, extrairZip };
