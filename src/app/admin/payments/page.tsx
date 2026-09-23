import { PiggyBank, RotateCcw, ShieldCheck } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Card } from "@/components/ui/Card";
import { formatCurrency } from "@/lib/utils/format";
import { getPaymentStats, getTransactions } from "@/features/payments/service";
import { PaymentsTable } from "./PaymentsTable";

export const dynamic = "force-dynamic";

export default async function PaymentsPage() {
  const [rawTransactions, stats] = await Promise.all([
    getTransactions(),
    getPaymentStats(),
  ]);
  const transactions = rawTransactions.map((t) => ({
    ...t,
    totalAmount: Number(t.totalAmount),
  }));

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

        <div className="mt-5">
          <PaymentsTable transactions={transactions} />
        </div>
      </div>
    </div>
  );
}
