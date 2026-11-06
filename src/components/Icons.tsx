const base = {
  width: 26,
  height: 26,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.3,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
  'aria-hidden': true,
}

export const TodayIcon = () => (
  <svg {...base}>
    <circle cx="12" cy="12" r="4.2" />
    <path d="M12 3.2v2M12 18.8v2M3.2 12h2M18.8 12h2M5.8 5.8l1.4 1.4M16.8 16.8l1.4 1.4M5.8 18.2l1.4-1.4M16.8 7.2l1.4-1.4" />
  </svg>
)
export const CandleIcon = () => (
  <svg {...base}>
    <path d="M12 3.5c1.6 1.8 1.9 3.2.9 4.3-.5.5-1.4.5-1.9 0-.9-1 .1-2.6 1-4.3z" />
    <path d="M8.5 10h7v10.5h-7z" />
    <path d="M12 8.3V10M6.5 20.5h11" />
  </svg>
)
export const QuillIcon = () => (
  <svg {...base}>
    <path d="M19.5 4.5c-6 .8-10.2 5-11.8 11.3l-.9 3.7 3.4-1.2c5.6-2 8.6-7.4 9.3-13.8z" />
    <path d="M6.8 19.5 12 13.5M9 9.5h5" />
  </svg>
)
export const MoonIcon = () => (
  <svg {...base}>
    <path d="M15.5 4.2A8.3 8.3 0 1 0 19.8 15 6.8 6.8 0 0 1 15.5 4.2z" />
    <path d="M18.4 5.2v2.2M17.3 6.3h2.2" />
  </svg>
)
export const CrystalIcon = () => (
  <svg {...base}>
    <path d="M12 3 7 9l5 12 5-12z" />
    <path d="M7 9h10M12 3l-2 6 2 12 2-12z" />
  </svg>
)
export const GearIcon = () => (
  <svg {...base} width={22} height={22}>
    <circle cx="12" cy="12" r="3" />
    <path d="M12 2.8v2.4M12 18.8v2.4M2.8 12h2.4M18.8 12h2.4M5.5 5.5l1.7 1.7M16.8 16.8l1.7 1.7M5.5 18.5l1.7-1.7M16.8 7.2l1.7-1.7" />
  </svg>
)
