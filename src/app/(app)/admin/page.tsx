import { notFound, redirect } from "next/navigation";
import { Suspense } from "react";
import { canAccessAdmin } from "@/features/admin/access";
import { UserList } from "@/features/admin/user-list";
import { getSessionPermissions } from "@/server/session";

async function AdminContent({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const session = await getSessionPermissions();
  if (!session) redirect("/login");
  // Admin pages are hidden (404) from users without the permission; actions re-check in the database.
  if (!canAccessAdmin(session.permissions)) notFound();

  const { q } = await searchParams;
  const search = typeof q === "string" ? q : "";

  return (
    <>
      <form role="search" className="flex gap-2">
        <input
          type="search"
          name="q"
          defaultValue={search}
          maxLength={32}
          placeholder="Rechercher un pseudo"
          aria-label="Rechercher un pseudo"
          className="min-w-0 flex-1 rounded border border-foreground/20 bg-background px-3 py-2"
        />
        <button type="submit" className="rounded bg-foreground/10 px-4 py-2 text-sm font-medium">
          Rechercher
        </button>
      </form>
      <UserList search={search} />
    </>
  );
}

export default function AdminPage({ searchParams }: PageProps<"/admin">) {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Administration</h1>
      <Suspense fallback={<p className="text-sm text-foreground/60">Chargement…</p>}>
        <AdminContent searchParams={searchParams as Promise<{ q?: string }>} />
      </Suspense>
    </div>
  );
}
