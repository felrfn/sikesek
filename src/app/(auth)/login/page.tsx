import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { assets } from "@/lib/assets";
import { LoginForm } from "./LoginForm";

// Absolute title so the public "Arenan Kalikesek" template doesn't apply to
// this internal admin sign-in page.
export const metadata: Metadata = {
  title: { absolute: "Masuk · SIKESEK" },
  icons: {
    icon: [{ url: "/assets/logo_sikesek.png", type: "image/png" }],
    shortcut: "/assets/logo_sikesek.png",
    apple: "/assets/logo_sikesek.png",
  },
};

export default function LoginPage() {
  return (
    <div className="relative flex min-h-screen flex-col bg-cream-50">
      {/* Soft brand glow - decorative only */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(ellipse_60%_60%_at_50%_0%,var(--color-brand-50),transparent)]"
      />

      <main className="relative flex flex-1 items-center justify-center px-4 py-16">
        <div className="w-full max-w-sm">
          <div className="mb-8 flex flex-col items-center text-center">
            <Image
              src={assets.logoInternal}
              alt="Logo SIKESEK"
              width={455}
              height={546}
              className="h-16 w-auto"
              priority
            />
            <p className="mt-4 text-xl font-bold tracking-wide text-brand-800">
              SIKESEK
            </p>
            <p className="mt-1 text-[11px] font-medium tracking-[0.2em] text-gray-400 uppercase">
              Portal Internal
            </p>
          </div>

          <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-gray-200 sm:p-8">
            <h1 className="text-center text-lg font-semibold text-gray-900">
              Masuk ke Dashboard
            </h1>
            <p className="mt-1 text-center text-sm text-gray-500">
              Gunakan akun admin SIKESEK untuk melanjutkan.
            </p>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
            Khusus staf internal SIKESEK
          </p>
          <p className="mt-2 text-center text-sm">
            <Link
              href="/"
              className="font-medium text-brand-700 hover:text-brand-800 hover:underline"
            >
              &larr; Kembali ke situs publik
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
