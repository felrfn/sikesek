-- Generalize the durable notification inbox so KTR and booking reminders can
-- share one table. Existing rows are KTR notifications, hence the default.
ALTER TABLE "notifications"
    ALTER COLUMN "detection_id" DROP NOT NULL,
    ADD COLUMN "type" TEXT NOT NULL DEFAULT 'KTR',
    ADD COLUMN "booking_type" TEXT,
    ADD COLUMN "booking_id" TEXT,
    ADD COLUMN "invoice_number" TEXT,
    ADD COLUMN "metadata" JSONB;

-- CreateTable
CREATE TABLE "booking_notification_events" (
    "id" TEXT NOT NULL,
    "booking_type" TEXT NOT NULL,
    "booking_id" TEXT NOT NULL,
    "event_type" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "booking_notification_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "booking_notification_events_booking_type_booking_id_event_type_key" ON "booking_notification_events"("booking_type", "booking_id", "event_type");

-- CreateIndex
CREATE INDEX "booking_notification_events_sent_at_idx" ON "booking_notification_events"("sent_at");

-- CreateIndex
CREATE INDEX "notifications_recipient_id_sent_at_idx" ON "notifications"("recipient_id", "sent_at");

-- CreateIndex
CREATE INDEX "notifications_booking_type_booking_id_idx" ON "notifications"("booking_type", "booking_id");
