import { Suspense } from "react";
import { AccentPicker } from "@/features/settings/accent-picker";
import { AccountSection } from "@/features/settings/account-section";

export default function SettingsPage() {
  return (
    <div className="flex flex-col gap-section">
      <h1 className="page-title">Réglages</h1>

      <section aria-labelledby="appearance-title" className="flex flex-col gap-2">
        <h2 id="appearance-title" className="section-title">
          Apparence
        </h2>
        <p className="px-1 text-sm text-muted">
          Choisis la couleur de l&apos;application : un thème prêt à l&apos;emploi ou la tienne.
        </p>
        <AccentPicker />
      </section>

      <Suspense fallback={null}>
        <AccountSection />
      </Suspense>

      <p className="px-1 text-center text-xs text-faint">
        Ces réglages sont enregistrés sur cet appareil.
      </p>
    </div>
  );
}
