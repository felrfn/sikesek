import { AdminTopbar } from "@/components/admin/AdminTopbar";
import { requireAdmin } from "@/lib/auth/requireAdmin";
import { ChangePasswordForm } from "./ChangePasswordForm";
import { ProfileForm } from "./ProfileForm";

export const dynamic = "force-dynamic";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  FIELD_OFFICER: "Petugas Lapangan",
};

export default async function AccountPage() {
  // requireAdmin() re-fetches the row from the database, so name/email/phone
  // here reflect the live account rather than a possibly stale JWT.
  const admin = await requireAdmin();

  return (
    <div>
      <AdminTopbar title="Akun Saya" />
      <div className="p-4 sm:p-6">
        <div className="mx-auto max-w-5xl">
          <h1 className="text-xl font-semibold text-gray-900">Akun Saya</h1>
          <p className="mt-1 text-sm text-gray-500">
            Kelola informasi profil dan kata sandi Anda.
          </p>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
            <ProfileForm
              initialName={admin.name}
              initialEmail={admin.email}
              initialPhone={admin.phone ?? ""}
              username={admin.username}
              roleLabel={ROLE_LABELS[admin.role] ?? admin.role}
              mustChangePassword={admin.mustChangePassword}
            />
            <ChangePasswordForm />
          </div>
        </div>
      </div>
    </div>
  );
}
