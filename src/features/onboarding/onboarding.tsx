"use client";

import { useEffect, useRef, useState, useSyncExternalStore, type ReactNode } from "react";
import {
  BellIcon,
  CalendarIcon,
  CheckIcon,
  HomeIcon,
  MapIcon,
  ShareIcon,
} from "@/components/icons";
import { Rise } from "@/components/rise";
import { detectPushSupport } from "@/features/push/device";
import { PushSettings } from "@/features/push/push-settings";
import { AccentPicker } from "@/features/settings/accent-picker";
import { ThemePicker } from "@/features/settings/theme-picker";
import {
  promptInstall,
  readInstallMode,
  readServerInstallMode,
  subscribeToInstall,
  type InstallMode,
} from "./install";
import {
  markOnboardingDone,
  readOnboardingDone,
  readServerOnboardingDone,
  subscribeToOnboarding,
} from "./onboarding-store";

type StepId = "welcome" | "install" | "notifications" | "look";

/**
 * The steps this device gets, in order. The install step only exists where we can help (a native prompt, or
 * the iOS Share instructions) and notifications only where the device can receive them.
 */
export function buildSteps(options: {
  install: InstallMode;
  push: boolean;
  /** Keeps the install step while the person is on it, so it does not vanish once the app got installed. */
  keepInstall: boolean;
}): StepId[] {
  const steps: StepId[] = ["welcome"];
  if (
    options.install === "prompt" ||
    options.install === "ios" ||
    options.install === "android" ||
    options.keepInstall
  ) {
    steps.push("install");
  }
  if (options.push) steps.push("notifications");
  steps.push("look");
  return steps;
}

const TITLES: Record<StepId, string> = {
  welcome: "Bienvenue sur BLOCUS.",
  install: "Installe l'application",
  notifications: "Ne rate aucune annonce",
  look: "Fais-la à ton image",
};

const SUBTITLES: Record<StepId, string> = {
  welcome: "Tout ce qu'il faut savoir sur la manifestation, au même endroit.",
  install: "Elle s'ouvre comme une vraie application, en plein écran, depuis ton écran d'accueil.",
  notifications: "Reçois une notification dès qu'un nouveau post est publié.",
  look: "Choisis le thème et la couleur de l'application. Tu pourras les changer dans les réglages.",
};

const FEATURES = [
  { Icon: HomeIcon, title: "Accueil", text: "Les dernières actualités de la manifestation." },
  { Icon: CalendarIcon, title: "Calendrier", text: "Les événements à venir, jour par jour." },
  { Icon: MapIcon, title: "Carte", text: "Où se trouve la manifestation en ce moment." },
] as const;

function WelcomeStep() {
  return (
    <ul className="flex flex-col gap-3">
      {FEATURES.map(({ Icon, title, text }, index) => (
        <li key={title}>
          <Rise order={index + 1}>
            <div className="card flex items-center gap-4 p-4">
              <span
                aria-hidden="true"
                className="flex size-12 shrink-0 items-center justify-center rounded-control bg-accent/15 text-accent"
              >
                <Icon className="size-6" />
              </span>
              <div className="min-w-0">
                <p className="font-semibold">{title}</p>
                <p className="text-sm text-muted">{text}</p>
              </div>
            </div>
          </Rise>
        </li>
      ))}
    </ul>
  );
}

function InstallInstruction({ position, children }: { position: number; children: ReactNode }) {
  return (
    <li className="flex items-center gap-3">
      <span
        aria-hidden="true"
        className="flex size-8 shrink-0 items-center justify-center rounded-full bg-foreground/10 text-xs font-semibold"
      >
        {position}
      </span>
      <span>{children}</span>
    </li>
  );
}

function InstallStep({ mode }: { mode: InstallMode }) {
  const [declined, setDeclined] = useState(false);

  if (mode === "prompt") {
    return (
      <div className="flex flex-col gap-3">
        <button
          type="button"
          className="btn btn-primary w-full"
          onClick={() => void promptInstall().then((accepted) => setDeclined(!accepted))}
        >
          Installer l&apos;application
        </button>
        {declined && (
          <p className="text-sm text-muted">
            Pas de souci, tu pourras l&apos;installer plus tard depuis le menu de ton navigateur.
          </p>
        )}
      </div>
    );
  }
  if (mode === "ios") {
    return (
      <ol className="card flex flex-col gap-4 p-4 text-sm">
        <InstallInstruction position={1}>
          Ouvre BLOCUS dans <strong>Safari</strong>, puis touche{" "}
          <ShareIcon strokeWidth="2" className="mx-0.5 -mt-1 size-5 text-accent" />{" "}
          <strong>Partager</strong> (en bas de l&apos;écran, ou dans le menu <strong>⋯</strong>).
        </InstallInstruction>
        <InstallInstruction position={2}>
          Fais défiler et choisis <strong>Sur l&apos;écran d&apos;accueil</strong>.
        </InstallInstruction>
        <InstallInstruction position={3}>
          Touche <strong>Ajouter</strong> en haut à droite.
        </InstallInstruction>
        <InstallInstruction position={4}>
          Ouvre BLOCUS depuis son icône : c&apos;est là que les notifications fonctionnent.
        </InstallInstruction>
      </ol>
    );
  }
  if (mode === "android") {
    return (
      <ol className="card flex flex-col gap-4 p-4 text-sm">
        <InstallInstruction position={1}>
          Touche le menu <strong aria-label="trois points">⋮</strong> de ton navigateur (en haut à
          droite, ou en bas selon le navigateur).
        </InstallInstruction>
        <InstallInstruction position={2}>
          Choisis <strong>Installer l&apos;application</strong> ou{" "}
          <strong>Ajouter à l&apos;écran d&apos;accueil</strong>.
        </InstallInstruction>
        <InstallInstruction position={3}>
          Confirme, puis ouvre BLOCUS depuis son icône.
        </InstallInstruction>
      </ol>
    );
  }
  return (
    <p className="card flex items-center gap-3 p-4 text-sm" role="status">
      <CheckIcon className="size-5 shrink-0 text-success" />
      L&apos;application est installée sur cet appareil.
    </p>
  );
}

function Sheet({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const installMode = useSyncExternalStore(
    subscribeToInstall,
    readInstallMode,
    readServerInstallMode,
  );
  const [stepId, setStepId] = useState<StepId>("welcome");
  // `window` is safe here: this component only mounts on the client, after hydration.
  const push =
    vapidPublicKey !== null &&
    detectPushSupport(window, process.env.NODE_ENV === "production") !== "unsupported";
  const steps = buildSteps({ install: installMode, push, keepInstall: stepId === "install" });
  const index = Math.max(0, steps.indexOf(stepId));
  const last = index === steps.length - 1;

  useEffect(() => {
    const dialog = dialogRef.current;
    if (dialog && !dialog.open) dialog.showModal();
  }, []);

  // Move the focus to the new title so screen readers announce the step.
  useEffect(() => {
    headingRef.current?.focus({ preventScroll: true });
  }, [stepId]);

  const go = (offset: number) => {
    const next = steps[index + offset];
    if (next) setStepId(next);
  };

  return (
    <dialog
      ref={dialogRef}
      aria-label="Bienvenue sur BLOCUS"
      // Escape and the Android back gesture skip the onboarding, like the "Passer" button.
      onCancel={(event) => {
        event.preventDefault();
        markOnboardingDone();
      }}
      className="fixed inset-0 m-0 h-dvh max-h-none w-dvw max-w-none flex-col bg-background p-0 text-foreground backdrop:bg-black/50 open:flex open:animate-fade-in lg:items-center lg:justify-center lg:bg-transparent"
    >
      <div className="mx-auto flex min-h-0 w-full max-w-md flex-1 flex-col lg:h-[40rem] lg:max-h-[90dvh] lg:flex-none lg:overflow-hidden lg:rounded-sheet lg:border lg:border-line lg:bg-background lg:shadow-2xl">
        <header className="flex items-center gap-4 px-gutter pt-[max(env(safe-area-inset-top),1rem)]">
          <ol aria-label={`Étape ${index + 1} sur ${steps.length}`} className="flex flex-1 gap-1.5">
            {steps.map((id, position) => (
              <li
                key={id}
                aria-hidden="true"
                className={`h-1 flex-1 rounded-full transition-[background-color] duration-300 ${
                  position <= index ? "bg-accent" : "bg-foreground/15"
                }`}
              />
            ))}
          </ol>
          {!last && (
            <button
              type="button"
              onClick={markOnboardingDone}
              className="-mr-3 min-h-tap px-3 text-sm font-medium text-muted transition-[scale] active:scale-[0.96]"
            >
              Passer
            </button>
          )}
        </header>

        <div
          key={stepId}
          className="flex flex-1 animate-fade-in flex-col gap-6 overflow-y-auto px-gutter py-8"
        >
          <div className="flex flex-col gap-3">
            {stepId === "notifications" && (
              <span
                aria-hidden="true"
                className="flex size-14 items-center justify-center rounded-card bg-accent/15 text-accent"
              >
                <BellIcon className="size-7" />
              </span>
            )}
            <h2
              ref={headingRef}
              tabIndex={-1}
              data-focus-silent
              className="font-display text-3xl font-extrabold tracking-tight"
            >
              {TITLES[stepId]}
            </h2>
            <p className="text-muted">{SUBTITLES[stepId]}</p>
          </div>

          {stepId === "welcome" && <WelcomeStep />}
          {stepId === "install" && <InstallStep mode={installMode} />}
          {stepId === "notifications" && vapidPublicKey && (
            <PushSettings vapidPublicKey={vapidPublicKey} />
          )}
          {stepId === "look" && (
            <div className="flex flex-col gap-6">
              <ThemePicker />
              <AccentPicker />
            </div>
          )}
        </div>

        <footer className="flex gap-3 border-t border-line px-gutter pt-3 pb-safe-bottom">
          {index > 0 && (
            <button type="button" onClick={() => go(-1)} className="btn btn-outline">
              Retour
            </button>
          )}
          <button
            type="button"
            onClick={last ? markOnboardingDone : () => go(1)}
            className="btn btn-primary flex-1"
          >
            {last ? "C'est parti" : index === 0 ? "Commencer" : "Suivant"}
          </button>
        </footer>
      </div>
    </dialog>
  );
}

/**
 * First-launch guide for signed-in people, as a full-screen sheet: what the app does, installing it, turning
 * notifications on and the look. Shown once per device (see `onboarding-store.ts`); "Passer", Escape or the
 * last button close it for good. Renders nothing on the server and on later visits.
 * @param vapidPublicKey - Public VAPID key, or `null` when push is off (the notifications step is dropped).
 */
export function Onboarding({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const done = useSyncExternalStore(
    subscribeToOnboarding,
    readOnboardingDone,
    readServerOnboardingDone,
  );
  if (done) return null;
  return <Sheet vapidPublicKey={vapidPublicKey} />;
}
