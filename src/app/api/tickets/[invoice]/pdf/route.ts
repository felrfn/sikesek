import { NextResponse } from "next/server";
import { getTransactionByInvoice } from "@/features/booking/service";
import { generateInvoicePdf } from "@/features/tickets/pdf";

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

  const pdfBytes = await generateInvoicePdf(transaction.id);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${transaction.invoiceNumber}.pdf"`,
    },
  });
}
