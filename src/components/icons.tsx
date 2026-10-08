import type { SVGProps } from "react";

/** Inline SVG icons (24x24, `currentColor`): no icon library, no extra request. Decorative by default. */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="24"
      height="24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      {...props}
    >
      {children}
    </svg>
  );
}

/** Shield with a check mark: administration. */
export function ShieldIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 3 5 6v5c0 4.4 2.9 8.3 7 10 4.1-1.7 7-5.6 7-10V6l-7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </Icon>
  );
}

/** Head and shoulders: profile. */
export function UserIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 20c0-3.3 3.1-6 7-6s7 2.7 7 6" />
    </Icon>
  );
}

/** House: home. */
export function HomeIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m4 11 8-7 8 7" />
      <path d="M6 10v9a1 1 0 0 0 1 1h3v-5h4v5h3a1 1 0 0 0 1-1v-9" />
    </Icon>
  );
}

/** Calendar page: calendar. */
export function CalendarIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <rect x="4" y="5" width="16" height="15" rx="2" />
      <path d="M8 3v4M16 3v4M4 10h16" />
      <path d="M9 14h.01M12 14h.01M15 14h.01M9 17h.01M12 17h.01" />
    </Icon>
  );
}

/** Folded map: map. */
export function MapIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m9 4-5 2v14l5-2 6 2 5-2V4l-5 2-6-2Z" />
      <path d="M9 4v14M15 6v14" />
    </Icon>
  );
}

/** Trash can: delete. */
export function TrashIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" />
      <path d="M10 11v5M14 11v5" />
    </Icon>
  );
}

/** Three sliders: settings. */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 7h9M17 7h3M4 17h3M11 17h9" />
      <circle cx="15" cy="7" r="2" />
      <circle cx="9" cy="17" r="2" />
      <path d="M4 12h3M11 12h9" />
      <circle cx="9" cy="12" r="2" />
    </Icon>
  );
}

/** Wrench: work in progress. */
export function WrenchIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M14.7 6.3a4 4 0 0 0-5.4 5.1L4 16.7a1.9 1.9 0 0 0 2.7 2.7l5.3-5.3a4 4 0 0 0 5.1-5.4l-2.4 2.4-2.4-.6-.6-2.4 2.4-2.4Z" />
    </Icon>
  );
}

/** Counter-clockwise arrow: undo. */
export function UndoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M9 14 4 9l5-5" />
      <path d="M4 9h10a6 6 0 0 1 0 12h-3" />
    </Icon>
  );
}

/** Clockwise arrow: redo. */
export function RedoIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m15 14 5-5-5-5" />
      <path d="M20 9H10a6 6 0 0 0 0 12h3" />
    </Icon>
  );
}

/** Pencil: edit. */
export function PencilIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </Icon>
  );
}

/** Cross: close. */
export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="m6 6 12 12M18 6 6 18" />
    </Icon>
  );
}

/** Map pin: a place. */
export function PinIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21s-6.5-5.6-6.5-11a6.5 6.5 0 0 1 13 0c0 5.4-6.5 11-6.5 11Z" />
      <circle cx="12" cy="10" r="2.3" />
    </Icon>
  );
}

/** Circular arrow: refresh. */
export function RefreshIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M20 12a8 8 0 1 1-2.3-5.7" />
      <path d="M20 4v4.5h-4.5" />
    </Icon>
  );
}
