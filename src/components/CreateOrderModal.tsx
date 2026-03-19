'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'sonner';
import { brand } from '@/app/ui/theme';
import type { ServiceType, Context, Frequency, CreateOrderInput } from '@/types/orders';
import { SERVICE_TYPE_LABELS, FREQUENCY_LABELS } from '@/types/orders';

interface CreateOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

const serviceTypes: ServiceType[] = ['windows', 'cleaning', 'yard', 'dump', 'auto', 'laundry_sneakers'];
const contexts: Context[] = ['home', 'commercial'];
const frequencies: Frequency[] = ['none', 'daily', '3x_weekly', 'weekly', 'fortnightly', 'monthly'];

export default function CreateOrderModal({ isOpen, onClose, onSuccess }: CreateOrderModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState<Partial<CreateOrderInput>>({
    customer_name: '',
    customer_email: '',
    customer_phone: '',
    service_type: 'cleaning',
    context: 'home',
    frequency: 'none',
    base_price: 0,
    final_price: 0,
    notes: '',
  });

  const handleChange = (field: keyof CreateOrderInput, value: string | number) => {
    setFormData((prev) => {
      const updated = { ...prev, [field]: value };
      // Auto-calculate final price if base price changes
      if (field === 'base_price') {
        updated.final_price = Number(value);
      }
      return updated;
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.customer_name || !formData.service_type || !formData.context) {
      toast.error('Please fill in all required fields');
      return;
    }

    setIsSubmitting(true);

    try {
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          base_price: Number(formData.base_price) || 0,
          final_price: Number(formData.final_price) || Number(formData.base_price) || 0,
          discount_percent: 0,
        }),
      });

      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Failed to create order');
      }

      toast.success('Order created successfully');
      onSuccess?.();
      onClose();
      setFormData({
        customer_name: '',
        customer_email: '',
        customer_phone: '',
        service_type: 'cleaning',
        context: 'home',
        frequency: 'none',
        base_price: 0,
        final_price: 0,
        notes: '',
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to create order');
    } finally {
      setIsSubmitting(false);
    }
  };

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
                <h2 className="text-lg font-semibold text-slate-900">Create New Order</h2>
                <p className="text-sm text-slate-500 mt-1">Add a one-time service order</p>
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
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-offset-1"
                    style={{ '--tw-ring-color': brand.primary } as React.CSSProperties}
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
                    <label className="block text-sm font-medium text-slate-700 mb-1">Frequency</label>
                    <select
                      value={formData.frequency}
                      onChange={(e) => handleChange('frequency', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    >
                      {frequencies.map((freq) => (
                        <option key={freq} value={freq}>
                          {FREQUENCY_LABELS[freq]}
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

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Date</label>
                    <input
                      type="date"
                      value={formData.scheduled_date || ''}
                      onChange={(e) => handleChange('scheduled_date', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-slate-700 mb-1">Scheduled Time</label>
                    <input
                      type="text"
                      value={formData.scheduled_time || ''}
                      onChange={(e) => handleChange('scheduled_time', e.target.value)}
                      className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                      placeholder="e.g., 9:00 AM"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">
                    Price (AUD) <span className="text-red-500">*</span>
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

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-1">Notes</label>
                  <textarea
                    value={formData.notes || ''}
                    onChange={(e) => handleChange('notes', e.target.value)}
                    className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 min-h-[80px]"
                    placeholder="Additional notes about this order..."
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
                  {isSubmitting ? 'Creating...' : 'Create Order'}
                </button>
              </div>
            </form>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
