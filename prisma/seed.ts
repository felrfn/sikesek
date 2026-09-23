import bcrypt from "bcryptjs";
import { prisma } from "../src/lib/prisma.ts";

async function seedAdmin() {
  const email = process.env.SEED_ADMIN_EMAIL ?? "admin@sikesek.local";
  const password = process.env.SEED_ADMIN_PASSWORD ?? "sikesek-admin";

  if (!process.env.SEED_ADMIN_PASSWORD) {
    console.warn(
      "SEED_ADMIN_PASSWORD not set, using a default local-only password. " +
        "Change it after first login.",
    );
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const admin = await prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      email,
      username: "admin",
      name: "Administrator",
      hashedPassword,
      role: "ADMIN",
      approvedAt: new Date(),
    },
  });

  console.log(`Seeded admin user: ${admin.email}`);
  return admin;
}

async function seedFieldOfficers() {
  const defaultPassword = await bcrypt.hash("sikesek-officer", 10);

  const officers = [
    { username: "jane.doe", name: "Jane Doe", email: "jane.doe@sikesek.gov", approved: true },
    { username: "alex.smith", name: "Alex Smith", email: "alex.smith@sikesek.gov", approved: true },
    { username: "m.johnson", name: "Marcus Johnson", email: "m.johnson@sikesek.gov", approved: false },
    { username: "l.wong", name: "Lisa Wong", email: "l.wong@sikesek.gov", approved: true },
  ];

  const created = [];
  for (const officer of officers) {
    created.push(
      await prisma.user.upsert({
        where: { email: officer.email },
        update: {},
        create: {
          email: officer.email,
          username: officer.username,
          name: officer.name,
          hashedPassword: defaultPassword,
          role: "FIELD_OFFICER",
          approvedAt: officer.approved ? new Date() : null,
        },
      }),
    );
  }
  console.log(`Seeded ${created.length} field officers`);
  return created;
}

async function seedFacilities() {
  const names: { name: string; iconName: string }[] = [
    { name: "Kamar mandi dalam", iconName: "bathroom" },
    { name: "Kipas angin", iconName: "fan" },
    { name: "Kopi & teh", iconName: "coffee" },
    { name: "1 Bed", iconName: "bed" },
    { name: "2 Bed", iconName: "bed" },
    { name: "Water heater", iconName: "water_heater" },
    { name: "Space luas", iconName: "space" },
    { name: "TV", iconName: "tv" },
    { name: "2 Kamar", iconName: "door" },
    { name: "Dapur", iconName: "kitchen" },
    { name: "Ruang keluarga", iconName: "living_room" },
  ];

  const facilities: Record<string, string> = {};
  for (const facility of names) {
    const existing = await prisma.facility.findFirst({
      where: { name: facility.name },
    });
    const record =
      existing ??
      (await prisma.facility.create({
        data: { name: facility.name, iconName: facility.iconName },
      }));
    facilities[facility.name] = record.id;
  }
  return facilities;
}

async function seedHomestays(facilityIds: Record<string, string>) {
  const homestays = [
    {
      name: "AREN 1",
      imageUrl: "/assets/aren1.jpg",
      minCapacity: 2,
      maxCapacity: 4,
      weekdayPrice: 200_000,
      weekendPrice: 250_000,
      holidayPrice: 300_000,
      facilities: ["Kamar mandi dalam", "Kipas angin", "Kopi & teh", "1 Bed", "Water heater"],
    },
    {
      name: "AREN 2",
      imageUrl: "/assets/aren2.jpg",
      minCapacity: 2,
      maxCapacity: 4,
      weekdayPrice: 200_000,
      weekendPrice: 250_000,
      holidayPrice: 300_000,
      facilities: ["Kamar mandi dalam", "Kipas angin", "Kopi & teh", "1 Bed", "Water heater"],
    },
    {
      name: "AREN 3",
      imageUrl: "/assets/aren3.jpg",
      minCapacity: 4,
      maxCapacity: 6,
      weekdayPrice: 375_000,
      weekendPrice: 450_000,
      holidayPrice: 500_000,
      facilities: ["Kamar mandi dalam", "Space luas", "2 Bed", "TV", "Water heater"],
    },
    {
      name: "AREN 4",
      imageUrl: "/assets/aren4.jpg",
      minCapacity: 6,
      maxCapacity: 8,
      weekdayPrice: 450_000,
      weekendPrice: 500_000,
      holidayPrice: 575_000,
      facilities: ["2 Kamar", "Dapur", "Ruang keluarga", "TV"],
    },
  ];

  for (const homestay of homestays) {
    const existing = await prisma.homestay.findFirst({
      where: { name: homestay.name },
    });
    const data = {
      name: homestay.name,
      imageUrl: homestay.imageUrl,
      minCapacity: homestay.minCapacity,
      maxCapacity: homestay.maxCapacity,
      weekdayPrice: homestay.weekdayPrice,
      weekendPrice: homestay.weekendPrice,
      holidayPrice: homestay.holidayPrice,
      extraBedPrice: 25_000,
      maxExtraBeds: 1,
    };
    const record = existing
      ? await prisma.homestay.update({ where: { id: existing.id }, data })
      : await prisma.homestay.create({ data });

    for (const facilityName of homestay.facilities) {
      const facilityId = facilityIds[facilityName];
      if (!facilityId) continue;
      await prisma.homestayFacility.upsert({
        where: {
          homestayId_facilityId: { homestayId: record.id, facilityId },
        },
        update: {},
        create: { homestayId: record.id, facilityId },
      });
    }
  }
  console.log(`Seeded ${homestays.length} homestays`);
}

async function seedVenues() {
  const weekdays = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY"] as const;
  const allDays = [...weekdays, "SATURDAY", "SUNDAY"] as const;

  const venues = [
    { name: "JOGLO", minCapacity: 90, maxCapacity: 100, pricePerHour: 100_000, days: allDays },
    { name: "PAWON", minCapacity: 30, maxCapacity: 40, pricePerHour: 50_000, days: allDays },
    { name: "GAZEBO ATAS", minCapacity: 20, maxCapacity: 30, pricePerHour: 30_000, days: weekdays },
    { name: "Panggung", minCapacity: 30, maxCapacity: 40, pricePerHour: 75_000, days: allDays },
    { name: "Aula Dalam", minCapacity: 30, maxCapacity: 35, pricePerHour: 75_000, days: allDays },
    { name: "Aula Full", minCapacity: 60, maxCapacity: 70, pricePerHour: 100_000, days: allDays },
    { name: "Sewa Tempat (Outbound)", minCapacity: 1, maxCapacity: 200, pricePerHour: 25_000, days: allDays },
  ];

  for (const venue of venues) {
    const existing = await prisma.venue.findFirst({ where: { name: venue.name } });
    const record =
      existing ??
      (await prisma.venue.create({
        data: {
          name: venue.name,
          minCapacity: venue.minCapacity,
          maxCapacity: venue.maxCapacity,
          pricePerHour: venue.pricePerHour,
        },
      }));

    for (const day of venue.days) {
      await prisma.venueAvailableDay.upsert({
        where: { venueId_day: { venueId: record.id, day } },
        update: {},
        create: { venueId: record.id, day },
      });
    }
  }
  console.log(`Seeded ${venues.length} venues`);
}

async function seedEdutrips() {
  const activityNames = [
    "ETM",
    "Keceh Kali",
    "Terapi Ikan",
    "Menanam Padi",
    "Berenang",
    "Tangkap Ikan",
    "Tanam Padi / Sayur",
    "Tangkap Ikan & Berenang",
  ];

  const activityIds: Record<string, string> = {};
  for (const name of activityNames) {
    const existing = await prisma.activity.findFirst({ where: { name } });
    const record = existing ?? (await prisma.activity.create({ data: { name } }));
    activityIds[name] = record.id;
  }

  const packages = [
    {
      name: "EDU TRIP KESEK 1",
      pricePerPax: 35_000,
      isPopular: false,
      activities: ["ETM", "Keceh Kali", "Terapi Ikan", "Menanam Padi", "Berenang"],
    },
    {
      name: "EDU TRIP KESEK 2",
      pricePerPax: 35_000,
      isPopular: false,
      activities: ["ETM", "Keceh Kali", "Terapi Ikan", "Tangkap Ikan", "Berenang"],
    },
    {
      name: "EDU TRIP KESEK 3",
      pricePerPax: 50_000,
      isPopular: true,
      activities: ["ETM", "Keceh Kali", "Terapi Ikan", "Tanam Padi / Sayur", "Tangkap Ikan & Berenang"],
    },
  ];

  for (const pkg of packages) {
    const existing = await prisma.edutripPackage.findFirst({ where: { name: pkg.name } });
    const record =
      existing ??
      (await prisma.edutripPackage.create({
        data: {
          name: pkg.name,
          pricePerPax: pkg.pricePerPax,
          isPopular: pkg.isPopular,
        },
      }));

    for (const activityName of pkg.activities) {
      const activityId = activityIds[activityName];
      await prisma.edutripPackageActivity.upsert({
        where: {
          packageId_activityId: { packageId: record.id, activityId },
        },
        update: {},
        create: { packageId: record.id, activityId },
      });
    }
  }
  console.log(`Seeded ${packages.length} edutrip packages`);
}

async function seedKtrMonitoring(fieldOfficerId: string) {
  const areas = [
    { name: "Kolam Renang A", locationDescription: "Area kolam renang utama" },
    { name: "Kolam Renang B", locationDescription: "Area kolam renang belakang" },
  ];

  const areaIds: Record<string, string> = {};
  for (const area of areas) {
    const existing = await prisma.monitoredArea.findFirst({ where: { name: area.name } });
    const record =
      existing ??
      (await prisma.monitoredArea.create({
        data: {
          name: area.name,
          locationDescription: area.locationDescription,
          streamUrl: `rtsp://camera.local/${area.name.toLowerCase().replace(/\s+/g, "-")}`,
          assignedEmployeeId: fieldOfficerId,
        },
      }));
    areaIds[area.name] = record.id;
  }

  const existingDetections = await prisma.smokingDetection.count();
  if (existingDetections === 0) {
    await prisma.smokingDetection.createMany({
      data: [
        {
          areaId: areaIds["Kolam Renang A"],
          confidence: 0.94,
          imageUrl: "https://placehold.co/400x300?text=Evidence",
          status: "DETECTED",
          detectedAt: new Date(Date.now() - 1000 * 60 * 40),
        },
        {
          areaId: areaIds["Kolam Renang B"],
          confidence: 0.82,
          imageUrl: "https://placehold.co/400x300?text=Evidence",
          status: "RESOLVED",
          assignedTo: fieldOfficerId,
          resolvedBy: fieldOfficerId,
          resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 2),
          detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 3),
        },
        {
          areaId: areaIds["Kolam Renang A"],
          confidence: 0.98,
          imageUrl: "https://placehold.co/400x300?text=Evidence",
          status: "RESOLVED",
          notes: "False positive - steam mistaken for smoke",
          resolvedBy: fieldOfficerId,
          resolvedAt: new Date(Date.now() - 1000 * 60 * 60 * 20),
          detectedAt: new Date(Date.now() - 1000 * 60 * 60 * 22),
        },
      ],
    });
    console.log("Seeded 3 KTR detections");
  }
}

async function main() {
  const admin = await seedAdmin();
  const officers = await seedFieldOfficers();
  const facilityIds = await seedFacilities();
  await seedHomestays(facilityIds);
  await seedVenues();
  await seedEdutrips();
  await seedKtrMonitoring(officers[0]?.id ?? admin.id);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
