import QRCode from "qrcode";

/**
 * The QR encodes only the invoice number (a stable identifier); the
 * scanning device sends it to the backend for authoritative validation
 * (PATTERNS.md ยง12 - QR Validation Pattern). No payment or personal data
 * is embedded in the code itself.
 */
export function generateTicketQrDataUrl(invoiceNumber: string) {
  return QRCode.toDataURL(invoiceNumber, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 240,
  });
}
