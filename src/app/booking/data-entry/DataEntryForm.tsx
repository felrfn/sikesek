"use client";

import { useState, type FormEvent, type InputHTMLAttributes } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Mail,
  Phone,
  User as UserIcon,
  type LucideIcon,
} from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { cn } from "@/lib/utils/cn";
import { formatCurrency } from "@/lib/utils/format";
import { useCart } from "@/features/booking/CartContext";
import { cartItemKey } from "@/features/booking/types";

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PHONE_PATTERN = /^[0-9+\-\s()]{8,20}$/;

type FieldErrors = Partial<Record<"name" | "email" | "phone" | "agreed", string>>;

export function DataEntryForm() {
  const router = useRouter();
  const cart = useCart();
  const [name, setName] = useState(cart.customer?.name ?? "");
  const [email, setEmail] = useState(cart.customer?.email ?? "");
  const [phone, setPhone] = useState(cart.customer?.phone ?? "");
  const [agreed, setAgreed] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validate(): FieldErrors {
    const next: FieldErrors = {};
    if (name.trim().length < 2) next.name = "Nama minimal 2 karakter.";
    if (!EMAIL_PATTERN.test(email.trim()))
      next.email = "Format email tidak valid.";
    if (!PHONE_PATTERN.test(phone.trim()))
      next.phone = "Nomor telepon 8-20 digit (angka, +, -, spasi).";
    if (!agreed) next.agreed = "Centang persetujuan untuk melanjutkan.";
    return next;
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    cart.setCustomer({ name: name.trim(), email: email.trim(), phone: phone.trim() });
    router.push("/booking/payment");
  }

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-6">
      <form onSubmit={handleSubmit} noValidate>
        <Card className="p-0">
          <div className="border-b border-gray-100 bg-cream-50 p-5">
            <h2 className="flex items-center gap-2 font-semibold text-gray-900">
              <UserIcon className="size-4 text-brand-700" />
              Data Diri Pemesan
            </h2>
            <p className="mt-1 text-sm text-gray-500">
              Lengkapi data dengan benar untuk pemesanan Anda.
            </p>
          </div>

          <div className="space-y-4 p-5">
            <TextField
              id="customer-name"
              label="Nama Pemesan"
              icon={UserIcon}
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Nama lengkap"
              autoComplete="name"
              error={errors.name}
            />

            <TextField
              id="customer-email"
              label="Email"
              icon={Mail}
              type="email"
              inputMode="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="nama@email.com"
              autoComplete="email"
              error={errors.email}
            />

            <TextField
              id="customer-phone"
              label="Nomor WhatsApp/Telepon"
              icon={Phone}
              type="tel"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="+62 8XX XXXX XXXX"
              autoComplete="tel"
              error={errors.phone}
            />

            <div>
              <label className="flex items-start gap-3 rounded-lg bg-cream-50 p-3 text-sm text-gray-600">
                <input
                  type="checkbox"
                  checked={agreed}
                  onChange={(event) => setAgreed(event.target.checked)}
                  aria-invalid={errors.agreed ? true : undefined}
                  aria-describedby={errors.agreed ? "agreement-error" : undefined}
                  className="mt-0.5 size-4 shrink-0 accent-brand-700"
                />
                <span>
                  Saya menyetujui Syarat &amp; Ketentuan serta Kebijakan Privasi
                  Arenan Kalikesek.
                </span>
              </label>
              {errors.agreed ? (
                <p
                  id="agreement-error"
                  role="alert"
                  className="mt-1 text-xs text-red-600"
                >
                  {errors.agreed}
                </p>
              ) : null}
            </div>
          </div>
        </Card>

        {cart.items.length > 0 ? (
          <Card className="mt-4 p-5">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-semibold text-gray-900">
                Ringkasan Pemesanan
              </h2>
              <Link
                href="/booking"
                className="text-sm font-medium text-brand-700 hover:underline"
              >
                Ubah
              </Link>
            </div>
            <ul className="mt-3 space-y-2 text-sm">
              {cart.items.map((item) => (
                <li
                  key={cartItemKey(item)}
                  className="flex justify-between gap-3"
                >
                  <span className="min-w-0 break-words text-gray-700">
                    {item.name}
                  </span>
                  <span className="shrink-0 whitespace-nowrap text-gray-900">
                    {formatCurrency(item.subtotal)}
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex justify-between border-t border-gray-100 pt-3 text-sm font-semibold text-gray-900">
              <span>Total</span>
              <span>{formatCurrency(cart.total)}</span>
            </div>
          </Card>
        ) : null}

        <div className="mt-4 flex flex-col gap-2">
          <Button type="submit" variant="primary" size="lg" className="min-h-12">
            Lanjut ke Pembayaran
          </Button>
          <Button
            type="button"
            variant="outline"
            size="lg"
            className="min-h-12"
            onClick={() => router.back()}
          >
            Kembali
          </Button>
        </div>
      </form>
    </div>
  );
}

function TextField({
  id,
  label,
  icon: Icon,
  error,
  className,
  ...inputProps
}: {
  id: string;
  label: string;
  icon: LucideIcon;
  error?: string;
} & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <div>
      <label
        htmlFor={id}
        className="mb-1.5 block text-sm font-medium text-gray-700"
      >
        {label}
      </label>
      <div
        className={cn(
          "flex min-h-11 items-center gap-2 rounded-lg border px-3 transition-colors focus-within:ring-2",
          error
            ? "border-red-300 focus-within:ring-red-100"
            : "border-gray-300 focus-within:border-brand-600 focus-within:ring-brand-600/20",
        )}
      >
        <Icon className="size-4 shrink-0 text-gray-400" />
        <input
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${id}-error` : undefined}
          className={cn(
            "h-11 w-full bg-transparent text-base text-gray-900 outline-none placeholder:text-gray-400 sm:text-sm",
            className,
          )}
          {...inputProps}
        />
      </div>
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1 text-xs text-red-600">
          {error}
        </p>
      ) : null}
    </div>
  );
}
