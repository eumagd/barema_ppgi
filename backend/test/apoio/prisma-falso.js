/*
 * Prisma em memória com só o que os testes de autenticação e parâmetros usam.
 * Permite testar as rotas sem PostgreSQL.
 */
const { hashSenha } = require("../../src/lib/senha");

function criarPrismaFalso() {
  const dados = {
    usuarios: [
      { id_usuario: 1, nome: "Secretaria do PPGI", email: "secretaria@ic.ufal.br", senha_hash: hashSenha("ppgi2026"), perfil: "SECRETARIA" },
      { id_usuario: 2, nome: "Coordenação do PPGI", email: "coordenacao@ic.ufal.br", senha_hash: hashSenha("ppgi2026"), perfil: "COORDENACAO" },
    ],
    tokens: [],
    resolucoes: [{ id_resolucao: 1, numero_ano: "1/2025", data_vigencia: new Date("2025-01-01") }],
    parametros: [
      { id_resolucao: 1, chave: "fuzzy.corte_confirmacao", valor: 92, descricao: "confirmação" },
      { id_resolucao: 1, chave: "fuzzy.corte_revisao", valor: 80, descricao: "revisão" },
      { id_resolucao: 1, chave: "pesos_estrato", valor: { A1: 1, A2: 0.875, A3: 0.75, A4: 0.625, B1: 0.5, B2: 0, B3: 0, B4: 0, C: 0 }, descricao: "pesos" },
    ],
  };

  const naoEncontrado = () => Object.assign(new Error("Registro não encontrado"), { code: "P2025" });

  const prisma = {
    dados,
    async $queryRaw() {
      return [{ "?column?": 1 }];
    },
    async $transaction(operacoes) {
      return Promise.all(operacoes);
    },
    usuario: {
      async findFirst({ where }) {
        const alvo = where.email.equals.toLowerCase();
        return dados.usuarios.find((u) => u.email.toLowerCase() === alvo) || null;
      },
      async findUnique({ where }) {
        return dados.usuarios.find((u) => u.id_usuario === where.id_usuario) || null;
      },
      async update({ where, data }) {
        const u = dados.usuarios.find((x) => x.id_usuario === where.id_usuario);
        if (!u) throw naoEncontrado();
        return Object.assign(u, data);
      },
    },
    tokenRedefinicaoSenha: {
      async create({ data }) {
        const t = { id_token: dados.tokens.length + 1, usado_em: null, ...data };
        dados.tokens.push(t);
        return t;
      },
      async findUnique({ where }) {
        return dados.tokens.find((t) => t.token_hash === where.token_hash) || null;
      },
      async updateMany({ where, data }) {
        const alvos = dados.tokens.filter((t) => t.id_usuario === where.id_usuario && t.usado_em === null);
        alvos.forEach((t) => Object.assign(t, data));
        return { count: alvos.length };
      },
    },
    resolucao: {
      async findMany() {
        return dados.resolucoes;
      },
      async findUnique({ where }) {
        return dados.resolucoes.find((r) => r.id_resolucao === where.id_resolucao) || null;
      },
    },
    parametro: {
      async findMany({ where }) {
        return dados.parametros.filter((p) => p.id_resolucao === where.id_resolucao);
      },
      async findUnique({ where }) {
        const { id_resolucao, chave } = where.id_resolucao_chave;
        return dados.parametros.find((p) => p.id_resolucao === id_resolucao && p.chave === chave) || null;
      },
      async update({ where, data }) {
        const { id_resolucao, chave } = where.id_resolucao_chave;
        const p = dados.parametros.find((x) => x.id_resolucao === id_resolucao && x.chave === chave);
        if (!p) throw naoEncontrado();
        return Object.assign(p, data);
      },
    },
  };

  return prisma;
}

/** Captura os e-mails "enviados" para inspecionar nos testes. */
function criarEmailFalso() {
  const enviados = [];
  return { enviados, async enviar(msg) { enviados.push(msg); } };
}

module.exports = { criarPrismaFalso, criarEmailFalso };
