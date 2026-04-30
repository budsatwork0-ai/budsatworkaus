import { brand } from '../../ui/theme';
import { MARKETING_SERVICES } from '@/lib/marketing-services';

const rows = [
  { s: 'Home Cleaning', basis: 'Scope / hours', range: `From $${MARKETING_SERVICES.cleaning.from}`, notes: 'Size, rooms, condition' },
  { s: 'Window Cleaning', basis: 'Panes / access', range: `From $${MARKETING_SERVICES.windows.from}`, notes: 'Height, access, tracks/screens' },
  { s: 'Mowing & Edging', basis: 'Yard size', range: `From $${MARKETING_SERVICES.yard.from}`, notes: 'Growth, obstacles' },
  { s: 'Garden Care', basis: 'Hourly', range: '$69–$99/hr', notes: 'Hedging/green waste' },
  { s: 'Dump Runs', basis: 'Load / item', range: `From $${MARKETING_SERVICES.dump.from}`, notes: 'Weight, tip fees, distance' },
  { s: 'Car Detailing', basis: 'Package', range: `From $${MARKETING_SERVICES.auto.from}`, notes: 'Vehicle size, condition' },
  { s: 'Laundry & Sneaker Care', basis: 'Load / pair', range: `From $${MARKETING_SERVICES.laundry_sneakers.from}`, notes: 'Pickup, turnaround, add-ons' },
  { s: 'Property Maintenance', basis: 'Hourly', range: '$79–$120/hr', notes: 'Task complexity' },
];

export default function PricingPage() {
  return (
    <section className="mx-auto max-w-6xl py-4 md:py-6">
      <h1 className="text-3xl md:text-4xl font-extrabold" style={{ color: brand.primary }}>Pricing</h1>
      <p className="text-xl mt-2" style={{ color: brand.muted }}>Transparent, indicative ranges. Final price confirmed before work begins.</p>
      <div className="mt-8 rounded-3xl border bg-white p-6 shadow-sm overflow-x-auto" style={{ borderColor: brand.border }}>
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-slate-500">
              <th className="py-3">Service</th>
              <th className="py-3">Basis</th>
              <th className="py-3">Range</th>
              <th className="py-3">What changes price</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.s} className="border-t" style={{ borderColor: brand.border }}>
                <td className="py-3 font-medium" style={{ color: brand.primary }}>{r.s}</td>
                <td className="py-3">{r.basis}</td>
                <td className="py-3">{r.range}</td>
                <td className="py-3">{r.notes}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
