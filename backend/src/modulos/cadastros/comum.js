/*
 * Peças comuns aos cadastros: validação de ids e datas, e criação do registro
 * na categoria AUTOR (com as variações de nome de citação, RF-BE09).
 */
const { z } = require("zod");
const { Erros } = require("../../lib/erros");
const { normalizarTexto } = require("../../lib/texto");

const id = z.coerce.number().int().positive();
const paramsId = z.object({ id });

/** "2026-03-01" → Date (meia-noite UTC); null limpa o campo. */
const data = z.iso
  .date({ error: "Data inválida. Use o formato AAAA-MM-DD." })
  .transform((v) => new Date(`${v}T00:00:00Z`));

const texto = (max, min = 1) => z.string().trim().min(min).max(max);
const textoOpcional = (max) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => v || null)
    .nullable()
    .optional();

/** Formato de citação ABNT: "Magdiel Santos" → "SANTOS, M."; "Ana C. Souza" → "SOUZA, A. C.". */
function nomeCitacaoPadrao(nome) {
  const partes = String(nome).trim().split(/\s+/).filter(Boolean);
  if (partes.length < 2) return String(nome).trim().toUpperCase();
  const sobrenome = partes.pop().toUpperCase();
  const iniciais = partes
    .filter((p) => !/^(da|de|do|das|dos|e)$/i.test(p))
    .map((p) => `${p[0].toUpperCase()}.`)
    .join(" ");
  return `${sobrenome}, ${iniciais}`;
}

/** Variações iniciais: a citação informada (ou a padrão) e o nome completo, sem repetir. */
function variacoesIniciais(nome, nomeCitacao) {
  const citacao = nomeCitacao || nomeCitacaoPadrao(nome);
  const vistos = new Set();
  return [citacao, nome]
    .map((n) => ({ nome: n.slice(0, 255), nome_normalizado: normalizarTexto(n).slice(0, 255) }))
    .filter((v) => v.nome_normalizado && !vistos.has(v.nome_normalizado) && vistos.add(v.nome_normalizado));
}

/** Dados de `autor: { create }` para docente, discente ou externo. */
function criarAutor(tipo, nome, nomeCitacao) {
  return {
    create: {
      tipo,
      nome_citacao: (nomeCitacao || nomeCitacaoPadrao(nome)).slice(0, 255),
      nomes_citacao: { create: variacoesIniciais(nome, nomeCitacao) },
    },
  };
}

async function exigir(promessa, mensagem) {
  const registro = await promessa;
  if (!registro) throw Erros.naoEncontrado(mensagem);
  return registro;
}

module.exports = { id, paramsId, data, texto, textoOpcional, nomeCitacaoPadrao, variacoesIniciais, criarAutor, exigir };
