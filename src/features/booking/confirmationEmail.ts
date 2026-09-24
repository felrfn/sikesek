import { sendEmail } from "@/lib/email";
import { generateInvoiceAndTicketsPdf } from "@/features/tickets/pdf";
import { formatCurrency } from "@/lib/utils/format";
import { prisma } from "@/lib/prisma";

/**
 * Sends the invoice + e-ticket PDF to the customer after payment is
 * confirmed. Never throws - see src/lib/email.ts for why - so callers
 * (the Midtrans webhook) don't need special-case error handling around it.
 */
export async function sendBookingConfirmationEmail(transactionId: string) {
  const full = await prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
  });

  const pdfBytes = await generateInvoiceAndTicketsPdf(transactionId);

  const html = `
    <div style="font-family: Arial, sans-serif; color: #111;">
      <h2 style="color: #0f4a33;">Booking confirmed - ${full.invoiceNumber}</h2>
      <p>Hi ${full.customerName},</p>
      <p>Your payment has been received. Your invoice and e-ticket(s) are attached to this email as a PDF.</p>
      <p><strong>Total paid:</strong> ${formatCurrency(full.totalAmount)}</p>
      <p>Please present the QR code from your e-ticket at the venue.</p>
      <p>Thank you for booking with SIKESEK.</p>
    </div>
  `;

  await sendEmail({
    to: full.customerEmail,
    subject: `SIKESEK booking confirmed - ${full.invoiceNumber}`,
    html,
    attachments: [
      {
        filename: `${full.invoiceNumber}.pdf`,
        content: Buffer.from(pdfBytes),
        contentType: "application/pdf",
      },
    ],
  });
}
