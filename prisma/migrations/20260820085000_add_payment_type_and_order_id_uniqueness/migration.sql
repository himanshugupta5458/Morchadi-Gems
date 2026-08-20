-- CreateEnum
CREATE TYPE "payment_type" AS ENUM ('prepaid', 'cod', 'partial_cod');

-- DropIndex
DROP INDEX "orders_cashfree_order_id_idx";

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "amount_due" DECIMAL(10,2) NOT NULL DEFAULT 0,
ADD COLUMN     "amount_prepaid" DECIMAL(10,2) NOT NULL,
ADD COLUMN     "cod_amount_collected" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "cod_collected_at" TIMESTAMP(3),
ADD COLUMN     "item_received_back" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "item_received_back_at" TIMESTAMP(3),
ADD COLUMN     "payment_type" "payment_type" NOT NULL DEFAULT 'prepaid';

-- CreateIndex
CREATE UNIQUE INDEX "orders_cashfree_order_id_key" ON "orders"("cashfree_order_id");

