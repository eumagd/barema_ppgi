# Guia de instalação e uso — Plataforma de Baremas do PPGI/UFAL

Este guia leva a plataforma do zero até o primeiro processo de credenciamento, para quem vai
operá-la (coordenação ou secretaria do PPGI). Não é preciso saber programar: basta copiar os
comandos. Os exemplos são para **Windows (PowerShell)**; no Linux/macOS os comandos são os mesmos,
salvo onde indicado.

**Sumário**

1. [Como a plataforma funciona](#1-como-a-plataforma-funciona)
2. [O que instalar](#2-o-que-instalar)
3. [Instalação](#3-instalação)
4. [Primeiro uso: a ordem certa](#4-primeiro-uso-a-ordem-certa)
5. [Ajustes da coordenação (parâmetros da resolução)](#5-ajustes-da-coordenação-parâmetros-da-resolução)
6. [E-mail (recuperação de senha e pareceres)](#6-e-mail-recuperação-de-senha-e-pareceres)
7. [Cópia de segurança e atualização](#7-cópia-de-segurança-e-atualização)
8. [Problemas comuns](#8-problemas-comuns)

---

## 1. Como a plataforma funciona

```
 Navegador ──► API (Node.js, pasta backend/) ──► Banco PostgreSQL
               └─ também entrega as telas (pasta frontend/)
```

- Tudo roda num endereço só: **http://localhost:3000** (ou o endereço do servidor onde for instalada).
- A produção dos docentes entra por três caminhos:
  1. **CSV do QLattes** (artigos em periódicos), exportado do Currículo Lattes;
  2. **cadastro manual** (artigos em eventos e coautores discentes/externos, que o CSV não traz);
  3. **OpenAlex** (opcional, se o conector estiver instalado): busca a produção com eventos e coautores.
- O **Qualis** vem das tabelas que você carrega (CAPES, PUC-RS, Scopus e Qualis Eventos).
- O **cálculo** segue a Resolução nº 1/2025 e os parâmetros podem ser ajustados sem mexer no código.

## 2. O que instalar

| Programa | Versão | Onde baixar |
| --- | --- | --- |
| **Node.js** | 20 ou mais novo (LTS) | https://nodejs.org |
| **PostgreSQL** | 14 ou mais novo (recomendado 16) | https://www.postgresql.org/download/ |
| **Git** | qualquer recente | https://git-scm.com |

No Windows, dá para instalar os três pelo PowerShell:

```powershell
winget install OpenJS.NodeJS.LTS
```
```powershell
winget install PostgreSQL.PostgreSQL.16
```
```powershell
winget install Git.Git
```

> **Anote a senha do usuário `postgres`** que o instalador do PostgreSQL pedir. Ela é necessária no passo 3.2.
> Depois de instalar, **feche e abra o PowerShell** para os comandos novos funcionarem.

As extensões que a plataforma usa (`pg_trgm`, `unaccent` e `fuzzystrmatch`) já vêm com o instalador
oficial do PostgreSQL; não é preciso instalar nada a mais.

> **Alternativa com Docker:** quem já usa Docker pode subir o banco com `npm run db:up` (pasta
> `backend`), em vez de instalar o PostgreSQL. No Windows o Docker Desktop exige o WSL.

## 3. Instalação

### 3.1 Baixar o código

```powershell
git clone https://github.com/eumagd/barema_ppgi.git
```
```powershell
cd barema_ppgi\backend
```
```powershell
npm install
```

> Se aparecer um aviso sobre "install scripts" do Prisma, rode também `npx prisma generate`.

### 3.2 Criar o banco de dados

Crie um usuário e um banco só para a plataforma (troque `SENHA_FORTE` por uma senha sua). O
PostgreSQL vai pedir a senha do `postgres` anotada na instalação:

```powershell
& "C:\Program Files\PostgreSQL\16\bin\psql.exe" -U postgres -h localhost -c "CREATE ROLE ppgi LOGIN PASSWORD 'SENHA_FORTE';" -c "CREATE DATABASE barema_ppgi OWNER ppgi;"
```

No Linux: `sudo -u postgres psql -c "CREATE ROLE ppgi LOGIN PASSWORD 'SENHA_FORTE';" -c "CREATE DATABASE barema_ppgi OWNER ppgi;"`

> Para rodar os testes automáticos ou gerar migrações novas (só desenvolvedores), o usuário
> precisa de `CREATEDB`: `ALTER ROLE ppgi CREATEDB;`.

### 3.3 Configurar o arquivo `.env`

Na pasta `backend`, copie o modelo:

```powershell
Copy-Item .env.example .env
```

Abra o `.env` no Bloco de Notas (`notepad .env`) e ajuste:

| Variável | O que colocar |
| --- | --- |
| `DATABASE_URL` | `postgresql://ppgi:SENHA_FORTE@localhost:5432/barema_ppgi?schema=public` (a mesma senha do passo 3.2) |
| `JWT_SECRET` | Um texto aleatório longo. Gere um com: `node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"` |
| `FRONTEND_URL` | O endereço onde a plataforma será aberta (padrão `http://localhost:3000`). Vai nos links dos e-mails. |
| `SMTP_*` | Opcional; veja a [seção 6](#6-e-mail-recuperação-de-senha-e-pareceres). |
| `OPENALEX_API_KEY` | Opcional (conector OpenAlex). Chave gratuita em https://openalex.org/settings/api |
| `DATABASE_URL_TESTE` | Só para desenvolvedores (testes automáticos). Pode apagar a linha. |

> O `.env` guarda senhas: **não envie esse arquivo para o GitHub** (ele já está no `.gitignore`).

### 3.4 Criar as tabelas, a resolução e o primeiro usuário

```powershell
npx prisma migrate deploy
```
```powershell
npm run preparar
```
```powershell
npm run criar-usuario -- --email coordenacao.ppgi@ic.ufal.br --nome "Coordenação do PPGI" --perfil COORDENACAO
```

O último comando pede a senha no terminal (mínimo de 8 caracteres, com letra e número). Crie
também o acesso da secretaria:

```powershell
npm run criar-usuario -- --email secretaria.ppgi@ic.ufal.br --nome "Secretaria do PPGI" --perfil SECRETARIA
```

> **Perfis:** a **secretaria** conduz o processo (cadastros, importações, revisão, abertura de
> processos, relatórios). A **coordenação** pode tudo isso e também **deferir/indeferir**, **excluir
> docentes** e **alterar os parâmetros** da resolução.
>
> Esqueceu uma senha? Rode o mesmo comando com o e-mail: a senha é redefinida.

> **Só para demonstração:** `npx prisma db seed` cria docentes e publicações fictícios e os usuários
> `secretaria@ic.ufal.br` / `coordenacao@ic.ufal.br` com senha `ppgi2026`. **Não use em produção**: o
> seed apaga os dados existentes.

### 3.5 Ligar a plataforma

```powershell
npm start
```

Abra **http://localhost:3000** e entre com o usuário criado. Para desligar, `Ctrl+C` no PowerShell.

> A plataforma fica no ar enquanto essa janela estiver aberta. Para deixá-la sempre ligada num
> servidor, use um gerenciador de processos (por exemplo `pm2`) ou um serviço do sistema; peça ajuda
> ao suporte de TI do IC.

## 4. Primeiro uso: a ordem certa

O cálculo depende de tudo o que vem antes. Siga esta ordem no primeiro ciclo:

### 4.1 Carregar as tabelas Qualis — menu **Bases Qualis**

Sem elas, as publicações ficam sem estrato e valem 0 ponto. Para cada base, exporte a planilha como
**CSV** e envie escolhendo a base e o ano-base:

| Base | Colunas esperadas | Observação |
| --- | --- | --- |
| **CAPES (Sucupira)** | `ISSN`, `Título`, `Área de Avaliação`, `Estrato` | Só a área informada (Ciência da Computação) é importada. Quadriênio 2017–2020 = ano-base 2020. |
| **PUC-RS** | `ISSN`, `Título`, `Estrato` | |
| **Scopus** | `ISSN`, `Título`, `Percentil` (ou `Estrato`) | Percentil convertido: A1 ≥ 87,5; A2 ≥ 75; … ; B4 < 12,5. |
| **Qualis Eventos da Computação** | `Sigla`, `Nome`, `Estrato` | Os eventos são encontrados pela sigla (SBBD, SBES, BRACIS…). |

Os nomes das colunas podem ter ou não acento e maiúsculas. Reenviar o mesmo arquivo não duplica
nada; uma versão nova substitui a anterior. O estrato que vale segue a ordem **CAPES → PUC-RS → Scopus**.
Use a caixa **Consultar estrato** para conferir um periódico ou evento.

### 4.2 Cadastrar as pessoas e as disciplinas — menu **Cadastros**

1. **Docentes:** nome, e-mail, matrícula, departamento, vínculo com o PPGI (Permanente/Colaborador) e
   **início do vínculo** (usado para "recém-credenciado" e para a progressão de Colaborador).
   Preencha o **ID Lattes** (os 16 dígitos do fim do link do currículo): é ele que liga o CSV do
   QLattes ao docente certo.
2. **Discentes:** com o **orientador** (só Permanentes podem orientar; no máximo 8 em andamento) e a
   **data da defesa** quando houver. Abra o discente em **Editar** para registrar **coorientações**
   (valem 0,5).
3. **Membros externos:** coorientadores e coautores de fora do PPGI.
4. **Disciplinas e turmas:** cadastre as disciplinas e, em **Turmas**, quem lecionou em cada semestre
   (critério de Docência: 24 meses, sem contar "Estudo Dirigido").

### 4.3 Importar a produção — menus **Docentes** e **Perfil**

**Pelo QLattes** (artigos em periódicos):

1. Instale a extensão **QLattes** no Chrome ou Firefox.
2. Abra o Currículo Lattes do docente (resolvendo o CAPTCHA) e espere o QLattes classificar.
3. Na visualização do QLattes, escolha o currículo e clique em **Exportar dados**: sai um `.csv`.
4. Envie:
   - **um docente:** no **Perfil** dele, em **Importar CSV do QLattes**;
   - **vários:** junte os CSVs num `.zip` e use **Importar currículos (QLattes)** na tela **Docentes**.
     O andamento de cada arquivo aparece na tela.

Reimportar um CSV atualizado só acrescenta publicações; nada que já foi revisado é apagado.

**Pelo OpenAlex** (se instalado; traz eventos e coautores): no **Perfil**, informe o **ORCID** do
docente e clique em **Importar do OpenAlex**.

**À mão** (o que faltar, principalmente **eventos** e **coautores discentes**): **Cadastros →
Publicação manual**. Para evento, informe a **sigla** (ela busca o estrato na tabela de Eventos).

> **Importante:** o CSV do QLattes **não traz eventos nem a lista de coautores**. A exigência de
> "produção com discente" do recredenciamento só é atendida se o discente estiver como coautor:
> pelo OpenAlex ou pela publicação manual (ou acrescentando o discente numa publicação existente).

### 4.4 Revisar — menu **Revisão**

- **Coautorias (Fuzzy Match):** publicações parecidas em currículos diferentes. Notas a partir de 92
  são juntadas sozinhas; de 80 a 91 esperam sua decisão (**É a mesma publicação** / **São
  diferentes**). Juntar faz a pontuação ser dividida entre os docentes do PPGI. Dá para desfazer.
- **Qualis sem estrato:** periódicos/eventos que não estão em nenhuma tabela. Classifique com o
  estrato e uma justificativa.

### 4.5 Conferir e abrir os processos

- No **Perfil** de cada docente, as abas **Cálculo** e **Requisitos** mostram a pontuação, a divisão
  das coautorias e cada critério da resolução (exigido × obtido).
- Menu **Credenciamento**: escolha o docente (ou o **lote**), confira os requisitos e as coautorias e
  clique em **Iniciar**. O cálculo fica gravado no processo.
- A **coordenação** defere ou indefere. Deferir um credenciamento grava o vínculo do docente.
- Aba **Relatório**: gere o parecer e **envie por e-mail** (exige o SMTP da seção 6).
- No **Painel**, **Exportar planilhas** gera a produção do período e os processos em Excel ou CSV.

## 5. Ajustes da coordenação (parâmetros da resolução)

Os pesos por estrato, os mínimos exigidos e os cortes do Fuzzy Match ficam no banco e são
ajustados no menu **Parâmetros**: a coordenação edita e salva; a secretaria só consulta. Números
aceitam vírgula (0,875). Ao mudar os cortes do Fuzzy Match, a tela oferece reprocessar a base.

| Parâmetro | Padrão | O que é |
| --- | --- | --- |
| `pesos_estrato` | A1 1,0 · A2 0,875 · A3 0,75 · A4 0,625 · B1 0,5 | Pontos por estrato |
| `credenciamento.pontuacao_minima` | 3,5 | Pontos mínimos para credenciar |
| `recredenciamento.pontuacao_minima` | 2,5 | Pontos mínimos para recredenciar |
| `fuzzy.corte_confirmacao` / `fuzzy.corte_revisao` | 92 / 80 | Faixas do Fuzzy Match |
| `docencia.niveis` | só pós-graduação | Níveis de disciplina que contam |

**Calibração do Fuzzy Match:** os cortes 92/80 ainda não foram conferidos com a planilha histórica
(`Credenciamento2026.xlsx`); vale comparar alguns casos da planilha com a tela **Revisão** e ajustar
em **Parâmetros**.

## 6. E-mail (recuperação de senha e pareceres)

Sem SMTP, a plataforma funciona, mas os e-mails só aparecem na janela da API (útil para testar). Para
enviar de verdade, preencha no `.env` os dados do servidor de e-mail institucional (peça ao NTI/IC):

```
SMTP_HOST=smtp.exemplo.ufal.br
SMTP_PORT=587
SMTP_USER=ppgi@ic.ufal.br
SMTP_PASS=senha-do-email
SMTP_FROM="PPGI/UFAL <ppgi@ic.ufal.br>"
```

Reinicie a plataforma depois de mudar o `.env`.

## 7. Cópia de segurança e atualização

**Cópia de segurança do banco** (faça antes de cada ciclo e antes de atualizar):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_dump.exe" -U ppgi -h localhost -F c -f "barema-$(Get-Date -Format yyyy-MM-dd).backup" barema_ppgi
```

Para restaurar (substitui os dados atuais pelos da cópia):

```powershell
& "C:\Program Files\PostgreSQL\16\bin\pg_restore.exe" -U ppgi -h localhost -d barema_ppgi --clean barema-AAAA-MM-DD.backup
```

**Atualizar para uma versão nova** (com a plataforma desligada):

```powershell
git pull
```
```powershell
npm install
```
```powershell
npx prisma migrate deploy
```
```powershell
npm run preparar
```

e ligue de novo com `npm start`. As migrações só acrescentam e ajustam; os dados são mantidos.

## 8. Problemas comuns

| Sintoma | Causa provável e solução |
| --- | --- |
| "Não foi possível carregar os dados" ao abrir uma tela | A API não está ligada. Rode `npm start` na pasta `backend`. |
| `EADDRINUSE` ou "porta 3000 em uso" | Já há uma plataforma (ou outro programa) na porta. Feche a outra janela ou mude `PORT` no `.env`. |
| Erro de conexão com o banco / `P1001` | PostgreSQL desligado ou `DATABASE_URL` errada (usuário, senha, porta). |
| "autenticação do tipo senha falhou" | Senha do usuário `ppgi` diferente da que está na `DATABASE_URL`. |
| Volta sempre para o login | A sessão expirou (8 horas) ou o usuário foi alterado. Entre de novo. |
| CSV do QLattes recusado ("não parece ser um CSV exportado pelo QLattes") | Use o arquivo do botão **Exportar dados** do QLattes, sem editar. Se abriu no Excel, salve como CSV. |
| "Este CSV é do currículo X, mas o docente está cadastrado com o ID Lattes Y" | O arquivo é de outro docente, ou o ID Lattes do cadastro está errado. |
| Publicações com 0 ponto | Falta a tabela Qualis da base certa ou o veículo não está nela: confira em **Bases Qualis → Consultar** e classifique em **Revisão → Qualis sem estrato**. |
| "Produção em coautoria com discente" não atendida | O CSV do QLattes não traz coautores: cadastre a publicação manual ou acrescente o discente. |
| E-mail não chega | SMTP não configurado (o texto aparece na janela da API) ou dados do SMTP errados. |
| "A cota diária do OpenAlex acabou" | Configure `OPENALEX_API_KEY` no `.env` ou tente no dia seguinte. |

---

Dúvidas técnicas: veja o [README do back end](backend/README.md) (todas as rotas da API e as regras
do cálculo) e o [README do front end](frontend/README.md) (telas).
