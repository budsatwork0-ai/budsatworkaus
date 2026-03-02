import Link from "next/link";

function FacebookIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
    </svg>
  );
}

function InstagramIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z" />
    </svg>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="mt-auto border-t border-black/10 bg-white/80 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-semibold text-slate-900">Buds At Work</h3>
            <p className="mt-2 text-sm text-slate-600">
              Professional services you can trust.
            </p>
            {/* Social links */}
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://www.facebook.com/people/Buds-At-Work/61579013228527/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buds At Work on Facebook"
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <FacebookIcon />
              </a>
              <a
                href="https://www.instagram.com/budsatwork_aus"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buds At Work on Instagram"
                className="text-slate-400 hover:text-slate-700 transition-colors"
              >
                <InstagramIcon />
              </a>
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-medium text-slate-900">Explore</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/services" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Services
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  FAQ
                </Link>
              </li>
              <li>
                <Link href="/shop" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Shop
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-medium text-slate-900">Company</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/about" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  About
                </Link>
              </li>
              <li>
                <Link href="/get-involved" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Get involved
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h4 className="font-medium text-slate-900">Legal & Contact</h4>
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
              <li className="pt-1">
                <a href="tel:0474766703" className="text-sm text-slate-600 hover:text-slate-900 transition">
                  0474 766 703
                </a>
              </li>
              <li className="text-sm text-slate-600">admin@budsatwork.com</li>
              <li>
                <Link href="/account" className="text-sm text-slate-400 hover:text-slate-600 transition">
                  Staff login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t border-black/10 pt-8 text-center">
          <p className="text-sm text-slate-500">
            &copy; {currentYear} Buds At Work. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  );
}
