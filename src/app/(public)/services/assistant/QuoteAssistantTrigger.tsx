'use client';

import { AnimatePresence } from 'framer-motion';
import { brand } from '@/app/ui/theme';
import { M } from '../utils/motion';
import type { Context } from '../types';

interface Props {
  onOpen: () => void;
  visible: boolean;
  context: Context;
}

const TRIGGER_LABEL: Record<Context, string> = {
  home: 'Not sure what to book?',
  commercial: 'Need a commercial quote?',
  ndis: 'Need an NDIS quote?',
};

export function QuoteAssistantTrigger({ onOpen, visible, context }: Props) {
  return (
    <AnimatePresence>
      {visible && (
        <M.div
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 6 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-16 right-4 z-40"
        >
          <button
            onClick={onOpen}
            aria-label="Open quote assistant"
            className="flex items-center gap-2 rounded-full px-4 py-2.5 text-[12px] font-semibold text-white transition-opacity hover:opacity-90 active:scale-[0.97]"
            style={{
              background: brand.primary,
              boxShadow: '0 4px 14px rgba(15,61,46,0.25)',
            }}
          >
            <span className="flex-shrink-0 text-[13px] leading-none" aria-hidden>✦</span>
            {TRIGGER_LABEL[context]}
          </button>
        </M.div>
      )}
    </AnimatePresence>
  );
}
