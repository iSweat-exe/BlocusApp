import { AppNav } from "@/components/app-nav";

// TODO(auth): redirect unauthenticated users to /login (see checklist step 1.2).
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <div className="flex flex-1 flex-col p-4">{children}</div>
      <AppNav />
    </>
  );
}
