/*
 * Apoio aos testes de integração: rodam contra um PostgreSQL de verdade, no banco
 * indicado por DATABASE_URL_TESTE (nunca o de desenvolvimento). Sem essa variável,
 * os testes são pulados.
 *
 *   npm run test:integracao     (aplica as migrações no banco de teste e roda)
 */
const { PrismaClient } = require("@prisma/client");
const request = require("supertest");
const { criarApp } = require("../../src/app");
const { hashSenha } = require("../../src/lib/senha");

require("dotenv").config({ quiet: true });
const URL_TESTE = process.env.DATABASE_URL_TESTE;
const pular = !URL_TESTE && "DATABASE_URL_TESTE não definida (veja backend/README.md)";

let prisma;
function obterPrisma() {
  if (URL_TESTE && URL_TESTE === process.env.DATABASE_URL) {
    throw new Error("DATABASE_URL_TESTE não pode ser igual à DATABASE_URL: os testes apagam os dados.");
  }
  prisma ??= new PrismaClient({ datasourceUrl: URL_TESTE });
  return prisma;
}

/** Esvazia todas as tabelas (menos o histórico de migrações) e recria os usuários. */
async function limparBanco() {
  const db = obterPrisma();
  const tabelas = await db.$queryRaw`
    SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename <> '_prisma_migrations'`;
  const lista = tabelas.map((t) => `"${t.tablename}"`).join(", ");
  await db.$executeRawUnsafe(`TRUNCATE ${lista} RESTART IDENTITY CASCADE`);
  await db.usuario.createMany({
    data: [
      { nome: "Secretaria", email: "secretaria@teste.br", senha_hash: hashSenha("senha123"), perfil: "SECRETARIA" },
      { nome: "Coordenação", email: "coordenacao@teste.br", senha_hash: hashSenha("senha123"), perfil: "COORDENACAO" },
    ],
  });
}

/** App + cliente HTTP já autenticado com o perfil pedido. */
async function clienteAutenticado(perfil = "SECRETARIA") {
  const app = criarApp({ prisma: obterPrisma(), email: { async enviar() {} } });
  const email = perfil === "SECRETARIA" ? "secretaria@teste.br" : "coordenacao@teste.br";
  const { body } = await request(app).post("/api/auth/login").send({ email, senha: "senha123" });
  const comToken = (metodo) => (url) => request(app)[metodo](url).set("Authorization", `Bearer ${body.token}`);
  return { app, get: comToken("get"), post: comToken("post"), patch: comToken("patch"), put: comToken("put"), delete: comToken("delete") };
}

async function encerrar() {
  if (prisma) await prisma.$disconnect();
}

module.exports = { pular, obterPrisma, limparBanco, clienteAutenticado, encerrar };
