-- AlterTable
ALTER TABLE "correspondencia" ADD COLUMN     "autores_movidos" JSONB;

-- AlterTable
ALTER TABLE "publicacao" ADD COLUMN     "id_mesclada_em" INTEGER;

-- CreateIndex
CREATE INDEX "publicacao_id_mesclada_em_idx" ON "publicacao"("id_mesclada_em");

-- AddForeignKey
ALTER TABLE "publicacao" ADD CONSTRAINT "publicacao_id_mesclada_em_fkey" FOREIGN KEY ("id_mesclada_em") REFERENCES "publicacao"("id_publicacao") ON DELETE SET NULL ON UPDATE CASCADE;


-- Uma publicação não pode ser mesclada nela mesma.
ALTER TABLE "publicacao"
  ADD CONSTRAINT "publicacao_mescla_chk" CHECK ("id_mesclada_em" IS NULL OR "id_mesclada_em" <> "id_publicacao");
