'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import type { ServiceType, Context, Frequency } from '@/types/orders';
import { SERVICE_TYPE_LABELS, FREQUENCY_LABELS } from '@/types/orders';

type QuoteStatus = 'pending' | 'approved' | 'adjusted' | 'denied' | 'converted';

interface Quote {
  id: number;
  client: string;
  email: string;
  phone: string;
  service: ServiceType;
  context: Context;
  scope?: string;
  frequency: Frequency;
  submitted: string;
  total: number;
  status: QuoteStatus;
  notes: string;
}

export default function QuotesPage() {
  const [quotes, setQuotes] = useState<Quote[]>([
    {
      id: 1,
      client: 'Maria Stevens',
      email: 'maria.s@email.com',
      phone: '0412345678',
      service: 'windows',
      context: 'home',
      scope: 'full',
      frequency: 'none',
      submitted: '24 Oct 2025',
      total: 340,
      status: 'pending',
      notes: '12 windows (interior + exterior) + tracks',
    },
    {
      id: 2,
      client: 'Dean Martin',
      email: 'dean.m@email.com',
      phone: '0423456789',
      service: 'yard',
      context: 'home',
      scope: 'lawn',
      frequency: 'none',
      submitted: '22 Oct 2025',
      total: 80,
      status: 'pending',
      notes: 'Standard front & back yard — Flagstone area',
    },
    {
      id: 3,
      client: 'ABC Corporation',
      email: 'facilities@abccorp.com',
      phone: '0798765432',
      service: 'cleaning',
      context: 'commercial',
      scope: 'standard',
      frequency: 'weekly',
      submitted: '20 Oct 2025',
      total: 440,
      status: 'approved',
      notes: 'Weekly office clean - 3 floors, includes break rooms',
    },
    {
      id: 4,
      client: 'Johnson Family',
      email: 'johnson@email.com',
      phone: '0434567890',
      service: 'dump',
      context: 'home',
      scope: 'bin',
      frequency: 'weekly',
      submitted: '18 Oct 2025',
      total: 20,
      status: 'approved',
      notes: 'Weekly bin clean service',
    },
  ]);

  const [convertModal, setConvertModal] = useState<{
    quote: Quote;
    type: 'order' | 'subscription';
  } | null>(null);

  const updateQuote = (id: number, newStatus: QuoteStatus, newTotal?: number) => {
    setQuotes((q) =>
      q.map((x) =>
        x.id === id
          ? { ...x, status: newStatus, total: newTotal ?? x.total }
          : x
      )
    );
    const messages: Record<string, string> = {
      approved: 'Quote approved',
      denied: 'Quote denied',
      adjusted: 'Quote price adjusted',
      converted: 'Quote converted',
    };
    toast.success(messages[newStatus] || `Quote ${newStatus}`);
  };

  const adjustQuote = (id: number) => {
    const newPrice = prompt('Enter new total price:');
    if (!newPrice) return;
    const num = parseFloat(newPrice);
    if (isNaN(num)) return toast.error('Invalid number.');
    updateQuote(id, 'adjusted', num);
  };

  const convertToOrder = async (quote: Quote) => {
    // In production, this would call the API
    // const res = await fetch('/api/orders', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     quote_id: quote.id.toString(),
    //     customer_name: quote.client,
    //     customer_email: quote.email,
    //     customer_phone: quote.phone,
    //     service_type: quote.service,
    //     context: quote.context,
    //     scope: quote.scope,
    //     frequency: quote.frequency,
    //     base_price: quote.total,
    //     final_price: quote.total,
    //     notes: quote.notes,
    //   }),
    // });

    updateQuote(quote.id, 'converted');
    setConvertModal(null);
    toast.success(`Order created from quote for ${quote.client}`);
  };

  const convertToSubscription = async (quote: Quote) => {
    // In production, this would call the API
    // const res = await fetch('/api/subscriptions', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json' },
    //   body: JSON.stringify({
    //     customer_name: quote.client,
    //     customer_email: quote.email,
    //     customer_phone: quote.phone,
    //     service_type: quote.service,
    //     context: quote.context,
    //     scope: quote.scope,
    //     frequency: quote.frequency,
    //     base_price: quote.total,
    //     price_per_cycle: quote.total,
    //     start_date: new Date().toISOString().split('T')[0],
    //     notes: quote.notes,
    //   }),
    // });

    updateQuote(quote.id, 'converted');
    setConvertModal(null);
    toast.success(`Subscription created from quote for ${quote.client}`);
  };

  const renderConvertModal = () => {
    if (!convertModal) return null;
    const { quote, type } = convertModal;

    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div
          className="absolute inset-0 bg-black/30"
          onClick={() => setConvertModal(null)}
          aria-hidden
        />
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative bg-white rounded-2xl shadow-xl max-w-md w-full mx-4 p-6"
        >
          <h2 className="text-lg font-semibold text-slate-900 mb-4">
            Convert to {type === 'order' ? 'Order' : 'Subscription'}
          </h2>

          <div className="space-y-3 text-sm">
            <div className="flex justify-between">
              <span className="text-slate-500">Customer</span>
              <span className="font-medium">{quote.client}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Service</span>
              <span className="font-medium">
                {SERVICE_TYPE_LABELS[quote.service]}
                {quote.scope && ` - ${quote.scope}`}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Frequency</span>
              <span className="font-medium">{FREQUENCY_LABELS[quote.frequency]}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-500">Price</span>
              <span className="font-semibold">${quote.total.toFixed(2)}</span>
            </div>
          </div>

          {type === 'subscription' && quote.frequency === 'none' && (
            <div className="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg text-xs text-yellow-700">
              This quote is for a one-time service. Converting to a subscription will require
              setting a recurring frequency.
            </div>
          )}

          <div className="flex gap-3 mt-6">
            <button
              onClick={() => setConvertModal(null)}
              className="flex-1 px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              onClick={() =>
                type === 'order'
                  ? convertToOrder(quote)
                  : convertToSubscription(quote)
              }
              className="flex-1 px-4 py-2 text-sm rounded-lg text-white"
              style={{ background: brand.primary }}
            >
              Create {type === 'order' ? 'Order' : 'Subscription'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  };

  const pendingQuotes = quotes.filter((q) => q.status === 'pending');
  const processedQuotes = quotes.filter((q) => q.status !== 'pending');

  return (
    <main className="max-w-5xl mx-auto py-8 px-4">
      <h1
        className="text-2xl font-semibold mb-2"
        style={{ color: brand.primary }}
      >
        Quote Submissions
      </h1>
      <p className="text-sm text-slate-500 mb-6">
        Review incoming quotes. Approved quotes can be converted to orders or subscriptions.
      </p>

      {/* Pending Quotes */}
      {pendingQuotes.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3">
            Pending Review ({pendingQuotes.length})
          </h2>
          <AnimatePresence>
            {pendingQuotes.map((q) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-black/10 bg-white/80 backdrop-blur p-5 mb-4 shadow-sm hover:shadow-md transition-all"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-lg">
                      {q.client}
                    </div>
                    <div className="text-sm text-slate-600">
                      {SERVICE_TYPE_LABELS[q.service]} ({q.context}) • ${q.total.toFixed(2)}
                      {q.frequency !== 'none' && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {FREQUENCY_LABELS[q.frequency]}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Submitted {q.submitted} • {q.email}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 italic">
                      {q.notes}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap">
                    <button
                      onClick={() => updateQuote(q.id, 'approved')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-green-100 text-green-700 hover:bg-green-200"
                    >
                      Approve
                    </button>
                    <button
                      onClick={() => adjustQuote(q.id)}
                      className="px-3 py-1.5 text-xs rounded-lg bg-yellow-100 text-yellow-700 hover:bg-yellow-200"
                    >
                      Adjust
                    </button>
                    <button
                      onClick={() => updateQuote(q.id, 'denied')}
                      className="px-3 py-1.5 text-xs rounded-lg bg-red-100 text-red-700 hover:bg-red-200"
                    >
                      Deny
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </>
      )}

      {/* Processed Quotes */}
      {processedQuotes.length > 0 && (
        <>
          <h2 className="text-sm font-semibold text-slate-700 uppercase tracking-wide mb-3 mt-8">
            Processed ({processedQuotes.length})
          </h2>
          <AnimatePresence>
            {processedQuotes.map((q) => (
              <motion.div
                key={q.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="rounded-2xl border border-black/10 bg-white/60 backdrop-blur p-5 mb-4"
              >
                <div className="flex flex-col md:flex-row md:items-start md:justify-between gap-4">
                  <div className="flex-1">
                    <div className="font-semibold text-slate-900 text-lg">
                      {q.client}
                    </div>
                    <div className="text-sm text-slate-600">
                      {SERVICE_TYPE_LABELS[q.service]} ({q.context}) • ${q.total.toFixed(2)}
                      {q.frequency !== 'none' && (
                        <span className="ml-2 text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full">
                          {FREQUENCY_LABELS[q.frequency]}
                        </span>
                      )}
                    </div>
                    <div className="text-xs text-slate-400 mt-1">
                      Submitted {q.submitted} • {q.email}
                    </div>
                    <div className="text-xs text-slate-500 mt-1 italic">
                      {q.notes}
                    </div>
                  </div>

                  <div className="flex gap-2 flex-wrap items-center">
                    {/* Status Badge */}
                    <span
                      className={`px-3 py-1.5 text-xs rounded-lg ${
                        q.status === 'approved'
                          ? 'bg-green-100 text-green-700'
                          : q.status === 'adjusted'
                          ? 'bg-yellow-100 text-yellow-700'
                          : q.status === 'converted'
                          ? 'bg-blue-100 text-blue-700'
                          : 'bg-red-100 text-red-700'
                      }`}
                    >
                      {q.status.charAt(0).toUpperCase() + q.status.slice(1)}
                    </span>

                    {/* Convert Buttons (only for approved/adjusted quotes) */}
                    {(q.status === 'approved' || q.status === 'adjusted') && (
                      <>
                        <button
                          onClick={() => setConvertModal({ quote: q, type: 'order' })}
                          className="px-3 py-1.5 text-xs rounded-lg text-white"
                          style={{ background: brand.primary }}
                        >
                          → Order
                        </button>
                        {q.frequency !== 'none' && (
                          <button
                            onClick={() =>
                              setConvertModal({ quote: q, type: 'subscription' })
                            }
                            className="px-3 py-1.5 text-xs rounded-lg border text-slate-700 hover:bg-slate-50"
                            style={{ borderColor: brand.primary }}
                          >
                            → Subscription
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </>
      )}

      {quotes.length === 0 && (
        <p className="text-center text-slate-500 text-sm mt-10">
          No quotes to review
        </p>
      )}

      {renderConvertModal()}
    </main>
  );
}
