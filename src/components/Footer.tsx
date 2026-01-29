import Link from "next/link";

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-black/10 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Buds at Work</h3>
            <p className="mt-2 text-sm text-slate-600">
              Professional services you can trust.
            </p>
          </div>

          {/* Quick Links */}
          <div>
            <h4 className="font-medium text-slate-900">Quick Links</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Home
                </Link>
              </li>
              <li>
                <Link href="/services" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/about" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  About
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal */}
          <div>
            <h4 className="font-medium text-slate-900">Legal</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/privacy" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact */}
          <div>
            <h4 className="font-medium text-slate-900">Contact</h4>
            <ul className="mt-2 space-y-2">
              <li className="text-sm text-slate-600">hello@budsatwork.com</li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-black/10 pt-8 text-center">
          <p className="text-sm text-slate-500">
            &copy; {currentYear} Buds at Work. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
