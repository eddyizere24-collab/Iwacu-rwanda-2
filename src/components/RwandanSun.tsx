"use client";

interface RwandanSunProps {
  size?: number;
  glow?: boolean;
  className?: string;
}

export function RwandanSun({ size = 44, glow = false, className = "" }: RwandanSunProps) {
  return (
    <span
      aria-label="Ikirango cya IWACU RWANDA"
      role="img"
      className={"inline-flex shrink-0 items-center justify-center rounded-full border-2 border-[#FAD201] bg-gradient-to-br from-[#00A3E0] via-[#00A3E0] to-[#20603D] text-white " + (glow ? "shadow-lg shadow-sky-500/30 " : "") + className}
      style={{ width: size, height: size }}
    >
      <svg viewBox="0 0 64 64" width={Math.round(size * 0.76)} height={Math.round(size * 0.76)} aria-hidden="true">
        <circle cx="32" cy="32" r="13" fill="#FAD201" />
        {Array.from({ length: 12 }, (_, i) => (
          <path key={i} d="M32 3 L36 16 L28 16 Z" fill="#FAD201" transform={"rotate(" + i * 30 + " 32 32)"} />
        ))}
        <circle cx="32" cy="32" r="7" fill="#00A3E0" />
      </svg>
    </span>
  );
}

export function AgasekeEmblem({ size = 32 }: { size?: number }) {
  return (
    <span className="inline-flex items-center justify-center rounded-xl border border-emerald-700/20 bg-emerald-50 text-emerald-800" style={{ width: size, height: size }} aria-label="Agaseke">
      <svg viewBox="0 0 40 40" width={size * 0.75} height={size * 0.75} fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden="true">
        <path d="M20 4 C10 8 7 16 8 24 C9 31 15 35 20 36 C25 35 31 31 32 24 C33 16 30 8 20 4Z" />
        <path d="M11 14 C18 18 22 22 29 27 M10 22 C17 20 23 14 29 11 M14 30 C17 23 20 15 21 6 M8 25 C16 27 24 27 32 23" />
      </svg>
    </span>
  );
}
