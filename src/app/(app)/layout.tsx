import { Suspense } from "react";
import { AppHeader, AppHeaderFallback } from "@/components/app-header";
import { AppNav } from "@/components/app-nav";
import { AppSidebar, AppSidebarFallback } from "@/components/app-sidebar";
import { RefreshOnReturn } from "@/components/refresh-on-return";
import { OnboardingGate } from "@/features/onboarding/onboarding-gate";

// Guests may read (A-022); the access guard for write actions is tracked in A-121.
// A phone has a top bar, the page and a bottom tab bar. From 1024 px the bottom bar gives way to a sidebar on the left
// and the page gets a wider column (each page lays itself out in columns from there).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <RefreshOnReturn />
      <Suspense>
        <OnboardingGate />
      </Suspense>
      <div className="flex flex-1 flex-col lg:flex-row">
        {/* usePathname() needs a Suspense boundary on routes with dynamic segments (/admin/users/[id]). */}
        <Suspense fallback={<AppSidebarFallback />}>
          <AppSidebar />
        </Suspense>
        <div className="flex min-w-0 flex-1 flex-col">
          <Suspense fallback={<AppHeaderFallback />}>
            <AppHeader />
          </Suspense>
          <div className="mx-auto flex w-full max-w-3xl flex-1 flex-col p-gutter lg:max-w-6xl lg:px-10 lg:pt-4 lg:pb-12">
            {children}
          </div>
          <Suspense
            fallback={
              <div
                aria-hidden="true"
                className="h-16 border-t border-line pb-safe-bottom lg:hidden"
              />
            }
          >
            <AppNav />
          </Suspense>
        </div>
      </div>
    </>
  );
}
