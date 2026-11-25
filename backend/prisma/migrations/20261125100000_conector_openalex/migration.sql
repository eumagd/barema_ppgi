-- AlterEnum
ALTER TYPE "fonte_importacao" ADD VALUE 'OPENALEX';

-- AlterTable
ALTER TABLE "docente" ADD COLUMN     "id_openalex" VARCHAR(20),
ADD COLUMN     "orcid" VARCHAR(19);

-- CreateIndex
CREATE UNIQUE INDEX "docente_orcid_key" ON "docente"("orcid");

-- CreateIndex
CREATE UNIQUE INDEX "docente_id_openalex_key" ON "docente"("id_openalex");


-- Formatos: ORCID com dígito verificador X no fim; ID de autor do OpenAlex começa com "A".
ALTER TABLE "docente"
  ADD CONSTRAINT "docente_orcid_chk" CHECK ("orcid" IS NULL OR "orcid" ~ '^[0-9]{4}-[0-9]{4}-[0-9]{4}-[0-9]{3}[0-9X]$'),
  ADD CONSTRAINT "docente_id_openalex_chk" CHECK ("id_openalex" IS NULL OR "id_openalex" ~ '^A[0-9]{4,18}$');
