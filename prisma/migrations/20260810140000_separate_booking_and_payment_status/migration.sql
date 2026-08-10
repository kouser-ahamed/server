-- Separate PAYMENT status from BOOKING status.
--
-- Bookings previously marked "PAID" (an invented booking state meaning
-- "paid, awaiting vendor approval") now become plain PENDING bookings; the
-- paid state is tracked on paymentStatus / the payments table instead.
UPDATE "bookings" SET "status" = 'PENDING' WHERE "status" = 'PAID';

-- Recreate the BookingStatus enum without the PAID value.
CREATE TYPE "BookingStatus_new" AS ENUM ('PENDING', 'CONFIRMED', 'ONGOING', 'COMPLETED', 'CANCELLED', 'REJECTED');
ALTER TABLE "bookings" ALTER COLUMN "status" DROP DEFAULT;
ALTER TABLE "bookings" ALTER COLUMN "status" TYPE "BookingStatus_new" USING ("status"::text::"BookingStatus_new");
DROP TYPE "BookingStatus";
ALTER TYPE "BookingStatus_new" RENAME TO "BookingStatus";
ALTER TABLE "bookings" ALTER COLUMN "status" SET DEFAULT 'PENDING';