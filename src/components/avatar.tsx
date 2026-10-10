import Image from "next/image";
import { initialsOf, safeAvatarUrl } from "@/features/profile/avatar";

const SIZES = {
  sm: { px: 36, box: "h-9 w-9 text-xs" },
  md: { px: 44, box: "h-11 w-11 text-sm" },
  lg: { px: 80, box: "h-20 w-20 text-2xl" },
  xl: { px: 96, box: "h-24 w-24 text-3xl" },
} as const;

/**
 * Round profile picture with an initials fallback. The URL is user-editable data, so it only renders when
 * `safeAvatarUrl()` accepts it (https, allowed host). Server Component: no client JavaScript.
 */
export function Avatar({
  pseudo,
  url,
  size = "md",
  ring = false,
  decorative = false,
  className = "",
}: {
  pseudo: string;
  url: string | null | undefined;
  size?: keyof typeof SIZES;
  /** Soft ring around the picture (large avatars on profile-like screens). */
  ring?: boolean;
  /** Decorative image (its container already has an accessible name): empty alt text. */
  decorative?: boolean;
  className?: string;
}) {
  const { px, box } = SIZES[size];
  const safe = safeAvatarUrl(url);
  const base = `${box} shrink-0 rounded-control ${ring ? "ring-4 ring-foreground/10" : ""} ${className}`;

  if (safe) {
    return (
      <Image
        src={safe}
        alt={decorative ? "" : `Photo de profil de ${pseudo}`}
        width={px}
        height={px}
        unoptimized
        referrerPolicy="no-referrer"
        className={`${base} object-cover`}
      />
    );
  }
  return (
    <span
      aria-hidden="true"
      className={`${base} flex items-center justify-center bg-foreground/10 font-semibold`}
    >
      {initialsOf(pseudo)}
    </span>
  );
}
