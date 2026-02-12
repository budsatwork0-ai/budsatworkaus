/**
 * Skip navigation links for keyboard accessibility.
 * These links are visually hidden but become visible when focused.
 */
export function SkipLinks() {
  return (
    <div className="sr-only focus-within:not-sr-only focus-within:fixed focus-within:top-0 focus-within:left-0 focus-within:z-[100] focus-within:flex focus-within:gap-2 focus-within:p-2 focus-within:bg-white">
      <a
        href="#main-content"
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        Skip to main content
      </a>
      <a
        href="#main-navigation"
        className="px-4 py-2 bg-emerald-600 text-white rounded-lg font-medium focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2"
      >
        Skip to navigation
      </a>
    </div>
  );
}

export default SkipLinks;
