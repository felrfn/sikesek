import { PiggyBank, RotateCcw, ShieldCheck } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { Pagination } from "@/components/admin/Pagination";
import { DateRangeFilter } from "@/components/admin/DateRangeFilter";
import { formatCurrency } from "@/lib/utils/format";
import { getPaymentStats, getTransactionsPage } from "@/features/payments/service";
import {
  buildPaginationMeta,
  parseDateRangeParams,
  parsePagination,
} from "@/lib/utils/adminQuery";
import type { PaymentStatus } from "@prisma/client";
import { PaymentsTable } from "./PaymentsTable";
import { PaymentsSearch } from "./PaymentsSearch";

export const dynamic = "force-dynamic";

type SearchParams = Record<string, string | string[] | undefined>;

const STATUS_OPTIONS: PaymentStatus[] = [
  "PENDING",
  "PAID",
  "FAILED",
  "EXPIRED",
  "PARTIALLY_REFUNDED",
  "REFUNDED",
];

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const status = STATUS_OPTIONS.includes(params.status as PaymentStatus)
    ? (params.status as PaymentStatus)
    : undefined;
  const search = typeof params.q === "string" ? params.q : undefined;
  const pagination = parsePagination(params);
  const dateRange = parseDateRangeParams(params);

  const [{ transactions: rawTransactions, total }, stats] = await Promise.all([
    getTransactionsPage({
      status,
      search,
      dateFrom: dateRange.from,
      dateTo: dateRange.to,
      skip: pagination.skip,
      take: pagination.take,
    }),
    getPaymentStats(),
  ]);
  const transactions = rawTransactions.map((t) => ({
    ...t,
    totalAmount: Number(t.totalAmount),
    refundedAmount: Number(t.refundedAmount),
  }));
  const meta = buildPaginationMeta(total, pagination.page, pagination.pageSize);

  return (
    <div>
      <AdminTopbar />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">
          Payment Management
        </h1>
        <p className="text-sm text-gray-500">
          Overview and verification of facility transactions.
        </p>

        <div className="mt-5 grid gap-4 sm:grid-cols-3">
          <Card className="p-4">
            <PiggyBank className="size-5 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Total Revenue</p>
            <p className="text-2xl font-bold text-gray-900">
              {formatCurrency(stats.totalRevenue)}
            </p>
          </Card>
          <Card className="p-4">
            <RotateCcw className="size-5 text-gray-400" />
            <p className="mt-3 text-sm text-gray-500">Refunded</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.refundedCount}
            </p>
          </Card>
          <Card className="p-4">
            <ShieldCheck className="size-5 text-green-500" />
            <p className="mt-3 text-sm text-gray-500">
              Transaction Success Rate
            </p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.successRate}%
            </p>
          </Card>
        </div>

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <PaymentsSearch />
          <DateRangeFilter label="Transaction" />
        </div>

        <div className="mt-3">
          <PaymentsTable transactions={transactions} />
        </div>

        <Card className="mt-3">
          <Pagination meta={meta} />
        </Card>
      </div>
    </div>
  );
}
