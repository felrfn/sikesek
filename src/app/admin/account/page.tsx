import { AtSign, Mail, ShieldCheck, UserRound } from "lucide-react";
import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ChangePasswordForm } from "./ChangePasswordForm";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  FIELD_OFFICER: "Petugas Lapangan",
};

export default async function AccountPage() {
  // requireAdmin() re-fetches the row from the database, so name/role/flag
  // here reflect the live account rather than a possibly stale JWT.
  const admin = await requireAdmin();

  return (
    <div>
      <AdminTopbar title="Akun Saya" />
      <div className="p-6">
        <h1 className="text-xl font-semibold text-gray-900">Akun Saya</h1>
        <p className="mt-1 text-sm text-gray-500">
          Informasi akun dan pengaturan kata sandi Anda.
        </p>

        <div className="mt-5 grid gap-5 lg:grid-cols-2">
          <Card className="p-6">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                {admin.name
                  .split(" ")
                  .map((part) => part[0])
                  .slice(0, 2)
                  .join("")
                  .toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-semibold text-gray-900">
                  {admin.name}
                </p>
                <p className="text-xs text-gray-500">
                  {ROLE_LABELS[admin.role] ?? admin.role}
                </p>
              </div>
            </div>

            <dl className="mt-5 space-y-3 text-sm">
              <div className="flex items-center gap-3">
                <dt className="flex w-24 shrink-0 items-center gap-2 text-gray-400">
                  <UserRound className="size-4" />
                  Username
                </dt>
                <dd className="truncate font-medium text-gray-800">
                  {admin.username}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="flex w-24 shrink-0 items-center gap-2 text-gray-400">
                  <Mail className="size-4" />
                  Email
                </dt>
                <dd className="truncate font-medium text-gray-800">
                  {admin.email}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="flex w-24 shrink-0 items-center gap-2 text-gray-400">
                  <AtSign className="size-4" />
                  Peran
                </dt>
                <dd className="font-medium text-gray-800">
                  {ROLE_LABELS[admin.role] ?? admin.role}
                </dd>
              </div>
              <div className="flex items-center gap-3">
                <dt className="flex w-24 shrink-0 items-center gap-2 text-gray-400">
                  <ShieldCheck className="size-4" />
                  Sandi
                </dt>
                <dd>
                  {admin.mustChangePassword ? (
                    <Badge tone="warning">
                      Masih kata sandi buatan admin
                    </Badge>
                  ) : (
                    <Badge tone="success">Sudah diatur sendiri</Badge>
                  )}
                </dd>
              </div>
            </dl>
          </Card>

          <ChangePasswordForm />
        </div>
      </div>
    </div>
  );
}
