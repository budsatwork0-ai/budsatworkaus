'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import type { ServiceType, Context } from '@/types/orders';
import { SERVICE_TYPE_LABELS } from '@/types/orders';
import type { SubscriptionFrequency, CreateSubscriptionInput } from '@/types/subscriptions';
import { SUBSCRIPTION_FREQUENCY_LABELS, FREQUENCY_DISCOUNTS } from '@/types/subscriptions';

interface CreateSubscriptionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const serviceTypes: ServiceType[] = ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'];
const contexts: Context[] = ['home', 'commercial'];
const frequencies: SubscriptionFrequency[] = ['daily', '3x_weekly', 'weekly', 'fortnightly', 'monthly'];

export default function CreateSubscriptionModal({ isOpen, onClose, onSuccess }: CreateSubscriptionModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateSubscriptionInput>>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    service_type: 'cleaning',
    context: 'home',
    frequency: 'weekly',
    base_price: 0,
    price_per_cycle: 0,
    start_date: new Date().toISOString().split('T')[0],
    notes: '',
  });

  const handleChange = (field: keyof CreateSubscriptionInput, value: string | number) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate price per cycle with discount
      if (field === 'base_price' || field === 'frequency') {
        const basePrice = Number(field === 'base_price' ? value : prev.base_price) || 0;
        const freq = (field === 'frequency' ? value : prev.frequency) as SubscriptionFrequency;
        const discount = FREQUENCY_DISCOUNTS[freq] || 0;
        updated.price_per_cycle = Math.round(basePrice * (1 - discount) * 100) / 100;
        updated.discount_percent = discount * 100;
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name || !formData.service_type || !formData.context || !formData.frequency || !formData.start_date) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/subscriptions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          base_price: Number(formData.base_price) || 0,
          price_per_cycle: Number(formData.price_per_cycle) || 0,
          discount_percent: formData.discount_percent || 0,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create subscription');
      }

      toast.success('Subscription created successfully');
      onSuccess?.();
      onClose();
      setFormData({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        service_type: 'cleaning',
        context: 'home',
        frequency: 'weekly',
        base_price: 0,
        price_per_cycle: 0,
        start_date: new Date().toISOString().split('T')[0],
        notes: '',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create subscription');
    } finally {
      setIsSubmitting(false);
    }
  };

  const discount = FREQUENCY_DISCOUNTS[formData.frequency as SubscriptionFrequency] || 0;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-black/30"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="relative bg-white rounded-2xl shadow-xl max-w-lg w-full mx-4 max-h-[90vh] overflow-y-auto"
          >
            <form onSubmit={handleSubmit}>
              <div className="px-6 py-4 border-b border-slate-100">
                <h2 className="text-lg font-semibold text-slate-900">Create New Subscription</h2>
                <p className="text-sm text-slate-500 mt-1">Add a recurring service</p>
              </div>

              <div className="px-6 py-4 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Customer Name <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="text"
                    value={formData.customer_name}
                    onChange={(e) => handleChange('customer_name', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    placeholder="Enter customer name"
                    required
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
                    <input
                      type="email"
                      value={formData.customer_email}
                      onChange={(e) => handleChange('customer_email', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      placeholder="email@example.com"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
                    <input
                      type="tel"
                      value={formData.customer_phone}
                      onChange={(e) => handleChange('customer_phone', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      placeholder="0412 345 678"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Service Type <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.service_type}
                      onChange={(e) => handleChange('service_type', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      required
                    >
                      {serviceTypes.map((type) => (
                        <option key={type} value={type}>
                          {SERVICE_TYPE_LABELS[type]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Context <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.context}
                      onChange={(e) => handleChange('context', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      required
                    >
                      {contexts.map((ctx) => (
                        <option key={ctx} value={ctx}>
                          {ctx.charAt(0).toUpperCase() + ctx.slice(1)}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">
                      Frequency <span className="text-red-500">*</span>
                    </label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => handleChange('frequency', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      required
                    >
                      {frequencies.map((freq) => (
                        <option key={freq} value={freq}>
                          {SUBSCRIPTION_FREQUENCY_LABELS[freq]} {FREQUENCY_DISCOUNTS[freq] > 0 && `(${Math.round(FREQUENCY_DISCOUNTS[freq] * 100)}% off)`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Scope</label>
                    <input
                      type="text"
                      value={formData.scope || ''}
                      onChange={(e) => handleChange('scope', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      placeholder="e.g., standard, full"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Start Date <span className="text-red-500">*</span>
                  </label>
                  <input
                    type="date"
                    value={formData.start_date || ''}
                    onChange={(e) => handleChange('start_date', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    required
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Base Price (AUD) <span className="text-red-500">*</span>
                  </label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">$</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={formData.base_price || ''}
                      onChange={(e) => handleChange('base_price', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 pl-7 pr-3 py-2 text-sm focus:outline-none focus:ring-2"
                      placeholder="0.00"
                      required
                    />
                  </div>
                </div>

                {discount > 0 && Number(formData.base_price) > 0 && (
                  <div className="rounded-lg bg-green-50 border border-green-100 p-3 text-sm">
                    <div className="flex justify-between text-slate-600">
                      <span>Base price:</span>
                      <span>${Number(formData.base_price).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>Frequency discount ({Math.round(discount * 100)}%):</span>
                      <span>-${(Number(formData.base_price) * discount).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between font-semibold text-slate-900 mt-1 pt-1 border-t border-green-200">
                      <span>Price per cycle:</span>
                      <span>${formData.price_per_cycle?.toFixed(2)}</span>
                    </div>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 min-h-[80px]"
                    placeholder="Additional notes about this subscription..."
                  />
                </div>
              </div>

              <div className="px-6 py-4 border-t border-slate-100 flex justify-end gap-3">
                <button
                  type="button"
                  onClick={onClose}
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm rounded-lg border border-slate-200 text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-2 text-sm rounded-lg text-white disabled:opacity-50"
                  style={{ background: brand.primary }}
                >
                  {isSubmitting ? 'Creating...' : 'Create Subscription'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
