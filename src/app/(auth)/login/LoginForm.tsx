"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { signIn } from "next-auth/react";
import { KeyRound, LogIn, User } from "lucide-react";
import { Button } from "@/components/ui/Button";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [remember, setRemember] = useState(false);
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
      setError("Invalid email or password.");
      return;
    }

    router.push("/admin");
    router.refresh();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex items-center gap-2 rounded-md border border-gray-300 bg-gray-50 px-3 py-2">
        <User className="size-4 text-gray-400" />
        <input
          type="email"
          required
          placeholder="Email/Username"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          className="w-full bg-transparent text-sm outline-none"
        />
      </label>

      <label className="flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
        <KeyRound className="size-4 text-gray-400" />
        <input
          type="password"
          required
          placeholder="Password"
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          className="w-full text-sm outline-none"
        />
      </label>

      <label className="flex items-center gap-2 text-sm text-gray-600">
        <input
          type="checkbox"
          checked={remember}
          onChange={(event) => setRemember(event.target.checked)}
        />
        Remember Me
      </label>

      {error ? <p className="text-sm text-red-600">{error}</p> : null}

      <Button
        type="submit"
        variant="primary"
        disabled={isSubmitting}
        className="w-full bg-brand-800 hover:bg-brand-900"
      >
        {isSubmitting ? "Signing in..." : "Login"}
        <LogIn className="size-4" />
      </Button>
    </form>
  );
}
