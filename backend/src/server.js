/* Ponto de entrada da API: `npm run dev` ou `npm start`. */
const config = require("./config");
const prisma = require("./db");
const { criarApp } = require("./app");
const { criarServicoEmail } = require("./lib/email");

const app = criarApp({ prisma, email: criarServicoEmail() });

const servidor = app.listen(config.porta, () => {
  console.info(`API do Barema PPGI ouvindo em http://localhost:${config.porta}`);
});

async function encerrar() {
  servidor.close();
  await prisma.$disconnect();
  process.exit(0);
}

process.on("SIGINT", encerrar);
process.on("SIGTERM", encerrar);
