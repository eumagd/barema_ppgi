/*
 * core/api — cliente HTTP da API do back end (backend/, rotas em /api).
 *
 * O back end serve este front end no mesmo endereço (http://localhost:3000), então a
 * base padrão é "/api". Para usar outro servidor, defina window.PPGI_API_URL antes deste
 * script. O token do login fica no Store; resposta 401 encerra a sessão e volta ao login.
 */
(function (PPGI) {
  "use strict";

  const { Store } = PPGI;
  const BASE = (window.PPGI_API_URL || "/api").replace(/\/+$/, "");
  const SESSION_KEY = "session";

  class ErroApi extends Error {
    constructor(status, corpo) {
      const erro = (corpo && corpo.erro) || {};
      super(erro.mensagem || (status === 0 ? "Sem conexão com o servidor. Confira se a API está rodando." : `Erro ${status} no servidor.`));
      this.status = status;
      this.codigo = erro.codigo;
      this.detalhes = erro.detalhes;
    }
  }

  function token() {
    const sessao = Store.read(SESSION_KEY, null);
    return sessao && sessao.token;
  }

  function sessaoExpirada() {
    Store.write(SESSION_KEY, null);
    const aqui = window.location.pathname.split("/").pop() + window.location.search;
    const publica = /^(index|login|recuperar-senha|redefinir-senha)\.html/.test(aqui) || aqui === "";
    if (!publica) window.location.replace(`login.html?next=${encodeURIComponent(aqui)}`);
  }

  async function requisitar(metodo, caminho, { corpo, formulario, bruto = false } = {}) {
    const cabecalhos = {};
    const t = token();
    if (t) cabecalhos.Authorization = `Bearer ${t}`;
    let body;
    if (formulario) body = formulario;
    else if (corpo !== undefined) {
      cabecalhos["Content-Type"] = "application/json";
      body = JSON.stringify(corpo);
    }

    let resposta;
    try {
      resposta = await fetch(BASE + caminho, { method: metodo, headers: cabecalhos, body });
    } catch {
      throw new ErroApi(0, null);
    }
    if (resposta.status === 401 && t) {
      sessaoExpirada();
      throw new ErroApi(401, { erro: { mensagem: "Sua sessão expirou. Faça login novamente." } });
    }
    if (bruto && resposta.ok) return resposta;
    const tipo = resposta.headers.get("content-type") || "";
    const dados = resposta.status === 204 ? null : tipo.includes("json") ? await resposta.json() : await resposta.text();
    if (!resposta.ok) throw new ErroApi(resposta.status, dados);
    return dados;
  }

  /** Baixa um arquivo (ex.: exportação XLSX) com o token e oferece para salvar. */
  async function baixar(caminho, nomePadrao) {
    const resposta = await requisitar("GET", caminho, { bruto: true });
    const disposicao = resposta.headers.get("content-disposition") || "";
    const nome = (disposicao.match(/filename="([^"]+)"/) || [])[1] || nomePadrao;
    const url = URL.createObjectURL(await resposta.blob());
    const link = document.createElement("a");
    link.href = url;
    link.download = nome;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }

  PPGI.Api = {
    ErroApi,
    SESSION_KEY,
    get: (c) => requisitar("GET", c),
    post: (c, corpo) => requisitar("POST", c, { corpo: corpo ?? {} }),
    put: (c, corpo) => requisitar("PUT", c, { corpo: corpo ?? {} }),
    patch: (c, corpo) => requisitar("PATCH", c, { corpo: corpo ?? {} }),
    del: (c) => requisitar("DELETE", c),
    enviarArquivo: (c, formulario) => requisitar("POST", c, { formulario }),
    baixar,
  };
})((window.PPGI = window.PPGI || {}));
