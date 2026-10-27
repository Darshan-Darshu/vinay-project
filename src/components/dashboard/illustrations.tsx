export function CampusArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 280 140" fill="none" aria-hidden>
      <path d="M20 108c28-18 48-18 70 0 22 18 46 18 74 0 24-16 44-16 70 2" stroke="#3d8f62" strokeWidth="8" strokeLinecap="round" />
      <path d="M46 108c16-28 28-44 36-44 10 0 18 16 28 44" fill="#2f6b4f" />
      <path d="M168 110c18-34 34-52 46-52 8 0 16 14 24 36 6 16 12 16 20 8" fill="#3d8f62" />
      <circle cx="214" cy="36" r="3" fill="#f3b7d4" />
      <circle cx="78" cy="28" r="2" fill="white" />
      <circle cx="132" cy="22" r="1.5" fill="#f0d56a" />
      <path d="M118 78h44l-6 30h-32l-6-30z" fill="#f4f7fb" />
      <path d="M110 78h60L140 52 110 78z" fill="#f3b7d4" />
      <rect x="134" y="90" width="12" height="18" rx="2" fill="#101a2c" />
    </svg>
  )
}

export function BookArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <rect x="10" y="14" width="28" height="36" rx="4" fill="#7eb6f6" />
      <rect x="22" y="12" width="28" height="36" rx="4" fill="#101a2c" />
      <path d="M28 22h16M28 28h12M28 34h14" stroke="white" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

export function LeafArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <path d="M18 42c8-18 18-26 30-28-2 16-10 28-24 34-2-2-4-4-6-6z" fill="#3d8f62" />
      <path d="M24 40c6-8 12-12 20-14" stroke="#f4f7fb" strokeWidth="2" strokeLinecap="round" />
      <circle cx="20" cy="20" r="3" fill="#f0d56a" />
    </svg>
  )
}

export function StarArt({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" fill="none" aria-hidden>
      <circle cx="32" cy="32" r="18" fill="#f0d56a" />
      <path d="M32 18l3.2 8.2H44l-7 5.2 2.6 8.4L32 35.2 24.4 39.8 27 31.4 20 26.2h8.8L32 18z" fill="#101a2c" />
    </svg>
  )
}

const courseArt = [BookArt, LeafArt, StarArt]

export function CourseArt({ index, className }: { index: number; className?: string }) {
  const Art = courseArt[index % courseArt.length] ?? BookArt
  return <Art className={className} />
}
