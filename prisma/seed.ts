import 'dotenv/config';
import { PrismaClient, DayType } from '@prisma/client';
import { Pool } from 'pg';
import { PrismaPg } from '@prisma/adapter-pg';
import bcrypt from 'bcryptjs';

const connectionString = `${process.env.DATABASE_URL}`;
const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log('Starting seeding...');

  console.log('Starting seeding...');

  // 0. Create Admin User
  const hashedPassword = await bcrypt.hash('admin123', 10);
  await prisma.user.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      email: 'admin@sikesek.com',
      name: 'Super Admin',
      hashedPassword,
      role: 'admin'
    }
  });

  // 1. Create Facilities
  const wifi = await prisma.facility.create({ data: { name: 'WiFi', iconName: 'wifi' } });
  const bath = await prisma.facility.create({ data: { name: 'Kamar Mandi Dalam', iconName: 'bath' } });
  const tv = await prisma.facility.create({ data: { name: 'TV', iconName: 'tv' } });
  const bed1 = await prisma.facility.create({ data: { name: '1 Bed', iconName: 'bed' } });
  const bed2 = await prisma.facility.create({ data: { name: '2 Bed', iconName: 'bed' } });

  // 2. Create Homestays
  const aren1 = await prisma.homestay.create({
    data: {
      name: 'AREN 1',
      weekdayPrice: 200000,
      weekendPrice: 250000,
      extraBedPrice: 25000,
      maxExtraBeds: 2,
      facilities: {
        create: [
          { facilityId: bath.id },
          { facilityId: bed1.id },
        ]
      }
    }
  });

  const aren4 = await prisma.homestay.create({
    data: {
      name: 'AREN 4',
      weekdayPrice: 450000,
      weekendPrice: 500000,
      extraBedPrice: 25000,
      maxExtraBeds: 2,
      facilities: {
        create: [
          { facilityId: bath.id },
          { facilityId: bed2.id },
          { facilityId: tv.id },
        ]
      }
    }
  });

  // 3. Create Venues
  const joglo = await prisma.venue.create({
    data: {
      name: 'JOGLO',
      minCapacity: 90,
      maxCapacity: 100,
      pricePerHour: 100000,
    }
  });

  const pawon = await prisma.venue.create({
    data: {
      name: 'PAWON',
      minCapacity: 30,
      maxCapacity: 40,
      pricePerHour: 50000,
    }
  });

  const gazebo = await prisma.venue.create({
    data: {
      name: 'GAZEBO ATAS',
      minCapacity: 20,
      maxCapacity: 30,
      pricePerHour: 30000,
      availableDays: {
        create: [
          { day: DayType.monday },
          { day: DayType.tuesday },
          { day: DayType.wednesday },
          { day: DayType.thursday },
          { day: DayType.friday },
        ]
      }
    }
  });

  // 4. Create Edutrips
  const padi = await prisma.activity.create({ data: { name: 'Tanam Padi' } });
  const ikan = await prisma.activity.create({ data: { name: 'Tangkap Ikan' } });
  const keceh = await prisma.activity.create({ data: { name: 'Keceh Kali' } });

  const edu3 = await prisma.edutripPackage.create({
    data: {
      name: 'EDU TRIP KESEK 3',
      pricePerPax: 50000,
      isPopular: true,
      activities: {
        create: [
          { activityId: padi.id },
          { activityId: ikan.id },
          { activityId: keceh.id },
        ]
      }
    }
  });

  console.log('Seeding completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
