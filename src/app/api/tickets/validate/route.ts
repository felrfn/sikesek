import { NextResponse } from 'next/server';
import { decryptTicketPayload } from '@/lib/encryption';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { qrPayload } = body;

    if (!qrPayload) {
      return NextResponse.json({ success: false, error: 'No payload provided' }, { status: 400 });
    }

    const decrypted = decryptTicketPayload(qrPayload);
    
    if (!decrypted || !decrypted.transactionId) {
      return NextResponse.json({ success: false, error: 'Invalid QR code' }, { status: 400 });
    }

    // Check if the transaction exists and is paid
    const transaction = await prisma.transaction.findUnique({
      where: { id: decrypted.transactionId },
      include: {
        homestayBookings: { include: { homestay: true } },
        edutripBookings: { include: { package: true } },
        venueBookings: { include: { venue: true } }
      }
    });

    if (!transaction) {
      return NextResponse.json({ success: false, error: 'Transaction not found' }, { status: 404 });
    }

    if (transaction.paymentStatus !== 'paid') {
      return NextResponse.json({ success: false, error: 'Transaction has not been paid' }, { status: 400 });
    }

    // Success - in a real app we might mark it as 'used' or 'checked in' here
    return NextResponse.json({ 
      success: true, 
      message: 'Ticket is valid',
      data: {
        invoiceNumber: transaction.invoiceNumber,
        customerName: transaction.customerName,
        createdAt: transaction.createdAt,
        totalItems: transaction.homestayBookings.length + transaction.edutripBookings.length + transaction.venueBookings.length
      }
    });

  } catch (error) {
    console.error('Validation error:', error);
    return NextResponse.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
