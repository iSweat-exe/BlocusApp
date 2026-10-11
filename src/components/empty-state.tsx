import type { ReactNode } from "react";

/**
 * A friendly "nothing here yet" block: a round icon, a short title and a line of help. Decorative icon (the title
 * says it all). `compact` drops the card and the big paddings, for a spot inside a list or a section.
 */
export function EmptyState({
  icon,
  title,
  children,
  compact = false,
}: {
  icon: ReactNode;
  title: string;
  children?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div
      className={
        compact
          ? "flex items-center gap-3 rounded-card border border-dashed border-line-strong p-4"
          : "flex flex-col items-center gap-3 rounded-card border border-dashed border-line-strong px-6 py-10 text-center"
      }
    >
      <span
        aria-hidden="true"
        className={`grid shrink-0 place-items-center rounded-full bg-accent/10 text-accent ${
          compact ? "size-10" : "size-14"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="font-semibold">{title}</p>
        {children && <p className="mt-1 text-sm text-muted">{children}</p>}
      </div>
    </div>
  );
}
