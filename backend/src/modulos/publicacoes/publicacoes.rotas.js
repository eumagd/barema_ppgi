/*
 * Cadastro manual de produção, para o que o CSV do QLattes não traz:
 * artigos em EVENTOS (58% da produção do PPGI) e COAUTORES discentes/externos
 * (exigência do recredenciamento).
 *
 *   GET    /api/autores                       ?busca=&tipo=DOCENTE|DISCENTE|EXTERNO  (para escolher coautores)
 *   POST   /api/publicacoes                   { titulo, ano, doi?, veiculo, autores: [id_autor, ...] }
 *            veiculo = { id_veiculo } ou { tipo: CONFERENCIA, sigla, nome } ou { tipo: PERIODICO, issn?, nome }
 *   GET    /api/publicacoes/:id
 *   PATCH  /api/publicacoes/:id               { titulo?, ano?, doi?, id_veiculo? }
 *   DELETE /api/publicacoes/:id               recusa se já entrou em alguma avaliação
 *   POST   /api/publicacoes/:id/autores       { id_autor }
 *   DELETE /api/publicacoes/:id/autores/:idAutor
 *
 * Toda publicação criada ou alterada passa pelo Fuzzy Match contra a base.
 */
const crypto = require("node:crypto");
const { Router } = require("express");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { Erros } = require("../../lib/erros");
const { normalizarIssn, normalizarSigla, normalizarTexto } = require("../../lib/texto");
const { estratoVigente, AREA_PADRAO } = require("../qualis/qualis.servico");
const { criarServicoFuzzy, publicacaoVigente } = require("../correspondencias/fuzzy.servico");
const { id, paramsId, texto } = require("../cadastros/comum");

const doi = z
  .string()
  .trim()
  .transform((v) => v.replace(/^https?:\/\/(dx\.)?doi\.org\//i, "").replace(/^doi:\s*/i, ""))
  .pipe(z.string().regex(/^10\.\d{4,9}\/\S+$/, "DOI inválido. Exemplo: 10.1145/3368089.3409741"))
  .nullable()
  .optional();

const veiculo = z.union([
  z.object({ id_veiculo: id }),
  z.object({ tipo: z.literal("CONFERENCIA"), sigla: texto(30), nome: texto(255, 2) }),
  z.object({ tipo: z.literal("PERIODICO"), issn: z.string().trim().optional(), nome: texto(255, 2) }),
]);

const esquemaCriar = z.object({
  titulo: texto(500, 3),
  ano: z.coerce.number().int().min(1950).max(2100),
  doi,
  veiculo,
  autores: z.array(id).min(1, "Informe ao menos um autor.").max(100),
});

const esquemaAtualizar = z
  .object({ titulo: texto(500, 3), ano: z.coerce.number().int().min(1950).max(2100), doi, id_veiculo: id })
  .partial()
  .refine((o) => Object.keys(o).length > 0, "Informe ao menos um campo para atualizar.");

const detalhes = {
  veiculo: { include: { estratos: true } },
  autorias: {
    orderBy: { ordem_autoria: "asc" },
    include: { autor: { include: { docente: { select: { nome: true, vinculo: true } }, discente: { select: { nome: true } }, externo: { select: { nome: true } } } } },
  },
};

function apresentar(p) {
  const vigente = p.veiculo ? estratoVigente(p.veiculo.estratos, AREA_PADRAO) : null;
  return {
    id_publicacao: p.id_publicacao,
    titulo: p.titulo,
    ano: p.ano_publicacao,
    doi: p.doi,
    id_mesclada_em: p.id_mesclada_em,
    veiculo: p.veiculo && { id_veiculo: p.veiculo.id_veiculo, tipo: p.veiculo.tipo, nome: p.veiculo.nome, issn_sigla: p.veiculo.issn_sigla },
    estrato: vigente?.estrato ?? null,
    fonte_estrato: vigente?.fonte ?? null,
    autores: p.autorias.map((a) => ({
      id_autor: a.id_autor,
      ordem: a.ordem_autoria,
      tipo: a.autor.tipo,
      nome: a.autor.docente?.nome ?? a.autor.discente?.nome ?? a.autor.externo?.nome ?? a.autor.nome_citacao,
    })),
  };
}

/** Acha ou cria o veículo informado. Conferência pela sigla; periódico pelo ISSN (ou pelo nome, sem ISSN). */
async function resolverVeiculo(tx, v) {
  if (v.id_veiculo) {
    const existente = await tx.veiculo.findUnique({ where: { id_veiculo: v.id_veiculo } });
    if (!existente) throw Erros.naoEncontrado("Veículo não encontrado.");
    return existente;
  }
  let chave;
  if (v.tipo === "CONFERENCIA") {
    chave = normalizarSigla(v.sigla).slice(0, 30);
    if (!chave) throw Erros.requisicaoInvalida("Sigla do evento inválida.");
  } else if (v.issn) {
    chave = normalizarIssn(v.issn);
    if (!chave) throw Erros.requisicaoInvalida(`ISSN inválido ("${v.issn}").`);
  } else {
    chave = `SEMISSN-${crypto.createHash("sha256").update(normalizarTexto(v.nome)).digest("hex").slice(0, 12)}`;
  }
  return tx.veiculo.upsert({
    where: { tipo_issn_sigla: { tipo: v.tipo, issn_sigla: chave } },
    create: { tipo: v.tipo, issn_sigla: chave, nome: v.nome },
    update: {},
  });
}

function criarRotasPublicacoes({ prisma }) {
  const fuzzy = criarServicoFuzzy({ prisma });
  const rotas = Router();

  const buscar = async (idPublicacao) => {
    const p = await prisma.publicacao.findUnique({ where: { id_publicacao: idPublicacao }, include: detalhes });
    if (!p) throw Erros.naoEncontrado("Publicação não encontrada.");
    return p;
  };
  const exigirNaoMesclada = (p) => {
    if (p.id_mesclada_em) {
      throw Erros.conflito(`Esta publicação foi mesclada na de número ${p.id_mesclada_em}. Edite aquela.`);
    }
  };

  rotas.post("/", validar({ body: esquemaCriar }), async (req, res) => {
    const { titulo, ano, doi: valorDoi, veiculo: v, autores } = req.validado.body;
    const unicos = [...new Set(autores)];
    const encontrados = await prisma.autor.count({ where: { id_autor: { in: unicos } } });
    if (encontrados !== unicos.length) throw Erros.requisicaoInvalida("Algum dos autores informados não existe.");

    // DOI é único: se já existe, é a mesma publicação (vale a que ficou depois das mesclas).
    const comMesmoDoi = valorDoi
      ? await prisma.publicacao.findFirst({ where: { doi: { equals: valorDoi, mode: "insensitive" } } })
      : null;
    const existente = comMesmoDoi && (await publicacaoVigente(prisma, comMesmoDoi.id_publicacao));

    const criada = await prisma.$transaction(async (tx) => {
      const veiculoFinal = await resolverVeiculo(tx, v);
      return tx.publicacao.create({
        data: {
          titulo,
          titulo_normalizado: normalizarTexto(titulo).slice(0, 500),
          ano_publicacao: ano,
          doi: existente ? null : (valorDoi ?? null),
          id_veiculo: veiculoFinal.id_veiculo,
          autorias: { create: unicos.map((idAutor, i) => ({ id_autor: idAutor, ordem_autoria: i + 1 })) },
        },
      });
    });

    let correspondencias;
    if (existente) {
      await fuzzy.mesclarPorDoi(criada.id_publicacao, existente.id_publicacao);
      correspondencias = { mescladas_automaticamente: 1, para_revisao: 0 };
    } else {
      correspondencias = await fuzzy.processar([criada.id_publicacao]);
    }
    const final = await buscar(criada.id_publicacao);
    res.status(201).json({ ...apresentar(final), correspondencias: { mescladas_automaticamente: correspondencias.mescladas_automaticamente, para_revisao: correspondencias.para_revisao } });
  });

  rotas.get("/:id", validar({ params: paramsId }), async (req, res) => {
    res.json(apresentar(await buscar(req.validado.params.id)));
  });

  rotas.patch("/:id", validar({ params: paramsId, body: esquemaAtualizar }), async (req, res) => {
    const { id: idPublicacao } = req.validado.params;
    exigirNaoMesclada(await buscar(idPublicacao));
    const { titulo, ano, doi: valorDoi, id_veiculo: idVeiculo } = req.validado.body;
    const data = {
      ...(titulo ? { titulo, titulo_normalizado: normalizarTexto(titulo).slice(0, 500) } : {}),
      ...(ano ? { ano_publicacao: ano } : {}),
      ...(valorDoi !== undefined ? { doi: valorDoi } : {}),
      ...(idVeiculo ? { id_veiculo: (await resolverVeiculo(prisma, { id_veiculo: idVeiculo })).id_veiculo } : {}),
    };
    await prisma.publicacao.update({ where: { id_publicacao: idPublicacao }, data });
    await fuzzy.processar([idPublicacao]);
    res.json(apresentar(await buscar(idPublicacao)));
  });

  rotas.delete("/:id", validar({ params: paramsId }), async (req, res) => {
    const { id: idPublicacao } = req.validado.params;
    await buscar(idPublicacao);
    const avaliacoes = await prisma.avaliacaoPublicacao.count({ where: { id_publicacao: idPublicacao } });
    if (avaliacoes) throw Erros.conflito("A publicação já entrou em uma avaliação e não pode ser excluída.");
    await prisma.publicacao.delete({ where: { id_publicacao: idPublicacao } });
    res.status(204).end();
  });

  rotas.post("/:id/autores", validar({ params: paramsId, body: z.object({ id_autor: id }) }), async (req, res) => {
    const { id: idPublicacao } = req.validado.params;
    const p = await buscar(idPublicacao);
    exigirNaoMesclada(p);
    const { id_autor: idAutor } = req.validado.body;
    if (!(await prisma.autor.findUnique({ where: { id_autor: idAutor } }))) throw Erros.naoEncontrado("Autor não encontrado.");
    if (p.autorias.some((a) => a.id_autor === idAutor)) throw Erros.conflito("Este autor já está na publicação.");
    const ordem = Math.max(0, ...p.autorias.map((a) => a.ordem_autoria)) + 1;
    await prisma.autoria.create({ data: { id_publicacao: idPublicacao, id_autor: idAutor, ordem_autoria: ordem } });
    res.status(201).json(apresentar(await buscar(idPublicacao)));
  });

  rotas.delete("/:id/autores/:idAutor", validar({ params: paramsId.extend({ idAutor: id }) }), async (req, res) => {
    const { id: idPublicacao, idAutor } = req.validado.params;
    const p = await buscar(idPublicacao);
    exigirNaoMesclada(p);
    if (!p.autorias.some((a) => a.id_autor === idAutor)) throw Erros.naoEncontrado("Este autor não está na publicação.");
    if (p.autorias.length === 1) throw Erros.regraDeNegocio("A publicação precisa de ao menos um autor. Exclua a publicação, se for o caso.");
    await prisma.autoria.delete({ where: { id_publicacao_id_autor: { id_publicacao: idPublicacao, id_autor: idAutor } } });
    res.json(apresentar(await buscar(idPublicacao)));
  });

  return rotas;
}

/** Busca de autores (docentes, discentes e externos) para escolher coautores na tela. */
function criarRotasAutores({ prisma }) {
  const rotas = Router();
  rotas.get(
    "/",
    validar({ query: z.object({ busca: z.string().trim().min(2, "Digite ao menos 2 letras.").max(150), tipo: z.enum(["DOCENTE", "DISCENTE", "EXTERNO"]).optional() }) }),
    async (req, res) => {
      const { busca, tipo } = req.validado.query;
      const contem = { contains: busca, mode: "insensitive" };
      const autores = await prisma.autor.findMany({
        where: {
          ...(tipo ? { tipo } : {}),
          OR: [
            { nome_citacao: contem },
            { nomes_citacao: { some: { nome_normalizado: { contains: normalizarTexto(busca) } } } },
            { docente: { nome: contem } },
            { discente: { nome: contem } },
            { externo: { nome: contem } },
          ],
        },
        take: 30,
        include: { docente: { select: { nome: true, vinculo: true } }, discente: { select: { nome: true, matricula: true } }, externo: { select: { nome: true, inst_origem: true } } },
      });
      res.json(
        autores.map((a) => ({
          id_autor: a.id_autor,
          tipo: a.tipo,
          nome: a.docente?.nome ?? a.discente?.nome ?? a.externo?.nome,
          nome_citacao: a.nome_citacao,
          detalhe: a.docente ? (a.docente.vinculo ?? "sem vínculo com o PPGI") : a.discente ? a.discente.matricula : a.externo?.inst_origem,
        })),
      );
    },
  );
  return rotas;
}

module.exports = { criarRotasPublicacoes, criarRotasAutores };
