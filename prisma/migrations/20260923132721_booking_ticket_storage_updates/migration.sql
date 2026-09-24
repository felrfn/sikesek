-- CreateEnum
CREATE TYPE "DetectionSource" AS ENUM ('API', 'MANUAL');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "BookingStatus" ADD VALUE 'CHECKED_IN';
ALTER TYPE "BookingStatus" ADD VALUE 'REJECTED';

-- AlterEnum
BEGIN;
CREATE TYPE "PaymentStatus_new" AS ENUM ('PENDING', 'PAID', 'FAILED', 'EXPIRED', 'REFUNDED');
ALTER TABLE "public"."transactions" ALTER COLUMN "payment_status" DROP DEFAULT;
ALTER TABLE "transactions" ALTER COLUMN "payment_status" TYPE "PaymentStatus_new" USING ("payment_status"::text::"PaymentStatus_new");
ALTER TYPE "PaymentStatus" RENAME TO "PaymentStatus_old";
ALTER TYPE "PaymentStatus_new" RENAME TO "PaymentStatus";
DROP TYPE "public"."PaymentStatus_old";
ALTER TABLE "transactions" ALTER COLUMN "payment_status" SET DEFAULT 'PENDING';
COMMIT;

-- AlterTable
ALTER TABLE "homestays" ADD COLUMN     "description" TEXT;

-- AlterTable
ALTER TABLE "smoking_detections" DROP COLUMN "image_url",
ADD COLUMN     "evidence_key" TEXT NOT NULL,
ADD COLUMN     "source" "DetectionSource" NOT NULL DEFAULT 'API',
ADD COLUMN     "updated_at" TIMESTAMP(3) NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "profile_image_key" TEXT;

-- AlterTable
ALTER TABLE "venues" ADD COLUMN     "description" TEXT;

-- CreateTable
CREATE TABLE "facility_photos" (
    "id" TEXT NOT NULL,
    "homestay_id" TEXT,
    "venue_id" TEXT,
    "url" TEXT NOT NULL,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facility_photos_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "tickets" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "homestay_booking_id" TEXT,
    "venue_booking_id" TEXT,
    "edutrip_booking_id" TEXT,
    "valid_from" TIMESTAMP(3) NOT NULL,
    "valid_until" TIMESTAMP(3) NOT NULL,
    "used_at" TIMESTAMP(3),
    "used_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "tickets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "tickets_code_key" ON "tickets"("code");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_homestay_booking_id_key" ON "tickets"("homestay_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_venue_booking_id_key" ON "tickets"("venue_booking_id");

-- CreateIndex
CREATE UNIQUE INDEX "tickets_edutrip_booking_id_key" ON "tickets"("edutrip_booking_id");

-- AddForeignKey
ALTER TABLE "facility_photos" ADD CONSTRAINT "facility_photos_homestay_id_fkey" FOREIGN KEY ("homestay_id") REFERENCES "homestays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "facility_photos" ADD CONSTRAINT "facility_photos_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_homestay_booking_id_fkey" FOREIGN KEY ("homestay_booking_id") REFERENCES "transaction_homestays"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_venue_booking_id_fkey" FOREIGN KEY ("venue_booking_id") REFERENCES "transaction_venues"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_edutrip_booking_id_fkey" FOREIGN KEY ("edutrip_booking_id") REFERENCES "transaction_edutrips"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "tickets" ADD CONSTRAINT "tickets_used_by_user_id_fkey" FOREIGN KEY ("used_by_user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

