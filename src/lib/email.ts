import nodemailer from "nodemailer";

export interface SendEmailInput {
  to: string;
  subject: string;
  html: string;
  attachments?: { filename: string; content: Buffer; contentType: string }[];
}

function isEmailConfigured() {
  return Boolean(
    process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASSWORD,
  );
}

let cachedTransporter: ReturnType<typeof nodemailer.createTransport> | null = null;

function getTransporter() {
  if (cachedTransporter) return cachedTransporter;

  cachedTransporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT ?? 587),
    secure: process.env.SMTP_PORT === "465",
    auth: {
      user: process.env.SMTP_USER,
      pass: process.env.SMTP_PASSWORD,
    },
  });
  return cachedTransporter;
}

/**
 * Never throws. Missing SMTP configuration is expected in development and
 * must not break the booking/payment flow (product requirement) - it's
 * logged and skipped instead. In production, a real send failure is logged
 * server-side and swallowed the same way, since a booking that already
 * succeeded must not be reported as failed to the customer just because
 * the confirmation email couldn't go out.
 */
export async function sendEmail(input: SendEmailInput): Promise<{ sent: boolean }> {
  if (!isEmailConfigured()) {
    console.warn(
      "Email delivery skipped: email environment variables are not configured.",
    );
    return { sent: false };
  }

  try {
    await getTransporter().sendMail({
      from: process.env.SMTP_FROM ?? "SIKESEK <no-reply@sikesek.local>",
      to: input.to,
      subject: input.subject,
      html: input.html,
      attachments: input.attachments,
    });
    return { sent: true };
  } catch (error) {
    console.error("Failed to send email:", error);
    return { sent: false };
  }
}
