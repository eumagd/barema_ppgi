/*
 * Texto do parecer de um processo avaliativo, a partir do cálculo (relatorios.html).
 * Sai em texto simples e em HTML para o e-mail.
 */
const STATUS = { EM_ANDAMENTO: "em andamento", DEFERIDO: "deferido", INDEFERIDO: "indeferido", CANCELADO: "cancelado" };
const TIPO = { CREDENCIAMENTO: "Credenciamento", RECREDENCIAMENTO: "Recredenciamento" };

const numero = (n) => (n == null ? "—" : Number(n).toLocaleString("pt-BR", { maximumFractionDigits: 4 }));
const dataBr = (d) => (d ? new Date(d).toISOString().slice(0, 10).split("-").reverse().join("/") : "—");
const esc = (t) => String(t ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]);

function montarParecer(avaliacao, calculo) {
  const tipo = TIPO[avaliacao.tipo];
  const resolucao = avaliacao.resolucao?.numero_ano ?? calculo.resolucao?.numero_ano ?? "";
  const assunto = `Parecer de ${tipo.toLowerCase()} — ${calculo.docente.nome} (PPGI/UFAL)`;
  const situacao = `Processo nº ${avaliacao.id_processo}, ${STATUS[avaliacao.status]}${avaliacao.valido_ate ? `, válido até ${dataBr(avaliacao.valido_ate)}` : ""}.`;
  const conclusao = calculo.apto
    ? `O(a) docente atende a todos os critérios da Resolução nº ${resolucao} para o ${tipo.toLowerCase()}.`
    : `O(a) docente não atende a ${calculo.requisitos.length - calculo.atendidos} critério(s) da Resolução nº ${resolucao}.`;
  const marca = (r) => (r.atendido ? "Atendido" : "Não atendido");

  const linhasReq = calculo.requisitos.map((r) => `- ${r.descricao}: ${numero(r.obtido)} (exigido ${r.exigido}) — ${marca(r)}`);
  const linhasPub = calculo.pesquisa.linhas
    .filter((l) => l.considerada)
    .map((l) => `- ${l.ano} · ${l.titulo} · ${l.veiculo ?? "—"} · ${l.estrato ?? "N"} · ${numero(l.pontos)} pt${l.divisor > 1 ? ` (÷${l.divisor})` : ""}`);
  const excecoes = calculo.excecoes.map((e) => `- ${e.descricao}`);

  const texto = [
    `Parecer de ${tipo} — ${calculo.docente.nome}`,
    situacao,
    `Período de Pesquisa: ${calculo.periodo.inicio} a ${calculo.periodo.fim}. Pontuação: ${numero(calculo.pesquisa.total)} pontos (${numero(calculo.pesquisa.bruto)} antes da divisão entre coautores).`,
    "",
    "Critérios:",
    ...linhasReq,
    ...(excecoes.length ? ["", "Exceções aplicadas:", ...excecoes] : []),
    "",
    "Produção considerada:",
    ...(linhasPub.length ? linhasPub : ["- Nenhuma publicação no período."]),
    "",
    conclusao,
    "",
    "Coordenação do Programa de Pós-Graduação em Informática — IC/UFAL",
  ].join("\n");

  const html = `<!doctype html><html lang="pt-BR"><body style="font-family:Arial,sans-serif;color:#1a1a1a;max-width:720px">
<h2 style="color:#0b4f6c">Parecer de ${esc(tipo)} — ${esc(calculo.docente.nome)}</h2>
<p>${esc(situacao)}<br>Período de Pesquisa: <b>${calculo.periodo.inicio} a ${calculo.periodo.fim}</b>. Pontuação: <b>${numero(calculo.pesquisa.total)}</b> pontos.</p>
<table style="border-collapse:collapse;width:100%" border="1" cellpadding="6">
<tr style="background:#eef4f7"><th align="left">Critério</th><th>Exigido</th><th>Obtido</th><th>Situação</th></tr>
${calculo.requisitos.map((r) => `<tr><td>${esc(r.descricao)}</td><td align="center">${esc(r.exigido)}</td><td align="center">${esc(numero(r.obtido))}</td><td align="center" style="color:${r.atendido ? "#1b7a3a" : "#b3261e"}">${marca(r)}</td></tr>`).join("\n")}
</table>
${excecoes.length ? `<p><b>Exceções:</b><br>${calculo.excecoes.map((e) => esc(e.descricao)).join("<br>")}</p>` : ""}
<p><b>${esc(conclusao)}</b></p>
<p style="color:#555">Coordenação do Programa de Pós-Graduação em Informática — IC/UFAL</p>
</body></html>`;

  return { assunto, texto, html };
}

module.exports = { montarParecer };
