/*
 * Montagem da aplicação Express. As dependências (Prisma, e-mail) são
 * injetadas para facilitar os testes.
 */
const express = require("express");
const cors = require("cors");
const config = require("./config");
const { criarRotasAuth } = require("./modulos/auth/auth.rotas");
const { criarRotasParametros } = require("./modulos/parametros/parametros.rotas");
const { criarRotasQualis } = require("./modulos/qualis/qualis.rotas");
const { criarRotasDocentes } = require("./modulos/cadastros/docentes.rotas");
const { criarRotasDiscentes, criarRotasExternos } = require("./modulos/cadastros/discentes.rotas");
const { criarRotasDisciplinas, criarRotasTurmas } = require("./modulos/cadastros/disciplinas.rotas");
const { criarRotasImportacoes } = require("./modulos/importacoes/importacoes.rotas");
const { criarRotasCorrespondencias } = require("./modulos/correspondencias/correspondencias.rotas");
const { criarRotasPublicacoes, criarRotasAutores } = require("./modulos/publicacoes/publicacoes.rotas");
const { criarRotasAvaliacoes, criarRotasCalculoDocente } = require("./modulos/avaliacoes/avaliacoes.rotas");
const { autenticar } = require("./middlewares/autenticacao");
const { rotaNaoEncontrada, tratarErros } = require("./middlewares/erros");

function criarApp({ prisma, email }) {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", "loopback");
  app.use(cors({ origin: config.frontendUrl }));
  app.use(express.json({ limit: "1mb" }));

  app.get("/api/saude", async (_req, res) => {
    let banco = "ok";
    try {
      await prisma.$queryRaw`SELECT 1`;
    } catch {
      banco = "indisponivel";
    }
    res.status(banco === "ok" ? 200 : 503).json({ status: banco === "ok" ? "ok" : "degradado", banco });
  });

  app.use("/api/auth", criarRotasAuth({ prisma, email }));
  app.use("/api/resolucoes", criarRotasParametros({ prisma }));
  app.use("/api/qualis", criarRotasQualis({ prisma }));
  app.use("/api/docentes", autenticar, criarRotasDocentes({ prisma }), criarRotasCalculoDocente({ prisma }));
  app.use("/api/discentes", autenticar, criarRotasDiscentes({ prisma }));
  app.use("/api/externos", autenticar, criarRotasExternos({ prisma }));
  app.use("/api/disciplinas", autenticar, criarRotasDisciplinas({ prisma }));
  app.use("/api/turmas", autenticar, criarRotasTurmas({ prisma }));
  app.use("/api/importacoes", criarRotasImportacoes({ prisma }));
  app.use("/api/correspondencias", criarRotasCorrespondencias({ prisma }));
  app.use("/api/publicacoes", autenticar, criarRotasPublicacoes({ prisma }));
  app.use("/api/autores", autenticar, criarRotasAutores({ prisma }));
  app.use("/api/avaliacoes", autenticar, criarRotasAvaliacoes({ prisma }));

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}

module.exports = { criarApp };
