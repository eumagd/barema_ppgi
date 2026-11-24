-- =====================================================================
-- AJUSTES MANUAIS DA INTEGRAÇÃO COM O QLATTES
-- Complementa 20261124120000_integracao_qlattes com o que o Prisma não expressa:
-- função de normalização, CHECKs e migração dos dados já existentes.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Normalização de textos (RF-BE07): minúsculas, sem acentos e sem
--    pontuação. unaccent() não é IMMUTABLE, então fixamos o dicionário
--    num wrapper para poder usar em índices e colunas geradas.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "f_unaccent"(texto TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, texto) $$;

CREATE OR REPLACE FUNCTION "fn_normaliza_texto"(texto TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$
  SELECT btrim(regexp_replace(regexp_replace(lower("f_unaccent"(texto)), '[^a-z0-9]+', ' ', 'g'), '\s+', ' ', 'g'))
$$;

-- Chave secundária: título sem o subtítulo (tudo após o primeiro ":").
CREATE OR REPLACE FUNCTION "fn_titulo_sem_subtitulo"(texto TEXT) RETURNS TEXT
  LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT "fn_normaliza_texto"(split_part(texto, ':', 1)) $$;

-- ---------------------------------------------------------------------
-- 2. Restrições de domínio (CHECK)
-- ---------------------------------------------------------------------

ALTER TABLE "docente"
  ADD CONSTRAINT "docente_id_lattes_chk" CHECK ("id_lattes" IS NULL OR "id_lattes" ~ '^[0-9]{16}$');

ALTER TABLE "estrato_qualis"
  -- Classificação manual (Qualis "N") exige justificativa (RF-BE05).
  ADD CONSTRAINT "estrato_qualis_manual_justificativa_chk"
    CHECK ("fonte" <> 'MANUAL' OR coalesce(btrim("justificativa"), '') <> '');

ALTER TABLE "turma"
  ADD CONSTRAINT "turma_semestre_chk" CHECK ("semestre" IN (1, 2)),
  ADD CONSTRAINT "turma_ano_chk" CHECK ("ano" BETWEEN 1980 AND 2100);

ALTER TABLE "correspondencia"
  ADD CONSTRAINT "correspondencia_nota_chk" CHECK ("nota" BETWEEN 0 AND 100),
  -- Cada tipo de comparação precisa do seu candidato.
  ADD CONSTRAINT "correspondencia_candidato_chk" CHECK (
       ("tipo" = 'PUBLICACAO' AND "id_publicacao_candidata" IS NOT NULL AND "id_publicacao_candidata" <> "id_publicacao")
    OR ("tipo" = 'AUTOR'      AND "nome_lido" IS NOT NULL AND "id_autor_candidato" IS NOT NULL)
  ),
  -- Decisão humana registra quem decidiu e quando.
  ADD CONSTRAINT "correspondencia_decisao_chk" CHECK (
    "decisao" NOT IN ('CONFIRMADA', 'REJEITADA') OR ("id_usuario" IS NOT NULL AND "decidido_em" IS NOT NULL)
  );

ALTER TABLE "importacao"
  ADD CONSTRAINT "importacao_hash_chk" CHECK ("hash_arquivo" ~ '^[0-9a-f]{64}$');

-- Uma mesma publicação não é comparada duas vezes com a mesma candidata.
CREATE UNIQUE INDEX "correspondencia_par_publicacao_uq"
  ON "correspondencia" ("id_publicacao", "id_publicacao_candidata") WHERE "tipo" = 'PUBLICACAO';

CREATE UNIQUE INDEX "correspondencia_par_autor_uq"
  ON "correspondencia" ("id_publicacao", "nome_lido", "id_autor_candidato") WHERE "tipo" = 'AUTOR';

-- DOI é único quando informado (comparação sem diferenciar maiúsculas).
CREATE UNIQUE INDEX "publicacao_doi_lower_uq" ON "publicacao" (lower("doi")) WHERE "doi" IS NOT NULL;

-- ---------------------------------------------------------------------
-- 3. Dados existentes
-- ---------------------------------------------------------------------

UPDATE "publicacao" SET "titulo_normalizado" = "fn_normaliza_texto"("titulo") WHERE "titulo_normalizado" IS NULL;

-- O nome de citação atual vira a primeira variação de cada autor.
INSERT INTO "autor_nome_citacao" ("id_autor", "nome", "nome_normalizado")
SELECT "id_autor", "nome_citacao", "fn_normaliza_texto"("nome_citacao")
  FROM "autor"
 WHERE coalesce("fn_normaliza_texto"("nome_citacao"), '') <> ''
ON CONFLICT DO NOTHING;
