/*
 * core/boot — carregador das telas internas.
 *
 * Uso no HTML (no lugar do <script> da página):
 *   <script src="assets/js/core/boot.js" data-page="assets/js/pages/professores.js"></script>
 *
 * Sem sessão, vai para o login. Com sessão, busca os dados na API (domain/dados) e só
 * então carrega o script da página, que pode ler tudo de forma síncrona como antes.
 */
(function (PPGI) {
  "use strict";

  const script = document.currentScript;
  const pagina = script.dataset.page;
  /* Telas de um docente: sem nenhum docente cadastrado, não há o que mostrar. */
  const DO_DOCENTE = ["perfil", "calculo", "verificacao", "relatorios"];
  const nomePagina = (pagina.match(/([a-z-]+)\.js$/) || [])[1];
  const app = document.getElementById("app");

  function irParaLogin() {
    const aqui = window.location.pathname.split("/").pop() + window.location.search;
    window.location.replace(`login.html?next=${encodeURIComponent(aqui)}`);
  }

  function carregando() {
    app.innerHTML = `<div class="flex min-h-screen items-center justify-center p-6" role="status" aria-live="polite">
      <div class="text-center">
        <div class="mx-auto h-10 w-10 animate-spin border-4 border-ppgi-soft border-t-ppgi"></div>
        <p class="mt-4 text-[15px] font-semibold text-ppgi">Carregando os dados do servidor…</p>
      </div>
    </div>`;
  }

  function falhou(erro) {
    const esc = PPGI.Format.escapeHtml;
    app.innerHTML = `<div class="flex min-h-screen items-center justify-center p-6">
      <div role="alert" class="max-w-md border border-danger bg-white p-6">
        <h1 class="text-lg font-extrabold text-danger">Não foi possível carregar os dados</h1>
        <p class="mt-2 text-[14px] text-ink/80">${esc(erro.message)}</p>
        <p class="mt-2 text-[13px] text-muted">Confira se a API está rodando (<code>npm run dev</code> na pasta backend) e tente de novo.</p>
        <div class="mt-4 flex gap-2">
          <button type="button" id="tentar" class="border border-ppgi bg-ppgi px-4 py-2 text-[14px] font-semibold text-white">Tentar de novo</button>
          <a href="login.html" class="border border-ppgi-soft px-4 py-2 text-[14px] font-semibold text-ppgi">Ir para o login</a>
        </div>
      </div>
    </div>`;
    document.getElementById("tentar").addEventListener("click", iniciar);
  }

  function iniciar() {
    if (!PPGI.Auth.currentUser()) return irParaLogin();
    carregando();
    PPGI.Dados.carregar(PPGI.Repository.currentPeriod())
      .then(() => {
        if (DO_DOCENTE.includes(nomePagina) && !PPGI.Dados.docentes().length) {
          window.location.replace("cadastros.html?aba=docentes");
          return;
        }
        const s = document.createElement("script");
        s.src = pagina;
        document.body.appendChild(s);
      })
      .catch((erro) => {
        if (erro.status !== 401) falhou(erro);
      });
  }

  iniciar();
})(window.PPGI);
