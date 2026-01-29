import { brand } from '../../ui/theme';
export default function CartPage() {
  return (
    <main className="mx-auto max-w-6xl px-6 md:px-8 py-12">
      <h1 className="text-3xl font-bold" style={{color:brand.primary}}>Your cart</h1>
      <p className="mt-2 text-slate-600">Your cart is empty. Add services to get started.</p>
    </main>
  );
}
