'use server';

import { prisma } from '@/lib/prisma';
import { revalidatePath } from 'next/cache';

export async function createTransaction(data: {
  customerName: string;
  customerEmail: string;
  customerPhone: string;
  items: { id: string; type: 'homestay' | 'edutrip'; price: number }[];
  totalAmount: number;
}) {
  try {
    // 1. Create the Transaction record
    const transaction = await prisma.transaction.create({
      data: {
        invoiceNumber: `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
        customerName: data.customerName,
        customerEmail: data.customerEmail,
        customerPhone: data.customerPhone,
        totalAmount: data.totalAmount,
        paymentStatus: 'pending',
      },
    });

    // 2. Insert items
    for (const item of data.items) {
      if (item.type === 'homestay') {
        await prisma.transactionHomestay.create({
          data: {
            transactionId: transaction.id,
            homestayId: item.id,
            pricePerNight: item.price,
            subtotal: item.price,
            totalNights: 1,
            checkInDate: new Date(), 
            checkOutDate: new Date(new Date().getTime() + 24 * 60 * 60 * 1000), 
          }
        });
      } else if (item.type === 'edutrip') {
        await prisma.transactionEdutrip.create({
          data: {
            transactionId: transaction.id,
            packageId: item.id,
            pricePerPax: item.price,
            subtotal: item.price,
            paxCount: 1, 
            visitDate: new Date(),
          }
        });
      }
    }

    return { success: true, transactionId: transaction.id };
  } catch (error) {
    console.error('Error creating transaction:', error);
    return { success: false, error: 'Failed to create transaction' };
  }
}

export async function getTransaction(id: string) {
  const t = await prisma.transaction.findUnique({
    where: { id },
    include: {
      homestayBookings: { include: { homestay: true } },
      edutripBookings: { include: { package: true } },
      venueBookings: { include: { venue: true } }
    }
  });
  
  if (!t) return null;
  
  return {
    ...t,
    totalAmount: Number(t.totalAmount),
    homestays: t.homestayBookings.map(th => ({ ...th, pricePerNight: Number(th.pricePerNight), extraBedPrice: Number(th.extraBedPrice), subtotal: Number(th.subtotal) })),
    edutrips: t.edutripBookings.map(te => ({ ...te, pricePerPax: Number(te.pricePerPax), subtotal: Number(te.subtotal), edutripPackage: te.package })),
    venues: t.venueBookings.map(tv => ({ ...tv, pricePerHour: Number(tv.pricePerHour), subtotal: Number(tv.subtotal) }))
  };
}

export async function processPayment(transactionId: string) {
  try {
    await prisma.transaction.update({
      where: { id: transactionId },
      data: { paymentStatus: 'paid' }
    });
    revalidatePath('/admin/payments');
    revalidatePath('/admin/reservations');
    return { success: true };
  } catch (error) {
    console.error('Error processing payment:', error);
    return { success: false };
  }
}
