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
}

function lineItems(transaction: Transaction): LineItem[] {
  return [
    ...transaction.homestays.map((h) => ({
      name: h.homestay.name,
      detail: `${formatLongDate(h.checkInDate)} - ${h.totalNights} night(s)`,
      amount: h.subtotal,
      bookingStatus: h.bookingStatus,
      ticketCode: h.ticket?.code ?? null,
    })),
    ...transaction.venues.map((v) => ({
      name: v.venue.name,
      detail: `${formatLongDate(v.bookingDate)} - ${v.totalHours} jam`,
      amount: v.subtotal,
      bookingStatus: v.bookingStatus,
      ticketCode: v.ticket?.code ?? null,
    })),
    ...transaction.edutrips.map((e) => ({
      name: e.package.name,
      detail: `${formatLongDate(e.visitDate)} - ${e.paxCount} pax`,
      amount: e.subtotal,
      bookingStatus: e.bookingStatus,
      ticketCode: e.ticket?.code ?? null,
    })),
  ];
}

function newPage(doc: PDFDocument) {
  return doc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
}

/**
 * Combined invoice + e-ticket PDF (PRD.md FR-06, and the product owner's
 * explicit instruction that the QR ticket travels with the invoice). Data
 * is loaded fresh from the database here, never trusted from a caller, so
 * the document always reflects backend truth even if called from a route
 * a caller doesn't fully control.
 */
export async function generateInvoicePdf(transactionId: string) {
  const transaction = await loadTransactionForPdf(transactionId);
  const items = lineItems(transaction);

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  let page = newPage(pdfDoc);
  let y = PAGE_HEIGHT - 40;

  function ensureSpace(needed: number) {
    if (y - needed < MARGIN) {
      page = newPage(pdfDoc);
      y = PAGE_HEIGHT - 40;
    }
  }

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
  text("Invoice & E-Ticket", { size: 9, color: GRAY });
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

  for (const item of items) {
    ensureSpace(30);
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
    ensureSpace(40);
    text("E-tickets are issued once payment is confirmed.", {
      size: 9,
      color: GRAY,
    });
    return pdfDoc.save();
  }

  for (const item of items) {
    if (!item.ticketCode) continue;
    await drawTicketPage(pdfDoc, newPage(pdfDoc), item, font, boldFont);
  }

  return pdfDoc.save();
}

async function drawTicketPage(
  pdfDoc: PDFDocument,
  page: PDFPage,
  item: LineItem,
  font: PDFFont,
  boldFont: PDFFont,
) {
  let y = PAGE_HEIGHT - 50;

  page.drawText("SIKESEK E-Ticket", { x: MARGIN, y, size: 14, font: boldFont, color: BRAND_GREEN });
  y -= 20;
  page.drawText(item.name, { x: MARGIN, y, size: 12, font: boldFont });
  y -= 16;
  page.drawText(item.detail, { x: MARGIN, y, size: 9, font, color: GRAY });
  y -= 30;

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
  page.drawText("Present this QR code at the venue.", {
    x: MARGIN,
    y,
    size: 8,
    font,
    color: GRAY,
  });
}
