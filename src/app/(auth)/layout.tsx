import { LoginBackground } from "@/features/auth/login-background";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative min-h-dvh w-full overflow-x-hidden flex flex-col items-center justify-center bg-background">
      {/* Ambient Red Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed -top-[80px] -right-[80px] z-0 h-[320px] w-[320px] rounded-full bg-[radial-gradient(circle,rgba(239,68,68,0.18)_0%,rgba(255,255,255,0)_70%)] blur-[140px]"
      />

      {/* Image de fond en footer avec fondu adaptatif */}
      <LoginBackground />

      <main className="relative z-10 flex flex-1 flex-col items-center justify-between min-h-dvh w-full max-w-[440px] px-5 pt-[max(28px,env(safe-area-inset-top))] pb-5 bg-transparent">
        {children}
      </main>
    </div>
  );
}
