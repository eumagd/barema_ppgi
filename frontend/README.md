# Front end — Plataforma de Gerenciamento de Baremas (PPGI/UFAL)

> Esta pasta contém o front end do projeto **Plataforma de Apoio ao Credenciamento e Recredenciamento de Docentes do PPGI/UFAL**. Para o contexto geral (objetivo, equipe, requisitos RF/RNF e stakeholders), veja o [README da raiz](../README.md).

Protótipo navegável (HTML, CSS e JavaScript puro, com Tailwind via CDN) do sistema de
gerenciamento de baremas do Programa de Pós-Graduação em Informática da UFAL: cálculo da
pontuação da produção científica, verificação de requisitos, relatórios e credenciamento /
recredenciamento de docentes.

Não precisa de build nem servidor: **abra `index.html` no navegador** (duplo clique).
A internet só é necessária para o Tailwind (CDN) e as fontes (Google Fonts).

> Se preferir servir por HTTP: `python3 -m http.server 8000` nesta pasta e acesse `http://localhost:8000`.

## Acesso de demonstração

| E-mail | Senha |
| --- | --- |
| `secretaria@ic.ufal.br` | `ppgi2026` |
| `coordenacao@ic.ufal.br` | `ppgi2026` |

A tela de login tem um botão “Preencher automaticamente”. A autenticação é **simulada no
navegador** (não há servidor nem segurança real) e serve só para demonstrar o fluxo.

## Páginas

**Públicas**

| Arquivo | Página |
| --- | --- |
| `index.html` | Página inicial do site: o sistema, funcionalidades, como funciona, quem somos |
| `login.html` | Entrar (com validação, mostrar senha e retorno à página pedida) |
| `recuperar-senha.html` | Pedido de link de recuperação |
| `redefinir-senha.html?email=…&token=demo` | Criação de nova senha com regras em tempo real |

**Internas (exigem login)**

| Arquivo | Tela |
| --- | --- |
| `painel.html` | Painel: indicadores do ciclo, processos em andamento, relatórios a enviar, Lattes |
| `professores.html` | Docentes, com filtro de vínculo (Todos do IC, PPGI, Permanentes, Colaboradores, Fora do PPGI). Atalho: `?vinculo=ppgi` |
| `perfil.html?d=<id>` | Perfil do docente |
| `calculo.html?d=<id>` | Cálculo do barema (exporta CSV) |
| `verificacao.html?d=<id>` | Verificação de requisitos (exporta CSV) |
| `relatorios.html?d=<id>` | Relatório do docente (PDF pela impressão, envio por e-mail) |
| `credenciamento.html` | Credenciamento/recredenciamento individual ou em lote, com conferência dos requisitos. Também `?d=<id>` (aba do docente) e `?modo=lote` |

Ids de docentes: `ana`, `bruno`, `carla`, `diego`, `fernanda`, `gustavo`, `helena`, `igor`, `julia`, `marcos`.

As ações (desvincular, sinalizar, enviar relatório, revisar coautorias, iniciar processo,
trocar senha, período e tema) ficam salvas no `localStorage`. **“Restaurar dados de
demonstração”**, no rodapé do menu lateral, volta os dados ao estado inicial sem desconectar.

O botão de lua/sol alterna entre **modo claro e escuro**. Sem escolha salva, a plataforma segue o tema do sistema operacional.

## Arquitetura

Módulos pequenos com responsabilidade única, organizados em camadas. Cada arquivo é uma IIFE
que registra seu módulo no namespace `window.PPGI`. ES modules (`import`) não foram usados
porque o navegador os bloqueia em `file://`, e o objetivo é abrir com duplo clique.

```
assets/
├── css/app.css          tokens de cor (claro/escuro), campos, impressão
├── img/                 logo do PPGI (original, recortada e versão para fundo escuro)
└── js/
    ├── tailwind.config.js  cores do Tailwind apontando para os tokens CSS
    ├── core/            infraestrutura, sem regra de negócio
    │   ├── store.js         persistência (localStorage com fallback em memória)
    │   ├── format.js        números pt-BR, escape de HTML, URL
    │   └── theme.js         tema claro/escuro (carregado no <head>, sem piscar)
    ├── domain/          dados e regras, não conhece HTML
    │   ├── catalog.js       dados fictícios, equipe, usuários de demonstração e parâmetros da Resolução nº 1/2025
    │   ├── repository.js    leitura dos dados + alterações salvas pelo usuário
    │   ├── barema.js        cálculo da pontuação e verificação de requisitos (funções puras)
    │   ├── auth.js          login, sessão e recuperação de senha (simulados)
    │   └── use-cases.js     ações que mudam o estado (desvincular, iniciar processo, enviar relatório…)
    ├── ui/              apresentação genérica, não conhece o domínio
    │   ├── components.js    componentes do design system (funções dados → HTML)
    │   ├── feedback.js      modal acessível e toasts
    │   ├── export.js        CSV e impressão
    │   └── view.js          render + delegação de eventos (data-action/change/input/submit)
    ├── layout/
    │   ├── public.js        site público e telas de acesso
    │   ├── shell.js         área interna: guarda de login, menu, cabeçalho, usuário
    │   ├── teacher-header.js identificação do docente + abas
    │   └── period-field.js  seletor de período compartilhado
    └── pages/           uma página por arquivo: só compõe layout + ui + domain
```

As dependências apontam sempre para dentro: `pages → layout → ui → core` e `pages → domain → core`.
Cada HTML carrega só o que usa: as páginas públicas não carregam as regras do barema.

## Documentação interna

As anotações de requisitos (RF/RNF), os registros de mudanças de cada tela, os fluxos, a
avaliação heurística, a paleta e os feedbacks recebidos saíram das telas e estão guardados em
[`docs/consideracoes-do-sistema.md`](docs/consideracoes-do-sistema.md).
