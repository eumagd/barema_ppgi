# Front end — Plataforma de Gerenciamento de Baremas (PPGI/UFAL)

> Esta pasta contém o front end do projeto **Plataforma de Apoio ao Credenciamento e Recredenciamento de Docentes do PPGI/UFAL**. Para o contexto geral (objetivo, equipe, requisitos RF/RNF e stakeholders), veja o [README da raiz](../README.md).

Front end (HTML, CSS e JavaScript puro, com Tailwind via CDN) da plataforma de gerenciamento de
baremas do Programa de Pós-Graduação em Informática da UFAL: cálculo da pontuação da produção
científica, verificação de requisitos, relatórios e credenciamento/recredenciamento de docentes.

**Os dados vêm da API do back end** ([`../backend`](../backend)), que também serve estas páginas:

```bash
cd ../backend
npm install
npx prisma migrate deploy && npx prisma db seed
npm run dev
```

e abra **http://localhost:3000**. (Abrir o `index.html` com duplo clique não funciona mais: o login e
os dados dependem da API.) A internet só é necessária para o Tailwind (CDN) e as fontes.

> Para usar uma API em outro endereço, defina `window.PPGI_API_URL = "https://…/api"` antes de
> `assets/js/core/api.js`.

## Acesso

Usuários criados pelo seed do banco:

| E-mail | Senha | Perfil |
| --- | --- | --- |
| `secretaria@ic.ufal.br` | `ppgi2026` | Secretaria |
| `coordenacao@ic.ufal.br` | `ppgi2026` | Coordenação (pode deferir/indeferir e alterar parâmetros) |

O login usa a API (token JWT guardado no navegador). A recuperação de senha envia um link por
e-mail; sem SMTP configurado no back end, o link aparece no console da API.

## Páginas

**Públicas**

| Arquivo | Página |
| --- | --- |
| `index.html` | Página inicial do site: o sistema, funcionalidades, como funciona, quem somos |
| `login.html` | Entrar (com validação, mostrar senha e retorno à página pedida) |
| `recuperar-senha.html` | Pedido de link de recuperação |
| `redefinir-senha.html?email=…&token=…` | Criação de nova senha (link enviado por e-mail) |

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
| `cadastros.html` | Cadastros: docentes, discentes (orientador e coorientações), membros externos, disciplinas e turmas, e publicação manual (eventos e coautores). Atalho: `?aba=discentes` |
| `qualis.html` | Bases Qualis: envio das tabelas (CAPES, PUC-RS, Scopus, Eventos), histórico de cargas e consulta do estrato de um veículo |
| `revisao.html` | Revisão: coautorias do Fuzzy Match (confirmar, rejeitar, desfazer mescla, reprocessar) e veículos sem estrato Qualis (classificação manual com justificativa). Atalho: `?aba=qualis` |

`<id>` é o número do docente no banco (`id_docente`).

Como os dados vêm da API:

- `core/boot.js` carrega os dados (`domain/dados.js`) antes do script de cada tela interna, então as
  telas continuam lendo tudo de forma síncrona (`Repository`, `Barema`), como no protótipo.
- O **cálculo é feito no back end** (motor da Resolução nº 1/2025); `domain/barema.js` só adapta o
  resultado para as telas.
- As ações (desvincular, sinalizar recusa, abrir processo, revisar coautorias, gerar/enviar relatório)
  chamam a API e recarregam os dados; erros da API aparecem como aviso na tela.
- **Importar currículos (QLattes)** em Docentes envia um `.zip` com os CSVs, processado em segundo plano
  com o andamento na tela; o perfil de cada docente aceita o `.csv` individual.
- Na tela de Credenciamento, marcar/desmarcar uma coautoria confirma ou rejeita a correspondência do
  Fuzzy Match (rejeitar desfaz a mescla).
- “⟳ Recarregar dados do servidor”, no rodapé do menu, busca tudo de novo.

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
    │   ├── store.js         sessão e preferências no navegador (localStorage com fallback em memória)
    │   ├── api.js           cliente HTTP da API (token, erros, downloads)
    │   ├── boot.js          carrega os dados da API antes de cada tela interna
    │   ├── format.js        números pt-BR, escape de HTML, URL
    │   └── theme.js         tema claro/escuro (carregado no <head>, sem piscar)
    ├── domain/          dados e regras, não conhece HTML
    │   ├── catalog.js       textos fixos, equipe, ciclo e períodos avaliativos
    │   ├── dados.js         dados vindos da API, convertidos para o formato das telas
    │   ├── repository.js    docentes, publicações, coautorias e período escolhido
    │   ├── barema.js        adapta o cálculo do back end (pontuação e requisitos) para as telas
    │   ├── auth.js          login, sessão e recuperação de senha pela API
    │   └── use-cases.js     ações pela API (desvincular, importar QLattes, abrir processo, enviar relatório…)
    ├── ui/              apresentação genérica, não conhece o domínio
    │   ├── components.js    componentes do design system (funções dados → HTML)
    │   ├── feedback.js      modal acessível e toasts
    │   ├── export.js        CSV e impressão
    │   ├── formulario.js    campos com name, leitura do formulário e mensagens de erro da API
    │   └── view.js          render + delegação de eventos; preserva formulários com data-preservar
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
