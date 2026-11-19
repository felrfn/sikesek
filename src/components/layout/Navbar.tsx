"use client";

import { useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { LinkButton } from "@/components/ui/Button";
import { assets } from "@/lib/assets";

const links = [
  { href: "/#homestay", label: "Homestay" },
  { href: "/#edutrip", label: "Edutrip" },
  { href: "/#venues", label: "Venue" },
  { href: "/#edutrip", label: "Paket" },
];

export function Navbar() {
  const [open, setOpen] = useState(false);

  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <Image
            src={assets.logo}
            alt="Arenan Kalikesek"
            width={36}
            height={36}
            className="h-9 w-auto shrink-0"
          />
          <span className="truncate text-base font-bold text-brand-700 sm:text-lg">
            Arenan Kalikesek
          </span>
        </Link>

        <nav className="hidden gap-6 text-sm font-medium text-gray-600 md:flex">
          {links.map((link) => (
            <Link
              key={link.label}
              href={link.href}
              className="hover:text-brand-700"
            >
              {link.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <span className="hidden sm:block">
            <LinkButton href="/booking" variant="accent" size="sm">
              Booking Sekarang
            </LinkButton>
          </span>
          <button
            type="button"
            onClick={() => setOpen((value) => !value)}
            aria-expanded={open}
            aria-controls="public-mobile-nav"
            aria-label={open ? "Tutup menu" : "Buka menu"}
            className="inline-flex size-10 items-center justify-center rounded-lg text-gray-600 transition-colors hover:bg-gray-100 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:hidden"
          >
            {open ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </div>

      {open ? (
        <nav
          id="public-mobile-nav"
          className="border-t border-gray-100 px-4 py-2 md:hidden"
        >
          <ul className="space-y-1 text-sm font-medium text-gray-700">
            {links.map((link) => (
              <li key={link.label}>
                <Link
                  href={link.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-2 py-2 hover:bg-gray-50 hover:text-brand-700"
                >
                  {link.label}
                </Link>
              </li>
            ))}
            <li className="pt-1">
              <LinkButton
                href="/booking"
                variant="accent"
                size="sm"
                className="w-full"
                onClick={() => setOpen(false)}
              >
                Booking Sekarang
              </LinkButton>
            </li>
          </ul>
        </nav>
      ) : null}
    </header>
  );
}
