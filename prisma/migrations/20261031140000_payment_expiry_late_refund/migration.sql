-- AlterTable
ALTER TABLE "transactions" ADD COLUMN     "snap_token" TEXT,
ADD COLUMN     "payment_expires_at" TIMESTAMP(3),
ADD COLUMN     "late_payment_at" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "refunds" ALTER COLUMN "requested_by_user_id" DROP NOT NULL,
ADD COLUMN     "automatic" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "transactions_payment_status_payment_expires_at_idx" ON "transactions"("payment_status", "payment_expires_at");

-- Existing PENDING transactions had no deadline before this migration. Give
-- them the same 5-minute window measured from their creation so the expiry
-- job can clean them up instead of leaving stale slot holds forever.
UPDATE "transactions"
SET "payment_expires_at" = "created_at" + INTERVAL '5 minutes'
WHERE "payment_status" = 'PENDING'
  AND "payment_expires_at" IS NULL;
