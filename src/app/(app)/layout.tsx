import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import { AppNav } from "@/components/app-nav";
import { RefreshOnReturn } from "@/components/refresh-on-return";

// Guests may read (A-022); the access guard for write actions is tracked in A-121.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RefreshOnReturn />
      <Suspense fallback={<AppHeaderFallback />}>
        <AppHeader />
      </Suspense>
      <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-4">{children}</div>
      {/* usePathname() needs a Suspense boundary on routes with dynamic segments (/admin/users/[id]). */}
      <Suspense
        fallback={
          <div
            aria-hidden="true"
            className="h-16 border-t border-foreground/10 pb-[env(safe-area-inset-bottom)]"
          />
        }
      >
        <AppNav />
      </Suspense>
    </>
  );
}
