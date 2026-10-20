import type { Metadata } from "next";
import { PatchNotesView } from "@/features/patch-notes/patch-notes-view";

export const metadata: Metadata = { title: "Patch notes" };

// The same for everybody (Guests and signed-in users): static content shipped with each deployment.
export default function PatchNotesPage() {
  return <PatchNotesView />;
}
