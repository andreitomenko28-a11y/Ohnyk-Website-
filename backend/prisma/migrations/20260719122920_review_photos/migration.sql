-- AlterTable
ALTER TABLE "Review" ADD COLUMN     "photos" TEXT[] DEFAULT ARRAY[]::TEXT[];
