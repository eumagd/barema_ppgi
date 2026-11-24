-- Extensões usadas pelo Fuzzy Match (RF-BE07 a RF-BE10). Precisam existir antes do índice GIN.
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "unaccent";
CREATE EXTENSION IF NOT EXISTS "fuzzystrmatch";

-- CreateEnum
CREATE TYPE "fonte_qualis" AS ENUM ('CAPES', 'PUC_RS', 'SCOPUS', 'EVENTOS', 'MANUAL');

-- CreateEnum
CREATE TYPE "fonte_importacao" AS ENUM ('QLATTES_CSV', 'PLANILHA_TRANSICAO', 'XML_LATTES');

-- CreateEnum
CREATE TYPE "status_importacao" AS ENUM ('PENDENTE', 'PROCESSANDO', 'CONCLUIDO', 'FALHA');

-- CreateEnum
CREATE TYPE "tipo_correspondencia" AS ENUM ('PUBLICACAO', 'AUTOR');

-- CreateEnum
CREATE TYPE "motivo_correspondencia" AS ENUM ('DOI', 'ISSN_TITULO', 'SIMILARIDADE_TITULO', 'NOME_AUTOR');

-- CreateEnum
CREATE TYPE "decisao_correspondencia" AS ENUM ('AUTOMATICA', 'PENDENTE', 'CONFIRMADA', 'REJEITADA');

-- CreateEnum
CREATE TYPE "nivel_disciplina" AS ENUM ('GRADUACAO', 'POS_GRADUACAO');

-- AlterTable
ALTER TABLE "docente" ADD COLUMN     "data_vinculo" DATE,
ADD COLUMN     "id_lattes" CHAR(16);

-- AlterTable
ALTER TABLE "discente" ADD COLUMN     "data_conclusao" DATE;

-- AlterTable
ALTER TABLE "estrato_qualis" ADD COLUMN     "fonte" "fonte_qualis" NOT NULL DEFAULT 'CAPES',
ADD COLUMN     "justificativa" TEXT;

-- AlterTable
ALTER TABLE "publicacao" ADD COLUMN     "doi" VARCHAR(255),
ADD COLUMN     "id_importacao" INTEGER,
ADD COLUMN     "titulo_normalizado" VARCHAR(500);

-- CreateTable
CREATE TABLE "autor_nome_citacao" (
    "id_nome_citacao" SERIAL NOT NULL,
    "id_autor" INTEGER NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "nome_normalizado" VARCHAR(255) NOT NULL,

    CONSTRAINT "autor_nome_citacao_pkey" PRIMARY KEY ("id_nome_citacao")
);

-- CreateTable
CREATE TABLE "parametro" (
    "id_parametro" SERIAL NOT NULL,
    "id_resolucao" INTEGER NOT NULL,
    "chave" VARCHAR(100) NOT NULL,
    "valor" JSONB NOT NULL,
    "descricao" VARCHAR(500),

    CONSTRAINT "parametro_pkey" PRIMARY KEY ("id_parametro")
);

-- CreateTable
CREATE TABLE "token_redefinicao_senha" (
    "id_token" SERIAL NOT NULL,
    "id_usuario" INTEGER NOT NULL,
    "token_hash" VARCHAR(128) NOT NULL,
    "expira_em" TIMESTAMP(3) NOT NULL,
    "usado_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "token_redefinicao_senha_pkey" PRIMARY KEY ("id_token")
);

-- CreateTable
CREATE TABLE "disciplina" (
    "id_disciplina" SERIAL NOT NULL,
    "codigo" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(200) NOT NULL,
    "nivel" "nivel_disciplina" NOT NULL,
    "estudo_dirigido" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "disciplina_pkey" PRIMARY KEY ("id_disciplina")
);

-- CreateTable
CREATE TABLE "turma" (
    "id_turma" SERIAL NOT NULL,
    "id_disciplina" INTEGER NOT NULL,
    "id_docente" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "semestre" INTEGER NOT NULL,

    CONSTRAINT "turma_pkey" PRIMARY KEY ("id_turma")
);

-- CreateTable
CREATE TABLE "importacao" (
    "id_importacao" SERIAL NOT NULL,
    "fonte" "fonte_importacao" NOT NULL,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "hash_arquivo" CHAR(64) NOT NULL,
    "status" "status_importacao" NOT NULL DEFAULT 'PENDENTE',
    "contagens" JSONB,
    "erros" JSONB,
    "id_docente" INTEGER,
    "id_usuario" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciado_em" TIMESTAMP(3),
    "finalizado_em" TIMESTAMP(3),

    CONSTRAINT "importacao_pkey" PRIMARY KEY ("id_importacao")
);

-- CreateTable
CREATE TABLE "correspondencia" (
    "id_correspondencia" SERIAL NOT NULL,
    "tipo" "tipo_correspondencia" NOT NULL,
    "id_publicacao" INTEGER NOT NULL,
    "id_publicacao_candidata" INTEGER,
    "nome_lido" VARCHAR(255),
    "id_autor_candidato" INTEGER,
    "nota" DECIMAL(5,2) NOT NULL,
    "motivo" "motivo_correspondencia" NOT NULL,
    "decisao" "decisao_correspondencia" NOT NULL DEFAULT 'PENDENTE',
    "justificativa" TEXT,
    "id_usuario" INTEGER,
    "decidido_em" TIMESTAMP(3),
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "correspondencia_pkey" PRIMARY KEY ("id_correspondencia")
);

-- CreateIndex
CREATE INDEX "autor_nome_citacao_nome_normalizado_idx" ON "autor_nome_citacao"("nome_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "autor_nome_citacao_id_autor_nome_normalizado_key" ON "autor_nome_citacao"("id_autor", "nome_normalizado");

-- CreateIndex
CREATE UNIQUE INDEX "parametro_id_resolucao_chave_key" ON "parametro"("id_resolucao", "chave");

-- CreateIndex
CREATE UNIQUE INDEX "token_redefinicao_senha_token_hash_key" ON "token_redefinicao_senha"("token_hash");

-- CreateIndex
CREATE INDEX "token_redefinicao_senha_id_usuario_idx" ON "token_redefinicao_senha"("id_usuario");

-- CreateIndex
CREATE UNIQUE INDEX "disciplina_codigo_key" ON "disciplina"("codigo");

-- CreateIndex
CREATE INDEX "turma_id_docente_ano_idx" ON "turma"("id_docente", "ano");

-- CreateIndex
CREATE UNIQUE INDEX "turma_id_disciplina_id_docente_ano_semestre_key" ON "turma"("id_disciplina", "id_docente", "ano", "semestre");

-- CreateIndex
CREATE INDEX "importacao_hash_arquivo_idx" ON "importacao"("hash_arquivo");

-- CreateIndex
CREATE INDEX "importacao_status_idx" ON "importacao"("status");

-- CreateIndex
CREATE INDEX "correspondencia_decisao_nota_idx" ON "correspondencia"("decisao", "nota");

-- CreateIndex
CREATE INDEX "correspondencia_id_publicacao_idx" ON "correspondencia"("id_publicacao");

-- CreateIndex
CREATE UNIQUE INDEX "docente_id_lattes_key" ON "docente"("id_lattes");

-- CreateIndex
CREATE INDEX "publicacao_doi_idx" ON "publicacao"("doi");

-- CreateIndex
CREATE INDEX "publicacao_id_importacao_idx" ON "publicacao"("id_importacao");

-- CreateIndex
CREATE INDEX "publicacao_titulo_normalizado_trgm_idx" ON "publicacao" USING GIN ("titulo_normalizado" gin_trgm_ops);

-- AddForeignKey
ALTER TABLE "autor_nome_citacao" ADD CONSTRAINT "autor_nome_citacao_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "autor"("id_autor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_id_importacao_fkey" FOREIGN KEY ("id_importacao") REFERENCES "importacao"("id_importacao") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "parametro" ADD CONSTRAINT "parametro_id_resolucao_fkey" FOREIGN KEY ("id_resolucao") REFERENCES "resolucao"("id_resolucao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "token_redefinicao_senha" ADD CONSTRAINT "token_redefinicao_senha_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma" ADD CONSTRAINT "turma_id_disciplina_fkey" FOREIGN KEY ("id_disciplina") REFERENCES "disciplina"("id_disciplina") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "turma" ADD CONSTRAINT "turma_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docente"("id_docente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docente"("id_docente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "importacao" ADD CONSTRAINT "importacao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondencia" ADD CONSTRAINT "correspondencia_id_publicacao_fkey" FOREIGN KEY ("id_publicacao") REFERENCES "publicacao"("id_publicacao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondencia" ADD CONSTRAINT "correspondencia_id_publicacao_candidata_fkey" FOREIGN KEY ("id_publicacao_candidata") REFERENCES "publicacao"("id_publicacao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondencia" ADD CONSTRAINT "correspondencia_id_autor_candidato_fkey" FOREIGN KEY ("id_autor_candidato") REFERENCES "autor"("id_autor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "correspondencia" ADD CONSTRAINT "correspondencia_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

