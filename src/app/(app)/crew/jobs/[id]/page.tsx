'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { crewTheme } from '@/lib/design-system/themes';
import { useEmployee } from '@/app/hooks/useEmployee';
import { SERVICE_TYPE_LABELS, ORDER_STATUS_LABELS } from '@/types/orders';
import { ASSIGNMENT_STATUS_LABELS, ASSIGNMENT_STATUS_COLORS } from '@/types/crew';
import type { ServiceType, OrderStatus } from '@/types/orders';
import type { AssignmentStatus, ChecklistItem, ChecklistResponse } from '@/types/crew';

interface Assignment {
  id: string;
  order_id: string;
  status: string;
  accepted_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  notes: string | null;
  orders: {
    id: string;
    customer_name: string;
    customer_email: string | null;
    customer_phone: string | null;
    service_type: string;
    context: string;
    scope: string | null;
    scheduled_date: string | null;
    scheduled_time: string | null;
    final_price: number;
    notes: string | null;
    status: string;
  } | null;
}

interface ChecklistTemplate {
  id: string;
  service_type: string;
  name: string;
  items: ChecklistItem[];
}

export default function JobDetailPage() {
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const router = useRouter();
  const { employee, isLoading: empLoading } = useEmployee();

  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [checklist, setChecklist] = useState<ChecklistTemplate | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);

  // Completion form state
  const [checklistResponses, setChecklistResponses] = useState<ChecklistResponse[]>([]);
  const [completionNotes, setCompletionNotes] = useState('');
  const [photoUrls, setPhotoUrls] = useState<string[]>([]);
  const [submitting, setSubmitting] = useState(false);

  const fetchJob = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/crew/jobs/${id}`);
      const data = await res.json();
      setAssignment(data.assignment);
      setChecklist(data.checklist);

      // Initialize checklist responses from template
      if (data.checklist?.items) {
        const items = data.checklist.items as ChecklistItem[];
        setChecklistResponses(
          items.map((item) => ({ label: item.label, checked: false, note: '' }))
        );
      }

      // If there's already a completion, pre-fill
      if (data.completion) {
        if (data.completion.checklist_responses) {
          setChecklistResponses(data.completion.checklist_responses);
        }
        if (data.completion.notes) setCompletionNotes(data.completion.notes);
        if (data.completion.photos) setPhotoUrls(data.completion.photos);
      }
    } catch {
      // handle silently
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (employee) fetchJob();
  }, [employee, fetchJob]);

  async function handleStatusChange(newStatus: string) {
    setActionLoading(true);
    try {
      const res = await fetch(`/api/crew/jobs/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus }),
      });
      if (res.ok) {
        if (newStatus === 'declined') {
          router.push('/crew/jobs');
        } else {
          fetchJob();
        }
      }
    } catch {
      // handle silently
    } finally {
      setActionLoading(false);
    }
  }

  async function handleComplete() {
    setSubmitting(true);
    try {
      const res = await fetch(`/api/crew/jobs/${id}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          checklist_responses: checklistResponses,
          notes: completionNotes,
          photos: photoUrls,
        }),
      });
      if (res.ok) {
        router.push('/crew/my-jobs');
      }
    } catch {
      // handle silently
    } finally {
      setSubmitting(false);
    }
  }

  function toggleChecklistItem(index: number) {
    setChecklistResponses((prev) =>
      prev.map((item, i) => (i === index ? { ...item, checked: !item.checked } : item))
    );
  }

  function updateChecklistNote(index: number, note: string) {
    setChecklistResponses((prev) =>
      prev.map((item, i) => (i === index ? { ...item, note } : item))
    );
  }

  if (empLoading || loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-6 h-6 border-2 border-t-transparent rounded-full animate-spin" style={{ borderColor: crewTheme.color.primary, borderTopColor: 'transparent' }} />
      </div>
    );
  }

  if (!assignment || !assignment.orders) {
    return (
      <div className="text-center py-20">
        <p className="font-medium" style={{ color: crewTheme.color.text }}>Job not found</p>
        <Link href="/crew/jobs" className="text-sm underline mt-2 inline-block" style={{ color: crewTheme.color.primary }}>
          Back to Available Jobs
        </Link>
      </div>
    );
  }

  const order = assignment.orders;
  const serviceLabel = SERVICE_TYPE_LABELS[order.service_type as ServiceType] || order.service_type;
  const statusLabel = ASSIGNMENT_STATUS_LABELS[assignment.status as AssignmentStatus] || assignment.status;
  const statusColor = ASSIGNMENT_STATUS_COLORS[assignment.status as AssignmentStatus] || 'bg-slate-100 text-slate-800';
  const orderStatusLabel = ORDER_STATUS_LABELS[order.status as OrderStatus] || order.status;

  const isAvailable = assignment.status === 'available';
  const isAccepted = assignment.status === 'accepted';
  const isInProgress = assignment.status === 'in_progress';
  const isCompleted = assignment.status === 'completed';

  // Check if all required items are checked
  const requiredItems = checklist?.items?.filter((i) => i.required) || [];
  const allRequiredChecked = requiredItems.length === 0 || requiredItems.every((reqItem) => {
    const response = checklistResponses.find((r) => r.label === reqItem.label);
    return response?.checked;
  });

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Link href={isAvailable ? '/crew/jobs' : '/crew/my-jobs'} className="text-sm" style={{ color: crewTheme.color.muted }}>
        &larr; Back to {isAvailable ? 'Available Jobs' : 'My Jobs'}
      </Link>

      {/* Header */}
      <div className={`${crewTheme.glass} rounded-2xl p-6`}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span
                className="inline-block px-2 py-0.5 rounded-full text-xs font-medium"
                style={{ background: 'rgba(15,61,46,0.1)', color: crewTheme.color.primary }}
              >
                {serviceLabel}
              </span>
              <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${statusColor}`}>
                {statusLabel}
              </span>
            </div>
            <h1 className="text-xl font-bold" style={{ color: crewTheme.color.text }}>
              {order.customer_name}
            </h1>
            <p className="text-sm mt-1" style={{ color: crewTheme.color.muted }}>
              Order status: {orderStatusLabel}
            </p>
          </div>
          <p className="text-2xl font-bold shrink-0" style={{ color: crewTheme.color.primary }}>
            ${order.final_price.toFixed(2)}
          </p>
        </div>

        {/* Job details */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5 pt-5 border-t" style={{ borderColor: crewTheme.color.border }}>
          <Detail label="Service" value={`${serviceLabel} (${order.context === 'commercial' ? 'Commercial' : 'Home'})`} />
          {order.scope && <Detail label="Scope" value={order.scope} />}
          <Detail label="Scheduled" value={
            order.scheduled_date
              ? `${new Date(order.scheduled_date).toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long' })}${order.scheduled_time ? ` at ${order.scheduled_time}` : ''}`
              : 'Not scheduled'
          } />
          {order.customer_phone && <Detail label="Phone" value={order.customer_phone} />}
          {order.notes && <Detail label="Notes" value={order.notes} />}
        </div>

        {/* Action buttons */}
        <div className="flex gap-3 mt-5 pt-5 border-t" style={{ borderColor: crewTheme.color.border }}>
          {isAvailable && (
            <>
              <button
                onClick={() => handleStatusChange('declined')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm border transition-colors hover:bg-red-50"
                style={{ borderColor: crewTheme.color.border, color: '#DC2626' }}
              >
                Decline
              </button>
              <button
                onClick={() => handleStatusChange('accepted')}
                disabled={actionLoading}
                className="px-4 py-2 rounded-lg text-sm text-white transition-colors hover:opacity-90"
                style={{ background: crewTheme.color.primary }}
              >
                Accept Job
              </button>
            </>
          )}
          {isAccepted && (
            <button
              onClick={() => handleStatusChange('in_progress')}
              disabled={actionLoading}
              className="px-4 py-2 rounded-lg text-sm text-white transition-colors hover:opacity-90"
              style={{ background: '#F59E0B' }}
            >
              Start Job
            </button>
          )}
          {isCompleted && (
            <span className="px-4 py-2 rounded-lg text-sm bg-green-100 text-green-800 font-medium">
              Job Completed
            </span>
          )}
        </div>
      </div>

      {/* Completion form - shown when in progress */}
      {isInProgress && (
        <div className={`${crewTheme.glass} rounded-2xl p-6`}>
          <h2 className="text-lg font-bold mb-4" style={{ color: crewTheme.color.text }}>
            Complete This Job
          </h2>

          {/* Checklist */}
          {checklistResponses.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold uppercase tracking-wider mb-3" style={{ color: crewTheme.color.muted }}>
                {checklist?.name || 'Checklist'}
              </h3>
              <div className="space-y-3">
                {checklistResponses.map((item, idx) => {
                  const templateItem = checklist?.items?.[idx];
                  const isRequired = templateItem?.required;
                  return (
                    <div key={idx} className="flex items-start gap-3">
                      <input
                        type="checkbox"
                        checked={item.checked}
                        onChange={() => toggleChecklistItem(idx)}
                        className="mt-0.5 w-5 h-5 rounded border-slate-300 accent-emerald-600"
                      />
                      <div className="flex-1">
                        <label className="text-sm font-medium cursor-pointer" style={{ color: crewTheme.color.text }}>
                          {item.label}
                          {isRequired && <span className="text-red-500 ml-1">*</span>}
                        </label>
                        {item.checked && (
                          <input
                            type="text"
                            placeholder="Add a note (optional)"
                            value={item.note || ''}
                            onChange={(e) => updateChecklistNote(idx, e.target.value)}
                            className="mt-1 w-full text-sm px-3 py-1.5 rounded-lg border bg-white"
                            style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
                          />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Notes */}
          <div className="mb-6">
            <label className="block text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: crewTheme.color.muted }}>
              Completion Notes
            </label>
            <textarea
              value={completionNotes}
              onChange={(e) => setCompletionNotes(e.target.value)}
              placeholder="Any notes about the job, issues encountered, etc."
              rows={3}
              className="w-full px-3 py-2 rounded-lg border bg-white text-sm resize-none"
              style={{ borderColor: crewTheme.color.border, color: crewTheme.color.text }}
            />
          </div>

          {/* Photo URLs (simplified - in production this would be file upload) */}
          <div className="mb-6">
            <label className="block text-sm font-semibold uppercase tracking-wider mb-2" style={{ color: crewTheme.color.muted }}>
              Photos
            </label>
            <p className="text-xs mb-2" style={{ color: crewTheme.color.muted }}>
              Add photo URLs to document the completed work.
            </p>
            {photoUrls.map((url, idx) => (
              <div key={idx} className="flex gap-2 mb-2">
                <input
                  type="text"
                  value={url}
                  onChange={(e) => {
                    const updated = [...photoUrls];
                    updated[idx] = e.target.value;
                    setPhotoUrls(updated);
                  }}
                  className="flex-1 px-3 py-1.5 rounded-lg border bg-white text-sm"
                  style={{ borderColor: crewTheme.color.border }}
                />
                <button
                  onClick={() => setPhotoUrls((prev) => prev.filter((_, i) => i !== idx))}
                  className="px-2 py-1.5 rounded-lg text-sm text-red-600 hover:bg-red-50"
                >
                  Remove
                </button>
              </div>
            ))}
            <button
              onClick={() => setPhotoUrls((prev) => [...prev, ''])}
              className="text-sm font-medium"
              style={{ color: crewTheme.color.primary }}
            >
              + Add photo
            </button>
          </div>

          {/* Submit */}
          <button
            onClick={handleComplete}
            disabled={submitting || !allRequiredChecked}
            className="w-full py-3 rounded-xl text-white font-medium transition-opacity disabled:opacity-50"
            style={{ background: crewTheme.color.primary }}
          >
            {submitting ? 'Submitting...' : 'Submit Completion'}
          </button>
          {!allRequiredChecked && (
            <p className="text-xs text-center mt-2 text-red-500">
              Please complete all required checklist items before submitting.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wider" style={{ color: crewTheme.color.muted }}>{label}</p>
      <p className="text-sm mt-0.5" style={{ color: crewTheme.color.text }}>{value}</p>
    </div>
  );
}
