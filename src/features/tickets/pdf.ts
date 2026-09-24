import QRCode from "qrcode";
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { formatCurrency, formatLongDate } from "@/lib/utils/format";
import { prisma } from "@/lib/prisma";

const BRAND_GREEN = rgb(0.06, 0.24, 0.17);
const GRAY = rgb(0.45, 0.45, 0.45);
const LIGHT_GRAY = rgb(0.85, 0.85, 0.85);
const PAGE_WIDTH = 360;
const PAGE_HEIGHT = 640;
const MARGIN = 28;

async function loadTransactionForPdf(transactionId: string) {
  return prisma.transaction.findUniqueOrThrow({
    where: { id: transactionId },
    include: {
      homestays: { include: { homestay: true, ticket: true } },
      venues: { include: { venue: true, ticket: true } },
      edutrips: { include: { package: true, ticket: true } },
    },
  });
}

type Transaction = Awaited<ReturnType<typeof loadTransactionForPdf>>;

interface LineItem {
  name: string;
  detail: string;
  amount: bigint;
  bookingStatus: string;
  ticketCode: string | null;
  validFrom: Date | null;
  validUntil: Date | null;
}

function lineItems(transaction: Transaction): LineItem[] {
  return [
    ...transaction.homestays.map((h) => ({
      name: h.homestay.name,
      detail: `${formatLongDate(h.checkInDate)} - ${h.totalNights} night(s)`,
      amount: h.subtotal,
      bookingStatus: h.bookingStatus,
      ticketCode: h.ticket?.code ?? null,
      validFrom: h.ticket?.validFrom ?? null,
      validUntil: h.ticket?.validUntil ?? null,
    })),
    ...transaction.venues.map((v) => ({
      name: v.venue.name,
      detail: `${formatLongDate(v.bookingDate)} - ${v.totalHours} jam`,
      amount: v.subtotal,
      bookingStatus: v.bookingStatus,
      ticketCode: v.ticket?.code ?? null,
      validFrom: v.ticket?.validFrom ?? null,
      validUntil: v.ticket?.validUntil ?? null,
    })),
    ...transaction.edutrips.map((e) => ({
      name: e.package.name,
      detail: `${formatLongDate(e.visitDate)} - ${e.paxCount} pax`,
      amount: e.subtotal,
      bookingStatus: e.bookingStatus,
      ticketCode: e.ticket?.code ?? null,
      validFrom: e.ticket?.validFrom ?? null,
      validUntil: e.ticket?.validUntil ?? null,
    })),
  ];
}

function newPage(doc: PDFDocument) {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

async function embedFonts(pdfDoc: PDFDocument) {
  return {
    font: await pdfDoc.embedFont(StandardFonts.Helvetica),
    boldFont: await pdfDoc.embedFont(StandardFonts.HelveticaBold),
  };
}

/** The invoice-only PDF (section 6 "Invoice PDF") - no QR codes. */
export async function generateInvoicePdf(transactionId: string) {
  const transaction = await loadTransactionForPdf(transactionId);
  const pdfDoc = await PDFDocument.create();
  const { font, boldFont } = await embedFonts(pdfDoc);
  drawInvoicePage(newPage(pdfDoc), transaction, font, boldFont);
  return pdfDoc.save();
}

/**
 * The QR-ticket-only PDF (section 6 "QR Ticket PDF") - one page per booked
 * line item that has a ticket (i.e. the transaction is PAID). Empty
 * (zero-page) if payment hasn't been confirmed yet - callers should check
 * `paymentStatus` themselves and not offer this download before then.
 */
export async function generateTicketsPdf(transactionId: string) {
  const transaction = await loadTransactionForPdf(transactionId);
  const pdfDoc = await PDFDocument.create();
  const { font, boldFont } = await embedFonts(pdfDoc);

  for (const item of lineItems(transaction)) {
    if (!item.ticketCode) continue;
    await drawTicketPage(pdfDoc, newPage(pdfDoc), transaction, item, font, boldFont);
  }

  return pdfDoc.save();
}

/** Combined document (invoice + all tickets) used for the confirmation email. */
export async function generateInvoiceAndTicketsPdf(transactionId: string) {
  const transaction = await loadTransactionForPdf(transactionId);
  const pdfDoc = await PDFDocument.create();
  const { font, boldFont } = await embedFonts(pdfDoc);

  drawInvoicePage(newPage(pdfDoc), transaction, font, boldFont);

  for (const item of lineItems(transaction)) {
    if (!item.ticketCode) continue;
    await drawTicketPage(pdfDoc, newPage(pdfDoc), transaction, item, font, boldFont);
  }

  return pdfDoc.save();
}

function drawInvoicePage(
  page: PDFPage,
  transaction: Transaction,
  font: PDFFont,
  boldFont: PDFFont,
) {
  let y = PAGE_HEIGHT - 40;

  function text(
    value: string,
    opts: { size?: number; font?: PDFFont; color?: ReturnType<typeof rgb>; x?: number } = {},
  ) {
    page.drawText(value, {
      x: opts.x ?? MARGIN,
      y,
      size: opts.size ?? 10,
      font: opts.font ?? font,
      color: opts.color ?? rgb(0, 0, 0),
    });
  }

  function line() {
    page.drawLine({
      start: { x: MARGIN, y },
      end: { x: PAGE_WIDTH - MARGIN, y },
      thickness: 0.5,
      color: LIGHT_GRAY,
    });
  }

  text("SIKESEK", { size: 20, font: boldFont, color: BRAND_GREEN });
  y -= 18;
  text("Invoice", { size: 9, color: GRAY });
  y -= 22;

  const fields: [string, string][] = [
    ["Invoice / Booking Ref", transaction.invoiceNumber],
    ["Customer", transaction.customerName],
    ["Email", transaction.customerEmail],
    ["Phone", transaction.customerPhone],
    ["Payment status", transaction.paymentStatus],
    ["Payment method", transaction.paymentMethod ?? "-"],
    ["Midtrans transaction ID", transaction.midtransTransactionId ?? "-"],
    ["Paid at", transaction.paidAt ? formatLongDate(transaction.paidAt) : "-"],
  ];
  for (const [label, value] of fields) {
    text(`${label}:`, { color: GRAY });
    text(value, { x: MARGIN + 130, font: boldFont });
    y -= 15;
  }

  y -= 6;
  line();
  y -= 18;

  for (const item of lineItems(transaction)) {
    text(item.name, { font: boldFont, size: 11 });
    text(formatCurrency(item.amount), {
      x: PAGE_WIDTH - MARGIN - boldFont.widthOfTextAtSize(formatCurrency(item.amount), 10),
      font: boldFont,
    });
    y -= 13;
    text(`${item.detail} - ${item.bookingStatus}`, { size: 8, color: GRAY });
    y -= 18;
  }

  line();
  y -= 20;
  const totalLabel = "Total";
  const totalValue = formatCurrency(transaction.totalAmount);
  text(totalLabel, { font: boldFont, size: 13 });
  text(totalValue, {
    x: PAGE_WIDTH - MARGIN - boldFont.widthOfTextAtSize(totalValue, 13),
    font: boldFont,
    size: 13,
  });
  y -= 30;

  if (transaction.paymentStatus !== "PAID") {
    text("E-tickets are issued once payment is confirmed.", { size: 9, color: GRAY });
  }
}

async function drawTicketPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  transaction: Transaction,
  item: LineItem,
  font: PDFFont,
  boldFont: PDFFont,
) {
  let y = PAGE_HEIGHT - 50;

  page.drawText("SIKESEK E-Ticket", { x: MARGIN, y, size: 14, font: boldFont, color: BRAND_GREEN });
  y -= 22;
  page.drawText(transaction.customerName, { x: MARGIN, y, size: 10, font, color: GRAY });
  y -= 18;
  page.drawText(item.name, { x: MARGIN, y, size: 12, font: boldFont });
  y -= 16;
  page.drawText(item.detail, { x: MARGIN, y, size: 9, font, color: GRAY });
  y -= 16;
  if (item.validFrom && item.validUntil) {
    page.drawText(
      `Valid: ${formatLongDate(item.validFrom)} - ${formatLongDate(item.validUntil)}`,
      { x: MARGIN, y, size: 8, font, color: GRAY },
    );
  }
  y -= 24;

  const qrPng = await QRCode.toBuffer(item.ticketCode as string, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 220,
  });
  const qrImage = await pdfDoc.embedPng(qrPng);
  const qrSize = 200;
  page.drawImage(qrImage, {
    x: (PAGE_WIDTH - qrSize) / 2,
    y: y - qrSize,
    width: qrSize,
    height: qrSize,
  });
  y -= qrSize + 20;
  page.drawText("Present this QR code at the venue for scanning.", {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: GRAY,
  });
  y -= 14;
  page.drawText(`Booking ref: ${transaction.invoiceNumber}`, {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: GRAY,
  });
}
