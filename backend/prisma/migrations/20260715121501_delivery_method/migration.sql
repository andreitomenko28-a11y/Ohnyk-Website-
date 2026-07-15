-- CreateEnum
CREATE TYPE "DeliveryMethod" AS ENUM ('PICKUP', 'COOK_DELIVERY', 'COURIER');

-- AlterTable
ALTER TABLE "Order" ADD COLUMN     "deliveryMethod" "DeliveryMethod" NOT NULL DEFAULT 'COURIER';

