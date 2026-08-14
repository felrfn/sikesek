import Link from 'next/link';
import { MapPin, Phone, Mail } from 'lucide-react';

export function Footer() {
  return (
    <footer className="bg-[#0f3824] text-white py-12">
      <div className="container mx-auto px-4 md:px-8 grid grid-cols-1 md:grid-cols-3 gap-8">
        {/* Brand & Description */}
        <div className="flex flex-col gap-4">
          <h2 className="text-2xl font-bold text-white">SIKESEK</h2>
          <p className="text-slate-300 text-sm leading-relaxed pr-8">
            Destination Management for Kalikesek, offering premium nature experiences, edutrips, and traditional gathering spaces.
          </p>
        </div>

        {/* Quick Links */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-emerald-400">Quick Links</h3>
          <nav className="flex flex-col gap-2 text-sm text-slate-300">
            <Link href="#" className="hover:text-white transition-colors">Privacy Policy</Link>
            <Link href="#" className="hover:text-white transition-colors">Terms of Service</Link>
            <Link href="#" className="hover:text-white transition-colors">Sustainability Commitment</Link>
            <Link href="#" className="hover:text-white transition-colors">Partner Portal</Link>
          </nav>
        </div>

        {/* Contact Us */}
        <div className="flex flex-col gap-4">
          <h3 className="text-lg font-semibold text-emerald-400">Contact Us</h3>
          <div className="flex flex-col gap-3 text-sm text-slate-300">
            <div className="flex items-start gap-3">
              <MapPin className="w-5 h-5 shrink-0" />
              <p>Kalikesek, Sriwulan, Limbangan, Kendal, Jawa Tengah, 51383</p>
            </div>
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 shrink-0" />
              <p>+62 812-3456-7890</p>
            </div>
            <div className="flex items-center gap-3">
              <Mail className="w-5 h-5 shrink-0" />
              <p>info@sikesek.com</p>
            </div>
          </div>
        </div>
      </div>
      
      {/* Copyright */}
      <div className="container mx-auto px-4 md:px-8 mt-12 pt-6 border-t border-emerald-900/50 text-center text-sm text-slate-400">
        <p>© 2024 SIKESEK Destination Management. All rights reserved.</p>
      </div>
    </footer>
  );
}
