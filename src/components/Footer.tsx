import Link from "next/link";
import { brand } from "@/app/ui/theme";

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

function TikTokIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className="h-5 w-5" aria-hidden>
      <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-2.88 2.5 2.89 2.89 0 0 1-2.89-2.89 2.89 2.89 0 0 1 2.89-2.89c.28 0 .54.04.79.1V9.01a6.33 6.33 0 0 0-.79-.05 6.34 6.34 0 0 0-6.34 6.34 6.34 6.34 0 0 0 6.34 6.34 6.34 6.34 0 0 0 6.33-6.34V8.69a8.18 8.18 0 0 0 4.78 1.52V6.75a4.85 4.85 0 0 1-1.01-.06z" />
    </svg>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer
      data-cursor-exclude
      className="mt-auto border-t backdrop-blur-sm"
      style={{
        borderColor: brand.border,
        background: "linear-gradient(180deg, rgba(255,255,255,0.82) 0%, rgba(241,247,243,0.96) 100%)",
      }}
    >
      <div className="mx-auto max-w-7xl px-6 py-12">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand */}
          <div>
            <h3 className="text-lg font-semibold" style={{ color: brand.primary }}>Buds At Work</h3>
            <p className="mt-2 text-sm" style={{ color: brand.muted }}>
              Professional services you can trust.
            </p>
            {/* Social links */}
            <div className="mt-4 flex items-center gap-3">
              <a
                href="https://www.facebook.com/people/Buds-At-Work/61579013228527/"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buds At Work on Facebook"
                className="transition-opacity hover:opacity-75"
                style={{ color: brand.accent }}
              >
                <FacebookIcon />
              </a>
              <a
                href="https://www.instagram.com/budsatwork_aus"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buds At Work on Instagram"
                className="transition-opacity hover:opacity-75"
                style={{ color: brand.accent }}
              >
                <InstagramIcon />
              </a>
              <a
                href="https://www.tiktok.com/@buds.at.work"
                target="_blank"
                rel="noopener noreferrer"
                aria-label="Buds At Work on TikTok"
                className="transition-opacity hover:opacity-75"
                style={{ color: brand.accent }}
              >
                <TikTokIcon />
              </a>
            </div>
          </div>

          {/* Explore */}
          <div>
            <h4 className="font-medium" style={{ color: brand.primary }}>Explore</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/services" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  Services
                </Link>
              </li>
              <li>
                <Link href="/pricing" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  Pricing
                </Link>
              </li>
              <li>
                <Link href="/faq" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  FAQ
                </Link>
              </li>
            </ul>
          </div>

          {/* Company */}
          <div>
            <h4 className="font-medium" style={{ color: brand.primary }}>Company</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/about" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  About
                </Link>
              </li>
              <li>
                <Link href="/get-involved" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  Get involved
                </Link>
              </li>
              <li>
                <Link href="/contact" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  Contact
                </Link>
              </li>
            </ul>
          </div>

          {/* Legal & Contact */}
          <div>
            <h4 className="font-medium" style={{ color: brand.primary }}>Legal & Contact</h4>
            <ul className="mt-2 space-y-2">
              <li>
                <Link href="/privacy" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="/terms" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  Terms of Service
                </Link>
              </li>
              <li className="pt-1 text-sm" style={{ color: brand.muted }}>Servicing Logan &amp; South Brisbane</li>
              <li>
                <a href="mailto:admin@budsatwork.com" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.muted }}>
                  admin@budsatwork.com
                </a>
              </li>
              <li>
                <Link href="/account" className="text-sm transition-opacity hover:opacity-75" style={{ color: brand.accent }}>
                  Staff login
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-8 border-t pt-8 text-center" style={{ borderColor: brand.border }}>
          <p className="text-sm" style={{ color: brand.muted }}>
            &copy; {currentYear} Buds At Work. All rights reserved. &middot; ABN 56 890 024 059
          </p>
        </div>
      </div>
    </footer>
  );
}
