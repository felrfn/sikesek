import type { PublicContact } from "@/features/users/publicContact";
import { mailtoHref, whatsappHref } from "@/lib/utils/contact";

export function Footer({ contact }: { contact: PublicContact }) {
  return (
    <footer className="mt-auto bg-brand-900 text-brand-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold">Arenan Kalikesek</p>
          <p className="mt-2 max-w-xs text-sm text-brand-100">
            Pengelolaan destinasi Kalikesek dengan pengalaman alam premium,
            edutrip, dan ruang pertemuan tradisional.
          </p>
        </div>
        <div>
          <p className="font-semibold">Readme</p>
          <ul className="mt-2 space-y-1 text-sm text-brand-100">
            <li>Kebijakan Privasi</li>
            <li>Syarat Layanan</li>
            <li>Komitmen Keberlanjutan</li>
            <li>Portal Mitra</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Kontak Kami</p>
          <ul className="mt-2 space-y-1 text-sm text-brand-100">
            <li>Kalikesek, Sriwulan, Limbangan, Kendal, Jawa Tengah, 51383</li>
            <li>
              <a
                href={whatsappHref(contact.phone)}
                target="_blank"
                rel="noreferrer"
                className="transition-colors hover:text-white hover:underline"
              >
                {contact.phone}
              </a>
            </li>
            <li>
              <a
                href={mailtoHref(contact.email)}
                className="transition-colors hover:text-white hover:underline"
              >
                {contact.email}
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-800 py-4 text-center text-xs text-brand-100">
        &copy; {new Date().getFullYear()} Arenan Kalikesek. Hak cipta dilindungi.
      </div>
    </footer>
  );
}
