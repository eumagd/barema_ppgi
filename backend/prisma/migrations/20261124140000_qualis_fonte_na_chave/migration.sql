-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "fonte_importacao" ADD VALUE 'QUALIS_CAPES';
ALTER TYPE "fonte_importacao" ADD VALUE 'QUALIS_PUC_RS';
ALTER TYPE "fonte_importacao" ADD VALUE 'QUALIS_SCOPUS';
ALTER TYPE "fonte_importacao" ADD VALUE 'QUALIS_EVENTOS';

-- AlterTable
ALTER TABLE "estrato_qualis" DROP CONSTRAINT "estrato_qualis_pkey",
ADD COLUMN     "id_importacao" INTEGER,
ADD CONSTRAINT "estrato_qualis_pkey" PRIMARY KEY ("id_veiculo", "ano_base", "area_de_atuacao", "fonte");

-- CreateIndex
CREATE INDEX "estrato_qualis_id_importacao_idx" ON "estrato_qualis"("id_importacao");

-- CreateIndex
CREATE INDEX "estrato_qualis_fonte_ano_base_area_de_atuacao_idx" ON "estrato_qualis"("fonte", "ano_base", "area_de_atuacao");

-- AddForeignKey
ALTER TABLE "estrato_qualis" ADD CONSTRAINT "estrato_qualis_id_importacao_fkey" FOREIGN KEY ("id_importacao") REFERENCES "importacao"("id_importacao") ON DELETE SET NULL ON UPDATE CASCADE;

