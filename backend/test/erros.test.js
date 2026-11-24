const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { Prisma } = require("@prisma/client");
const { traduzir } = require("../src/middlewares/erros");

/* Textos copiados de erros reais do Prisma 6 contra o PostgreSQL 16 (servidor em pt-BR). */
const erroDoBanco = (corpo) =>
  new Prisma.PrismaClientUnknownRequestError(
    `Invalid \`prisma.discente.create()\` invocation:\n\nError occurred during query execution:\nConnectorError(ConnectorError { user_facing_error: None, kind: QueryError(PostgresError { ${corpo}, severity: "ERRO", detail: None, column: None, hint: None }), transient: false })`,
    { clientVersion: "6.19.3" },
  );

describe("tradução de erros do banco", () => {
  it("repassa a mensagem dos gatilhos (RAISE EXCEPTION)", () => {
    const t = traduzir(erroDoBanco('code: "P0001", message: "Apenas docentes permanentes podem orientar (docente 5)."'));
    assert.equal(t.status, 422);
    assert.equal(t.message, "Apenas docentes permanentes podem orientar (docente 5).");
  });

  it("troca o nome do CHECK por uma mensagem legível", () => {
    const t = traduzir(
      erroDoBanco('code: "23514", message: "a nova linha da relação \\"docente\\" viola a restrição de verificação \\"docente_id_lattes_chk\\""'),
    );
    assert.equal(t.status, 422);
    assert.equal(t.message, "O ID Lattes deve ter exatamente 16 dígitos.");
  });

  it("funciona com o servidor em inglês (imagem Docker)", () => {
    const t = traduzir(
      erroDoBanco('code: "23514", message: "new row for relation \\"turma\\" violates check constraint \\"turma_semestre_chk\\""'),
    );
    assert.equal(t.message, "O semestre deve ser 1 ou 2.");
  });

  it("não inventa tradução para erros desconhecidos", () => {
    assert.equal(traduzir(erroDoBanco('code: "XX000", message: "falha interna"')), null);
  });
});
