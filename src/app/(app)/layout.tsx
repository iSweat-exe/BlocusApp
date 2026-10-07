import { Suspense } from "react";
import { AppNav } from "@/components/app-nav";
import { AuthStatus } from "@/features/auth/auth-status";

// Guests may read (A-022); the access guard for write actions is tracked in A-121.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <header className="flex justify-end p-4 pb-0">
        <Suspense>
          <AuthStatus />
        </Suspense>
      </header>
      <div className="flex flex-1 flex-col p-4">{children}</div>
      {/* usePathname() needs a Suspense boundary on routes with dynamic segments (/admin/users/[id]). */}
      <Suspense
        fallback={<div aria-hidden="true" className="h-12 border-t border-foreground/10" />}
      >
        <AppNav />
      </Suspense>
    </>
  );
}
