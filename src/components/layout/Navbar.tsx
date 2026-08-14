'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';

export function Navbar() {
  const pathname = usePathname();

  const navLinks = [
    { name: 'Homestay', href: '#' },
    { name: 'Edutrip', href: '#' },
    { name: 'Meeting Points', href: '#' },
    { name: 'Packages', href: '#' },
    { name: 'Booking', href: '/booking' },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-white">
      <div className="container mx-auto flex h-16 items-center justify-between px-4 md:px-8">
        <div className="flex items-center gap-2">
          <Link href="/" className="text-2xl font-bold text-sikesek">
            SIKESEK
          </Link>
        </div>
        
        <nav className="hidden md:flex items-center gap-8 text-sm font-medium">
          {navLinks.map((link) => {
            const isActive = pathname.startsWith(link.href) && link.href !== '#';
            return (
              <Link
                key={link.name}
                href={link.href}
                className={`transition-colors hover:text-sikesek ${
                  isActive ? 'text-sikesek border-b-2 border-sikesek pb-1' : 'text-slate-600'
                }`}
              >
                {link.name}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-4">
          <Link href="/booking">
            <Button className="bg-sikesek hover:bg-sikesek/90 text-white rounded-md px-6">
              Booking Sekarang
            </Button>
          </Link>
        </div>
      </div>
    </header>
  );
}
