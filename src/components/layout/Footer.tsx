export function Footer() {
  return (
    <footer className="mt-auto bg-brand-900 text-brand-50">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 md:grid-cols-3">
        <div>
          <p className="text-lg font-bold">SIKESEK</p>
          <p className="mt-2 max-w-xs text-sm text-brand-100">
            Destination Management for Kalikesek, offering premium nature
            experiences, edutrips, and traditional gathering spaces.
          </p>
        </div>
        <div>
          <p className="font-semibold">Quick Links</p>
          <ul className="mt-2 space-y-1 text-sm text-brand-100">
            <li>Privacy Policy</li>
            <li>Terms of Service</li>
            <li>Sustainability Commitment</li>
            <li>Partner Portal</li>
          </ul>
        </div>
        <div>
          <p className="font-semibold">Contact Us</p>
          <ul className="mt-2 space-y-1 text-sm text-brand-100">
            <li>Kalikesek, Sriwulan, Limbangan, Kendal, Jawa Tengah, 51383</li>
            <li>+62 812-3456-7890</li>
            <li>info@sikesek.com</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-brand-800 py-4 text-center text-xs text-brand-100">
        &copy; {new Date().getFullYear()} SIKESEK Destination Management. All
        rights reserved.
      </div>
    </footer>
  );
}
