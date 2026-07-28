/**
 * The DivcoWest wordmark: five stacked bars + "DIVCO" (bold) "WEST" (regular).
 * Colors are the literal brand PMS values (7737 C green, Cool Gray 11), not the
 * WCAG-adjusted `--brand` token used for interactive UI — a logo's exact color
 * is fixed regardless of contrast math, same as the brand guideline shows it.
 */
export function BrandMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 224 40"
      className={className}
      role="img"
      aria-label="DivcoWest"
      xmlns="http://www.w3.org/2000/svg"
    >
      <g fill="#6AA442">
        <rect x="0" y="2" width="24" height="4" />
        <rect x="0" y="7.6" width="24" height="4" />
        <rect x="0" y="13.2" width="24" height="4" />
        <rect x="0" y="18.8" width="24" height="4" />
        <rect x="0" y="24.4" width="24" height="4" />
      </g>
      <text
        x="32"
        y="30"
        fontFamily="'Nunito Sans', sans-serif"
        fontSize="27"
        fontWeight="800"
        fill="#54565B"
        letterSpacing="0.2"
      >
        DIVCO
        <tspan fontWeight="400">WEST</tspan>
      </text>
    </svg>
  )
}
