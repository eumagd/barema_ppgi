/*
 * Exportações (RF-BE15):
 *   GET /api/exportacoes/producao.xlsx | producao.csv   ?inicio=&fim=&id_docente=
 *       uma linha por publicação de cada docente, com estrato, fonte, peso, divisor e pontos
 *   GET /api/exportacoes/avaliacoes.xlsx | avaliacoes.csv   ?status=&tipo=
 *       resumo dos processos avaliativos
 *
 * O CSV sai em UTF-8 com BOM e ";" (abre direto no Excel em português).
 */
const { Router } = require("express");
const ExcelJS = require("exceljs");
const { z } = require("zod");
const { validar } = require("../../middlewares/validar");
const { id } = require("../cadastros/comum");
const { criarServicoCalculo } = require("../avaliacoes/calculo.servico");

const FONTES = { CAPES: "CAPES", PUC_RS: "PUC-RS", SCOPUS: "Scopus", EVENTOS: "Qualis Eventos", MANUAL: "Manual" };
const VINCULOS = { PERMANENTE: "Permanente", COLABORADOR: "Colaborador" };
const TIPOS_VEICULO = { PERIODICO: "Periódico", CONFERENCIA: "Evento" };

const COLUNAS_PRODUCAO = [
  { header: "Docente", key: "docente", width: 28 },
  { header: "Vínculo", key: "vinculo", width: 13 },
  { header: "Ano", key: "ano", width: 7 },
  { header: "Título", key: "titulo", width: 60 },
  { header: "Veículo", key: "veiculo", width: 40 },
  { header: "Tipo", key: "tipo", width: 10 },
  { header: "Estrato", key: "estrato", width: 8 },
  { header: "Fonte do estrato", key: "fonte", width: 15 },
  { header: "Peso", key: "peso", width: 7 },
  { header: "Divisor (docentes PPGI)", key: "divisor", width: 12 },
  { header: "Pontos", key: "pontos", width: 9 },
  { header: "Com discente", key: "com_discente", width: 12 },
];

const COLUNAS_AVALIACOES = [
  { header: "Processo", key: "id_processo", width: 9 },
  { header: "Docente", key: "docente", width: 28 },
  { header: "Tipo", key: "tipo", width: 17 },
  { header: "Status", key: "status", width: 13 },
  { header: "Resolução", key: "resolucao", width: 10 },
  { header: "Solicitado em", key: "data_solicitacao", width: 13 },
  { header: "Publicações consideradas", key: "publicacoes_consideradas", width: 12 },
  { header: "Publicações desmarcadas", key: "publicacoes_desmarcadas", width: 12 },
  { header: "Pontuação de Pesquisa", key: "pontos", width: 12 },
  { header: "Válido até", key: "valido_ate", width: 12 },
  { header: "Relatório", key: "status_relatorio", width: 11 },
];

const dataBr = (d) => (d ? new Date(d).toISOString().slice(0, 10).split("-").reverse().join("/") : "");

function csv(colunas, linhas) {
  const celula = (v) => {
    const t = v == null ? "" : typeof v === "number" ? String(v).replace(".", ",") : String(v);
    return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  };
  const corpo = [colunas.map((c) => c.header), ...linhas.map((l) => colunas.map((c) => l[c.key]))].map((l) => l.map(celula).join(";")).join("\r\n");
  return Buffer.from("﻿" + corpo, "utf8");
}

async function xlsx(nomeAba, colunas, linhas) {
  const livro = new ExcelJS.Workbook();
  livro.creator = "Plataforma de Baremas do PPGI/UFAL";
  const aba = livro.addWorksheet(nomeAba, { views: [{ state: "frozen", ySplit: 1 }] });
  aba.columns = colunas;
  aba.addRows(linhas);
  aba.getRow(1).font = { bold: true };
  aba.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: colunas.length } };
  return Buffer.from(await livro.xlsx.writeBuffer());
}

async function enviar(res, formato, nome, aba, colunas, linhas) {
  const hoje = new Date().toISOString().slice(0, 10);
  if (formato === "csv") {
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${nome}-${hoje}.csv"`);
    return res.send(csv(colunas, linhas));
  }
  res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  res.setHeader("Content-Disposition", `attachment; filename="${nome}-${hoje}.xlsx"`);
  return res.send(await xlsx(aba, colunas, linhas));
}

function criarRotasExportacoes({ prisma }) {
  const calculo = criarServicoCalculo({ prisma });
  const rotas = Router();

  const producao = [
    validar({
      query: z.object({
        inicio: z.coerce.number().int().min(1950).max(2100).optional(),
        fim: z.coerce.number().int().min(1950).max(2100).optional(),
        id_docente: id.optional(),
      }),
    }),
    async (req, res) => {
      const formato = req.path.endsWith(".csv") ? "csv" : "xlsx";
      const { inicio, fim, id_docente: idDocente } = req.validado.query;
      const docentes = await prisma.docente.findMany({
        where: idDocente ? { id_docente: idDocente } : { vinculo: { not: null } },
        orderBy: { nome: "asc" },
        select: { id_docente: true },
      });
      const linhas = [];
      for (const d of docentes) {
        const r = await calculo.calcular(d.id_docente, { inicio, fim });
        for (const l of r.pesquisa.linhas) {
          linhas.push({
            docente: r.docente.nome,
            vinculo: VINCULOS[r.docente.vinculo] ?? "Sem vínculo",
            ano: l.ano,
            titulo: l.titulo,
            veiculo: l.veiculo ?? "",
            tipo: TIPOS_VEICULO[l.tipo_veiculo] ?? l.tipo_veiculo,
            estrato: l.estrato ?? "N",
            fonte: FONTES[l.fonte_estrato] ?? "",
            peso: l.peso,
            divisor: l.divisor,
            pontos: l.pontos,
            com_discente: l.com_discente ? "Sim" : "Não",
          });
        }
      }
      await enviar(res, formato, "producao-ppgi", "Produção", COLUNAS_PRODUCAO, linhas);
    },
  ];

  const avaliacoes = [
    validar({
      query: z.object({
        status: z.enum(["EM_ANDAMENTO", "DEFERIDO", "INDEFERIDO", "CANCELADO"]).optional(),
        tipo: z.enum(["CREDENCIAMENTO", "RECREDENCIAMENTO"]).optional(),
      }),
    }),
    async (req, res) => {
      const formato = req.path.endsWith(".csv") ? "csv" : "xlsx";
      const { status, tipo } = req.validado.query;
      const lista = await prisma.$queryRaw`
        SELECT v.*, a.data_solicitacao, a.pontuacao_pesquisa, a.valido_ate, a.status_relatorio
          FROM vw_resumo_avaliacao v JOIN avaliacao a ON a.id_processo = v.id_processo
         WHERE (${status ?? null}::text IS NULL OR v.status::text = ${status ?? null})
           AND (${tipo ?? null}::text IS NULL OR v.tipo::text = ${tipo ?? null})
         ORDER BY v.docente, a.data_solicitacao DESC`;
      const linhas = lista.map((l) => ({
        id_processo: l.id_processo,
        docente: l.docente,
        tipo: l.tipo === "CREDENCIAMENTO" ? "Credenciamento" : "Recredenciamento",
        status: { EM_ANDAMENTO: "Em andamento", DEFERIDO: "Deferido", INDEFERIDO: "Indeferido", CANCELADO: "Cancelado" }[l.status],
        resolucao: l.resolucao,
        data_solicitacao: dataBr(l.data_solicitacao),
        publicacoes_consideradas: Number(l.publicacoes_consideradas),
        publicacoes_desmarcadas: Number(l.publicacoes_desmarcadas),
        pontos: l.pontuacao_pesquisa == null ? null : Number(l.pontuacao_pesquisa),
        valido_ate: dataBr(l.valido_ate),
        status_relatorio: { RASCUNHO: "Rascunho", GERADO: "Gerado", ENVIADO: "Enviado" }[l.status_relatorio],
      }));
      await enviar(res, formato, "avaliacoes-ppgi", "Avaliações", COLUNAS_AVALIACOES, linhas);
    },
  ];

  rotas.get(["/producao.xlsx", "/producao.csv"], ...producao);
  rotas.get(["/avaliacoes.xlsx", "/avaliacoes.csv"], ...avaliacoes);
  return rotas;
}

module.exports = { criarRotasExportacoes, csv };
