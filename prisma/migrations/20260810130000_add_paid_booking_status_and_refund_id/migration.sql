-- AlterEnum
ALTER TYPE "BookingStatus" ADD VALUE 'PAID';

-- AlterTable
ALTER TABLE "payments" ADD COLUMN "stripeRefundId" TEXT;