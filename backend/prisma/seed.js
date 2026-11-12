/*
 * Dados de demonstração — os mesmos docentes e publicações fictícios do front end.
 * Rodar com: npx prisma db seed
 */
const { PrismaClient } = require("@prisma/client");
const crypto = require("node:crypto");

const prisma = new PrismaClient();

/* Pontuação por estrato (Resolução nº 1/2025), igual ao front end. */
const QUALIS_POINTS = { A1: 100, A2: 85, A3: 70, A4: 55, B1: 40, B2: 25, B3: 12.5, B4: 5 };
const PERIODO = [2023, 2024, 2025];
const ANO_BASE_QUALIS = 2024;
const AREA = "Ciência da Computação";

/* Hash simples com scrypt (módulo nativo do Node, sem dependências extras). */
function hashSenha(senha) {
  const salt = crypto.randomBytes(16).toString("hex");
  const hash = crypto.scryptSync(senha, salt, 64).toString("hex");
  return `scrypt$${salt}$${hash}`;
}

const DOCENTES = [
  { chave: "ana", matricula: "IC0001", nome: "Ana C. Souza", email: "ana.souza@ic.ufal.br", vinculo: "PERMANENTE", citacao: "SOUZA, A. C." },
  { chave: "bruno", matricula: "IC0002", nome: "Bruno M. Lima", email: "bruno.lima@ic.ufal.br", vinculo: "PERMANENTE", citacao: "LIMA, B. M." },
  { chave: "carla", matricula: "IC0003", nome: "Carla R. Pereira", email: "carla.pereira@ic.ufal.br", vinculo: null, citacao: "PEREIRA, C. R." },
  { chave: "fernanda", matricula: "IC0005", nome: "Fernanda P. Rocha", email: "fernanda.rocha@ic.ufal.br", vinculo: "PERMANENTE", citacao: "ROCHA, F. P." },
  { chave: "gustavo", matricula: "IC0006", nome: "Gustavo T. Nogueira", email: "gustavo.nogueira@ic.ufal.br", vinculo: "COLABORADOR", citacao: "NOGUEIRA, G. T." },
  { chave: "helena", matricula: "IC0007", nome: "Helena S. Barros", email: "helena.barros@ic.ufal.br", vinculo: "COLABORADOR", citacao: "BARROS, H. S." },
];

/* issn_sigla fictício para periódicos (DEMO-xxxx); sigla real para conferências. */
const VEICULOS = [
  { chave: "JNA", nome: "Journal of Network Analytics", issn_sigla: "DEMO-0001", tipo: "PERIODICO", estrato: "A1" },
  { chave: "TPDS", nome: "IEEE Transactions on Parallel and Distributed Systems", issn_sigla: "DEMO-0002", tipo: "PERIODICO", estrato: "A2" },
  { chave: "SBBD", nome: "Simpósio Brasileiro de Banco de Dados", issn_sigla: "SBBD", tipo: "CONFERENCIA", estrato: "A4" },
  { chave: "CLOSER", nome: "Int. Conference on Cloud Computing and Services Science", issn_sigla: "CLOSER", tipo: "CONFERENCIA", estrato: "A3" },
  { chave: "JSERD", nome: "Journal of Software Engineering Research and Development", issn_sigla: "DEMO-0003", tipo: "PERIODICO", estrato: "A4" },
  { chave: "RITA", nome: "Revista de Informática Teórica e Aplicada", issn_sigla: "DEMO-0004", tipo: "PERIODICO", estrato: "B3" },
  { chave: "IOTJ", nome: "IEEE Internet of Things Journal", issn_sigla: "DEMO-0005", tipo: "PERIODICO", estrato: "A1" },
  { chave: "WSCAD", nome: "Simpósio em Sistemas Computacionais de Alto Desempenho", issn_sigla: "WSCAD", tipo: "CONFERENCIA", estrato: "B2" },
  { chave: "INS", nome: "Information Sciences", issn_sigla: "DEMO-0006", tipo: "PERIODICO", estrato: "A1" },
  { chave: "ACCESS", nome: "IEEE Access", issn_sigla: "DEMO-0007", tipo: "PERIODICO", estrato: "A2" },
];

const PUBLICACOES = [
  { titulo: "Detecção de anomalias em fluxos de rede", veiculo: "JNA", ano: 2024, autores: ["bruno", "fernanda"], correspondencia: 98 },
  { titulo: "Compressão de modelos federados", veiculo: "TPDS", ano: 2024, autores: ["bruno", "ana", "gustavo"], correspondencia: 95 },
  { titulo: "Benchmark de consultas em grafos", veiculo: "SBBD", ano: 2023, autores: ["bruno"] },
  { titulo: "Serviços adaptativos em nuvem", veiculo: "CLOSER", ano: 2025, autores: ["bruno", "helena"], correspondencia: 93 },
  { titulo: "Ferramenta de testes mutantes", veiculo: "JSERD", ano: 2023, autores: ["bruno"] },
  { titulo: "Revisão sistemática de SLAs", veiculo: "RITA", ano: 2024, autores: ["bruno"] },
  { titulo: "Edge scheduling for IoT workloads", veiculo: "IOTJ", ano: 2025, autores: ["bruno", "fernanda"], correspondencia: 98 },
  { titulo: "Orquestração de contêineres em clusters acadêmicos", veiculo: "WSCAD", ano: 2022, autores: ["bruno"] },
  { titulo: "Fuzzy matching of author names", veiculo: "SBBD", ano: 2023, autores: ["ana", "fernanda"], correspondencia: 91 },
  { titulo: "Aprendizado ativo para classificação de textos", veiculo: "INS", ano: 2024, autores: ["ana"] },
  { titulo: "Gêmeos digitais para cidades inteligentes", veiculo: "ACCESS", ano: 2025, autores: ["fernanda", "helena"], correspondencia: 96 },
];

async function limpar() {
  // Ordem inversa das dependências.
  await prisma.avaliacaoPublicacao.deleteMany();
  await prisma.avaliacao.deleteMany();
  await prisma.autoria.deleteMany();
  await prisma.publicacao.deleteMany();
  await prisma.estratoQualis.deleteMany();
  await prisma.veiculo.deleteMany();
  await prisma.autor.deleteMany();
  await prisma.coorientacao.deleteMany();
  await prisma.discente.deleteMany();
  await prisma.externo.deleteMany();
  await prisma.docente.deleteMany();
  await prisma.resolucao.deleteMany();
  await prisma.usuario.deleteMany();
}

async function main() {
  await limpar();

  await prisma.usuario.createMany({
    data: [
      { nome: "Secretaria do PPGI", email: "secretaria@ic.ufal.br", senha_hash: hashSenha("ppgi2026"), perfil: "SECRETARIA" },
      { nome: "Coordenação do PPGI", email: "coordenacao@ic.ufal.br", senha_hash: hashSenha("ppgi2026"), perfil: "COORDENACAO" },
    ],
  });

  const resolucao = await prisma.resolucao.create({
    data: {
      numero_ano: "1/2025",
      data_vigencia: new Date("2025-01-01"),
      link_documento:
        "https://ic.ufal.br/pt-br/pos-graduacao/informatica/documentos/regimento/resolucoes/resolucoes_-1-_assinado-1.pdf/view",
    },
  });

  /* Docentes + seus registros na categoria AUTOR. */
  const docentes = {};
  const autores = {};
  for (const d of DOCENTES) {
    const docente = await prisma.docente.create({
      data: {
        matricula: d.matricula,
        nome: d.nome,
        email: d.email,
        vinculo: d.vinculo,
        data_ultima_atualizacao: new Date("2026-09-11"),
        autor: { create: { tipo: "DOCENTE", nome_citacao: d.citacao } },
      },
      include: { autor: true },
    });
    docentes[d.chave] = docente;
    autores[d.chave] = docente.autor;
  }

  /* Discentes (Orienta) e uma coorientação por docente colaborador e outra por membro externo. */
  const disc1 = await prisma.discente.create({
    data: { matricula: "PPGI2024001", nome: "Lucas Andrade", ano_ingresso: 2024, id_orientador: docentes.bruno.id_docente },
  });
  await prisma.discente.create({
    data: { matricula: "PPGI2025002", nome: "Marina Costa", ano_ingresso: 2025, id_orientador: docentes.ana.id_docente },
  });
  const disc3 = await prisma.discente.create({
    data: { matricula: "PPGI2025003", nome: "Rafael Tenório", ano_ingresso: 2025, id_orientador: docentes.fernanda.id_docente },
  });
  const externo = await prisma.externo.create({ data: { nome: "Paulo Henrique Lins", inst_origem: "UFPE" } });

  await prisma.coorientacao.createMany({
    data: [
      { id_discente: disc1.id_discente, id_docente: docentes.gustavo.id_docente },
      { id_discente: disc3.id_discente, id_externo: externo.id_externo },
    ],
  });

  /* Veículos e Qualis (entidade fraca). */
  const veiculos = {};
  for (const v of VEICULOS) {
    veiculos[v.chave] = await prisma.veiculo.create({
      data: {
        nome: v.nome,
        issn_sigla: v.issn_sigla,
        tipo: v.tipo,
        estratos: {
          create: { ano_base: ANO_BASE_QUALIS, area_de_atuacao: AREA, estrato: v.estrato, pontuacao: QUALIS_POINTS[v.estrato] },
        },
      },
    });
  }

  /* Publicações e autorias (Escreve, com ordem_autoria). */
  const publicacoes = [];
  for (const p of PUBLICACOES) {
    const pub = await prisma.publicacao.create({
      data: {
        titulo: p.titulo,
        ano_publicacao: p.ano,
        correspondencia: p.correspondencia ?? null,
        id_veiculo: veiculos[p.veiculo].id_veiculo,
        autorias: {
          create: p.autores.map((chave, i) => ({ id_autor: autores[chave].id_autor, ordem_autoria: i + 1 })),
        },
      },
    });
    publicacoes.push({ ...p, id_publicacao: pub.id_publicacao });
  }

  /* Recredenciamento do Bruno: publicações do período, com a pontuação dividida entre coautores do PPGI. */
  const doPpgi = (chave) => DOCENTES.find((d) => d.chave === chave).vinculo !== null;
  const consideradas = publicacoes.filter((p) => p.autores.includes("bruno") && PERIODO.includes(p.ano));
  const itens = consideradas.map((p) => {
    const estrato = VEICULOS.find((v) => v.chave === p.veiculo).estrato;
    const coautoresPpgi = p.autores.filter(doPpgi).length;
    const pontos = Math.round((QUALIS_POINTS[estrato] / coautoresPpgi) * 100) / 100;
    return { id_publicacao: p.id_publicacao, considerada: true, pontos_atribuidos: pontos };
  });
  const total = itens.reduce((s, i) => s + i.pontos_atribuidos, 0);

  await prisma.avaliacao.create({
    data: {
      tipo: "RECREDENCIAMENTO",
      data_solicitacao: new Date("2026-09-15"),
      status: "EM_ANDAMENTO",
      pontuacao_pesquisa: Math.round(total * 100) / 100,
      id_docente: docentes.bruno.id_docente,
      id_resolucao: resolucao.id_resolucao,
      publicacoes: { create: itens },
    },
  });

  /* Ana: recredenciamento já deferido, com relatório enviado. */
  await prisma.avaliacao.create({
    data: {
      tipo: "RECREDENCIAMENTO",
      data_solicitacao: new Date("2026-08-20"),
      status: "DEFERIDO",
      valido_ate: new Date("2028-01-31"),
      status_relatorio: "ENVIADO",
      data_envio_relatorio: new Date("2026-09-15T10:00:00Z"),
      cumpriu_docencia: true,
      cumpriu_orientacao: true,
      id_docente: docentes.ana.id_docente,
      id_resolucao: resolucao.id_resolucao,
    },
  });

  console.log(`Seed concluído: ${DOCENTES.length} docentes, ${PUBLICACOES.length} publicações, 2 avaliações.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
