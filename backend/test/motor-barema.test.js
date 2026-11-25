const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { PADROES } = require("../src/dominio/parametros-resolucao-1-2025");
const motor = require("../src/dominio/motor-barema");

const p = PADROES;
const REF = new Date("2026-11-24T00:00:00Z");
const EU = 1;

const eu = { tipo: "DOCENTE", id_docente: EU, ppgi: true, avaliado: true, nome: "Eu" };
const colega = (id, nome = `Colega ${id}`) => ({ tipo: "DOCENTE", id_docente: id, ppgi: true, nome });
const docenteSemVinculo = { tipo: "DOCENTE", id_docente: 99, ppgi: false, nome: "Fora do PPGI" };
const discente = { tipo: "DISCENTE", nome: "Aluno" };
const externo = { tipo: "EXTERNO", nome: "Externo" };

let seq = 0;
const pub = (estrato, autores = [eu], extra = {}) => ({
  id_publicacao: ++seq,
  titulo: `Pub ${seq}`,
  ano: 2024,
  tipo_veiculo: "PERIODICO",
  estrato,
  autores,
  ...extra,
});

const permanente = { id_docente: EU, nome: "Eu", vinculo: "PERMANENTE", data_vinculo: "2018-03-01" };
const candidato = { id_docente: EU, nome: "Eu", vinculo: null, data_vinculo: null };

describe("Pesquisa", () => {
  it("divide só pelos docentes do PPGI (discentes, externos e docentes sem vínculo não entram)", () => {
    const r = motor.calcularPesquisa({
      publicacoes: [pub("A1", [eu, colega(2), discente, externo, docenteSemVinculo]), pub("A2", [eu])],
      idDocente: EU,
      tipo: "RECREDENCIAMENTO",
      p,
    });
    assert.deepEqual(r.linhas.map((l) => [l.peso, l.divisor, l.pontos]), [[1, 2, 0.5], [0.875, 1, 0.875]]);
    assert.equal(r.total, 1.375);
    assert.equal(r.bruto, 1.875);
    assert.equal(r.desconto_coautoria, 0.5);
  });

  it("usa os pesos da resolução: A4 = 0,625 e abaixo de B1 vale zero", () => {
    const r = motor.calcularPesquisa({ publicacoes: [pub("A4"), pub("B1"), pub("B2"), pub(null)], idDocente: EU, tipo: "RECREDENCIAMENTO", p });
    assert.deepEqual(r.linhas.map((l) => l.pontos), [0.625, 0.5, 0, 0]);
  });

  it("credenciamento: ≥ 3,5 pontos e ≥ 2 periódicos A3+, sem contar eventos", () => {
    const publicacoes = [pub("A1"), pub("A1"), pub("A2"), pub("A3", [eu], { tipo_veiculo: "CONFERENCIA" }), pub("A4")];
    const r = motor.calcularPesquisa({ publicacoes, idDocente: EU, tipo: "CREDENCIAMENTO", p });
    assert.equal(r.total, 4.25);
    const [pontos, periodicos] = r.requisitos;
    assert.equal(pontos.atendido, true);
    assert.equal(periodicos.obtido, 3, "A1, A1 e A2; o A3 é evento");
    assert.equal(periodicos.atendido, true);

    const fraco = motor.calcularPesquisa({ publicacoes: [pub("A1"), pub("A4"), pub("A4")], idDocente: EU, tipo: "CREDENCIAMENTO", p });
    assert.deepEqual(fraco.requisitos.map((x) => x.atendido), [false, false]);
  });

  it("recredenciamento exige coautoria com discente e respeita publicações desmarcadas", () => {
    const comDiscente = pub("A1", [eu, discente]);
    const r = motor.calcularPesquisa({ publicacoes: [comDiscente, pub("A1"), pub("A2")], idDocente: EU, tipo: "RECREDENCIAMENTO", p });
    assert.deepEqual(r.requisitos.map((x) => [x.codigo, x.atendido]), [
      ["PESQUISA_PONTUACAO", true],
      ["PESQUISA_PERIODICOS", true],
      ["PESQUISA_COAUTORIA_DISCENTE", true],
    ]);

    const desmarcada = motor.calcularPesquisa({ publicacoes: [{ ...comDiscente, considerada: false }, pub("A1")], idDocente: EU, tipo: "RECREDENCIAMENTO", p });
    assert.equal(desmarcada.total, 1);
    assert.equal(desmarcada.requisitos[2].atendido, false);
  });
});

describe("Orientação e Docência", () => {
  it("orientação: em andamento ou concluída nos 24 meses; coorientação vale 0,5", () => {
    const r = motor.calcularOrientacao({
      orientacoes: [
        { id_discente: 1, ano_ingresso: 2025, data_conclusao: null },
        { id_discente: 2, ano_ingresso: 2020, data_conclusao: "2022-03-01" }, // fora da janela
      ],
      coorientacoes: [
        { id_discente: 3, ano_ingresso: 2023, data_conclusao: "2025-06-10" },
        { id_discente: 4, ano_ingresso: 2024, data_conclusao: null },
      ],
      referencia: REF,
      p,
    });
    assert.equal(r.total, 2);
    assert.equal(r.requisitos[0].atendido, true);
    assert.deepEqual(r.orientacoes.map((o) => o.id_discente), [1]);
  });

  it("docência: Estudo Dirigido e graduação não contam; só a janela de 24 meses", () => {
    const disc = (codigo, ano, semestre, extra = {}) => ({ codigo, nome: codigo, ano, semestre, nivel: "POS_GRADUACAO", estudo_dirigido: false, ...extra });
    const r = motor.calcularDocencia({
      turmas: [
        disc("ED01", 2025, 1, { estudo_dirigido: true }),
        disc("GRAD1", 2025, 2, { nivel: "GRADUACAO" }),
        disc("PPGI1", 2023, 1), // antes da janela (nov/2024)
      ],
      referencia: REF,
      p,
    });
    assert.equal(r.total, 0);
    assert.equal(r.requisitos[0].atendido, false);
    assert.equal(r.turmas.find((t) => t.codigo === "ED01").motivo, "Estudo Dirigido não conta");

    const ok = motor.calcularDocencia({ turmas: [disc("PPGI1", 2024, 2)], referencia: REF, p });
    assert.equal(ok.requisitos[0].atendido, true);
  });
});

describe("Avaliação completa e exceções", () => {
  const dadosBase = (docente, publicacoes, extra = {}) => ({ docente, publicacoes, orientacoes: [], coorientacoes: [], turmas: [], ...extra });

  it("período padrão: os 3 anos completos anteriores à referência", () => {
    assert.deepEqual(motor.periodoPesquisa(REF, 36), { inicio: 2023, fim: 2025 });
    assert.deepEqual(motor.periodoPesquisa(REF, 36, 2022, 2024), { inicio: 2022, fim: 2024 });
  });

  it("recredenciamento sem orientação/docência não fica apto; recém-credenciado é isento", () => {
    const producao = [pub("A1", [eu, discente]), pub("A1"), pub("A2")];
    const antigo = motor.avaliar(dadosBase(permanente, producao), { referencia: REF }, p);
    assert.equal(antigo.tipo, "RECREDENCIAMENTO");
    assert.equal(antigo.apto, false);
    assert.deepEqual(antigo.requisitos.filter((r) => !r.atendido).map((r) => r.codigo), ["ORIENTACAO_MINIMA", "DOCENCIA_MINIMA"]);

    const recem = motor.avaliar(dadosBase({ ...permanente, data_vinculo: "2025-06-01" }, producao), { referencia: REF }, p);
    assert.equal(recem.apto, true);
    assert.equal(recem.excecoes[0].codigo, "RECEM_CREDENCIADO");
    assert.equal(recem.orientacao.isento, true);
  });

  it("publicações fora do período não contam e geram aviso quando não sobra nada", () => {
    const r = motor.avaliar(dadosBase(candidato, [pub("A1", [eu], { ano: 2019 })]), { referencia: REF }, p);
    assert.equal(r.pesquisa.total, 0);
    assert.match(r.avisos[0], /Nenhuma publicação entre 2023 e 2025/);
  });

  it("bloqueia o credenciamento se toda a produção também é de um mesmo docente do PPGI", () => {
    const tutor = colega(7, "Docente Tutor");
    const tudoComTutor = [pub("A1", [eu, tutor]), pub("A1", [eu, tutor, colega(8)]), pub("A1", [eu, tutor]), pub("A1", [eu, tutor]), pub("A2", [eu, tutor]), pub("A2", [eu, tutor])];
    const bloqueado = motor.avaliar(dadosBase(candidato, tudoComTutor), { referencia: REF }, p);
    const sub = bloqueado.requisitos.find((r) => r.codigo === "CREDENCIAMENTO_SUBCONJUNTO");
    assert.equal(sub.atendido, false);
    assert.equal(sub.detalhe.nome, "Docente Tutor");
    assert.equal(bloqueado.apto, false);

    const proprio = motor.avaliar(dadosBase(candidato, [...tudoComTutor, pub("A3")]), { referencia: REF }, p);
    assert.equal(proprio.requisitos.find((r) => r.codigo === "CREDENCIAMENTO_SUBCONJUNTO"), undefined);
  });

  it("progressão Colaborador → Permanente", () => {
    const colaborador = { id_docente: EU, nome: "Eu", vinculo: "COLABORADOR", data_vinculo: "2024-01-10" };
    const turmas = [{ codigo: "PPGI1", nome: "IA", ano: 2025, semestre: 1, nivel: "POS_GRADUACAO", estudo_dirigido: false }];
    const r = motor.avaliar(dadosBase(colaborador, [pub("A1", [eu, discente])], { turmas }), { referencia: REF }, p);
    assert.equal(r.progressao.elegivel, true);
    const sem = motor.avaliar(dadosBase({ ...colaborador, data_vinculo: "2026-05-01" }, [pub("A1")]), { referencia: REF }, p);
    assert.deepEqual(sem.progressao.requisitos.map((x) => x.atendido), [false, false, false]);
  });
});

describe("Teto de 30% de Colaboradores (Art. 8º)", () => {
  it("ordena colaboradores aptos pela pontuação e corta no limite", () => {
    const r = (id, vinculo, total, apto = true) => ({ docente: { id_docente: id, nome: `D${id}`, vinculo }, apto, pesquisa: { total } });
    const resultados = [
      ...[1, 2, 3, 4, 5, 6, 7].map((i) => r(i, "PERMANENTE", 3)),
      r(10, "COLABORADOR", 2.6),
      r(11, "COLABORADOR", 4.0),
      r(12, "COLABORADOR", 3.1),
      r(13, "COLABORADOR", 5, false),
    ];
    const teto = motor.aplicarTetoColaboradores(resultados, p);
    assert.equal(teto.limite, 3, "floor(30% × (7 + 3))");
    assert.deepEqual(teto.ranking.map((x) => [x.id_docente, x.dentro_do_teto]), [[11, true], [12, true], [10, true]]);

    const apertado = motor.aplicarTetoColaboradores(resultados.slice(3), p);
    assert.equal(apertado.limite, 2, "floor(30% × (4 + 3))");
    assert.deepEqual(apertado.ranking.map((x) => x.dentro_do_teto), [true, true, false]);
  });
});
