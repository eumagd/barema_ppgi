# Plataforma de Apoio ao Credenciamento e Recredenciamento de Docentes do PPGI/UFAL

Projeto desenvolvido para as disciplinas de **Programação 3 e ACE 1**, do curso de Ciência da Computação da Universidade Federal de Alagoas (UFAL).

**Professores:** Dr. Ranilson Paiva e Dra. Maria Cristina Tenório

**Equipe:**
- Anna Beatriz Bernardo - Tech Lead (abbg@ic.ufal.br)
- Magdiel Santos - Analista de Requisitos (mss3@ic.ufal.br)
- Mariana Lessa - Scrum Master (mlcs@ic.ufal.br)

---

## Sobre o Projeto

O processo de credenciamento e recredenciamento de docentes do Programa de Pós-Graduação em Informática (PPGI/UFAL) exige a avaliação da produção científica dos docentes, considerando critérios como classificação Qualis dos artigos, coautorias e pontuação mínima exigida.

Esta plataforma tem como objetivo **automatizar e organizar** as etapas do critério de pesquisa desse processo, integrando-se a ferramentas já utilizadas atualmente, como o **QLattes** e a extensão de correspondência aproximada (**Find Fuzzy Match**), em vez de substituí-las.

> Este README é baseado no Documento de Requisitos V0 (03/09/2026) e será atualizado conforme o projeto evolui.

---

## Objetivo

Apoiar o responsável pela condução do processo avaliativo na:
- Organização dos dados de produção científica dos docentes;
- Verificação do cumprimento dos critérios mínimos de credenciamento/recredenciamento;
- Identificação de coautorias entre docentes do programa;
- Cálculo da pontuação da produção científica, com divisão adequada entre coautores.

---

## Funcionalidades (Requisitos Funcionais)

| ID | Funcionalidade | Criticidade |
|----|-----------------|-------------|
| RF01 | Organização dos dados dos docentes usados na avaliação | Alta |
| RF02 | Integração com dados do Currículo Lattes | Alta |
| RF03 | Classificação da produção científica via Qualis | Alta |
| RF04 | Identificação de coautorias entre docentes do PPGI/UFAL | Alta |
| RF05 | Cálculo da pontuação da produção científica | Alta |
| RF06 | Divisão da pontuação de artigos em coautoria | Alta |
| RF07 | Verificação dos critérios mínimos de produção científica | Alta |
| RF08 | Uso de correspondência aproximada (Fuzzy Match) para identificar publicações | Média |

---

## Requisitos Não Funcionais

| ID | Requisito | Criticidade |
|----|-----------|-------------|
| RNF01 | Integração com ferramentas existentes (QLattes, Fuzzy Match) | Alta |
| RNF02 | Organização e clareza na apresentação das informações | Alta |
| RNF03 | Usabilidade da interface | Média |
| RNF04 | Manutenibilidade e evolução da solução | Média |

---

## Critérios de Criticidade

- **Alta:** requisito essencial para que a solução cumpra sua finalidade principal.
- **Média:** requisito importante, mas sua ausência não impede o funcionamento básico.
- **Baixa:** requisito desejável, mas não essencial.

---

## Stakeholders

- **Rian Gabriel Santos Pinheiro** — Responsável pela condução do processo avaliativo (rian@ic.ufal.br)
- **Bruno Costa e Silva Nogueira** — Coordenação do PPGI/UFAL (bruno@ic.ufal.br)
- Colegiado do Programa de Pós-Graduação em Informática
- Docentes do PPGI/UFAL

## Fontes Consultadas

- Resolução nº 1/2025 do PPGI/UFAL
- Documento do projeto da disciplina de Programação 3
- Levantamento de requisitos junto ao responsável pelo processo avaliativo
- QLattes
- Extensão de correspondência aproximada (Find Fuzzy Match)

---

## Status do Projeto

Em desenvolvimento. Implementados:

- **Banco de dados** (PostgreSQL + Prisma) a partir do Modelo ER.
- **API** (Node.js + Express): autenticação com perfis, cadastros, cargas Qualis, importação do CSV do
  QLattes, Fuzzy Match no PostgreSQL, motor de cálculo da Resolução nº 1/2025, processos de
  credenciamento/recredenciamento, exportação XLSX/CSV e pareceres por e-mail.
- **Front end** ligado à API (as telas são servidas pela própria API).

Detalhes em [`backend/README.md`](backend/README.md) e [`frontend/README.md`](frontend/README.md).

## Controle de Versão do Documento de Requisitos

| Versão | Data | Descrição |
|--------|------|-----------|
| V0 | 03/09/2026 | Levantamento inicial dos requisitos do projeto |

---

## Tecnologias

- **Back end:** Node.js 20+, Express 5, Prisma ORM, Zod, JWT.
- **Banco:** PostgreSQL 16, com `pg_trgm`, `unaccent` e `fuzzystrmatch` (Fuzzy Match).
- **Front end:** HTML, CSS e JavaScript puro, com Tailwind via CDN.
- **Testes:** `node:test` + supertest (unidade e integração contra o PostgreSQL).

## Como Executar

Passo a passo completo, do zero até o primeiro processo, no **[Guia de instalação e uso](GUIA-INSTALACAO.md)**.

Resumo, para quem já tem Node.js e PostgreSQL:

```bash
cd backend
npm install
cp .env.example .env              # ajuste DATABASE_URL e JWT_SECRET
npx prisma migrate deploy
npm run preparar                  # resolução nº 1/2025 e parâmetros
npm run criar-usuario -- --email voce@ic.ufal.br --nome "Seu Nome" --perfil COORDENACAO
npm start                         # http://localhost:3000
```

Para uma demonstração com dados fictícios, use `npx prisma db seed` no lugar dos dois comandos do meio.

## Licença

_A definir._
