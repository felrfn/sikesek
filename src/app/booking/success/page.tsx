import { CheckCircle2, Download, Home } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { getTransactionByInvoice } from "@/features/booking/service";

export const dynamic = "force-dynamic";

export default async function BookingSuccessPage({
  searchParams,
}: {
  searchParams: Promise<{ invoice?: string }>;
}) {
  const { invoice } = await searchParams;
  const transaction = invoice ? await getTransactionByInvoice(invoice) : null;

  if (!transaction) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Booking not found
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            We could not find a booking for this invoice.
          </p>
          <LinkButton href="/" className="mt-4" variant="primary">
            Back to Home
          </LinkButton>
        </div>
      </main>
    );
  }

  if (transaction.paymentStatus === "PENDING") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Waiting for payment confirmation
          </h1>
          <p className="mt-2 max-w-sm text-sm text-gray-500">
            Invoice {transaction.invoiceNumber} is still pending. Your ticket
            will be issued automatically once Midtrans confirms the payment.
          </p>
          <LinkButton href="/" className="mt-4" variant="primary">
            Back to Home
          </LinkButton>
        </div>
      </main>
    );
  }

  if (transaction.paymentStatus !== "PAID") {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 text-center">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">
            Payment {transaction.paymentStatus.toLowerCase()}
          </h1>
          <p className="mt-2 text-sm text-gray-500">
            Invoice {transaction.invoiceNumber} could not be completed.
          </p>
          <LinkButton href="/booking" className="mt-4" variant="primary">
            Try Again
          </LinkButton>
        </div>
      </main>
    );
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden bg-white px-4 text-center">
      <div className="absolute inset-x-0 top-0 h-52 rounded-b-[50%] bg-green-50" />
      <div className="relative">
        <div className="mx-auto flex size-16 items-center justify-center rounded-full bg-green-100">
          <CheckCircle2 className="size-8 text-green-700" />
        </div>
        <h1 className="mt-6 text-xl font-semibold text-brand-800">
          Booking Successful!
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-sm text-gray-500">
          Your e-ticket has been generated and is ready to use. A copy has
          also been sent to your email.
        </p>

        <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
          <a
            href={`/api/tickets/${transaction.invoiceNumber}/pdf`}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-brand-700 px-4 py-2 text-sm font-medium text-white hover:bg-brand-800"
          >
            <Download className="size-4" />
            Download Ticket (PDF)
          </a>
          <LinkButton href="/" variant="outline">
            <Home className="size-4" />
            Back to Home
          </LinkButton>
        </div>
      </div>
    </main>
  );
}
