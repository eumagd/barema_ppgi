/*
 * Montagem da aplicação Express. As dependências (Prisma, e-mail) são
 * injetadas para facilitar os testes.
 */
const express = require("express");
const cors = require("cors");
const config = require("./config");
const { criarRotasAuth } = require("./modulos/auth/auth.rotas");
const { criarRotasParametros } = require("./modulos/parametros/parametros.rotas");
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

  app.use(rotaNaoEncontrada);
  app.use(tratarErros);
  return app;
}

module.exports = { criarApp };
