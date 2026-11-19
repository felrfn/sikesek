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
      <h2 style="color: #0f4a33;">Pemesanan dikonfirmasi - ${full.invoiceNumber}</h2>
      <p>Halo ${full.customerName},</p>
      <p>Pembayaran Anda telah kami terima. Invoice dan e-tiket terlampir dalam email ini sebagai PDF.</p>
      <p><strong>Total dibayar:</strong> ${formatCurrency(full.totalAmount)}</p>
      <p>Tunjukkan QR code dari e-tiket Anda di lokasi.</p>
      <p>Terima kasih telah memesan di Arenan Kalikesek.</p>
    </div>
  `;

  await sendEmail({
    to: full.customerEmail,
    subject: `Konfirmasi pemesanan Arenan Kalikesek - ${full.invoiceNumber}`,
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
