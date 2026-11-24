/*
 * Configuração lida do ambiente (.env). Falha cedo se algo obrigatório faltar.
 */
require("dotenv").config({ quiet: true });

const ambiente = process.env.NODE_ENV || "development";

function obrigatorio(nome, padraoDev) {
  const valor = process.env[nome];
  if (valor) return valor;
  if (ambiente !== "production" && padraoDev !== undefined) return padraoDev;
  throw new Error(`Variável de ambiente ${nome} não definida (veja backend/.env.example).`);
}

const config = {
  ambiente,
  porta: Number(process.env.PORT) || 3000,
  jwt: {
    segredo: obrigatorio("JWT_SECRET", "segredo-de-desenvolvimento"),
    expiraEm: process.env.JWT_EXPIRES_IN || "8h",
  },
  frontendUrl: (process.env.FRONTEND_URL || "http://localhost:5500").replace(/\/+$/, ""),
  redefinicaoSenha: { validadeMinutos: 60 },
  smtp: {
    host: process.env.SMTP_HOST || "",
    porta: Number(process.env.SMTP_PORT) || 587,
    usuario: process.env.SMTP_USER || "",
    senha: process.env.SMTP_PASS || "",
    remetente: process.env.SMTP_FROM || "PPGI/UFAL <nao-responda@ic.ufal.br>",
  },
};

module.exports = config;
