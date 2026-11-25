/*
 * Prepara um banco novo para uso real (sem os dados de demonstração do seed):
 * cadastra a Resolução nº 1/2025 e os parâmetros dela, se ainda não existirem.
 * Pode ser rodado mais de uma vez: só acrescenta o que falta.
 *
 *   npm run preparar
 */
require("dotenv").config({ quiet: true });
const { PrismaClient } = require("@prisma/client");
const { PARAMETROS } = require("../src/dominio/parametros-resolucao-1-2025");

const RESOLUCAO = {
  numero_ano: "1/2025",
  data_vigencia: new Date("2025-01-01"),
  link_documento: "https://ic.ufal.br/pt-br/pos-graduacao/informatica/documentos/regimento/resolucoes/resolucoes_-1-_assinado-1.pdf/view",
};

async function main() {
  const prisma = new PrismaClient();
  try {
    const resolucao =
      (await prisma.resolucao.findUnique({ where: { numero_ano: RESOLUCAO.numero_ano } })) ?? (await prisma.resolucao.create({ data: RESOLUCAO }));
    const { count } = await prisma.parametro.createMany({
      data: PARAMETROS.map((p) => ({ ...p, id_resolucao: resolucao.id_resolucao })),
      skipDuplicates: true,
    });
    const usuarios = await prisma.usuario.count();
    console.log(`Resolução nº ${resolucao.numero_ano} pronta; ${count} parâmetro(s) novo(s) (os existentes não foram alterados).`);
    if (!usuarios) console.log('Nenhum usuário cadastrado ainda. Crie o primeiro com:  npm run criar-usuario -- --email ... --nome "..." --perfil COORDENACAO');
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error("Não foi possível preparar o banco:", erro.message);
  process.exit(1);
});
