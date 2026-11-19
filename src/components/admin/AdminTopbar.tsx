import Link from "next/link";
import { requireAdmin } from "@/lib/auth/requireAdmin";

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "AD";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

// The search box this header used to render here was purely decorative (no
// onChange/state ever wired to it - see the task write-up that asked for
// its removal). Each list page that actually needs search now owns its own
// functional search input next to its own filters instead.
export async function AdminTopbar({ title }: { title?: string }) {
  // Read the live row (not the JWT) so editing name/email on /admin/account
  // is reflected here immediately, without a re-login.
  const admin = await requireAdmin();
  const displayName = admin.name?.trim() || admin.email;
  const initials = initialsOf(displayName);

  return (
    <header className="flex items-center justify-between border-b border-gray-200 bg-white px-6 py-3">
      {title ? <p className="font-semibold text-brand-700">{title}</p> : <div />}
      <div className="flex items-center gap-3">
        <Link
          href="/admin/account"
          aria-label={`Buka akun saya (${displayName})`}
          title={displayName}
          className="flex size-8 items-center justify-center rounded-full bg-brand-100 text-xs font-semibold text-brand-700 transition-opacity hover:opacity-80 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
        >
          {initials}
        </Link>
      </div>
    </header>
  );
}
