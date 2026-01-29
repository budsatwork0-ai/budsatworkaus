import React from 'react';

const iconProps = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

export const IconWrap = ({ children }: { children: React.ReactNode }) => (
  <div style={{ width: 22, height: 22 }} className="shrink-0 text-black">
    {children}
  </div>
);

export const WindowIcon = () => (
  <svg {...iconProps}>
    <rect x="3" y="3" width="18" height="18" rx="3" />
    <path d="M12 3v18M3 9h18" />
  </svg>
);

export const CleanIcon = () => (
  <svg {...iconProps}>
    <path d="M4 20h16M7 20l2-10h6l2 10" />
    <path d="M9 6h6M10 4h4" />
  </svg>
);

export const LawnIcon = () => (
  <svg {...iconProps}>
    <path d="M3 20h18" />
    <path d="M6 20v-5m3 5v-3m3 3v-6m3 6v-4m3 4v-5" />
  </svg>
);

export const TruckIcon = () => (
  <svg {...iconProps}>
    <path d="M10 17h7v-7H3v7h2" />
    <path d="M17 10h3l2 2v5h-5M6 20a2 2 0 110-4 2 2 0 010 4zm10 0a2 2 0 110-4 2 2 0 010 4z" />
  </svg>
);

export const CarIcon = () => (
  <svg {...iconProps}>
    <path d="M3 13l2-5a3 3 0 012.8-2h8.4A3 3 0 0119 8l2 5" />
    <path d="M5 13h14" />
    <circle cx="7.5" cy="17.5" r="1.5" />
    <circle cx="16.5" cy="17.5" r="1.5" />
    <path d="M3 13v4M21 13v4" />
  </svg>
);

export const ShoeIcon = () => (
  <svg {...iconProps}>
    <path d="M3 16c4 0 6-2 7-4l5 3c2 1 3 1 6 1v2H3z" />
    <path d="M10 12l1-2" />
  </svg>
);
