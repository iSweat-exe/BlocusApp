import { PlusIcon, TrendUpIcon, WrenchIcon } from "@/components/icons";
import { PATCH_NOTES, type PatchChange, type PatchChangeKind, type PatchNote } from "./patch-notes";

// One colour and one icon per kind: the icon shows it at a glance, the small label under the icon's colour names it
// (colour is never the only cue). The icon stands alone: no background, no outline.
const KINDS: Record<PatchChangeKind, { label: string; Icon: typeof PlusIcon; text: string }> = {
  new: {
    label: "Nouveau",
    Icon: PlusIcon,
    text: "text-accent",
  },
  improved: {
    label: "Amélioré",
    Icon: TrendUpIcon,
    text: "text-warning",
  },
  fixed: {
    label: "Corrigé",
    Icon: WrenchIcon,
    text: "text-success",
  },
};

/** Consecutive changes of the same kind, shown under one icon and one label. */
export type ChangeGroup = { kind: PatchChangeKind; texts: string[] };

/** Merges neighbouring changes of the same kind into one group (order kept; the same kind apart stays apart). */
export function groupChanges(changes: readonly PatchChange[]): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  for (const { kind, text } of changes) {
    const last = groups[groups.length - 1];
    if (last?.kind === kind) last.texts.push(text);
    else groups.push({ kind, texts: [text] });
  }
  return groups;
}

/**
 * A group of changes: the icon of its kind, the kind in small capitals, then the sentence, or a dashed list when
 * several changes of that kind follow each other.
 */
function Change({ kind, texts }: ChangeGroup) {
  const { label, Icon, text: color } = KINDS[kind];
  return (
    <li className="flex items-start gap-3 px-4 py-3">
      {/* 7 px = (label 16 + gap 2 + first line 20 - icon 24) / 2: centred on the label and the first line together. */}
      <Icon aria-hidden="true" strokeWidth="2" className={`mt-[7px] size-6 shrink-0 ${color}`} />
      <span className="flex min-w-0 flex-col gap-0.5">
        <span className={`text-[11px] leading-4 font-semibold tracking-wide uppercase ${color}`}>
          {label}
        </span>
        {texts.length === 1 ? (
          <span className="text-sm leading-5 text-pretty">{texts[0]}</span>
        ) : (
          <ul className="flex flex-col gap-1 text-sm leading-5">
            {texts.map((text) => (
              <li key={text} className="flex gap-2">
                <span aria-hidden="true" className="text-faint">
                  -
                </span>
                <span className="min-w-0 text-pretty">{text}</span>
              </li>
            ))}
          </ul>
        )}
      </span>
    </li>
  );
}

const dateFormat = new Intl.DateTimeFormat("fr-FR", {
  day: "numeric",
  month: "long",
  year: "numeric",
  timeZone: "UTC",
});

/** `2026-10-20` → « 20 octobre 2026 » (UTC, so the day never shifts with the reader's time zone). */
export function formatPatchDate(isoDate: string): string {
  return dateFormat.format(new Date(`${isoDate}T00:00:00Z`));
}

function Entry({ note }: { note: PatchNote }) {
  const headingId = `patch-${note.date}`;
  return (
    <section aria-labelledby={headingId} className="flex flex-col gap-2">
      <header className="px-1">
        <h2 id={headingId} className="section-title">
          <time dateTime={note.date}>{formatPatchDate(note.date)}</time>
        </h2>
        <p className="font-display text-lg font-bold tracking-tight">{note.title}</p>
      </header>
      <ul className="card divide-y divide-line overflow-hidden">
        {groupChanges(note.changes).map((group) => (
          <Change key={group.texts[0]} {...group} />
        ))}
      </ul>
    </section>
  );
}

/**
 * The patch notes: what changed in each update, newest first. Pure: the notes come from `patch-notes.ts`.
 * @param notes - The entries to show (defaults to the application's own).
 */
export function PatchNotesView({ notes = PATCH_NOTES }: { notes?: readonly PatchNote[] }) {
  return (
    <div className="mx-auto flex w-full max-w-3xl flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h1 className="page-title">Patch notes</h1>
        <p className="text-sm text-muted">Historique des modifications, par date.</p>
      </header>
      {notes.map((note) => (
        <Entry key={note.date} note={note} />
      ))}
    </div>
  );
}
