import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { assets } from "@/lib/assets";

const links = [
  { href: "/#homestay", label: "Homestay" },
  { href: "/#edutrip", label: "Edutrip" },
  { href: "/#venues", label: "Venue" },
  { href: "/#edutrip", label: "Paket" },
];

export function Navbar() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={assets.logo}
            alt="Arenan Kalikesek"
            width={36}
            height={36}
            className="h-9 w-auto"
          />
          <span className="text-base font-bold whitespace-nowrap text-brand-700 sm:text-lg">
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
        <LinkButton href="/booking" variant="accent" size="sm">
          Booking Sekarang
        </LinkButton>
      </div>
    </header>
  );
}
