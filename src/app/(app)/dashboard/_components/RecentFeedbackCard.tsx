'use client';

export type FeedbackItem = {
  initials: string;
  customer: string;
  service: string;
  quote: string;
  rating: number;
};

export function RecentFeedbackCard({ feedback }: { feedback: FeedbackItem[] }) {
  return (
    <section className="max-h-[210px] overflow-hidden rounded-[26px] border border-[#dfe9e2] bg-white px-4 py-4 shadow-[0_18px_48px_rgba(15,61,46,0.07)]">
      <h2 className="text-[18px] font-extrabold leading-tight text-[#17392b]">Recent feedback</h2>
      <div className="mt-3 divide-y divide-[#e2ebe5]">
        {feedback.length === 0 ? (
          <p className="rounded-[18px] bg-[#f4faf6] px-3 py-3 text-[13px] font-semibold text-[#7f9187]">No recent feedback yet</p>
        ) : feedback.map((item) => (
          <div key={`${item.customer}-${item.service}`} className="grid grid-cols-[38px_minmax(0,1fr)] gap-3 py-2.5 first:pt-0">
            <span className="grid h-9 w-9 place-items-center rounded-[12px] bg-[#e0e0e2] text-[13px] font-semibold text-[#686c6a]">
              {item.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[14px] font-extrabold text-[#273f34]">
                {item.customer} · {item.service}
              </p>
              <p className="line-clamp-2 text-[13px] font-medium leading-snug text-[#87968d]">
                &quot;{item.quote}&quot; <span className="font-bold text-[#76867d]">{'★'.repeat(item.rating)}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
