/*
 * ui/components — componentes visuais do design system como funções puras
 * (recebem dados, devolvem HTML). Nenhum componente acessa domínio ou Store.
 *
 * Texto sobre amarelo usa "text-black" (fixo) para manter contraste nos dois temas.
 */
(function (PPGI) {
  "use strict";

  const { escapeHtml: esc, initials } = PPGI.Format;

  function dataAttributes(data = {}) {
    return Object.entries(data).map(([k, v]) => ` data-${k}="${esc(v)}"`).join("");
  }

  /* ---------- Marca ---------- */
  function logo(className = "h-10 w-auto") {
    return `<img src="assets/img/logo-ppgi.png" alt="PPGI" class="logo-light ${className}"><img src="assets/img/logo-ppgi-dark.png" alt="PPGI" class="logo-dark ${className}">`;
  }

  /** Botão de alternar tema. A página registra a ação "toggle-theme". */
  function themeToggle(attr = "data-action") {
    return `<button type="button" ${attr}="toggle-theme" class="inline-flex h-10 w-10 shrink-0 items-center justify-center border border-ppgi-soft bg-white text-ppgi hover:border-ppgi" aria-label="Alternar modo claro/escuro" title="Alternar modo claro/escuro">
      <svg aria-hidden="true" viewBox="0 0 24 24" class="h-5 w-5 dark:hidden" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/></svg>
      <svg aria-hidden="true" viewBox="0 0 24 24" class="hidden h-5 w-5 dark:block" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/></svg>
    </button>`;
  }

  /* ---------- Marcadores e rótulos ---------- */
  function marker(size = "h-2.5 w-2.5") {
    return `<span aria-hidden="true" class="${size} shrink-0 bg-ppgi-yellow ring-1 ring-black/10"></span>`;
  }

  const TAG_TONES = {
    blue: "border-ppgi bg-ppgi-tint text-ppgi",
    yellow: "border-black/20 bg-ppgi-yellow text-black",
    soft: "border-ppgi-soft bg-white text-muted",
    solid: "border-ppgi bg-ppgi text-white",
    fail: "border-danger bg-danger/10 text-danger",
  };

  function tag(text, tone = "blue") {
    return `<span class="inline-block whitespace-nowrap border px-2 py-0.5 font-mono text-[11px] font-bold uppercase tracking-[0.04em] ${TAG_TONES[tone]}">${esc(text)}</span>`;
  }

  function avatar(name, size = "h-8 w-8 text-[11px]") {
    return `<span aria-hidden="true" class="inline-flex ${size} shrink-0 items-center justify-center rounded-full border border-ppgi bg-ppgi-tint font-mono font-bold text-ppgi">${esc(initials(name))}</span>`;
  }

  /* ---------- Botões ---------- */
  const BUTTON_VARIANTS = {
    primary: "border-ppgi bg-ppgi text-white hover:bg-ppgi-dark",
    outline: "border-ppgi bg-white text-ppgi hover:bg-ppgi-tint",
    soft: "border-ppgi-soft bg-ppgi-tint text-ppgi hover:border-ppgi",
    yellow: "border-black/30 bg-ppgi-yellow text-black hover:border-black",
    danger: "border-danger bg-white text-danger hover:bg-danger/10",
    ghost: "border-transparent bg-transparent text-ppgi underline underline-offset-2 hover:bg-ppgi-tint",
  };

  /**
   * Botão ou link com aparência de botão.
   * opts: { variant, href, action, data, wide, disabled, label (aria), pressed, type, size }
   */
  function button(text, opts = {}) {
    const variant = BUTTON_VARIANTS[opts.variant || "primary"];
    const size = opts.size === "lg" ? "min-h-12 px-6 text-[15px]" : "min-h-10 px-4 text-[14px]";
    const width = opts.wide ? "w-full" : "";
    const disabled = opts.disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "";
    const cls = `inline-flex items-center justify-center gap-1.5 border py-2 font-semibold transition-colors ${size} ${variant} ${width} ${disabled}`;
    const aria = opts.label ? ` aria-label="${esc(opts.label)}"` : "";
    if (opts.href) return `<a href="${esc(opts.href)}" class="${cls}"${aria}>${text}</a>`;
    const action = opts.action ? ` data-action="${esc(opts.action)}"` : "";
    const pressed = opts.pressed === undefined ? "" : ` aria-pressed="${opts.pressed}"`;
    return `<button type="${opts.type || "button"}" class="${cls}"${action}${dataAttributes(opts.data)}${aria}${pressed}${opts.disabled ? " disabled" : ""}>${text}</button>`;
  }

  /* ---------- Contêineres ---------- */
  function panel({ title, actions = "", body, className = "", id = "" }) {
    const header = title
      ? `<header class="flex flex-wrap items-center justify-between gap-2 border-b border-ppgi-soft px-5 py-3">
          <div class="flex items-center gap-2.5">
            ${marker()}
            <h2 class="text-[14px] font-bold uppercase tracking-[0.05em] text-ppgi">${esc(title)}</h2>
          </div>
          ${actions ? `<div class="flex flex-wrap items-center gap-2">${actions}</div>` : ""}
        </header>`
      : "";
    return `<section ${id ? `id="${id}"` : ""} class="border border-ppgi-soft bg-white shadow-sm shadow-black/5 ${className}">
      ${header}
      <div class="p-5">${body}</div>
    </section>`;
  }

  function sectionTitle(text) {
    return `<div class="mb-3 flex items-center gap-2.5">
      ${marker("h-3 w-3")}
      <h3 class="text-[14px] font-bold uppercase tracking-[0.06em] text-ppgi">${esc(text)}</h3>
    </div>`;
  }

  const ALERT_TONES = {
    info: { icon: "ℹ", cls: "border-ppgi bg-ppgi-tint text-ppgi", body: "text-ink/80", role: "status" },
    ok: { icon: "✓", cls: "border-ppgi bg-white text-ppgi", body: "text-ink/80", role: "status" },
    error: { icon: "✗", cls: "border-danger bg-danger/5 text-danger", body: "text-ink/80", role: "alert" },
    highlight: { icon: "■", cls: "border-black/30 bg-ppgi-yellow text-black", body: "text-black/80", role: "status" },
  };

  function alert({ tone = "info", title, body = "", actions = "" }) {
    const cfg = ALERT_TONES[tone];
    return `<div role="${cfg.role}" class="flex flex-wrap items-start gap-3 border px-4 py-3 ${cfg.cls}">
      <span aria-hidden="true" class="mt-0.5 font-mono text-[15px] font-bold">${cfg.icon}</span>
      <div class="min-w-0 flex-1">
        <p class="text-[14px] font-bold">${esc(title)}</p>
        ${body ? `<div class="mt-0.5 text-[14px] leading-relaxed ${cfg.body}">${body}</div>` : ""}
      </div>
      ${actions ? `<div class="flex flex-wrap gap-2">${actions}</div>` : ""}
    </div>`;
  }

  function stat({ value, label, hint = "", tone = "default" }) {
    const valueColor = tone === "fail" ? "text-danger" : "text-ppgi";
    return `<div class="border border-ppgi-soft bg-white px-4 py-3">
      <p class="text-[13px] text-muted">${esc(label)}</p>
      <p class="mt-1 text-2xl font-extrabold ${valueColor}">${value}</p>
      ${hint ? `<p class="mt-0.5 font-mono text-[12px] text-muted">${hint}</p>` : ""}
    </div>`;
  }

  /* ---------- Tabela ----------
   * rows: array de arrays de células (HTML) ou { group: "Título" } para linha de grupo. */
  function table({ head, rows, footnote = "", caption = "" }) {
    const headHtml = head
      .map((h) => `<th scope="col" class="border border-ppgi px-3 py-2 font-mono text-[11px] font-bold uppercase tracking-[0.06em] whitespace-nowrap">${esc(h)}</th>`)
      .join("");
    const bodyHtml = rows
      .map((row, i) => {
        if (row.group) {
          return `<tr><th scope="colgroup" colspan="${head.length}" class="border border-ppgi-soft bg-ppgi-tint px-3 py-2 text-left font-mono text-[11px] font-bold uppercase tracking-[0.08em] text-ppgi">${esc(row.group)}</th></tr>`;
        }
        const zebra = i % 2 ? "bg-ppgi-tint/50" : "bg-white";
        const cells = row.map((cell) => `<td class="border border-ppgi-soft px-3 py-2 align-top text-ink/90">${cell}</td>`).join("");
        return `<tr class="${zebra}">${cells}</tr>`;
      })
      .join("");
    return `<div>
      <div class="overflow-x-auto">
        <table class="w-full border-collapse text-left text-[14px]">
          ${caption ? `<caption class="sr-only">${esc(caption)}</caption>` : ""}
          <thead><tr class="bg-ppgi text-white">${headHtml}</tr></thead>
          <tbody>${bodyHtml}</tbody>
        </table>
      </div>
      ${footnote ? `<p class="mt-2 font-mono text-[11px] text-muted">${esc(footnote)}</p>` : ""}
    </div>`;
  }

  function emptyState(text) {
    return `<p class="border border-dashed border-ppgi-soft bg-ppgi-tint/40 px-4 py-6 text-center text-[14px] text-muted">${esc(text)}</p>`;
  }

  /* ---------- Formulário ---------- */
  function fieldLabel(label) {
    return `<span class="mb-1 block text-[14px] font-semibold text-ppgi">${esc(label)}</span>`;
  }

  /** options: [{ value, label }] — placeholder opcional vira primeira opção vazia. */
  function selectField({ id, label, options, value, action, placeholder }) {
    const empty = placeholder ? `<option value=""${value ? "" : " selected"}>${esc(placeholder)}</option>` : "";
    const opts = options
      .map((o) => `<option value="${esc(o.value)}"${o.value === value ? " selected" : ""}>${esc(o.label)}</option>`)
      .join("");
    return `<label class="block" for="${id}">
      ${fieldLabel(label)}
      <select id="${id}" class="field-input" data-change="${esc(action)}">${empty}${opts}</select>
    </label>`;
  }

  function searchField({ id, label, placeholder, value, action }) {
    return `<label class="block" for="${id}">
      ${fieldLabel(label)}
      <input id="${id}" type="search" class="field-input" placeholder="${esc(placeholder)}" value="${esc(value)}" data-input="${esc(action)}" autocomplete="off">
    </label>`;
  }

  /** Campo de texto de formulário com mensagem de erro acessível. */
  function textField({ id, label, type = "text", value = "", placeholder = "", autocomplete = "", error = "", hint = "", action = "", trailing = "" }) {
    const describedBy = error ? `${id}-erro` : hint ? `${id}-dica` : "";
    const message = error
      ? `<p id="${id}-erro" class="mt-1 text-[13px] font-semibold text-danger">✗ ${esc(error)}</p>`
      : hint ? `<p id="${id}-dica" class="mt-1 text-[13px] text-muted">${esc(hint)}</p>` : "";
    return `<div>
      <label for="${id}">${fieldLabel(label)}</label>
      <div class="relative">
        <input id="${id}" name="${id}" type="${type}" class="field-input ${trailing ? "pr-24" : ""}" value="${esc(value)}" placeholder="${esc(placeholder)}"
          ${autocomplete ? `autocomplete="${autocomplete}"` : ""} ${action ? `data-input="${esc(action)}"` : ""}
          ${error ? 'aria-invalid="true"' : ""} ${describedBy ? `aria-describedby="${describedBy}"` : ""}>
        ${trailing ? `<div class="absolute inset-y-0 right-1 flex items-center">${trailing}</div>` : ""}
      </div>
      ${message}
    </div>`;
  }

  function checkbox({ checked, text, action, data = {} }) {
    return `<label class="flex cursor-pointer items-start gap-2.5 text-[14px] text-ink">
      <input type="checkbox" class="mt-0.5 h-4 w-4 shrink-0 accent-ppgi" data-change="${esc(action)}"${dataAttributes(data)}${checked ? " checked" : ""}>
      <span>${text}</span>
    </label>`;
  }

  /** Grupo de botões exclusivos. options: [{ value, label }] */
  function segmented({ label, options, value, action }) {
    const items = options
      .map((o) => {
        const active = o.value === value;
        const cls = active ? "border-ppgi bg-ppgi text-white" : "border-ppgi-soft bg-white text-ppgi hover:bg-ppgi-tint";
        return `<button type="button" aria-pressed="${active}" data-action="${esc(action)}" data-value="${esc(o.value)}" class="-ml-px flex-1 whitespace-nowrap border px-3 py-2 text-[14px] font-semibold first:ml-0 ${cls}">${esc(o.label)}</button>`;
      })
      .join("");
    return `<div role="group" aria-label="${esc(label)}" class="flex">${items}</div>`;
  }

  /* ---------- Ajuda contextual ---------- */
  function help(title, body) {
    return `<details class="group border border-ppgi-soft bg-white">
      <summary class="flex cursor-pointer list-none items-center gap-2 px-4 py-2.5 text-[14px] font-semibold text-ppgi">
        <span aria-hidden="true" class="inline-flex h-5 w-5 items-center justify-center border border-ppgi font-mono text-[11px]">?</span>
        ${esc(title)}
        <span aria-hidden="true" class="ml-auto transition-transform group-open:rotate-180">▾</span>
      </summary>
      <div class="border-t border-ppgi-soft px-4 py-3 text-[14px] leading-relaxed text-ink/80">${body}</div>
    </details>`;
  }

  PPGI.UI = {
    logo, themeToggle, marker, tag, avatar, button, panel, sectionTitle, alert, stat, table, emptyState,
    selectField, searchField, textField, checkbox, segmented, help,
  };
})((window.PPGI = window.PPGI || {}));
