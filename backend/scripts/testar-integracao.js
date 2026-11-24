/*
 * Aplica as migrações no banco de teste (DATABASE_URL_TESTE) e roda test/integracao.
 * Uso: npm run test:integracao
 */
require("dotenv").config({ quiet: true });
const { execSync } = require("node:child_process");

const url = process.env.DATABASE_URL_TESTE;
if (!url) {
  console.error("Defina DATABASE_URL_TESTE no .env (um banco separado: ele é apagado a cada execução).");
  process.exit(1);
}
if (url === process.env.DATABASE_URL) {
  console.error("DATABASE_URL_TESTE não pode ser igual à DATABASE_URL.");
  process.exit(1);
}

const env = { ...process.env, DATABASE_URL: url };
execSync("npx prisma migrate deploy", { stdio: "inherit", env });
execSync("node --test --test-concurrency=1 test/integracao/", { stdio: "inherit", env: process.env });
