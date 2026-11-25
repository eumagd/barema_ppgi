/* Ponto de entrada da API: `npm run dev` ou `npm start`. */
const config = require("./config");
const prisma = require("./db");
const { criarApp } = require("./app");
const { criarServicoEmail } = require("./lib/email");

const app = criarApp({ prisma, email: criarServicoEmail() });

// Lotes interrompidos por um reinício perderam os arquivos em memória: ficam como falha.
const { criarServicoImportacao } = require("./modulos/importacoes/importacao.servico");
criarServicoImportacao({ prisma })
  .encerrarLotesInterrompidos()
  .then((n) => n && console.info(`${n} lote(s) de importação interrompido(s) marcado(s) como falha.`))
  .catch((e) => console.error(e));

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
