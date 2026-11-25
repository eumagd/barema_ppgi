-- Os pesos da Resolução nº 1/2025 têm três casas (A2 = 0,875; A4 = 0,625) e a divisão entre
-- coautores gera mais (0,625 ÷ 3 = 0,2083). Com duas casas, 0,875 virava 0,88 e um total de
-- 2,495 podia aparecer como 2,50 e passar no corte de 2,5. Passamos os pontos para 4 casas.
--
-- A view vw_resumo_avaliacao usa pontos_atribuidos; o PostgreSQL não altera o tipo de coluna
-- usada por view, então ela é recriada (mesma definição da migração 20261111120500).

DROP VIEW IF EXISTS "vw_resumo_avaliacao";

ALTER TABLE "avaliacao" ALTER COLUMN "pontuacao_pesquisa" SET DATA TYPE DECIMAL(10,4);
ALTER TABLE "avaliacao_publicacao" ALTER COLUMN "pontos_atribuidos" SET DATA TYPE DECIMAL(10,4);
ALTER TABLE "estrato_qualis" ALTER COLUMN "pontuacao" SET DATA TYPE DECIMAL(10,4);

-- Estratos gravados com o peso arredondado: refaz a pontuação pelos pesos da resolução.
UPDATE "estrato_qualis" SET "pontuacao" = CASE "estrato"
  WHEN 'A1' THEN 1.0 WHEN 'A2' THEN 0.875 WHEN 'A3' THEN 0.75 WHEN 'A4' THEN 0.625 WHEN 'B1' THEN 0.5 ELSE 0 END
 WHERE "pontuacao" <= 1;

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
