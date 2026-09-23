"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Mail, Phone, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { useCart } from "@/features/booking/CartContext";

export function DataEntryForm() {
  const router = useRouter();
  const cart = useCart();
  const [name, setName] = useState(cart.customer?.name ?? "");
  const [email, setEmail] = useState(cart.customer?.email ?? "");
  const [phone, setPhone] = useState(cart.customer?.phone ?? "");
  const [agreed, setAgreed] = useState(false);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    cart.setCustomer({ name, email, phone });
    router.push("/booking/payment");
  }

  return (
    <form onSubmit={handleSubmit} className="mx-auto max-w-2xl px-4 py-6">
      <Card className="p-0">
        <div className="border-b border-gray-100 bg-cream-50 p-5">
          <h2 className="flex items-center gap-2 font-semibold text-gray-900">
            <UserIcon className="size-4 text-brand-700" />
            Data Diri Pemesan
          </h2>
          <p className="mt-1 text-sm text-gray-500">
            Please provide accurate details for your reservation.
          </p>
        </div>

        <div className="space-y-4 p-5">
          <label className="block text-sm font-medium text-gray-700">
            Nama / PIC
            <div className="mt-1 flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
              <UserIcon className="size-4 text-gray-400" />
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="nama"
                className="w-full text-sm outline-none"
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Email
            <div className="mt-1 flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
              <Mail className="size-4 text-gray-400" />
              <input
                required
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                className="w-full text-sm outline-none"
              />
            </div>
          </label>

          <label className="block text-sm font-medium text-gray-700">
            Nomor
            <div className="mt-1 flex items-center gap-2 rounded-md border border-gray-300 px-3 py-2">
              <Phone className="size-4 text-gray-400" />
              <input
                required
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="+62 8XX XXXX XXXX"
                className="w-full text-sm outline-none"
              />
            </div>
          </label>

          <label className="flex items-start gap-2 rounded-md bg-cream-50 p-3 text-sm text-gray-600">
            <input
              type="checkbox"
              required
              checked={agreed}
              onChange={(e) => setAgreed(e.target.checked)}
              className="mt-0.5"
            />
            I agree with Term And Condition and Privacy Policy of SIKESEK.
          </label>
        </div>
      </Card>

      <div className="mt-4 flex flex-col gap-2">
        <Button type="submit" variant="primary" size="lg">
          Continue to Payment
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={() => router.back()}
        >
          Back
        </Button>
      </div>
    </form>
  );
}
