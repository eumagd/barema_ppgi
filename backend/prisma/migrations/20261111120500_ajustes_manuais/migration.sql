-- =====================================================================
-- AJUSTES MANUAIS
-- Migração criada com `npx prisma migrate dev --create-only` e editada à mão.
-- Reúne as regras do Modelo ER que o schema do Prisma não consegue expressar.
-- =====================================================================

-- ---------------------------------------------------------------------
-- 1. Restrições de domínio (CHECK)
-- ---------------------------------------------------------------------

ALTER TABLE "discente"
  ADD CONSTRAINT "discente_ano_ingresso_chk" CHECK ("ano_ingresso" BETWEEN 1980 AND 2100);

ALTER TABLE "publicacao"
  ADD CONSTRAINT "publicacao_ano_chk" CHECK ("ano_publicacao" BETWEEN 1950 AND 2100),
  ADD CONSTRAINT "publicacao_correspondencia_chk" CHECK ("correspondencia" IS NULL OR "correspondencia" BETWEEN 0 AND 100);

ALTER TABLE "estrato_qualis"
  ADD CONSTRAINT "estrato_qualis_pontuacao_chk" CHECK ("pontuacao" >= 0),
  ADD CONSTRAINT "estrato_qualis_ano_base_chk" CHECK ("ano_base" BETWEEN 2000 AND 2100);

ALTER TABLE "autoria"
  ADD CONSTRAINT "autoria_ordem_chk" CHECK ("ordem_autoria" >= 1);

ALTER TABLE "avaliacao"
  ADD CONSTRAINT "avaliacao_pontuacao_chk" CHECK ("pontuacao_pesquisa" IS NULL OR "pontuacao_pesquisa" >= 0),
  -- Relatório marcado como enviado precisa da data de envio.
  ADD CONSTRAINT "avaliacao_envio_relatorio_chk" CHECK ("status_relatorio" <> 'ENVIADO' OR "data_envio_relatorio" IS NOT NULL),
  -- Validade só faz sentido para processo deferido.
  ADD CONSTRAINT "avaliacao_validade_chk" CHECK ("valido_ate" IS NULL OR "status" = 'DEFERIDO');

ALTER TABLE "avaliacao_publicacao"
  ADD CONSTRAINT "avaliacao_publicacao_pontos_chk" CHECK ("pontos_atribuidos" IS NULL OR "pontos_atribuidos" >= 0);

-- ---------------------------------------------------------------------
-- 2. Categoria AUTOR (união): cada autor aponta para exatamente uma
--    superclasse, e ela precisa bater com o campo "tipo".
-- ---------------------------------------------------------------------

ALTER TABLE "autor"
  ADD CONSTRAINT "autor_uma_superclasse_chk" CHECK (
    num_nonnulls("id_docente", "id_discente", "id_externo") = 1
    AND (
         ("tipo" = 'DOCENTE'  AND "id_docente"  IS NOT NULL)
      OR ("tipo" = 'DISCENTE' AND "id_discente" IS NOT NULL)
      OR ("tipo" = 'EXTERNO'  AND "id_externo"  IS NOT NULL)
    )
  );

-- ---------------------------------------------------------------------
-- 3. Coorienta: o coorientador é um docente OU um membro externo,
--    sem repetir o mesmo par.
-- ---------------------------------------------------------------------

ALTER TABLE "coorientacao"
  ADD CONSTRAINT "coorientacao_um_coorientador_chk" CHECK (num_nonnulls("id_docente", "id_externo") = 1);

CREATE UNIQUE INDEX "coorientacao_discente_docente_uq"
  ON "coorientacao" ("id_discente", "id_docente") WHERE "id_docente" IS NOT NULL;

CREATE UNIQUE INDEX "coorientacao_discente_externo_uq"
  ON "coorientacao" ("id_discente", "id_externo") WHERE "id_externo" IS NOT NULL;

-- E-mails únicos sem diferenciar maiúsculas de minúsculas.
CREATE UNIQUE INDEX "docente_email_lower_uq" ON "docente" (lower("email"));
CREATE UNIQUE INDEX "usuario_email_lower_uq" ON "usuario" (lower("email"));

-- ---------------------------------------------------------------------
-- 4. Orienta: só docente PERMANENTE orienta, com no máximo 8 orientandos.
-- ---------------------------------------------------------------------

CREATE OR REPLACE FUNCTION "fn_valida_orientacao"() RETURNS trigger AS $$
DECLARE
  v_vinculo "vinculo_ppgi";
  v_total   INTEGER;
BEGIN
  IF NEW."id_orientador" IS NULL THEN
    RETURN NEW;
  END IF;

  SELECT "vinculo" INTO v_vinculo
    FROM "docente" WHERE "id_docente" = NEW."id_orientador";

  IF v_vinculo IS DISTINCT FROM 'PERMANENTE' THEN
    RAISE EXCEPTION 'Apenas docentes permanentes podem orientar (docente %).', NEW."id_orientador";
  END IF;

  SELECT count(*) INTO v_total
    FROM "discente"
   WHERE "id_orientador" = NEW."id_orientador"
     AND "id_discente" <> NEW."id_discente";

  IF v_total >= 8 THEN
    RAISE EXCEPTION 'O docente % já possui 8 orientandos (limite do modelo).', NEW."id_orientador";
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_valida_orientacao"
  BEFORE INSERT OR UPDATE OF "id_orientador" ON "discente"
  FOR EACH ROW EXECUTE FUNCTION "fn_valida_orientacao"();

-- O orientador não pode ser cadastrado também como coorientador do mesmo discente.
CREATE OR REPLACE FUNCTION "fn_valida_coorientacao"() RETURNS trigger AS $$
BEGIN
  IF NEW."id_docente" IS NOT NULL AND EXISTS (
       SELECT 1 FROM "discente"
        WHERE "id_discente" = NEW."id_discente"
          AND "id_orientador" = NEW."id_docente") THEN
    RAISE EXCEPTION 'O docente % já é orientador do discente %.', NEW."id_docente", NEW."id_discente";
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "trg_valida_coorientacao"
  BEFORE INSERT OR UPDATE ON "coorientacao"
  FOR EACH ROW EXECUTE FUNCTION "fn_valida_coorientacao"();

-- ---------------------------------------------------------------------
-- 5. View de apoio às telas de cálculo e relatório
-- ---------------------------------------------------------------------

CREATE VIEW "vw_resumo_avaliacao" AS
SELECT a."id_processo",
       d."id_docente",
       d."nome"                                                        AS "docente",
       a."tipo",
       a."status",
       r."numero_ano"                                                  AS "resolucao",
       count(ap."id_publicacao") FILTER (WHERE ap."considerada")       AS "publicacoes_consideradas",
       count(ap."id_publicacao") FILTER (WHERE NOT ap."considerada")   AS "publicacoes_desmarcadas",
       coalesce(sum(ap."pontos_atribuidos") FILTER (WHERE ap."considerada"), 0) AS "pontos_calculados"
  FROM "avaliacao" a
  JOIN "docente"   d ON d."id_docente"   = a."id_docente"
  JOIN "resolucao" r ON r."id_resolucao" = a."id_resolucao"
  LEFT JOIN "avaliacao_publicacao" ap ON ap."id_processo" = a."id_processo"
 GROUP BY a."id_processo", d."id_docente", d."nome", a."tipo", a."status", r."numero_ano";
