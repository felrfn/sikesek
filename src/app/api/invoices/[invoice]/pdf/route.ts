import { NextResponse } from "next/server";
import { getTransactionByInvoice } from "@/features/booking/service";
import { generateInvoicePdf } from "@/features/tickets/pdf";

/** Invoice-only PDF (section 6 "Invoice PDF") - available regardless of
 * payment status, so a customer can always see what they were charged. */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ invoice: string }> },
) {
  const { invoice } = await params;
  const transaction = await getTransactionByInvoice(invoice);

  if (!transaction) {
    return NextResponse.json({ error: "Invoice not found" }, { status: 404 });
  }

  const pdfBytes = await generateInvoicePdf(transaction.id);

  return new NextResponse(Buffer.from(pdfBytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${transaction.invoiceNumber}-invoice.pdf"`,
    },
  });
}
