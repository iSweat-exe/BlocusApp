import type { SVGProps } from "react";

/** Inline SVG icons (24x24, `currentColor`): no icon library, no extra request. Decorative by default. */
type IconProps = SVGProps<SVGSVGElement>;

function Icon({ children, className, style, ...props }: IconProps) {
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
      style={{ isolation: "isolate", ...style }}
      className={`inline-block origin-center shrink-0 ${className ?? ""}`}
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
    <Icon strokeWidth="2" {...props}>
      <path d="M3.75 10.5L12 3.75l8.25 6.75v9A1.5 1.5 0 0 1 18.75 21H14.5v-5.25a1.25 1.25 0 0 0-1.25-1.25h-2.5a1.25 1.25 0 0 0-1.25 1.25V21H5.25A1.5 1.5 0 0 1 3.75 19.5v-9z" />
    </Icon>
  );
}

/** Calendar page: calendar. */
export function CalendarIcon(props: IconProps) {
  return (
    <Icon strokeWidth="2" {...props}>
      <path d="M8 2v3M16 2v3M3.5 8.5h17M5 4.5h14a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-12a2 2 0 0 1 2-2z" />
      <circle cx="8" cy="12.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="12.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="12.5" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="8" cy="16" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="12" cy="16" r="0.8" fill="currentColor" stroke="none" />
      <circle cx="16" cy="16" r="0.8" fill="currentColor" stroke="none" />
    </Icon>
  );
}

/** Folded map: map. */
export function MapIcon(props: IconProps) {
  return (
    <Icon strokeWidth="2" {...props}>
      <path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3V6zM9 3v15M15 6v15" />
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

/** Settings gear: settings. */
export function SettingsIcon(props: IconProps) {
  return (
    <Icon strokeWidth="2" {...props}>
      <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
      <circle cx="12" cy="12" r="3" />
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
