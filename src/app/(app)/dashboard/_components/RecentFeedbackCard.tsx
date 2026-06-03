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
    <section className="rounded-[30px] border border-[#dfe9e2] bg-white px-6 py-7 shadow-[0_18px_48px_rgba(15,61,46,0.07)] sm:px-8">
      <h2 className="text-[27px] font-extrabold leading-tight text-[#17392b]">Recent feedback</h2>
      <div className="mt-6 divide-y divide-[#e2ebe5]">
        {feedback.map((item) => (
          <div key={`${item.customer}-${item.service}`} className="grid grid-cols-[60px_minmax(0,1fr)] gap-4 py-4 first:pt-0">
            <span className="grid h-[58px] w-[58px] place-items-center rounded-[16px] bg-[#e0e0e2] text-lg font-semibold text-[#686c6a]">
              {item.initials}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[18px] font-extrabold text-[#273f34]">
                {item.customer} · {item.service}
              </p>
              <p className="text-[16px] font-medium leading-snug text-[#87968d]">
                &quot;{item.quote}&quot; <span className="font-bold text-[#76867d]">{'★'.repeat(item.rating)}</span>
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
