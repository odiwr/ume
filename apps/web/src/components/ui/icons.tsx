// SVGs selected from the Icones catalog (https://icones.js.org/).
// Bundled locally from Iconify collections. Sources and licenses: public/icons/NOTICE.md.
// Do not draw new UI icons here; select an icon from Icones instead.
import type { ReactNode, SVGProps } from 'react'

export type IconProps = SVGProps<SVGSVGElement> & { size?: number | string }

function createIcon(name: string, content: ReactNode, width = 24, height = 24) {
  function Icon({ size = 24, strokeWidth = 2, ...props }: IconProps) {
    return (
      <svg
        xmlns="http://www.w3.org/2000/svg"
        width={size}
        height={size}
        viewBox={`0 0 ${width} ${height}`}
        strokeWidth={strokeWidth}
        aria-hidden="true"
        focusable="false"
        {...props}
      >
        {content}
      </svg>
    )
  }
  Icon.displayName = name
  return Icon
}

/** https://icones.js.org/collection/lucide?icon=lucide:activity */
export const Activity = /*#__PURE__*/ createIcon(
  'Activity',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:alert-triangle */
export const AlertTriangle = /*#__PURE__*/ createIcon(
  'AlertTriangle',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:arrow-down */
export const ArrowDown = /*#__PURE__*/ createIcon(
  'ArrowDown',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M12 5v14m7-7l-7 7l-7-7"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:arrow-left */
export const ArrowLeft = /*#__PURE__*/ createIcon(
  'ArrowLeft',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m12 19l-7-7l7-7m7 7H5"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:arrow-right */
export const ArrowRight = /*#__PURE__*/ createIcon(
  'ArrowRight',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M5 12h14m-7-7l7 7l-7 7"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:arrow-up-right */
export const ArrowUpRight = /*#__PURE__*/ createIcon(
  'ArrowUpRight',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M7 7h10v10M7 17L17 7"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:ban */
export const Ban = /*#__PURE__*/ createIcon(
  'Ban',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M4.929 4.929L19.07 19.071" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:bell */
export const Bell = /*#__PURE__*/ createIcon(
  'Bell',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M10.268 21a2 2 0 0 0 3.464 0m-10.47-5.674A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:calendar-clock */
export const CalendarClock = /*#__PURE__*/ createIcon(
  'CalendarClock',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M16 14v2.2l1.6 1M16 2v3m5 2.338V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h2.338M3 9h5.859M8 2v3" />
      <circle cx="16" cy="16" r="6" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:check */
export const Check = /*#__PURE__*/ createIcon(
  'Check',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M20 6L9 17l-5-5"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:check-circle-2 */
export const CheckCircle2 = /*#__PURE__*/ createIcon(
  'CheckCircle2',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m16 9l-5.5 5.5L8 12" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:chevron-down */
export const ChevronDown = /*#__PURE__*/ createIcon(
  'ChevronDown',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m6 9l6 6l6-6"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:chevron-left */
export const ChevronLeft = /*#__PURE__*/ createIcon(
  'ChevronLeft',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m15 18l-6-6l6-6"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:chevron-right */
export const ChevronRight = /*#__PURE__*/ createIcon(
  'ChevronRight',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m9 18l6-6l-6-6"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:chevrons-up-down */
export const ChevronsUpDown = /*#__PURE__*/ createIcon(
  'ChevronsUpDown',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m7 15l5 5l5-5M7 9l5-5l5 5"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:circle-alert */
export const CircleAlert = /*#__PURE__*/ createIcon(
  'CircleAlert',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4m0 4h.01" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:clock */
export const Clock = /*#__PURE__*/ createIcon(
  'Clock',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 6v6l4 2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:cloud-upload */
export const CloudUpload = /*#__PURE__*/ createIcon(
  'CloudUpload',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M12 13v8m-8-6.101A7 7 0 1 1 15.71 8h1.79a4.5 4.5 0 0 1 2.5 8.242" />
      <path d="m8 17l4-4l4 4" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:copy */
export const Copy = /*#__PURE__*/ createIcon(
  'Copy',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:credit-card */
export const CreditCard = /*#__PURE__*/ createIcon(
  'CreditCard',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <rect width="20" height="14" x="2" y="5" rx="2" />
      <path d="M2 10h20M6 14h2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:crown */
export const Crown = /*#__PURE__*/ createIcon(
  'Crown',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294zM5 21h14"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:database */
export const Database = /*#__PURE__*/ createIcon(
  'Database',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:disc-3 */
export const Disc3 = /*#__PURE__*/ createIcon(
  'Disc3',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M6 12c0-1.7.7-3.2 1.8-4.2" />
      <circle cx="12" cy="12" r="2" />
      <path d="M18 12c0 1.7-.7 3.2-1.8 4.2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:dollar-sign */
export const DollarSign = /*#__PURE__*/ createIcon(
  'DollarSign',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M12 2v20m5-17H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:external-link */
export const ExternalLink = /*#__PURE__*/ createIcon(
  'ExternalLink',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M15 3h6v6m-11 5L21 3m-3 10v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:file-music */
export const FileMusic = /*#__PURE__*/ createIcon(
  'FileMusic',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M11.65 22H18a2 2 0 0 0 2-2V8a2.4 2.4 0 0 0-.706-1.706l-3.588-3.588A2.4 2.4 0 0 0 14 2H6a2 2 0 0 0-2 2v10.35" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5M8 20v-7l3 1.474" />
      <circle cx="6" cy="20" r="2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:file-text */
export const FileText = /*#__PURE__*/ createIcon(
  'FileText',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z" />
      <path d="M14 2v5a1 1 0 0 0 1 1h5M10 9H8m8 4H8m8 4H8" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:flag */
export const Flag = /*#__PURE__*/ createIcon(
  'Flag',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M4 22V4a1 1 0 0 1 .4-.8A6 6 0 0 1 8 2c3 0 5 2 7.333 2q2 0 3.067-.8A1 1 0 0 1 20 4v10a1 1 0 0 1-.4.8A6 6 0 0 1 16 16c-3 0-5-2-8-2a6 6 0 0 0-4 1.528"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:gavel */
export const Gavel = /*#__PURE__*/ createIcon(
  'Gavel',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m14 13l-8.381 8.38a1 1 0 0 1-3.001-3l8.384-8.381M16 16l6-6m-.5.5l-8-8M8 8l6-6M8.5 7.5l8 8"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:hard-drive */
export const HardDrive = /*#__PURE__*/ createIcon(
  'HardDrive',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M10 16h.01m-7.798-4.423a2 2 0 0 0-.212.896V18a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-5.527a2 2 0 0 0-.212-.896L18.55 5.11A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11zm19.734.436H2.054M6 16h.01"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:headphones */
export const Headphones = /*#__PURE__*/ createIcon(
  'Headphones',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M3 14h3a2 2 0 0 1 2 2v3a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-7a9 9 0 0 1 18 0v7a2 2 0 0 1-2 2h-1a2 2 0 0 1-2-2v-3a2 2 0 0 1 2-2h3"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:info */
export const Info = /*#__PURE__*/ createIcon(
  'Info',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4m0-4h.01" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:key-round */
export const KeyRound = /*#__PURE__*/ createIcon(
  'KeyRound',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:layout-dashboard */
export const LayoutDashboard = /*#__PURE__*/ createIcon(
  'LayoutDashboard',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <rect width="7" height="9" x="3" y="3" rx="1" />
      <rect width="7" height="5" x="14" y="3" rx="1" />
      <rect width="7" height="9" x="14" y="12" rx="1" />
      <rect width="7" height="5" x="3" y="16" rx="1" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:layout-grid */
export const LayoutGrid = /*#__PURE__*/ createIcon(
  'LayoutGrid',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <rect width="7" height="7" x="3" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="3" rx="1" />
      <rect width="7" height="7" x="14" y="14" rx="1" />
      <rect width="7" height="7" x="3" y="14" rx="1" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:link-2 */
export const Link2 = /*#__PURE__*/ createIcon(
  'Link2',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M9 17H7A5 5 0 0 1 7 7h2m6 0h2a5 5 0 1 1 0 10h-2m-7-5h8"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:link-2-off */
export const Link2Off = /*#__PURE__*/ createIcon(
  'Link2Off',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M9 17H7A5 5 0 0 1 7 7m8 0h2a5 5 0 0 1 4 8M8 12h4M2 2l20 20"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:list-music */
export const ListMusic = /*#__PURE__*/ createIcon(
  'ListMusic',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M16 5H3m8 7H3m8 7H3m18-3V5" />
      <circle cx="18" cy="16" r="3" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:lock */
export const Lock = /*#__PURE__*/ createIcon(
  'Lock',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:log-out */
export const LogOut = /*#__PURE__*/ createIcon(
  'LogOut',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m16 17l5-5l-5-5m5 5H9m0 9H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:mail */
export const Mail = /*#__PURE__*/ createIcon(
  'Mail',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="m22 7l-8.991 5.727a2 2 0 0 1-2.009 0L2 7" />
      <rect width="20" height="16" x="2" y="4" rx="2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:map-pin */
export const MapPin = /*#__PURE__*/ createIcon(
  'MapPin',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0" />
      <circle cx="12" cy="10" r="3" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:menu */
export const Menu = /*#__PURE__*/ createIcon(
  'Menu',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M4 5h16M4 12h16M4 19h16"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:message-square */
export const MessageSquare = /*#__PURE__*/ createIcon(
  'MessageSquare',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M22 17a2 2 0 0 1-2 2H6.828a2 2 0 0 0-1.414.586l-2.202 2.202A.71.71 0 0 1 2 21.286V5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2z"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:mic */
export const Mic = /*#__PURE__*/ createIcon(
  'Mic',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M12 19v3m7-12v2a7 7 0 0 1-14 0v-2" />
      <rect width="6" height="13" x="9" y="2" rx="3" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:more-vertical */
export const MoreVertical = /*#__PURE__*/ createIcon(
  'MoreVertical',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="1" />
      <circle cx="12" cy="5" r="1" />
      <circle cx="12" cy="19" r="1" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:music */
export const Music = /*#__PURE__*/ createIcon(
  'Music',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M9 18V5l12-2v13" />
      <circle cx="6" cy="18" r="3" />
      <circle cx="18" cy="16" r="3" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:music-2 */
export const Music2 = /*#__PURE__*/ createIcon(
  'Music2',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="8" cy="18" r="4" />
      <path d="M12 18V2l7 4" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:pencil */
export const Pencil = /*#__PURE__*/ createIcon(
  'Pencil',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M21.174 6.812a1 1 0 0 0-3.986-3.987L3.842 16.174a2 2 0 0 0-.5.83l-1.321 4.352a.5.5 0 0 0 .623.622l4.353-1.32a2 2 0 0 0 .83-.497zM15 5l4 4"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:play */
export const Play = /*#__PURE__*/ createIcon(
  'Play',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M5 5a2 2 0 0 1 3.008-1.728l11.997 6.998a2 2 0 0 1 .003 3.458l-12 7A2 2 0 0 1 5 19z"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:plus */
export const Plus = /*#__PURE__*/ createIcon(
  'Plus',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M5 12h14m-7-7v14"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:radio */
export const Radio = /*#__PURE__*/ createIcon(
  'Radio',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M16.247 7.761a6 6 0 0 1 0 8.478m2.828-11.306a10 10 0 0 1 0 14.134m-14.15 0a10 10 0 0 1 0-14.134m2.828 11.306a6 6 0 0 1 0-8.478" />
      <circle cx="12" cy="12" r="2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:radio-tower */
export const RadioTower = /*#__PURE__*/ createIcon(
  'RadioTower',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M4.9 16.1C1 12.2 1 5.8 4.9 1.9m2.9 2.8a6.14 6.14 0 0 0-.8 7.5" />
      <circle cx="12" cy="9" r="2" />
      <path d="M16.2 4.8c2 2 2.26 5.11.8 7.47M19.1 1.9a9.96 9.96 0 0 1 0 14.1m-9.6 2h5M8 22l4-11l4 11" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:rotate-ccw */
export const RotateCcw = /*#__PURE__*/ createIcon(
  'RotateCcw',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M3 12a9 9 0 1 0 9-9a9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:scroll-text */
export const ScrollText = /*#__PURE__*/ createIcon(
  'ScrollText',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M15 12h-5m5-4h-5m9 9V5a2 2 0 0 0-2-2H4" />
      <path d="M8 21h12a2 2 0 0 0 2-2v-1a1 1 0 0 0-1-1H11a1 1 0 0 0-1 1v1a2 2 0 1 1-4 0V5a2 2 0 1 0-4 0v2a1 1 0 0 0 1 1h3" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:search */
export const Search = /*#__PURE__*/ createIcon(
  'Search',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="m21 21l-4.34-4.34" />
      <circle cx="11" cy="11" r="8" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:search-x */
export const SearchX = /*#__PURE__*/ createIcon(
  'SearchX',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="m13.5 8.5l-5 5m0-5l5 5" />
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21l-4.3-4.3" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:send */
export const Send = /*#__PURE__*/ createIcon(
  'Send',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11zm7.318-19.539l-10.94 10.939"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:server */
export const Server = /*#__PURE__*/ createIcon(
  'Server',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <rect width="20" height="8" x="2" y="2" rx="2" ry="2" />
      <rect width="20" height="8" x="2" y="14" rx="2" ry="2" />
      <path d="M6 6h.01M6 18h.01" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:settings */
export const Settings = /*#__PURE__*/ createIcon(
  'Settings',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M9.671 4.136a2.34 2.34 0 0 1 4.659 0a2.34 2.34 0 0 0 3.319 1.915a2.34 2.34 0 0 1 2.33 4.033a2.34 2.34 0 0 0 0 3.831a2.34 2.34 0 0 1-2.33 4.033a2.34 2.34 0 0 0-3.319 1.915a2.34 2.34 0 0 1-4.659 0a2.34 2.34 0 0 0-3.32-1.915a2.34 2.34 0 0 1-2.33-4.033a2.34 2.34 0 0 0 0-3.831A2.34 2.34 0 0 1 6.35 6.051a2.34 2.34 0 0 0 3.319-1.915" />
      <circle cx="12" cy="12" r="3" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:shield */
export const Shield = /*#__PURE__*/ createIcon(
  'Shield',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:shield-alert */
export const ShieldAlert = /*#__PURE__*/ createIcon(
  'ShieldAlert',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1zm-8-5v4m0 4h.01"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:shield-check */
export const ShieldCheck = /*#__PURE__*/ createIcon(
  'ShieldCheck',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
      <path d="m9 12l2 2l4-4" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:shield-off */
export const ShieldOff = /*#__PURE__*/ createIcon(
  'ShieldOff',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m2 2l20 20M5 5a1 1 0 0 0-1 1v7c0 5 3.5 7.5 7.67 8.94a1 1 0 0 0 .67.01c2.35-.82 4.48-1.97 5.9-3.71M9.309 3.652A12.3 12.3 0 0 0 11.24 2.28a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1v7a10 10 0 0 1-.08 1.264"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:shuffle */
export const Shuffle = /*#__PURE__*/ createIcon(
  'Shuffle',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="m18 14l4 4l-4 4m0-20l4 4l-4 4" />
      <path d="M2 18h1.973a4 4 0 0 0 3.3-1.7l5.454-8.6a4 4 0 0 1 3.3-1.7H22M2 6h1.972a4 4 0 0 1 3.6 2.2M22 18h-6.041a4 4 0 0 1-3.3-1.8l-.359-.45" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:sparkles */
export const Sparkles = /*#__PURE__*/ createIcon(
  'Sparkles',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M11.017 2.814a1 1 0 0 1 1.966 0l1.051 5.558a2 2 0 0 0 1.594 1.594l5.558 1.051a1 1 0 0 1 0 1.966l-5.558 1.051a2 2 0 0 0-1.594 1.594l-1.051 5.558a1 1 0 0 1-1.966 0l-1.051-5.558a2 2 0 0 0-1.594-1.594l-5.558-1.051a1 1 0 0 1 0-1.966l5.558-1.051a2 2 0 0 0 1.594-1.594zM20 2v4m2-2h-4" />
      <circle cx="4" cy="20" r="2" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:ticket */
export const Ticket = /*#__PURE__*/ createIcon(
  'Ticket',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M2 9a3 3 0 0 1 0 6v2a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-2a3 3 0 0 1 0-6V7a2 2 0 0 0-2-2H4a2 2 0 0 0-2 2Zm11-4v2m0 10v2m0-8v2"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:trash */
export const Trash = /*#__PURE__*/ createIcon(
  'Trash',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:trash-2 */
export const Trash2 = /*#__PURE__*/ createIcon(
  'Trash2',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M10 11v6m4-6v6m5-11v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:triangle-alert */
export const TriangleAlert = /*#__PURE__*/ createIcon(
  'TriangleAlert',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m21.73 18l-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3M12 9v4m0 4h.01"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:unplug */
export const Unplug = /*#__PURE__*/ createIcon(
  'Unplug',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="m19 5l3-3M2 22l3-3m1.3 1.3a2.4 2.4 0 0 0 3.4 0L12 18l-6-6l-2.3 2.3a2.4 2.4 0 0 0 0 3.4Zm1.2-6.8L10 11m.5 5.5L13 14m-1-8l6 6l2.3-2.3a2.4 2.4 0 0 0 0-3.4l-2.6-2.6a2.4 2.4 0 0 0-3.4 0Z"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:upload */
export const Upload = /*#__PURE__*/ createIcon(
  'Upload',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M12 3v12m5-7l-5-5l-5 5m14 7v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:user-minus */
export const UserMinus = /*#__PURE__*/ createIcon(
  'UserMinus',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 11h-6" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:user-round */
export const UserRound = /*#__PURE__*/ createIcon(
  'UserRound',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="8" r="5" />
      <path d="M20 21a8 8 0 0 0-16 0" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:users */
export const Users = /*#__PURE__*/ createIcon(
  'Users',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M16 3.128a4 4 0 0 1 0 7.744M22 21v-2a4 4 0 0 0-3-3.87" />
      <circle cx="9" cy="7" r="4" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:volume-2 */
export const Volume2 = /*#__PURE__*/ createIcon(
  'Volume2',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M11 4.702a.705.705 0 0 0-1.203-.498L6.413 7.587A1.4 1.4 0 0 1 5.416 8H3a1 1 0 0 0-1 1v6a1 1 0 0 0 1 1h2.416a1.4 1.4 0 0 1 .997.413l3.383 3.384A.705.705 0 0 0 11 19.298zM16 9a5 5 0 0 1 0 6m3.364 3.364a9 9 0 0 0 0-12.728"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:wifi-off */
export const WifiOff = /*#__PURE__*/ createIcon(
  'WifiOff',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M12 20h.01M8.5 16.429a5 5 0 0 1 7 0M5 12.859a10 10 0 0 1 5.17-2.69m8.83 2.69a10 10 0 0 0-2.007-1.523M2 8.82a15 15 0 0 1 4.177-2.643M22 8.82a15 15 0 0 0-11.288-3.764M2 2l20 20"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:x */
export const X = /*#__PURE__*/ createIcon(
  'X',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M18 6L6 18M6 6l12 12"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/lucide?icon=lucide:circle-x */
export const XCircle = /*#__PURE__*/ createIcon(
  'XCircle',
  <>
    <g
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="m15 9l-6 6m0-6l6 6" />
    </g>
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/simple-icons?icon=simple-icons:discord */
export const DiscordMark = /*#__PURE__*/ createIcon(
  'DiscordMark',
  <>
    <path
      fill="currentColor"
      d="M20.317 4.37a19.8 19.8 0 0 0-4.885-1.515a.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.3 18.3 0 0 0-5.487 0a13 13 0 0 0-.617-1.25a.08.08 0 0 0-.079-.037A19.7 19.7 0 0 0 3.677 4.37a.1.1 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.08.08 0 0 0 .031.057a19.9 19.9 0 0 0 5.993 3.03a.08.08 0 0 0 .084-.028a14 14 0 0 0 1.226-1.994a.076.076 0 0 0-.041-.106a13 13 0 0 1-1.872-.892a.077.077 0 0 1-.008-.128a10 10 0 0 0 .372-.292a.07.07 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.07.07 0 0 1 .078.01q.181.149.373.292a.077.077 0 0 1-.006.127a12.3 12.3 0 0 1-1.873.892a.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.08.08 0 0 0 .084.028a19.8 19.8 0 0 0 6.002-3.03a.08.08 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.06.06 0 0 0-.031-.03M8.02 15.33c-1.182 0-2.157-1.085-2.157-2.419c0-1.333.956-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.956 2.418-2.157 2.418m7.975 0c-1.183 0-2.157-1.085-2.157-2.419c0-1.333.955-2.419 2.157-2.419c1.21 0 2.176 1.096 2.157 2.42c0 1.333-.946 2.418-2.157 2.418"
    />
  </>,
  24,
  24,
)

/** https://icones.js.org/collection/logos?icon=logos:google-icon */
export const GoogleMark = /*#__PURE__*/ createIcon(
  'GoogleMark',
  <>
    <path
      fill="#4285f4"
      d="M255.878 133.451c0-10.734-.871-18.567-2.756-26.69H130.55v48.448h71.947c-1.45 12.04-9.283 30.172-26.69 42.356l-.244 1.622l38.755 30.023l2.685.268c24.659-22.774 38.875-56.282 38.875-96.027"
    />
    <path
      fill="#34a853"
      d="M130.55 261.1c35.248 0 64.839-11.605 86.453-31.622l-41.196-31.913c-11.024 7.688-25.82 13.055-45.257 13.055c-34.523 0-63.824-22.773-74.269-54.25l-1.531.13l-40.298 31.187l-.527 1.465C35.393 231.798 79.49 261.1 130.55 261.1"
    />
    <path
      fill="#fbbc05"
      d="M56.281 156.37c-2.756-8.123-4.351-16.827-4.351-25.82c0-8.994 1.595-17.697 4.206-25.82l-.073-1.73L15.26 71.312l-1.335.635C5.077 89.644 0 109.517 0 130.55s5.077 40.905 13.925 58.602z"
    />
    <path
      fill="#eb4335"
      d="M130.55 50.479c24.514 0 41.05 10.589 50.479 19.438l36.844-35.974C195.245 12.91 165.798 0 130.55 0C79.49 0 35.393 29.301 13.925 71.947l42.211 32.783c10.59-31.477 39.891-54.251 74.414-54.251"
    />
  </>,
  256,
  262,
)

/** https://icones.js.org/collection/lucide?icon=lucide:sliders-horizontal */
export const SlidersHorizontal = /*#__PURE__*/ createIcon(
  'SlidersHorizontal',
  <>
    <path
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth="inherit"
      d="M10 5H3m9 14H3M14 3v4m2 10v4m5-9h-9m9 7h-5m5-14h-7m-6 5v4m0-2H3"
    />
  </>,
)

/** https://icones.js.org/collection/ph?icon=ph:headphones-fill */
export const HeadphonesFilled = /*#__PURE__*/ createIcon(
  'HeadphonesFilled',
  <>
    <path
      fill="currentColor"
      d="M232 128v56a24 24 0 0 1-24 24h-16a24 24 0 0 1-24-24v-40a24 24 0 0 1 24-24h23.65a87.71 87.71 0 0 0-87-80H128a88 88 0 0 0-87.64 80H64a24 24 0 0 1 24 24v40a24 24 0 0 1-24 24H48a24 24 0 0 1-24-24v-56a104.11 104.11 0 0 1 177.89-73.34A103.4 103.4 0 0 1 232 128"
    />
  </>,
  256,
  256,
)
