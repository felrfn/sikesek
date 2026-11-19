"use client";

import { useState, type ComponentType, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { AtSign, Loader2, Lock, Mail, Phone, UserRound } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { updateOwnProfile } from "@/features/users/actions";

const inputClasses =
  "h-11 w-full rounded-lg border border-gray-300 bg-white px-3 text-sm text-gray-900 outline-none transition-colors placeholder:text-gray-400 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/20";

function initialsOf(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export function ProfileForm({
  initialName,
  initialEmail,
  initialPhone,
  username,
  roleLabel,
  mustChangePassword,
}: {
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  username: string;
  roleLabel: string;
  mustChangePassword: boolean;
}) {
  const router = useRouter();
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSuccess(false);
    setIsSubmitting(true);

    const result = await updateOwnProfile(new FormData(event.currentTarget));
    setIsSubmitting(false);

    if (result.error) {
      setError(result.error);
      return;
    }

    setName((value) => value.trim());
    setEmail((value) => value.trim());
    setPhone((value) => value.trim());
    setSuccess(true);
    router.refresh();
  }

  return (
    <Card className="p-6">
      <div className="flex items-center gap-3">
        <div className="flex size-11 items-center justify-center rounded-full bg-brand-100 text-sm font-semibold text-brand-700">
          {initialsOf(name) || "AD"}
        </div>
        <div className="min-w-0">
          <p className="truncate font-semibold text-gray-900">{name || "-"}</p>
          <p className="text-xs text-gray-500">{roleLabel}</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="mt-5 space-y-4">
        <Field
          id="profile-name"
          name="name"
          label="Nama"
          icon={UserRound}
          value={name}
          onChange={setName}
          autoComplete="name"
          maxLength={120}
        />
        <Field
          id="profile-email"
          name="email"
          label="Email"
          icon={Mail}
          type="email"
          value={email}
          onChange={setEmail}
          autoComplete="email"
          hint="Dipakai untuk login ke panel admin."
        />
        <Field
          id="profile-phone"
          name="phone"
          label="Nomor telepon"
          icon={Phone}
          type="tel"
          value={phone}
          onChange={setPhone}
          autoComplete="tel"
          maxLength={20}
          placeholder="Opsional"
        />

        <div className="flex items-center gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3 py-2.5 text-sm">
          <AtSign className="size-4 shrink-0 text-gray-400" aria-hidden="true" />
          <div className="min-w-0 flex-1">
            <p className="text-xs text-gray-500">Username</p>
            <p className="truncate font-medium text-gray-800">{username}</p>
          </div>
        </div>


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
            Profil berhasil diperbarui.
          </p>
        ) : null}

        <Button type="submit" disabled={isSubmitting} className="h-10">
          {isSubmitting ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Menyimpan…
            </>
          ) : (
            "Simpan Perubahan"
          )}
        </Button>
      </form>
    </Card>
  );
}

function Field({
  id,
  name,
  label,
  icon: Icon,
  type = "text",
  value,
  onChange,
  autoComplete,
  maxLength,
  placeholder,
  hint,
}: {
  id: string;
  name: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  type?: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete?: string;
  maxLength?: number;
  placeholder?: string;
  hint?: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-gray-700">
        {label}
      </label>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-gray-400"
          aria-hidden
        />
        <input
          id={id}
          name={name}
          type={type}
          required={name !== "phone"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          autoComplete={autoComplete}
          maxLength={maxLength}
          placeholder={placeholder}
          className={`${inputClasses} pl-9`}
        />
      </div>
      {hint ? <p className="mt-1 text-xs text-gray-500">{hint}</p> : null}
    </div>
  );
}
