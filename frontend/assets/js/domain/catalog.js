/*
 * domain/catalog — dados de exemplo (fictícios) e parâmetros da Resolução nº 1/2025.
 * Somente leitura: alterações feitas pelo usuário ficam no repository.
 */
(function (PPGI) {
  "use strict";

  const QUALIS_POINTS = { A1: 100, A2: 85, A3: 70, A4: 55, B1: 40, B2: 25, B3: 12.5, B4: 5 };
  const STRATA = Object.keys(QUALIS_POINTS);
  const UPPER_STRATA = ["A1", "A2", "A3", "A4"];
  const TOP_STRATA = ["A1", "A2"];

  const RULES = {
    minUpperStrata: 4,
    minTopStrata: 2,
    minScore: 120,
    minCoauthorConfidence: 80,
  };

  const PERIODS = [
    { id: "2023-2025", label: "2023 – 2025", years: [2023, 2024, 2025] },
    { id: "2022-2024", label: "2022 – 2024", years: [2022, 2023, 2024] },
  ];

  const APP = {
    name: "Plataforma de Gerenciamento de Baremas",
    institution: "PPGI · Instituto de Computação · UFAL",
    program: "Programa de Pós-Graduação em Informática",
  };

  const CYCLE = { year: "2026", deadline: "30/11/2026", deadlineIso: "2026-11-30", resolution: "Resolução nº 1/2025" };

  const TEAM = {
    members: ["Anna Beatriz Bernardo", "Magdiel Santos", "Mariana Lessa"],
    advisor: "Prof. Dr. Ranilson Paiva",
  };

  /* Usuários de demonstração (autenticação simulada no navegador, sem segurança real). */
  const DEMO_USERS = [
    { email: "secretaria@ic.ufal.br", name: "Secretaria do PPGI", role: "Secretaria", password: "ppgi2026" },
    { email: "coordenacao@ic.ufal.br", name: "Coordenação do PPGI", role: "Coordenação", password: "ppgi2026" },
  ];

  const DEPARTMENTS = ["Ciência da Computação", "Sistemas de Software", "Computação Aplicada"];

  const SAMPLE_SYNC_DATE = "11/09/2026";

  const TEACHERS = [
    {
      id: "ana", name: "Ana C. Souza", email: "ana.souza@ic.ufal.br", department: "Ciência da Computação",
      employment: "Efetivo", ppgi: "Permanente", lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "credenciado", label: "Credenciada · válido até 01/2028" },
      undergradCourses: { 2022: 2, 2023: 2, 2024: 1, 2025: 2 }, gradCourses: { 2022: 1, 2023: 1, 2025: 1 },
      ongoingAdvising: 2, finishedAdvisingYears: [2023, 2025],
      report: { status: "Enviado", date: "15/09/2026" },
    },
    {
      id: "bruno", name: "Bruno M. Lima", email: "bruno.lima@ic.ufal.br", department: "Sistemas de Software",
      employment: "Efetivo", ppgi: "Permanente", lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "andamento", label: "Recredenciamento em andamento" },
      undergradCourses: { 2022: 1, 2023: 0, 2024: 2, 2025: 1 }, gradCourses: { 2025: 1 },
      ongoingAdvising: 1, finishedAdvisingYears: [2022],
      report: { status: "Rascunho", date: null },
    },
    {
      id: "carla", name: "Carla R. Pereira", email: "carla.pereira@ic.ufal.br", department: "Ciência da Computação",
      employment: "Efetivo", ppgi: null, lattesSync: null,
      process: { status: "nenhum", label: "Sem processo" },
      undergradCourses: { 2022: 2, 2023: 2, 2024: 2, 2025: 2 }, gradCourses: {},
      ongoingAdvising: 0, finishedAdvisingYears: [], report: null,
    },
    {
      id: "diego", name: "Diego A. Alves", email: "diego.alves@ic.ufal.br", department: "Computação Aplicada",
      employment: "Substituto", ppgi: null, lattesSync: null,
      process: { status: "nenhum", label: "Sem processo" },
      undergradCourses: { 2024: 3, 2025: 3 }, gradCourses: {},
      ongoingAdvising: 0, finishedAdvisingYears: [], report: null,
    },
    {
      id: "fernanda", name: "Fernanda P. Rocha", email: "fernanda.rocha@ic.ufal.br", department: "Sistemas de Software",
      employment: "Efetivo", ppgi: "Permanente", lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "credenciado", label: "Credenciada · válido até 01/2027" },
      undergradCourses: { 2022: 1, 2023: 1, 2024: 1, 2025: 1 }, gradCourses: { 2023: 1, 2025: 1 },
      ongoingAdvising: 3, finishedAdvisingYears: [2024],
      report: { status: "Gerado", date: "12/09/2026" },
    },
    {
      id: "gustavo", name: "Gustavo T. Nogueira", email: "gustavo.nogueira@ic.ufal.br", department: "Computação Aplicada",
      employment: "Efetivo", ppgi: "Colaborador", lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "andamento", label: "Recredenciamento em andamento" },
      undergradCourses: { 2022: 2, 2023: 2, 2024: 2, 2025: 1 }, gradCourses: { 2024: 1 },
      ongoingAdvising: 1, finishedAdvisingYears: [],
      report: { status: "Rascunho", date: null },
    },
    {
      id: "helena", name: "Helena S. Barros", email: "helena.barros@ic.ufal.br", department: "Ciência da Computação",
      employment: "Efetivo", ppgi: "Colaborador", lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "credenciado", label: "Credenciada · válido até 01/2028" },
      undergradCourses: { 2022: 1, 2023: 1, 2024: 2, 2025: 1 }, gradCourses: { 2025: 1 },
      ongoingAdvising: 1, finishedAdvisingYears: [2024],
      report: { status: "Gerado", date: "12/09/2026" },
    },
    {
      id: "igor", name: "Igor V. Martins", email: "igor.martins@ic.ufal.br", department: "Computação Aplicada",
      employment: "Efetivo", ppgi: null, lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "nenhum", label: "Sem processo" },
      undergradCourses: { 2022: 1, 2023: 2, 2024: 1, 2025: 2 }, gradCourses: { 2024: 1 },
      ongoingAdvising: 1, finishedAdvisingYears: [2024], report: null,
    },
    {
      id: "julia", name: "Júlia F. Cavalcante", email: "julia.cavalcante@ic.ufal.br", department: "Sistemas de Software",
      employment: "Efetivo", ppgi: null, lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "nenhum", label: "Sem processo" },
      undergradCourses: { 2024: 2, 2025: 2 }, gradCourses: {},
      ongoingAdvising: 0, finishedAdvisingYears: [], report: null,
    },
    {
      id: "marcos", name: "Marcos L. Teixeira", email: "marcos.teixeira@ic.ufal.br", department: "Ciência da Computação",
      employment: "Efetivo", ppgi: null, lattesSync: SAMPLE_SYNC_DATE,
      process: { status: "nenhum", label: "Sem processo" },
      undergradCourses: { 2022: 1, 2023: 1, 2024: 1, 2025: 1 }, gradCourses: {},
      ongoingAdvising: 1, finishedAdvisingYears: [], report: null,
    },
  ];

  /*
   * Produção científica. authors = ids de docentes do IC.
   * confidence: confiança da identificação automática da coautoria (nomes).
   * suspect: possível coautor do PPGI com nome parecido — exige revisão humana.
   */
  const PUBLICATIONS = [
    { id: "p1", title: "Detecção de anomalias em fluxos de rede", venue: "Journal of Network Analytics", year: 2024, qualis: "A1", authors: ["bruno", "fernanda"], confidence: 98 },
    { id: "p2", title: "Compressão de modelos federados", venue: "IEEE TPDS", year: 2024, qualis: "A2", authors: ["bruno", "ana", "gustavo"], confidence: 95 },
    { id: "p3", title: "Benchmark de consultas em grafos", venue: "SBBD", year: 2023, qualis: "A4", authors: ["bruno"] },
    { id: "p4", title: "Serviços adaptativos em nuvem", venue: "CLOSER", year: 2025, qualis: "A3", authors: ["bruno", "helena"], confidence: 93 },
    { id: "p5", title: "Ferramenta de testes mutantes", venue: "JSERD", year: 2023, qualis: "A4", authors: ["bruno"] },
    { id: "p6", title: "Revisão sistemática de SLAs", venue: "RITA", year: 2024, qualis: "B3", authors: ["bruno"] },
    { id: "p7", title: "Edge scheduling for IoT workloads", venue: "IEEE IoT Journal", year: 2025, qualis: "A1", authors: ["bruno", "fernanda"], confidence: 98 },
    { id: "p8", title: "A survey on software testing", venue: "JSERD", year: 2025, qualis: "B1", authors: ["bruno"], suspect: { id: "ana", name: "Ana Clara Souza", confidence: 62 } },
    { id: "p9", title: "Orquestração de contêineres em clusters acadêmicos", venue: "WSCAD", year: 2022, qualis: "B2", authors: ["bruno"] },
    { id: "p10", title: "Fuzzy matching of author names", venue: "SBBD", year: 2023, qualis: "A4", authors: ["ana", "fernanda"], confidence: 91 },
    { id: "p11", title: "Aprendizado ativo para classificação de textos", venue: "Information Sciences", year: 2024, qualis: "A1", authors: ["ana"] },
    { id: "p12", title: "Métricas de legibilidade de código", venue: "Empirical Software Engineering", year: 2025, qualis: "A2", authors: ["ana"] },
    { id: "p13", title: "Ensino de programação com juízes on-line", venue: "SBIE", year: 2023, qualis: "B1", authors: ["ana"] },
    { id: "p14", title: "Escalonamento energético em data centers", venue: "FGCS", year: 2024, qualis: "A3", authors: ["fernanda"] },
    { id: "p15", title: "Gêmeos digitais para cidades inteligentes", venue: "IEEE Access", year: 2025, qualis: "A2", authors: ["fernanda", "helena"], confidence: 96 },
    { id: "p16", title: "Visualização de dados educacionais", venue: "RBIE", year: 2024, qualis: "B1", authors: ["gustavo"] },
    { id: "p17", title: "Chatbots para atendimento acadêmico", venue: "WEI", year: 2025, qualis: "B2", authors: ["gustavo"] },
    { id: "p18", title: "Redes neurais em grafos para recomendação", venue: "BRACIS", year: 2023, qualis: "A4", authors: ["helena"] },
    { id: "p19", title: "Explicabilidade em modelos de crédito", venue: "Expert Systems with Applications", year: 2024, qualis: "A3", authors: ["helena"] },
    { id: "p20", title: "Verificação formal de contratos inteligentes", venue: "Formal Aspects of Computing", year: 2023, qualis: "A2", authors: ["igor"] },
    { id: "p21", title: "Síntese de programas a partir de exemplos", venue: "ACM TOPLAS", year: 2024, qualis: "A1", authors: ["igor"] },
    { id: "p22", title: "Refatoração automática de testes", venue: "SBES", year: 2024, qualis: "A4", authors: ["igor"] },
    { id: "p23", title: "Análise estática de vulnerabilidades em Python", venue: "JSS", year: 2025, qualis: "A3", authors: ["igor"] },
    { id: "p24", title: "Gamificação no ensino de algoritmos", venue: "SBIE", year: 2024, qualis: "B1", authors: ["carla"] },
    { id: "p25", title: "Acessibilidade em aplicativos móveis", venue: "IHC", year: 2025, qualis: "A4", authors: ["julia"] },
    { id: "p26", title: "Compiladores para arquiteturas heterogêneas", venue: "SBAC-PAD", year: 2023, qualis: "A3", authors: ["marcos"] },
    { id: "p27", title: "Paralelismo em simulações de fluidos", venue: "WSCAD", year: 2024, qualis: "B2", authors: ["marcos"] },
  ];

  PPGI.Catalog = Object.freeze({
    APP, TEAM, DEMO_USERS,
    QUALIS_POINTS, STRATA, UPPER_STRATA, TOP_STRATA, RULES, PERIODS, CYCLE, DEPARTMENTS, TEACHERS, PUBLICATIONS,
  });
})((window.PPGI = window.PPGI || {}));
