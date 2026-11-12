-- CreateEnum
CREATE TYPE "vinculo_ppgi" AS ENUM ('PERMANENTE', 'COLABORADOR');

-- CreateEnum
CREATE TYPE "tipo_autor" AS ENUM ('DOCENTE', 'DISCENTE', 'EXTERNO');

-- CreateEnum
CREATE TYPE "tipo_veiculo" AS ENUM ('PERIODICO', 'CONFERENCIA');

-- CreateEnum
CREATE TYPE "estrato" AS ENUM ('A1', 'A2', 'A3', 'A4', 'B1', 'B2', 'B3', 'B4', 'C');

-- CreateEnum
CREATE TYPE "tipo_avaliacao" AS ENUM ('CREDENCIAMENTO', 'RECREDENCIAMENTO');

-- CreateEnum
CREATE TYPE "status_avaliacao" AS ENUM ('EM_ANDAMENTO', 'DEFERIDO', 'INDEFERIDO', 'CANCELADO');

-- CreateEnum
CREATE TYPE "status_relatorio" AS ENUM ('RASCUNHO', 'GERADO', 'ENVIADO');

-- CreateEnum
CREATE TYPE "perfil_usuario" AS ENUM ('SECRETARIA', 'COORDENACAO');

-- CreateTable
CREATE TABLE "docente" (
    "id_docente" SERIAL NOT NULL,
    "matricula" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "url_lattes" VARCHAR(255),
    "data_ultima_atualizacao" DATE,
    "vinculo" "vinculo_ppgi",
    "data_recusa_participacao" DATE,

    CONSTRAINT "docente_pkey" PRIMARY KEY ("id_docente")
);

-- CreateTable
CREATE TABLE "discente" (
    "id_discente" SERIAL NOT NULL,
    "matricula" VARCHAR(20) NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "ano_ingresso" INTEGER NOT NULL,
    "id_orientador" INTEGER,

    CONSTRAINT "discente_pkey" PRIMARY KEY ("id_discente")
);

-- CreateTable
CREATE TABLE "externo" (
    "id_externo" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "inst_origem" VARCHAR(150),

    CONSTRAINT "externo_pkey" PRIMARY KEY ("id_externo")
);

-- CreateTable
CREATE TABLE "coorientacao" (
    "id_coorientacao" SERIAL NOT NULL,
    "id_discente" INTEGER NOT NULL,
    "id_docente" INTEGER,
    "id_externo" INTEGER,

    CONSTRAINT "coorientacao_pkey" PRIMARY KEY ("id_coorientacao")
);

-- CreateTable
CREATE TABLE "autor" (
    "id_autor" SERIAL NOT NULL,
    "tipo" "tipo_autor" NOT NULL,
    "nome_citacao" VARCHAR(255) NOT NULL,
    "id_docente" INTEGER,
    "id_discente" INTEGER,
    "id_externo" INTEGER,

    CONSTRAINT "autor_pkey" PRIMARY KEY ("id_autor")
);

-- CreateTable
CREATE TABLE "veiculo" (
    "id_veiculo" SERIAL NOT NULL,
    "nome" VARCHAR(255) NOT NULL,
    "issn_sigla" VARCHAR(30) NOT NULL,
    "tipo" "tipo_veiculo" NOT NULL,

    CONSTRAINT "veiculo_pkey" PRIMARY KEY ("id_veiculo")
);

-- CreateTable
CREATE TABLE "estrato_qualis" (
    "id_veiculo" INTEGER NOT NULL,
    "ano_base" INTEGER NOT NULL,
    "area_de_atuacao" VARCHAR(100) NOT NULL,
    "estrato" "estrato" NOT NULL,
    "pontuacao" DECIMAL(6,2) NOT NULL,

    CONSTRAINT "estrato_qualis_pkey" PRIMARY KEY ("id_veiculo","ano_base","area_de_atuacao")
);

-- CreateTable
CREATE TABLE "publicacao" (
    "id_publicacao" SERIAL NOT NULL,
    "titulo" VARCHAR(500) NOT NULL,
    "ano_publicacao" INTEGER NOT NULL,
    "correspondencia" DECIMAL(5,2),
    "id_veiculo" INTEGER,

    CONSTRAINT "publicacao_pkey" PRIMARY KEY ("id_publicacao")
);

-- CreateTable
CREATE TABLE "autoria" (
    "id_publicacao" INTEGER NOT NULL,
    "id_autor" INTEGER NOT NULL,
    "ordem_autoria" INTEGER NOT NULL,

    CONSTRAINT "autoria_pkey" PRIMARY KEY ("id_publicacao","id_autor")
);

-- CreateTable
CREATE TABLE "resolucao" (
    "id_resolucao" SERIAL NOT NULL,
    "numero_ano" VARCHAR(20) NOT NULL,
    "data_vigencia" DATE NOT NULL,
    "link_documento" VARCHAR(500),

    CONSTRAINT "resolucao_pkey" PRIMARY KEY ("id_resolucao")
);

-- CreateTable
CREATE TABLE "avaliacao" (
    "id_processo" SERIAL NOT NULL,
    "tipo" "tipo_avaliacao" NOT NULL,
    "data_solicitacao" DATE NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" "status_avaliacao" NOT NULL DEFAULT 'EM_ANDAMENTO',
    "pontuacao_pesquisa" DECIMAL(8,2),
    "cumpriu_docencia" BOOLEAN,
    "cumpriu_orientacao" BOOLEAN,
    "possui_coautoria_discente" BOOLEAN,
    "valido_ate" DATE,
    "status_relatorio" "status_relatorio" NOT NULL DEFAULT 'RASCUNHO',
    "data_envio_relatorio" TIMESTAMP(3),
    "id_docente" INTEGER NOT NULL,
    "id_resolucao" INTEGER NOT NULL,

    CONSTRAINT "avaliacao_pkey" PRIMARY KEY ("id_processo")
);

-- CreateTable
CREATE TABLE "avaliacao_publicacao" (
    "id_processo" INTEGER NOT NULL,
    "id_publicacao" INTEGER NOT NULL,
    "considerada" BOOLEAN NOT NULL DEFAULT true,
    "pontos_atribuidos" DECIMAL(8,2),

    CONSTRAINT "avaliacao_publicacao_pkey" PRIMARY KEY ("id_processo","id_publicacao")
);

-- CreateTable
CREATE TABLE "usuario" (
    "id_usuario" SERIAL NOT NULL,
    "nome" VARCHAR(150) NOT NULL,
    "email" VARCHAR(150) NOT NULL,
    "senha_hash" VARCHAR(255) NOT NULL,
    "perfil" "perfil_usuario" NOT NULL,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_pkey" PRIMARY KEY ("id_usuario")
);

-- CreateIndex
CREATE UNIQUE INDEX "docente_matricula_key" ON "docente"("matricula");

-- CreateIndex
CREATE UNIQUE INDEX "docente_email_key" ON "docente"("email");

-- CreateIndex
CREATE UNIQUE INDEX "discente_matricula_key" ON "discente"("matricula");

-- CreateIndex
CREATE INDEX "discente_id_orientador_idx" ON "discente"("id_orientador");

-- CreateIndex
CREATE INDEX "coorientacao_id_discente_idx" ON "coorientacao"("id_discente");

-- CreateIndex
CREATE UNIQUE INDEX "autor_id_docente_key" ON "autor"("id_docente");

-- CreateIndex
CREATE UNIQUE INDEX "autor_id_discente_key" ON "autor"("id_discente");

-- CreateIndex
CREATE UNIQUE INDEX "autor_id_externo_key" ON "autor"("id_externo");

-- CreateIndex
CREATE UNIQUE INDEX "veiculo_tipo_issn_sigla_key" ON "veiculo"("tipo", "issn_sigla");

-- CreateIndex
CREATE INDEX "publicacao_id_veiculo_idx" ON "publicacao"("id_veiculo");

-- CreateIndex
CREATE INDEX "publicacao_ano_publicacao_idx" ON "publicacao"("ano_publicacao");

-- CreateIndex
CREATE INDEX "autoria_id_autor_idx" ON "autoria"("id_autor");

-- CreateIndex
CREATE UNIQUE INDEX "autoria_id_publicacao_ordem_autoria_key" ON "autoria"("id_publicacao", "ordem_autoria");

-- CreateIndex
CREATE UNIQUE INDEX "resolucao_numero_ano_key" ON "resolucao"("numero_ano");

-- CreateIndex
CREATE INDEX "avaliacao_id_docente_idx" ON "avaliacao"("id_docente");

-- CreateIndex
CREATE INDEX "avaliacao_id_resolucao_idx" ON "avaliacao"("id_resolucao");

-- CreateIndex
CREATE INDEX "avaliacao_publicacao_id_publicacao_idx" ON "avaliacao_publicacao"("id_publicacao");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_email_key" ON "usuario"("email");

-- AddForeignKey
ALTER TABLE "discente" ADD CONSTRAINT "discente_id_orientador_fkey" FOREIGN KEY ("id_orientador") REFERENCES "docente"("id_docente") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coorientacao" ADD CONSTRAINT "coorientacao_id_discente_fkey" FOREIGN KEY ("id_discente") REFERENCES "discente"("id_discente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coorientacao" ADD CONSTRAINT "coorientacao_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docente"("id_docente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "coorientacao" ADD CONSTRAINT "coorientacao_id_externo_fkey" FOREIGN KEY ("id_externo") REFERENCES "externo"("id_externo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autor" ADD CONSTRAINT "autor_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docente"("id_docente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autor" ADD CONSTRAINT "autor_id_discente_fkey" FOREIGN KEY ("id_discente") REFERENCES "discente"("id_discente") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autor" ADD CONSTRAINT "autor_id_externo_fkey" FOREIGN KEY ("id_externo") REFERENCES "externo"("id_externo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "estrato_qualis" ADD CONSTRAINT "estrato_qualis_id_veiculo_fkey" FOREIGN KEY ("id_veiculo") REFERENCES "veiculo"("id_veiculo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_id_veiculo_fkey" FOREIGN KEY ("id_veiculo") REFERENCES "veiculo"("id_veiculo") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoria" ADD CONSTRAINT "autoria_id_publicacao_fkey" FOREIGN KEY ("id_publicacao") REFERENCES "publicacao"("id_publicacao") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "autoria" ADD CONSTRAINT "autoria_id_autor_fkey" FOREIGN KEY ("id_autor") REFERENCES "autor"("id_autor") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_id_docente_fkey" FOREIGN KEY ("id_docente") REFERENCES "docente"("id_docente") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao" ADD CONSTRAINT "avaliacao_id_resolucao_fkey" FOREIGN KEY ("id_resolucao") REFERENCES "resolucao"("id_resolucao") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao_publicacao" ADD CONSTRAINT "avaliacao_publicacao_id_processo_fkey" FOREIGN KEY ("id_processo") REFERENCES "avaliacao"("id_processo") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "avaliacao_publicacao" ADD CONSTRAINT "avaliacao_publicacao_id_publicacao_fkey" FOREIGN KEY ("id_publicacao") REFERENCES "publicacao"("id_publicacao") ON DELETE CASCADE ON UPDATE CASCADE;
