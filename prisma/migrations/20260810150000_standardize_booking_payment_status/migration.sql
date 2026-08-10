-- Standardize the booking + payment status workflow.
--
-- Two canonical status fields on bookings:
--   * "status"        (BookingStatus)   -> PENDING | CONFIRMED | REJECTED | CANCELLED
--   * "paymentStatus" (PaymentStatus)   -> UNPAID | PAID | REFUNDED
--
-- The removed enum members are mapped to their nearest equivalent so existing
-- rows never hold a value that no longer exists:
--   * booking.status  ONGOING / COMPLETED -> CONFIRMED
--   * paymentStatus / payments.status PENDING / FAILED -> UNPAID

-- ---------- Bookings: add paymentIntentId + backfill -------------
ALTER TABLE "bookings" ADD COLUMN "paymentIntentId" TEXT;

UPDATE "bookings" b
SET "paymentIntentId" = p."stripePaymentIntentId"
FROM "payments" p
WHERE p."bookingId" = b."id"
  AND p."stripePaymentIntentId" IS NOT NULL;

-- ---------- PaymentStatus: UNPAID | PAID | REFUNDED --------------
UPDATE "bookings" SET "paymentStatus" = 'UNPAID' WHERE "paymentStatus" IN ('PENDING', 'FAILED');
UPDATE "payments" SET "status" = 'UNPAID' WHERE "status" IN ('PENDING', 'FAILED');

CREATE TYPE "PaymentStatus_new" AS ENUM ('UNPAID', 'PAID', 'REFUNDED');

ALTER TABLE "bookings" ALTER COLUMN "paymentStatus" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "paymentStatus" TYPE "PaymentStatus_new" USING ("paymentStatus"::text::"PaymentStatus_new");

ALTER TABLE "payments" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "payments" ALTER COLUMN "status" TYPE "PaymentStatus_new" USING ("status"::text::"PaymentStatus_new");

DROP TYPE "PaymentStatus";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";

ALTER TABLE "bookings" ALTER COLUMN "paymentStatus" SET DEFAULT 'UNPAID';
ALTER TABLE "payments" ALTER COLUMN "status" SET DEFAULT 'UNPAID';

-- ---------- BookingStatus: PENDING | CONFIRMED | REJECTED | CANCELLED --------------
UPDATE "bookings" SET "status" = 'CONFIRMED' WHERE "status" IN ('ONGOING', 'COMPLETED');

CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'REJECTED', 'CANCELLED');

ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");

DROP TYPE "BookingStatus";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";

ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING';