const P = {
  plus: <><path d="M12 5v14" /><path d="M5 12h14" /></>,
  search: <><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></>,
  shelf: (
    <>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.5" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.5" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.5" />
    </>
  ),
  book: (
    <>
      <path d="M4.5 5.5A2 2 0 0 1 6.5 3.5H18a1.5 1.5 0 0 1 1.5 1.5v13a1.5 1.5 0 0 1-1.5 1.5H6.5a2 2 0 0 1-2-2z" />
      <path d="M4.5 17.5a2 2 0 0 1 2-2H19" />
      <path d="M8.5 7.5h7" opacity=".5" />
    </>
  ),
  gear: (
    <>
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-2.7 1.1v.3a2 2 0 1 1-4 0v-.2a1.6 1.6 0 0 0-2.8-1.1l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1A1.6 1.6 0 0 0 3.5 15H3a2 2 0 1 1 0-4h.2a1.6 1.6 0 0 0 1.1-2.7l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1A1.6 1.6 0 0 0 9.8 4.4V4a2 2 0 1 1 4 0v.2a1.6 1.6 0 0 0 2.7 1.1l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0 1.1 2.7h.3a2 2 0 1 1 0 4h-.2a1.6 1.6 0 0 0-1.1 1z" />
    </>
  ),
  back: <path d="M15 5l-7 7 7 7" />,
  more: (
    <>
      <circle cx="12" cy="5.5" r="1.2" fill="currentColor" />
      <circle cx="12" cy="12" r="1.2" fill="currentColor" />
      <circle cx="12" cy="18.5" r="1.2" fill="currentColor" />
    </>
  ),
  play: <path d="M8 5.5v13l11-6.5z" />,
  folder: (
    <>
      <path d="M3.5 7.5a2 2 0 0 1 2-2h3.6l2 2.4h7.4a2 2 0 0 1 2 2v8.1a2 2 0 0 1-2 2H5.5a2 2 0 0 1-2-2z" />
    </>
  ),
  zip: (
    <>
      <rect x="4" y="3.5" width="16" height="17" rx="2" />
      <path d="M11 3.5v3M13 6.5v3M11 9.5v3M13 12.5v2.5" />
      <rect x="10.4" y="15" width="3.2" height="3.6" rx=".8" />
    </>
  ),
  image: (
    <>
      <rect x="3.5" y="4.5" width="17" height="15" rx="2" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="m4 17 4.6-4.6a1.5 1.5 0 0 1 2.1 0L16 18" />
    </>
  ),
  trash: (
    <>
      <path d="M4 7h16M9.5 7V5a1 1 0 0 1 1-1h3a1 1 0 0 1 1 1v2" />
      <path d="M6.5 7l.8 12a2 2 0 0 0 2 1.9h5.4a2 2 0 0 0 2-1.9l.8-12" />
    </>
  ),
  list: (
    <>
      <path d="M4 6.5h16M4 12h16M4 17.5h16" />
    </>
  ),
  left: <path d="M9 5l-7 7 7 7" />,
  right: <path d="M15 5l7 7-7 7" />,
  check: <path d="m5 12.5 4.5 4.5L19 7" />,
}

export function Icon({ name, size = 20, strokeWidth = 1.7, style }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={style}
      aria-hidden="true"
    >
      {P[name] || null}
    </svg>
  )
}
