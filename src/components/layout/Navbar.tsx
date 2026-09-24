import Image from "next/image";
import Link from "next/link";
import { LinkButton } from "@/components/ui/Button";
import { assets } from "@/lib/assets";

const links = [
  { href: "/#homestay", label: "Homestay" },
  { href: "/#edutrip", label: "Edutrip" },
  { href: "/#venues", label: "Meeting Points" },
  { href: "/#edutrip", label: "Packages" },
];

export function Navbar() {
  return (
    <header className="border-b border-gray-200 bg-white">
      <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-4">
        <Link href="/" className="flex items-center gap-2">
          <Image
            src={assets.logo}
            alt="SIKESEK"
            width={36}
            height={36}
            className="h-9 w-auto"
          />
          <span className="text-lg font-bold text-brand-700">SIKESEK</span>
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
