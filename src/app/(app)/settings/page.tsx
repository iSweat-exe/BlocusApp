import type { Metadata } from "next";
import { Suspense } from "react";
import { NotificationsSection } from "@/features/push/notifications-section";
import { CreditsLink } from "@/features/credits/credits-link";
import { AccentPicker } from "@/features/settings/accent-picker";
import { ThemePicker } from "@/features/settings/theme-picker";
import { AccountSection } from "@/features/settings/account-section";
import { TwoFactorSection } from "@/features/mfa/two-factor-section";
import { LegalLinks } from "@/features/legal/legal-links";
import { MyDataSection } from "@/features/legal/my-data-section";
import { PatchNotesLink } from "@/features/patch-notes/patch-notes-link";

export const metadata: Metadata = { title: "Réglages" };

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-section">
      <h1 className="page-title">Réglages</h1>

      {/* Two columns from 1024 px: the sections keep their height and flow from one column to the other. */}
      <div className="flex flex-col gap-section lg:block lg:columns-2 lg:gap-x-10 lg:space-y-0 [&>*]:break-inside-avoid lg:[&>*]:mb-section">
        <section aria-labelledby="theme-title" className="flex flex-col gap-2">
          <h2 id="theme-title" className="section-title">
            Thème
          </h2>
          <ThemePicker />
        </section>

        <section aria-labelledby="appearance-title" className="flex flex-col gap-2">
          <h2 id="appearance-title" className="section-title">
            Couleur
          </h2>
          <p className="px-1 text-sm text-muted">
            Choisis la couleur de l&apos;application : un thème prêt à l&apos;emploi ou la tienne.
          </p>
          <AccentPicker />
        </section>

        <Suspense fallback={null}>
          <NotificationsSection />
        </Suspense>

        <Suspense fallback={null}>
          <AccountSection />
        </Suspense>

        <Suspense fallback={null}>
          <TwoFactorSection />
        </Suspense>

        <Suspense fallback={null}>
          <MyDataSection />
        </Suspense>

        {/* Outside of the account section on purpose: Guests and signed-in users both see it. */}
        <section aria-labelledby="about-title" className="flex flex-col gap-2">
          <h2 id="about-title" className="section-title">
            À propos
          </h2>
          <PatchNotesLink />
          <CreditsLink />
          <LegalLinks />
        </section>
      </div>

      <p className="px-1 text-center text-xs text-faint">
        Ces réglages sont enregistrés sur cet appareil.
      </p>
    </div>
  );
}
