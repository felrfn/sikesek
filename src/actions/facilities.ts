'use server';

import { prisma } from '@/lib/prisma';

export async function getHomestays() {
  const data = await prisma.homestay.findMany({
    include: {
      facilities: {
        include: { facility: true }
      }
    }
  });
  return data.map(d => ({
    ...d,
    weekdayPrice: Number(d.weekdayPrice),
    weekendPrice: Number(d.weekendPrice),
    extraBedPrice: Number(d.extraBedPrice),
  }));
}

export async function getVenues() {
  const data = await prisma.venue.findMany({
    include: {
      availableDays: true
    }
  });
  return data.map(d => ({
    ...d,
    pricePerHour: Number(d.pricePerHour),
  }));
}

export async function getEdutrips() {
  const data = await prisma.edutripPackage.findMany({
    include: {
      activities: {
        include: { activity: true }
      }
    }
  });
  return data.map(d => ({
    ...d,
    pricePerPax: Number(d.pricePerPax),
  }));
}
