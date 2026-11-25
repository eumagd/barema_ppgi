/*
 * Cria (ou redefine a senha de) um usuário da plataforma, sem passar pela tela.
 *
 *   npm run criar-usuario -- --email coordenacao@ic.ufal.br --nome "Coordenação do PPGI" --perfil COORDENACAO
 *
 * A senha é pedida no terminal (não aparece na tela nem fica no histórico de comandos).
 * Para automação, pode vir da variável de ambiente SENHA_NOVO_USUARIO.
 * Perfis: SECRETARIA ou COORDENACAO. Se o e-mail já existir, a senha e o perfil são atualizados.
 */
require("dotenv").config({ quiet: true });
const readline = require("node:readline");
const { PrismaClient } = require("@prisma/client");
const { hashSenha, regrasNaoAtendidas } = require("../src/lib/senha");

function argumentos() {
  const args = {};
  const lista = process.argv.slice(2);
  for (let i = 0; i < lista.length; i++) {
    if (lista[i].startsWith("--")) args[lista[i].slice(2)] = lista[i + 1];
  }
  return args;
}

/** Lê a senha sem ecoar os caracteres. */
function perguntarSenha(pergunta) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (texto) => {
      if (texto.includes(pergunta)) rl.output.write(texto);
    };
    rl.question(pergunta, (resposta) => {
      rl.close();
      process.stdout.write("\n");
      resolve(resposta);
    });
  });
}

async function main() {
  const { email, nome, perfil = "SECRETARIA" } = argumentos();
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error("Informe --email com um e-mail válido.");
  if (!["SECRETARIA", "COORDENACAO"].includes(perfil)) throw new Error("--perfil deve ser SECRETARIA ou COORDENACAO.");

  let senha = process.env.SENHA_NOVO_USUARIO;
  if (!senha) {
    senha = await perguntarSenha("Senha (mín. 8 caracteres, com letra e número): ");
    const confirmacao = await perguntarSenha("Repita a senha: ");
    if (senha !== confirmacao) throw new Error("As senhas não conferem.");
  }
  const pendentes = regrasNaoAtendidas(senha);
  if (pendentes.length) throw new Error(`Senha fraca: ${pendentes.join("; ")}.`);

  const prisma = new PrismaClient();
  try {
    const emailNormalizado = email.trim().toLowerCase();
    const existente = await prisma.usuario.findFirst({ where: { email: { equals: emailNormalizado, mode: "insensitive" } } });
    if (existente) {
      await prisma.usuario.update({
        where: { id_usuario: existente.id_usuario },
        data: { senha_hash: hashSenha(senha), perfil, ...(nome ? { nome } : {}) },
      });
      console.log(`Usuário ${emailNormalizado} atualizado (perfil ${perfil}).`);
    } else {
      if (!nome) throw new Error('Informe --nome para um usuário novo (ex.: --nome "Secretaria do PPGI").');
      await prisma.usuario.create({ data: { email: emailNormalizado, nome, perfil, senha_hash: hashSenha(senha) } });
      console.log(`Usuário ${emailNormalizado} criado (perfil ${perfil}).`);
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((erro) => {
  console.error(erro.message);
  process.exit(1);
});
