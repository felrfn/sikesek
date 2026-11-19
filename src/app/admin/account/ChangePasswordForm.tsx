"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { changeOwnPassword } from "@/features/users/actions";

const inputClasses =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

export function ChangePasswordForm() {
  const router = useRouter();
  const [showPasswords, setShowPasswords] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);

    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(formData.get("currentPassword") ?? "");
    const newPassword = String(formData.get("newPassword") ?? "");
    const confirmPassword = String(formData.get("confirmPassword") ?? "");

    // Mirrors changePasswordSchema; checked here too so the obvious mistakes
    // don't cost a server round-trip.
    if (newPassword.length < 8) {
      setError("Kata sandi baru minimal 8 karakter.");
      return;
    }
    if (newPassword !== confirmPassword) {
      setError("Konfirmasi kata sandi tidak cocok.");
      return;
    }
    if (newPassword === currentPassword) {
      setError("Kata sandi baru harus berbeda dari kata sandi saat ini.");
      return;
    }

    setIsSubmitting(true);
    const result = await changeOwnPassword(formData);
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    form.reset();
    setSuccess(true);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <h2 className="font-semibold text-gray-900">Ganti Kata Sandi</h2>
      <p className="mt-1 text-sm text-gray-500">
        Masukkan kata sandi saat ini, lalu tentukan kata sandi baru minimal 8
        karakter.
      </p>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <PasswordField
          id="current-password"
          name="currentPassword"
          label="Kata sandi saat ini"
          autoComplete="current-password"
          show={showPasswords}
        />
        <PasswordField
          id="new-password"
          name="newPassword"
          label="Kata sandi baru"
          autoComplete="new-password"
          show={showPasswords}
        />
        <PasswordField
          id="confirm-password"
          name="confirmPassword"
          label="Ulangi kata sandi baru"
          autoComplete="new-password"
          show={showPasswords}
        />

        <button
          type="button"
          onClick={() => setShowPasswords((value) => !value)}
          aria-pressed={showPasswords}
          className="inline-flex items-center gap-1.5 text-xs font-medium text-gray-500 transition-colors hover:text-gray-700 focus-visible:outline-2 focus-visible:outline-brand-600"
        >
          {showPasswords ? (
            <EyeOff className="size-3.5" />
          ) : (
            <Eye className="size-3.5" />
          )}
          {showPasswords ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
        </button>

        {error ? (
          <p
            role="alert"
            className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
          >
            {error}
          </p>
        ) : null}

        {success ? (
          <p
            role="status"
            className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700"
          >
            Kata sandi berhasil diperbarui.
          </p>
        ) : null}

        <div className="flex items-center gap-3 pt-1">
          <Button type="submit" disabled={isSubmitting} className="h-10">
            {isSubmitting ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Menyimpan…
              </>
            ) : (
              "Simpan Kata Sandi"
            )}
          </Button>
          <p className="text-xs text-gray-400">
            Sesi di perangkat lain tidak otomatis berakhir.
          </p>
        </div>
      </form>
    </Card>
  );
}

function PasswordField({
  id,
  name,
  label,
  autoComplete,
  show,
}: {
  id: string;
  name: string;
  label: string;
  autoComplete: string;
  show: boolean;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        required
        autoComplete={autoComplete}
        placeholder="••••••••"
        className={inputClasses}
      />
    </div>
  );
}
