import type { ReactNode } from "react";

/**
 * Staggered entrance of an element, for infrequent screens (onboarding, "what's new") where the sequence shows the
 * hierarchy. Never use it on routine interactions.
 * @param order - Position in the sequence: each step waits 100 ms more (0 starts at once).
 */
export function Rise({ order, children }: { order: number; children: ReactNode }) {
  return (
    <div
      className="animate-rise-in motion-reduce:[animation-delay:0ms]"
      style={{ animationDelay: `${order * 100}ms` }}
    >
      {children}
    </div>
  );
}
