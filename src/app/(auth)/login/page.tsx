import { ShieldCheck } from "lucide-react";
import { LoginForm } from "./LoginForm";

export default function LoginPage() {
  return (
    <div className="min-h-screen bg-gray-100">
      <header className="flex items-center gap-2 bg-brand-900 px-6 py-4 text-white">
        <ShieldCheck className="size-5" />
        <span className="font-bold tracking-wide">SIKESEK ADMIN</span>
      </header>

      <main className="flex items-center justify-center px-4 py-20">
        <div className="w-full max-w-sm overflow-hidden rounded-xl bg-white shadow-sm">
          <div className="flex items-center justify-center bg-brand-900 py-8">
            <div className="flex size-12 items-center justify-center rounded-full bg-white/10">
              <ShieldCheck className="size-6 text-white" />
            </div>
          </div>
          <div className="p-6">
            <h1 className="text-center text-lg font-semibold text-gray-900">
              Admin Access Portal
            </h1>
            <p className="mt-1 text-center text-sm text-gray-500">
              Please authenticate to continue to the dashboard.
            </p>
            <div className="mt-6">
              <LoginForm />
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
