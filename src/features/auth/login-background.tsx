/**
 * Decorative background of the login screen: a soft glow of the accent color rising from the bottom edge.
 * Pure CSS (no image to download, no client JavaScript), and it follows the theme and the accent chosen by
 * the user.
 */
export function LoginBackground() {
  return (
    <div
      aria-hidden="true"
      className="accent-glow pointer-events-none fixed inset-x-0 bottom-0 z-0 h-1/2"
    />
  );
}
