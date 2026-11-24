/*
 * Valida body/query/params com Zod e guarda o resultado em req.validado.
 * (No Express 5, req.query é somente leitura.)
 */
function validar(esquemas) {
  return (req, _res, next) => {
    req.validado = {};
    for (const parte of ["params", "query", "body"]) {
      if (esquemas[parte]) req.validado[parte] = esquemas[parte].parse(req[parte] ?? {});
    }
    next();
  };
}

module.exports = { validar };
