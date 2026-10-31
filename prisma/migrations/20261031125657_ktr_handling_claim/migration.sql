-- AlterTable
ALTER TABLE "smoking_detections" ADD COLUMN     "handling_by_id" TEXT,
ADD COLUMN     "handling_started_at" TIMESTAMP(3);

-- CreateIndex
CREATE INDEX "smoking_detections_handling_by_id_idx" ON "smoking_detections"("handling_by_id");

-- AddForeignKey
ALTER TABLE "smoking_detections" ADD CONSTRAINT "smoking_detections_handling_by_id_fkey" FOREIGN KEY ("handling_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
