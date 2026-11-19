"use client";

import { useMemo, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Copy, Phone, Plus } from "lucide-react";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Drawer } from "@/components/ui/Drawer";
import { Modal } from "@/components/ui/Modal";
import { Switch } from "@/components/ui/Switch";
import { formatShortDate } from "@/lib/utils/format";
import { mailtoHref, whatsappHref } from "@/lib/utils/contact";
import { createUser, resetUserPassword, updateUser } from "@/features/users/actions";
import type { User } from "@prisma/client";

function initials(name: string) {
  return name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  FIELD_OFFICER: "Petugas Lapangan",
};

export function UsersClient({ users }: { users: User[] }) {
  const router = useRouter();
  const [query, setQuery] = useState("");
  const [drawerMode, setDrawerMode] = useState<"create" | "edit" | null>(null);
  const [activeUser, setActiveUser] = useState<User | null>(null);
  const [generatedPasswordFor, setGeneratedPasswordFor] = useState<{
    name: string;
    password: string;
  } | null>(null);

  const filtered = useMemo(
    () =>
      users.filter((u) =>
        `${u.name} ${u.username} ${u.email}`
          .toLowerCase()
          .includes(query.toLowerCase()),
      ),
    [users, query],
  );

  async function handleReset(user: User) {
    if (
      !confirm(
        `Atur ulang kata sandi untuk ${user.name}? Kata sandi acak baru akan dibuat.`,
      )
    ) {
      return;
    }
    const result = await resetUserPassword(user.id);
    if (result.error) {
      alert(result.error);
      return;
    }
    if (result.password) {
      setGeneratedPasswordFor({ name: user.name, password: result.password });
    }
  }

  function closeDrawer() {
    setDrawerMode(null);
    setActiveUser(null);
  }

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <input
          placeholder="Cari staf berdasarkan nama, username, atau email…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-9 w-full max-w-md rounded-lg border border-gray-200 bg-white px-3 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        />
        <Button
          size="sm"
          onClick={() => {
            setActiveUser(null);
            setDrawerMode("create");
          }}
        >
          <Plus className="size-4" />
          Tambah Pengguna Baru
        </Button>
      </div>

      <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {filtered.map((user) => (
          <Card
            key={user.id}
            onClick={() => {
              setActiveUser(user);
              setDrawerMode("edit");
            }}
            title="Klik untuk mengedit"
            className="cursor-pointer p-4 transition-colors hover:border-brand-300"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex size-10 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
                  {initials(user.name)}
                </div>
                <div className="min-w-0">
                  <p className="truncate font-medium text-gray-900">{user.name}</p>
                  <a
                    href={mailtoHref(user.email)}
                    onClick={(event) => event.stopPropagation()}
                    className="block truncate text-xs text-gray-500 hover:text-brand-700 hover:underline"
                  >
                    {user.email}
                  </a>
                </div>
              </div>
              <Badge tone={user.approvedAt ? "success" : "neutral"}>
                {user.approvedAt ? "Aktif" : "Nonaktif"}
              </Badge>
            </div>

            <div className="mt-3 rounded-md bg-gray-50 px-3 py-2 text-xs text-gray-500">
              <p className="text-gray-400">Peran</p>
              <p className="font-medium text-gray-700">
                {ROLE_LABELS[user.role] ?? user.role}
              </p>
            </div>
            {user.phone ? (
              <a
                href={whatsappHref(user.phone)}
                target="_blank"
                rel="noreferrer"
                onClick={(event) => event.stopPropagation()}
                className="mt-2 inline-flex items-center gap-1.5 text-xs text-gray-500 hover:text-brand-700 hover:underline"
              >
                <Phone className="size-3.5" />
                {user.phone}
              </a>
            ) : null}
            <p className="mt-2 text-xs text-gray-400">
              Bergabung {formatShortDate(user.createdAt)}
            </p>
            {user.mustChangePassword ? (
              <p className="mt-2 text-xs font-medium text-amber-600">
                Wajib ganti kata sandi saat login berikutnya
              </p>
            ) : null}

            <div
              className="mt-3 flex gap-2"
              onClick={(event) => event.stopPropagation()}
            >
              <Button size="sm" variant="outline" onClick={() => handleReset(user)}>
                Reset Password
              </Button>
            </div>
          </Card>
        ))}
      </div>

      <Drawer
        open={drawerMode !== null}
        onClose={closeDrawer}
        title={
          drawerMode === "create"
            ? "Tambah Pengguna Baru"
            : `Edit Pengguna${activeUser ? ` — ${activeUser.name}` : ""}`
        }
      >
        {drawerMode ? (
          <UserForm
            mode={drawerMode}
            user={activeUser ?? undefined}
            onCancel={closeDrawer}
            onSaved={(generatedPassword, name) => {
              closeDrawer();
              if (generatedPassword) {
                setGeneratedPasswordFor({ name, password: generatedPassword });
              }
              router.refresh();
            }}
          />
        ) : null}
      </Drawer>

      <GeneratedPasswordModal
        value={generatedPasswordFor}
        onClose={() => setGeneratedPasswordFor(null)}
      />
    </>
  );
}

/**
 * Shown exactly once right after an account is created or reset. There is no
 * way to retrieve this value again once the modal is closed - only
 * `resetUserPassword` can issue a new one.
 */
function GeneratedPasswordModal({
  value,
  onClose,
}: {
  value: { name: string; password: string } | null;
  onClose: () => void;
}) {
  const [copied, setCopied] = useState(false);

  return (
    <Modal open={value !== null} onClose={onClose} title="Kata Sandi Dibuat">
      {value ? (
        <div className="space-y-3 text-sm">
          <p className="text-gray-600">
            Kata sandi acak dibuat untuk <strong>{value.name}</strong>. Bagikan
            secara aman — kata sandi tidak akan ditampilkan lagi. Pengguna wajib
            menggantinya saat login pertama.
          </p>
          <div className="flex items-center justify-between gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2 font-mono text-base">
            {value.password}
            <button
              type="button"
              onClick={() => {
                navigator.clipboard.writeText(value.password).catch(() => {});
                setCopied(true);
              }}
              className="flex items-center gap-1 rounded-md bg-brand-700 px-2 py-1 text-xs font-medium text-white hover:bg-brand-800"
            >
              <Copy className="size-3.5" />
              {copied ? "Tersalin" : "Salin"}
            </button>
          </div>
          <div className="flex justify-end pt-1">
            <Button size="sm" onClick={onClose}>
              Selesai
            </Button>
          </div>
        </div>
      ) : null}
    </Modal>
  );
}

function UserForm({
  mode,
  user,
  onCancel,
  onSaved,
}: {
  mode: "create" | "edit";
  user?: User;
  onCancel: () => void;
  onSaved: (generatedPassword: string | undefined, name: string) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [active, setActive] = useState(Boolean(user?.approvedAt));

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const formData = new FormData(event.currentTarget);
    let generatedPassword: string | undefined;
    let actionError: string | undefined;

    if (mode === "create") {
      const result = await createUser(formData);
      actionError = result.error;
      generatedPassword = result.password;
    } else {
      const result = await updateUser(user!.id, formData);
      actionError = result.error;
    }

    setIsSubmitting(false);
    if (actionError) {
      setError(actionError);
      return;
    }
    onSaved(generatedPassword, String(formData.get("name") ?? ""));
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <Field label="Nama" name="name" defaultValue={user?.name} required />
        <Field
          label="Username"
          name="username"
          defaultValue={user?.username}
          required
        />
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <Field
          label="Email"
          name="email"
          type="email"
          defaultValue={user?.email}
          required
        />
        <Field label="Telepon" name="phone" defaultValue={user?.phone ?? ""} />
      </div>

      <label className="block text-sm font-medium text-gray-700">
        Peran
        <select
          name="role"
          defaultValue={user?.role ?? "FIELD_OFFICER"}
          className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
        >
          <option value="ADMIN">Admin</option>
          <option value="FIELD_OFFICER">Petugas Lapangan</option>
        </select>
      </label>

      {mode === "create" ? (
        <p className="rounded-lg bg-gray-50 px-3 py-2 text-xs text-gray-500">
          Kata sandi acak akan dibuat otomatis dan ditampilkan sekali setelah
          disimpan. Pengguna wajib menggantinya saat login pertama.
        </p>
      ) : (
        <div className="rounded-lg border border-gray-200 p-3">
          <Switch
            checked={active}
            onCheckedChange={setActive}
            label="Akun aktif"
            description="Jika dimatikan, pengguna tidak dapat login (termasuk aplikasi mobile)."
          />
          {active ? (
            <input type="hidden" name="approved" value="true" />
          ) : null}
        </div>
      )}

      {error ? (
        <p
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <div className="flex gap-2 border-t border-gray-100 pt-4">
        <Button type="submit" variant="primary" disabled={isSubmitting}>
          {isSubmitting ? "Menyimpan…" : "Simpan"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel}>
          Batal
        </Button>
      </div>
    </form>
  );
}

function Field({
  label,
  name,
  type = "text",
  defaultValue,
  required,
}: {
  label: string;
  name: string;
  type?: string;
  defaultValue?: string;
  required?: boolean;
}) {
  return (
    <label className="block text-sm font-medium text-gray-700">
      {label}
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        className="mt-1 block w-full rounded-lg border border-gray-300 px-3 py-2 text-sm outline-none transition-colors focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20"
      />
    </label>
  );
}
