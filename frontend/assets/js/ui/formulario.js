/*
 * ui/formulario — campos de formulário com "name" (lidos com FormData no envio) e
 * utilitários para transformar o formulário no corpo da requisição.
 */
(function (PPGI) {
  "use strict";

  const { escapeHtml: esc } = PPGI.Format;

  const rotulo = (id, label, obrigatorio) =>
    `<label for="${id}" class="mb-1 block text-[14px] font-semibold text-ppgi">${esc(label)}${obrigatorio ? ' <span class="text-danger" aria-hidden="true">*</span>' : ""}</label>`;

  /** Campo de texto/número/data. opts: { type, value, required, placeholder, hint, min, max } */
  function campo(id, label, opts = {}) {
    const atributos = [
      `id="${id}"`,
      `name="${id}"`,
      `type="${opts.type || "text"}"`,
      `class="field-input"`,
      `value="${esc(opts.value ?? "")}"`,
      opts.placeholder ? `placeholder="${esc(opts.placeholder)}"` : "",
      opts.required ? "required" : "",
      opts.min !== undefined ? `min="${opts.min}"` : "",
      opts.max !== undefined ? `max="${opts.max}"` : "",
      opts.hint ? `aria-describedby="${id}-dica"` : "",
    ].join(" ");
    const dica = opts.hint ? `<p id="${id}-dica" class="mt-1 text-[12px] text-muted">${esc(opts.hint)}</p>` : "";
    return `<div>${rotulo(id, label, opts.required)}<input ${atributos}>${dica}</div>`;
  }

  /** options: [{ value, label }] */
  function escolha(id, label, options, opts = {}) {
    const vazio = opts.placeholder !== undefined ? `<option value="">${esc(opts.placeholder)}</option>` : "";
    const itens = options
      .map((o) => `<option value="${esc(o.value)}"${String(o.value) === String(opts.value ?? "") ? " selected" : ""}>${esc(o.label)}</option>`)
      .join("");
    const extra = opts.change ? ` data-change="${esc(opts.change)}"` : "";
    return `<div>${rotulo(id, label, opts.required)}<select id="${id}" name="${id}" class="field-input"${opts.required ? " required" : ""}${extra}>${vazio}${itens}</select></div>`;
  }

  function caixa(id, texto, marcado) {
    return `<label class="flex cursor-pointer items-center gap-2 text-[14px] text-ink"><input type="checkbox" id="${id}" name="${id}" class="h-4 w-4 accent-ppgi"${marcado ? " checked" : ""}>${esc(texto)}</label>`;
  }

  /** Lê o formulário: textos aparados, "" vira null; checkbox vira booleano. */
  function ler(form) {
    const dados = {};
    for (const el of form.elements) {
      if (!el.name) continue;
      if (el.type === "checkbox") dados[el.name] = el.checked;
      else if (el.type !== "file") dados[el.name] = el.value.trim() === "" ? null : el.value.trim();
    }
    return dados;
  }

  /** Mensagem de erro da API, com o primeiro detalhe de validação quando houver. */
  function mensagemDeErro(erro) {
    const detalhe = Array.isArray(erro.detalhes) && erro.detalhes[0];
    return detalhe && detalhe.mensagem ? `${detalhe.mensagem}${detalhe.campo ? ` (${detalhe.campo})` : ""}` : erro.message;
  }

  PPGI.Formulario = { campo, escolha, caixa, ler, mensagemDeErro };
})((window.PPGI = window.PPGI || {}));
