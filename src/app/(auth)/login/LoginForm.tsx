"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { Eye, EyeOff, KeyRound, Loader2, LogIn, Mail } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setIsSubmitting(true);

    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
    });

    setIsSubmitting(false);

    if (result?.error) {
      setError("Email atau kata sandi salah.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label
          htmlFor="login-email"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Email
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
          <Mail className="size-4 shrink-0 text-gray-400" />
          <input
            id="login-email"
            type="email"
            required
            autoComplete="email"
            placeholder="nama@sikesek.id"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            aria-invalid={error ? true : undefined}
            className="h-11 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
        </div>
      </div>

      <div>
        <label
          htmlFor="login-password"
          className="mb-1.5 block text-sm font-medium text-gray-700"
        >
          Kata Sandi
        </label>
        <div className="flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 transition-colors focus-within:border-brand-600 focus-within:ring-2 focus-within:ring-brand-600/20">
          <KeyRound className="size-4 shrink-0 text-gray-400" />
          <input
            id="login-password"
            type={showPassword ? "text" : "password"}
            required
            autoComplete="current-password"
            placeholder="Masukkan kata sandi"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "login-error" : undefined}
            className="h-11 w-full bg-transparent text-sm text-gray-900 outline-none placeholder:text-gray-400"
          />
          <button
            type="button"
            onClick={() => setShowPassword((value) => !value)}
            aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
            aria-pressed={showPassword}
            className="shrink-0 rounded p-1 text-gray-400 transition-colors hover:text-gray-600 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            {showPassword ? (
              <EyeOff className="size-4" />
            ) : (
              <Eye className="size-4" />
            )}
          </button>
        </div>
      </div>

      {error ? (
        <p
          id="login-error"
          role="alert"
          className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"
        >
          {error}
        </p>
      ) : null}

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="mt-1 h-11 w-full bg-brand-800 text-sm font-semibold hover:bg-brand-900"
      >
        {isSubmitting ? (
          <>
            <Loader2 className="size-4 animate-spin" />
            Memproses…
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            Masuk
          </>
        )}
      </Button>
    </form>
  );
}
