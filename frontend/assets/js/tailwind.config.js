/*
 * Configuração do Tailwind (Play CDN) — Paleta institucional PPGI/UFAL
 *   Azul escuro  #04469F — títulos, textos, ícones e logo
 *   Azul claro   #BFCFE6 — bordas e superfícies suaves
 *   Amarelo      #FFDE59 — faixas de destaque e marcadores (texto sobre ele sempre preto)
 *   Branco       #FFFFFF — fundos dos componentes
 *   Preto        #000000 — texto de corpo
 *
 * As cores são variáveis CSS (assets/css/app.css), redefinidas no modo escuro.
 * "white" é a cor de superfície: no escuro vira o azul-marinho dos cartões, e um
 * botão "bg-ppgi text-white" continua legível nos dois temas.
 */
const token = (name) => `rgb(var(--c-${name}) / <alpha-value>)`;

tailwind.config = {
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        white: token("surface"),
        ink: token("ink"),
        page: token("page"),
        muted: token("muted"),
        danger: token("danger"),
        ppgi: {
          DEFAULT: token("ppgi"),
          dark: token("ppgi-strong"),
          soft: token("soft"),
          tint: token("tint"),
          yellow: token("yellow"),
        },
      },
      fontFamily: {
        sans: ["Archivo", "ui-sans-serif", "system-ui", "sans-serif"],
        mono: ["Space Mono", "ui-monospace", "monospace"],
      },
    },
  },
};
