-- CreateEnum
CREATE TYPE "situacao_funcional" AS ENUM ('EFETIVO', 'SUBSTITUTO', 'VISITANTE', 'APOSENTADO');

-- AlterTable
ALTER TABLE "docente" ADD COLUMN     "departamento" VARCHAR(150),
ADD COLUMN     "situacao_funcional" "situacao_funcional" NOT NULL DEFAULT 'EFETIVO';

