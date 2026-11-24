/*
 * Envio de e-mail. Com SMTP_HOST configurado usa o nodemailer; sem ele,
 * apenas mostra a mensagem no console (útil em desenvolvimento).
 */
const nodemailer = require("nodemailer");
const config = require("../config");

function criarServicoEmail(smtp = config.smtp) {
  if (!smtp.host) {
    return {
      async enviar({ para, assunto, texto }) {
        console.info(`[e-mail não enviado: SMTP não configurado]\nPara: ${para}\nAssunto: ${assunto}\n\n${texto}\n`);
      },
    };
  }

  const transporte = nodemailer.createTransport({
    host: smtp.host,
    port: smtp.porta,
    secure: smtp.porta === 465,
    auth: smtp.usuario ? { user: smtp.usuario, pass: smtp.senha } : undefined,
  });

  return {
    async enviar({ para, assunto, texto, html }) {
      await transporte.sendMail({ from: smtp.remetente, to: para, subject: assunto, text: texto, html });
    },
  };
}

module.exports = { criarServicoEmail };
