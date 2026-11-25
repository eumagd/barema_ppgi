-- CreateTable
CREATE TABLE "lote_importacao" (
    "id_lote" SERIAL NOT NULL,
    "nome_arquivo" VARCHAR(255) NOT NULL,
    "status" "status_importacao" NOT NULL DEFAULT 'PENDENTE',
    "total" INTEGER NOT NULL,
    "itens" JSONB NOT NULL,
    "id_usuario" INTEGER,
    "criado_em" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "iniciado_em" TIMESTAMP(3),
    "finalizado_em" TIMESTAMP(3),

    CONSTRAINT "lote_importacao_pkey" PRIMARY KEY ("id_lote")
);

-- CreateIndex
CREATE INDEX "lote_importacao_status_idx" ON "lote_importacao"("status");

-- AddForeignKey
ALTER TABLE "lote_importacao" ADD CONSTRAINT "lote_importacao_id_usuario_fkey" FOREIGN KEY ("id_usuario") REFERENCES "usuario"("id_usuario") ON DELETE SET NULL ON UPDATE CASCADE;

