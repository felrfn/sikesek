/** Contact-link helpers shared by Workers and User Management. */

export function mailtoHref(email: string) {
  return `mailto:${email}`;
}

/**
 * Normalizes an Indonesian phone number into a wa.me URL:
 * `0812-3456-7890` -> `https://wa.me/6281234567890`.
 * Optionally appends a pre-filled message.
 */
export function whatsappHref(phone: string, message?: string) {
  const digits = phone.replace(/\D/g, "");
  const normalized = digits.startsWith("0")
    ? `62${digits.slice(1)}`
    : digits;
  const base = `https://wa.me/${normalized}`;
  return message?.trim()
    ? `${base}?text=${encodeURIComponent(message)}`
    : base;
}

export function telHref(phone: string) {
  return `tel:${phone.replace(/[^+\d]/g, "")}`;
}
