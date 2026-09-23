import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import type { getTransactionByInvoice } from "@/features/booking/service";

type Transaction = NonNullable<
  Awaited<ReturnType<typeof getTransactionByInvoice>>
>;

function lineItems(transaction: Transaction) {
  return [
    ...transaction.homestays.map((h) => ({
      name: h.homestay.name,
      detail: `${formatLongDate(h.checkInDate)}`,
      amount: h.subtotal,
    })),
    ...transaction.venues.map((v) => ({
      name: v.venue.name,
      detail: `${formatLongDate(v.bookingDate)} - ${v.totalHours} jam`,
      amount: v.subtotal,
    })),
    ...transaction.edutrips.map((e) => ({
      name: e.package.name,
      detail: `${formatLongDate(e.visitDate)} - ${e.paxCount} pax`,
      amount: e.subtotal,
    })),
  ];
}

export async function generateTicketPdf(transaction: Transaction) {
  const qrPng = await QRCode.toBuffer(transaction.invoiceNumber, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 200,
  });

  const pdfDoc = await PDFDocument.create();
  const page = pdfDoc.addPage([320, 500]);
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const qrImage = await pdfDoc.embedPng(qrPng);

  let y = 460;
  const left = 24;
  const brandGreen = rgb(0.06, 0.24, 0.17);

  page.drawText("SIKESEK", {
    x: left,
    y,
    size: 18,
    font: boldFont,
    color: brandGreen,
  });
  y -= 20;
  page.drawText("E-Ticket / Booking Confirmation", {
    x: left,
    y,
    size: 9,
    font,
    color: rgb(0.4, 0.4, 0.4),
  });
  y -= 24;

  const fields: [string, string][] = [
    ["Invoice", transaction.invoiceNumber],
    ["Name", transaction.customerName],
    ["Email", transaction.customerEmail],
    ["Phone", transaction.customerPhone],
    ["Status", transaction.paymentStatus],
  ];

  for (const [label, value] of fields) {
    page.drawText(`${label}:`, { x: left, y, size: 10, font, color: rgb(0.4, 0.4, 0.4) });
    page.drawText(value, { x: left + 70, y, size: 10, font: boldFont });
    y -= 16;
  }

  y -= 8;
  page.drawLine({
    start: { x: left, y },
    end: { x: 320 - left, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 16;

  for (const item of lineItems(transaction)) {
    page.drawText(item.name, { x: left, y, size: 10, font: boldFont });
    y -= 13;
    page.drawText(item.detail, { x: left, y, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
    page.drawText(formatCurrency(item.amount), {
      x: 320 - left - font.widthOfTextAtSize(formatCurrency(item.amount), 9),
      y: y + 13,
      size: 9,
      font,
    });
    y -= 16;
  }

  y -= 4;
  page.drawLine({
    start: { x: left, y },
    end: { x: 320 - left, y },
    thickness: 0.5,
    color: rgb(0.8, 0.8, 0.8),
  });
  y -= 18;

  const totalLabel = "Total";
  const totalValue = formatCurrency(transaction.totalAmount);
  page.drawText(totalLabel, { x: left, y, size: 12, font: boldFont });
  page.drawText(totalValue, {
    x: 320 - left - boldFont.widthOfTextAtSize(totalValue, 12),
    y,
    size: 12,
    font: boldFont,
  });

  const qrSize = 140;
  page.drawImage(qrImage, {
    x: (320 - qrSize) / 2,
    y: 40,
    width: qrSize,
    height: qrSize,
  });

  return pdfDoc.save();
}
