import { PiggyBank, RotateCcw, ShieldCheck } from "lucide-react";
import { after } from "next/server";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/format";
import {
  getPaymentStats,
  getTransactionsPage,
  PAYMENT_SORT_FIELDS,
  type PaymentSortField,
} from "@/features/payments/service";
import { PAYMENT_STATUS_OPTIONS } from "@/lib/utils/paymentStatus";
import { effectivePaymentStatus } from "@/lib/payment";
import { sweepOverduePaymentsThrottled } from "@/features/payments/expiryService";
import {
  buildPaginationMeta,
  parseDateRangeParams,
  parsePagination,
} from "@/lib/utils/adminQuery";
import type { PaymentStatus } from "@prisma/client";
import { PaymentsTable } from "./PaymentsTable";
import { PaymentsToolbar } from "./PaymentsToolbar";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

function first(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] : value;
}

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;

  after(() => {
    sweepOverduePaymentsThrottled().catch((error) => {
      console.error("[Payment] Background expiry sweep failed", error);
    });
  });

  const rawStatuses = first(params.statuses);
  const legacyStatus = first(params.status);
  const statuses = (
    rawStatuses
      ? rawStatuses.split(",")
      : legacyStatus
        ? [legacyStatus]
        : []
  ).filter((value): value is PaymentStatus =>
    (PAYMENT_STATUS_OPTIONS as readonly string[]).includes(value),
  );

  const sortParam = first(params.sort) as PaymentSortField | undefined;
  const sort =
    sortParam && PAYMENT_SORT_FIELDS.includes(sortParam) ? sortParam : undefined;
  const dir = first(params.dir) === "asc" ? "asc" : "desc";

  const search = typeof params.q === "string" ? params.q : undefined;
  const pagination = parsePagination(params);
  const dateRange = parseDateRangeParams(params);
  const dateActive = Boolean(dateRange.from || dateRange.to);

  const [{ transactions: rawTransactions, total }, stats] = await Promise.all([
    getTransactionsPage({
      statuses,
      search,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      skip: pagination.skip,
      take: pagination.take,
      sort,
      dir,
    }),
    getPaymentStats(),
  ]);
  const now = new Date();
  const transactions = rawTransactions.map((t) => {
    const paymentStatus = effectivePaymentStatus(
      t.paymentStatus,
      t.paymentExpiresAt,
      now,
    );
    return {
      ...t,
      paymentStatus,
      paymentOverdue: t.paymentStatus === "PENDING" && paymentStatus === "EXPIRED",
      totalAmount: Number(t.totalAmount),
      refundedAmount: Number(t.refundedAmount),
    };
  });
  const meta = buildPaginationMeta(total, pagination.page, pagination.pageSize);

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Manajemen Pembayaran
        </h1>
        <p className="mt-1 text-sm text-gray-500">
          Pantau dan verifikasi transaksi fasilitas.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Card className="bg-brand-50 p-4">
            <PiggyBank className="size-5 text-brand-700" />
            <p className="mt-3 text-sm text-gray-500">Total Pendapatan</p>
            <p className="text-2xl font-bold text-brand-800">
              {formatCurrency(stats.totalRevenue)}
            </p>
          </Card>
          <Card className="bg-amber-50 p-4">
            <RotateCcw className="size-5 text-amber-600" />
            <p className="mt-3 text-sm text-gray-500">Refund</p>
            <p className="text-2xl font-bold text-amber-700">
              {stats.refundedCount}
            </p>
          </Card>
          <Card className="bg-green-50 p-4">
            <ShieldCheck className="size-5 text-green-600" />
            <p className="mt-3 text-sm text-gray-500">
              Tingkat Keberhasilan Transaksi
            </p>
            <p className="text-2xl font-bold text-green-700">
              {stats.successRate}%
            </p>
          </Card>
        </div>

        <div className="mt-5">
          <PaymentsToolbar
            selectedStatuses={statuses}
            sort={{ field: sort ?? null, dir }}
            dateActive={dateActive}
          />
        </div>

        <div className="mt-3">
          <PaymentsTable
            transactions={transactions}
            meta={meta}
            sort={sort ?? null}
            dir={dir}
          />
        </div>
      </div>
    </div>
  );
}
