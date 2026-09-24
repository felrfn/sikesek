import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTransactionByInvoice } from "@/features/booking/service";
import { generateTicketsPdf } from "@/features/tickets/pdf";

/** QR-ticket-only PDF (section 6 "QR Ticket PDF") - only available once
 * payment is confirmed, since tickets don't exist before then. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await params;
  const transaction = await getTransactionByInvoice(invoice);

  if (!transaction) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }
  if (transaction.paymentStatus !== "PAID") {
    return NextResponse.json(
      { error: "This booking has not been paid yet" },
      { status: 409 },
    );
  }

  const ticketCount = await prisma.ticket.count({
    where: { transactionId: transaction.id },
  });
  if (ticketCount === 0) {
    return NextResponse.json(
      { error: "Tickets are still being issued for this booking, please try again shortly." },
      { status: 409 },
    );
  }

  const pdfBytes = await generateTicketsPdf(transaction.id);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${transaction.invoiceNumber}-ticket.pdf"`,
    },
  });
}
