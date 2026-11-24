/*
 * Limite simples de tentativas em memória (login e recuperação de senha).
 * Suficiente para uma única instância; com várias, trocar por Redis.
 */
const { Erros } = require("../lib/erros");

function limiteTentativas({ maximo, janelaMs, chave }) {
  const registros = new Map();

  return (req, _res, next) => {
    const agora = Date.now();
    const id = chave(req);
    const registro = registros.get(id);
    if (!registro || registro.expiraEm <= agora) {
      registros.set(id, { total: 1, expiraEm: agora + janelaMs });
    } else if (++registro.total > maximo) {
      return next(Erros.muitasTentativas());
    }
    if (registros.size > 10_000) {
      for (const [k, r] of registros) if (r.expiraEm <= agora) registros.delete(k);
    }
    return next();
  };
}

module.exports = { limiteTentativas };
