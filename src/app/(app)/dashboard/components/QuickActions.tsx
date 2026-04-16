'use client';

import { useEffect, useState, Fragment } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import { toast } from 'sonner';

type ModalType = 'invoice' | 'expense' | 'job' | 'reminder' | 'crew' | null;

// Icons
function PlusIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M12 5v14M5 12h14" />
    </svg>
  );
}

function InvoiceIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="4" y="3" width="16" height="18" rx="2" />
      <path d="M8 7h8M8 11h8M8 15h4" />
    </svg>
  );
}

function ExpenseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="2" y="5" width="20" height="14" rx="2" />
      <circle cx="12" cy="12" r="3" />
      <path d="M6 12h.01M18 12h.01" />
    </svg>
  );
}

function CalendarIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  );
}

function BellIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
      <path d="M13.73 21a2 2 0 01-3.46 0" />
    </svg>
  );
}

function UserPlusIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className={className}>
      <path d="M16 21v-2a4 4 0 00-4-4H6a4 4 0 00-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" y1="8" x2="19" y2="14" />
      <line x1="22" y1="11" x2="16" y2="11" />
    </svg>
  );
}

function CloseIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className={className}>
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  );
}

const quickActions = [
  { id: 'invoice',  label: 'Create Invoice',   icon: <InvoiceIcon />,  color: brand.primary },
  { id: 'expense',  label: 'Record Expense',    icon: <ExpenseIcon />,  color: '#EF4444' },
  { id: 'job',      label: 'Schedule Job',      icon: <CalendarIcon />, color: '#6366F1' },
  { id: 'reminder', label: 'Send Reminder',     icon: <BellIcon />,     color: '#F59E0B' },
  { id: 'crew',     label: 'Add Crew Member',   icon: <UserPlusIcon />, color: '#8B5CF6' },
] as const;

function Modal({
  isOpen,
  onClose,
  title,
  children,
}: {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [isOpen, onClose]);

  return (
    <AnimatePresence>
      {isOpen && (
        <Fragment>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: 'spring', duration: 0.3 }}
            className="fixed left-1/2 top-1/2 z-50 w-full max-w-lg -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-black/10 bg-white p-6 shadow-2xl"
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold" style={{ color: brand.text }}>
                {title}
              </h2>
              <button
                onClick={onClose}
                className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition-colors"
              >
                <CloseIcon />
              </button>
            </div>
            {children}
          </motion.div>
        </Fragment>
      )}
    </AnimatePresence>
  );
}

function CreateInvoiceForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    customer: '',
    service: '',
    amount: '',
    dueDate: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success('Invoice created successfully');
    onClose();
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
        <input
          type="text"
          required
          value={formData.customer}
          onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          placeholder="Enter customer name"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Service</label>
          <select
            required
            value={formData.service}
            onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
          >
            <option value="">Select service</option>
            <option value="windows">Window cleaning</option>
            <option value="cleaning">Home cleaning</option>
            <option value="yard">Yard care</option>
            <option value="dump">Dump runs</option>
            <option value="auto">Car detailing</option>
            <option value="laundry_sneakers">Laundry & Sneaker Care</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Due Date</label>
        <input
          type="date"
          required
          value={formData.dueDate}
          onChange={(e) => setFormData(prev => ({ ...prev, dueDate: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20 outline-none resize-none"
          rows={3}
          placeholder="Add any notes..."
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50"
          style={{ background: brand.primary }}
        >
          {isSubmitting ? 'Creating...' : 'Create Invoice'}
        </button>
      </div>
    </form>
  );
}

function RecordExpenseForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    vendor: '',
    category: '',
    amount: '',
    date: new Date().toISOString().split('T')[0],
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success('Expense recorded successfully');
    onClose();
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Vendor / Supplier</label>
        <input
          type="text"
          required
          value={formData.vendor}
          onChange={(e) => setFormData(prev => ({ ...prev, vendor: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
          placeholder="Enter vendor name"
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Category</label>
          <select
            required
            value={formData.category}
            onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
          >
            <option value="">Select category</option>
            <option value="supplies">Supplies</option>
            <option value="fuel">Fuel</option>
            <option value="wages">Wages</option>
            <option value="rent">Rent</option>
            <option value="utilities">Utilities</option>
            <option value="insurance">Insurance</option>
            <option value="equipment">Equipment</option>
            <option value="other">Other</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Amount</label>
          <input
            type="number"
            required
            min="0"
            step="0.01"
            value={formData.amount}
            onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
            placeholder="0.00"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
        <input
          type="date"
          required
          value={formData.date}
          onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-red-500 focus:ring-2 focus:ring-red-500/20 outline-none resize-none"
          rows={3}
          placeholder="Add any notes..."
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-red-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-red-600 hover:shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? 'Recording...' : 'Record Expense'}
        </button>
      </div>
    </form>
  );
}

function ScheduleJobForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({
    customer: '',
    phone: '',
    address: '',
    service: '',
    date: '',
    time: '',
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    toast.success('Job scheduled successfully');
    onClose();
    setIsSubmitting(false);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Customer Name</label>
          <input
            type="text"
            required
            value={formData.customer}
            onChange={(e) => setFormData(prev => ({ ...prev, customer: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            placeholder="Enter name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input
            type="tel"
            required
            value={formData.phone}
            onChange={(e) => setFormData(prev => ({ ...prev, phone: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
            placeholder="04XX XXX XXX"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Address</label>
        <input
          type="text"
          required
          value={formData.address}
          onChange={(e) => setFormData(prev => ({ ...prev, address: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          placeholder="Enter address"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Service</label>
        <select
          required
          value={formData.service}
          onChange={(e) => setFormData(prev => ({ ...prev, service: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
        >
          <option value="">Select service</option>
          <option value="windows">Window cleaning</option>
          <option value="cleaning">Home cleaning</option>
          <option value="yard">Yard care</option>
          <option value="dump">Dump runs</option>
          <option value="auto">Car detailing</option>
          <option value="laundry_sneakers">Laundry & Sneaker Care</option>
        </select>
      </div>
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Date</label>
          <input
            type="date"
            required
            value={formData.date}
            onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Time</label>
          <input
            type="time"
            required
            value={formData.time}
            onChange={(e) => setFormData(prev => ({ ...prev, time: e.target.value }))}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none"
          />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Notes (optional)</label>
        <textarea
          value={formData.notes}
          onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-indigo-500 focus:ring-2 focus:ring-indigo-500/20 outline-none resize-none"
          rows={2}
          placeholder="Any special instructions..."
        />
      </div>
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onClose}
          className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isSubmitting}
          className="flex-1 rounded-xl bg-indigo-500 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-600 hover:shadow-lg disabled:opacity-50"
        >
          {isSubmitting ? 'Scheduling...' : 'Schedule Job'}
        </button>
      </div>
    </form>
  );
}

function SendReminderForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({ quoteId: '', channel: 'email', message: '' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await fetch(`/api/quotes/${formData.quoteId}/remind`, { method: 'POST' });
      toast.success('Reminder sent successfully');
    } catch {
      toast.error('Failed to send reminder');
    }
    setIsSubmitting(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Quote ID</label>
        <input
          type="text"
          required
          value={formData.quoteId}
          onChange={(e) => setFormData(p => ({ ...p, quoteId: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
          placeholder="Paste the quote UUID"
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Channel</label>
        <select
          value={formData.channel}
          onChange={(e) => setFormData(p => ({ ...p, channel: e.target.value }))}
          className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-amber-500 focus:ring-2 focus:ring-amber-500/20 outline-none"
        >
          <option value="email">Email (24h nudge)</option>
        </select>
      </div>
      <p className="text-xs text-slate-500">Sends the &ldquo;Still thinking?&rdquo; email with the direct payment link. Rate-limited to 5/hr per quote.</p>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50" style={{ background: '#F59E0B' }}>
          {isSubmitting ? 'Sending...' : 'Send Reminder'}
        </button>
      </div>
    </form>
  );
}

function AddCrewForm({ onClose }: { onClose: () => void }) {
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', role: 'cleaner' });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    await new Promise(r => setTimeout(r, 800));
    toast.success('Crew member invite sent — they will receive onboarding details');
    setIsSubmitting(false);
    onClose();
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Full Name</label>
          <input type="text" required value={formData.name} onChange={(e) => setFormData(p => ({ ...p, name: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none" placeholder="Name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Phone</label>
          <input type="tel" required value={formData.phone} onChange={(e) => setFormData(p => ({ ...p, phone: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none" placeholder="04XX XXX XXX" />
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Email</label>
        <input type="email" required value={formData.email} onChange={(e) => setFormData(p => ({ ...p, email: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none" placeholder="crew@example.com" />
      </div>
      <div>
        <label className="block text-sm font-medium text-slate-700 mb-1">Role</label>
        <select value={formData.role} onChange={(e) => setFormData(p => ({ ...p, role: e.target.value }))} className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 outline-none">
          <option value="cleaner">Cleaner</option>
          <option value="driver">Driver</option>
          <option value="detailer">Detailer</option>
          <option value="yard_crew">Yard Crew</option>
          <option value="laundry">Laundry & Sneakers</option>
          <option value="supervisor">Supervisor</option>
        </select>
      </div>
      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onClose} className="flex-1 rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-50 transition-colors">Cancel</button>
        <button type="submit" disabled={isSubmitting} className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition-all hover:shadow-lg disabled:opacity-50" style={{ background: '#8B5CF6' }}>
          {isSubmitting ? 'Adding...' : 'Add Crew Member'}
        </button>
      </div>
    </form>
  );
}

export default function QuickActions() {
  const [activeModal, setActiveModal] = useState<ModalType>(null);

  return (
    <>
      <div className="flex flex-wrap gap-2">
        {quickActions.map((action) => (
          <button
            key={action.id}
            onClick={() => setActiveModal(action.id as ModalType)}
            className="inline-flex items-center gap-2 rounded-xl border border-black/10 bg-white px-4 py-2.5 text-sm font-medium text-slate-700 shadow-sm hover:shadow-md hover:border-black/20 transition-all"
          >
            <span style={{ color: action.color }}>{action.icon}</span>
            {action.label}
          </button>
        ))}
      </div>

      <Modal
        isOpen={activeModal === 'invoice'}
        onClose={() => setActiveModal(null)}
        title="Create Invoice"
      >
        <CreateInvoiceForm onClose={() => setActiveModal(null)} />
      </Modal>

      <Modal
        isOpen={activeModal === 'expense'}
        onClose={() => setActiveModal(null)}
        title="Record Expense"
      >
        <RecordExpenseForm onClose={() => setActiveModal(null)} />
      </Modal>

      <Modal
        isOpen={activeModal === 'job'}
        onClose={() => setActiveModal(null)}
        title="Schedule Job"
      >
        <ScheduleJobForm onClose={() => setActiveModal(null)} />
      </Modal>

      <Modal
        isOpen={activeModal === 'reminder'}
        onClose={() => setActiveModal(null)}
        title="Send Quote Reminder"
      >
        <SendReminderForm onClose={() => setActiveModal(null)} />
      </Modal>

      <Modal
        isOpen={activeModal === 'crew'}
        onClose={() => setActiveModal(null)}
        title="Add Crew Member"
      >
        <AddCrewForm onClose={() => setActiveModal(null)} />
      </Modal>
    </>
  );
}
