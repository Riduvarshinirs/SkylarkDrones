/**
 * Faint topographic contour-line motif — the product's one signature
 * visual element, drawn from Skylark's own domain (aerial survey /
 * elevation mapping). Used sparingly as a background watermark, never
 * as foreground decoration.
 */
export function ContourLines({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      viewBox="0 0 800 160"
      fill="none"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <path
        d="M0 120 C 100 100, 150 140, 240 120 S 380 90, 460 110 S 600 140, 800 100"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M0 90 C 110 70, 160 105, 260 88 S 400 60, 480 82 S 620 108, 800 68"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M0 60 C 120 42, 170 74, 280 58 S 420 32, 500 54 S 640 78, 800 40"
        stroke="currentColor"
        strokeWidth="1"
      />
      <path
        d="M0 32 C 130 16, 180 46, 300 30 S 440 8, 520 28 S 660 50, 800 14"
        stroke="currentColor"
        strokeWidth="1"
      />
    </svg>
  );
}
