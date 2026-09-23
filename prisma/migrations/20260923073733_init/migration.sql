-- CreateEnum
CREATE TYPE "Role" AS ENUM ('ADMIN', 'FIELD_OFFICER');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('PENDING', 'PAID', 'CANCELLED', 'REFUNDED');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "DayType" AS ENUM ('MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY', 'SUNDAY');

-- CreateEnum
CREATE TYPE "DetectionStatus" AS ENUM ('DETECTED', 'NOTIFIED', 'RESOLVED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "username" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "hashed_password" TEXT NOT NULL,
    "phone" TEXT,
    "role" "Role" NOT NULL DEFAULT 'FIELD_OFFICER',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approved_at" TIMESTAMP(3),
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_fcm_tokens" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "token" TEXT NOT NULL,
    "device_info" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_fcm_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monitored_areas" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "location_description" TEXT,
    "stream_url" TEXT NOT NULL,
    "assigned_employee_id" TEXT,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monitored_areas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "smoking_detections" (
    "id" TEXT NOT NULL,
    "area_id" TEXT NOT NULL,
    "confidence" DECIMAL(5,4) NOT NULL,
    "image_url" TEXT NOT NULL,
    "status" "DetectionStatus" NOT NULL DEFAULT 'DETECTED',
    "assigned_to" TEXT,
    "detected_at" TIMESTAMP(3) NOT NULL,
    "resolved_by" TEXT,
    "resolved_at" TIMESTAMP(3),
    "notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "smoking_detections_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "detection_id" TEXT NOT NULL,
    "recipient_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sent_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "read_at" TIMESTAMP(3),

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "facilities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "icon_name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "facilities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homestays" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "min_capacity" INTEGER NOT NULL DEFAULT 1,
    "max_capacity" INTEGER NOT NULL,
    "weekday_price" BIGINT NOT NULL,
    "weekend_price" BIGINT NOT NULL,
    "holiday_price" BIGINT NOT NULL,
    "extra_bed_price" BIGINT NOT NULL DEFAULT 0,
    "max_extra_beds" INTEGER NOT NULL DEFAULT 1,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "homestays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "homestay_facilities" (
    "homestay_id" TEXT NOT NULL,
    "facility_id" TEXT NOT NULL,

    CONSTRAINT "homestay_facilities_pkey" PRIMARY KEY ("homestay_id","facility_id")
);

-- CreateTable
CREATE TABLE "homestay_special_prices" (
    "id" TEXT NOT NULL,
    "homestay_id" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "price" BIGINT NOT NULL,
    "note" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "homestay_special_prices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venues" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "image_url" TEXT,
    "min_capacity" INTEGER NOT NULL DEFAULT 1,
    "max_capacity" INTEGER NOT NULL,
    "price_per_hour" BIGINT NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "venue_available_days" (
    "venue_id" TEXT NOT NULL,
    "day" "DayType" NOT NULL,

    CONSTRAINT "venue_available_days_pkey" PRIMARY KEY ("venue_id","day")
);

-- CreateTable
CREATE TABLE "edutrip_packages" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "price_per_pax" BIGINT NOT NULL,
    "is_popular" BOOLEAN NOT NULL DEFAULT false,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "edutrip_packages_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "activities" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "edutrip_package_activities" (
    "package_id" TEXT NOT NULL,
    "activity_id" TEXT NOT NULL,

    CONSTRAINT "edutrip_package_activities_pkey" PRIMARY KEY ("package_id","activity_id")
);

-- CreateTable
CREATE TABLE "transactions" (
    "id" TEXT NOT NULL,
    "invoice_number" TEXT NOT NULL,
    "customer_name" TEXT NOT NULL,
    "customer_email" TEXT NOT NULL,
    "customer_phone" TEXT NOT NULL,
    "customer_note" TEXT,
    "total_amount" BIGINT NOT NULL,
    "snap_url" TEXT,
    "payment_method" TEXT,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "paid_at" TIMESTAMP(3),
    "midtrans_transaction_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_homestays" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "homestay_id" TEXT NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "check_in_date" DATE NOT NULL,
    "check_out_date" DATE NOT NULL,
    "total_nights" INTEGER NOT NULL,
    "extra_beds_count" INTEGER NOT NULL DEFAULT 0,
    "price_per_night" BIGINT NOT NULL,
    "extra_bed_price" BIGINT NOT NULL DEFAULT 0,
    "subtotal" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_homestays_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_venues" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "venue_id" TEXT NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "booking_date" DATE NOT NULL,
    "start_time" TIME NOT NULL,
    "end_time" TIME NOT NULL,
    "total_hours" INTEGER NOT NULL,
    "price_per_hour" BIGINT NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_venues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "transaction_edutrips" (
    "id" TEXT NOT NULL,
    "transaction_id" TEXT NOT NULL,
    "package_id" TEXT NOT NULL,
    "booking_status" "BookingStatus" NOT NULL DEFAULT 'PENDING',
    "visit_date" DATE NOT NULL,
    "pax_count" INTEGER NOT NULL,
    "price_per_pax" BIGINT NOT NULL,
    "subtotal" BIGINT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "transaction_edutrips_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_username_key" ON "users"("username");

-- CreateIndex
CREATE UNIQUE INDEX "transactions_invoice_number_key" ON "transactions"("invoice_number");

-- AddForeignKey
ALTER TABLE "user_fcm_tokens" ADD CONSTRAINT "user_fcm_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "monitored_areas" ADD CONSTRAINT "monitored_areas_assigned_employee_id_fkey" FOREIGN KEY ("assigned_employee_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smoking_detections" ADD CONSTRAINT "smoking_detections_area_id_fkey" FOREIGN KEY ("area_id") REFERENCES "monitored_areas"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smoking_detections" ADD CONSTRAINT "smoking_detections_assigned_to_fkey" FOREIGN KEY ("assigned_to") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "smoking_detections" ADD CONSTRAINT "smoking_detections_resolved_by_fkey" FOREIGN KEY ("resolved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_detection_id_fkey" FOREIGN KEY ("detection_id") REFERENCES "smoking_detections"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_recipient_id_fkey" FOREIGN KEY ("recipient_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homestay_facilities" ADD CONSTRAINT "homestay_facilities_homestay_id_fkey" FOREIGN KEY ("homestay_id") REFERENCES "homestays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homestay_facilities" ADD CONSTRAINT "homestay_facilities_facility_id_fkey" FOREIGN KEY ("facility_id") REFERENCES "facilities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "homestay_special_prices" ADD CONSTRAINT "homestay_special_prices_homestay_id_fkey" FOREIGN KEY ("homestay_id") REFERENCES "homestays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "venue_available_days" ADD CONSTRAINT "venue_available_days_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edutrip_package_activities" ADD CONSTRAINT "edutrip_package_activities_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "edutrip_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "edutrip_package_activities" ADD CONSTRAINT "edutrip_package_activities_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_homestays" ADD CONSTRAINT "transaction_homestays_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_homestays" ADD CONSTRAINT "transaction_homestays_homestay_id_fkey" FOREIGN KEY ("homestay_id") REFERENCES "homestays"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_venues" ADD CONSTRAINT "transaction_venues_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_venues" ADD CONSTRAINT "transaction_venues_venue_id_fkey" FOREIGN KEY ("venue_id") REFERENCES "venues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_edutrips" ADD CONSTRAINT "transaction_edutrips_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "transaction_edutrips" ADD CONSTRAINT "transaction_edutrips_package_id_fkey" FOREIGN KEY ("package_id") REFERENCES "edutrip_packages"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
