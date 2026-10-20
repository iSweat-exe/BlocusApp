import Link from "next/link";
import type { ReactNode } from "react";
import { LEGAL, LEGAL_PAGES, TO_COMPLETE } from "./legal-info";

/** A numbered-free section of a legal text: a title and its paragraphs. */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="font-display text-lg font-bold tracking-tight">{title}</h2>
      <div className="flex flex-col gap-2 text-sm leading-relaxed text-foreground/90 [&_a]:font-medium [&_a]:text-accent [&_li]:ml-4 [&_li]:list-disc [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-1">
        {children}
      </div>
    </section>
  );
}

/** Link to another page of the app (the legal texts link to each other and to the settings). */
export function InternalLink({ href, children }: { href: string; children: ReactNode }) {
  return (
    <Link href={href} prefetch={false}>
      {children}
    </Link>
  );
}

/** Shows a value of `legal-info.ts`; the placeholder stands out so that it is never published by mistake. */
export function LegalValue({ value }: { value: string }) {
  if (value.includes("@")) return <a href={`mailto:${value}`}>{value}</a>;
  if (value !== TO_COMPLETE) return <strong>{value}</strong>;
  return (
    <mark className="rounded bg-warning/25 px-1 font-semibold text-foreground">{TO_COMPLETE}</mark>
  );
}

/** Common frame of the legal pages: title, date, the text, and links to the other legal pages. */
export function LegalPage({
  title,
  intro,
  children,
}: {
  title: string;
  intro: string;
  children: ReactNode;
}) {
  return (
    <article className="mx-auto flex w-full max-w-3xl flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h1 className="page-title">{title}</h1>
        <p className="text-sm text-muted">{intro}</p>
        <p className="text-xs text-faint">Dernière mise à jour : {LEGAL.updatedOn}</p>
      </header>

      {children}

      <nav aria-label="Autres pages légales" className="card flex flex-col overflow-hidden">
        {LEGAL_PAGES.map((page) => (
          <Link
            key={page.href}
            href={page.href}
            prefetch={false}
            className="flex min-h-control items-center justify-between gap-3 px-4 py-3 text-sm font-medium active:bg-foreground/10 [&:not(:first-child)]:border-t [&:not(:first-child)]:border-line"
          >
            {page.label}
            <span aria-hidden="true" className="text-faint">
              ›
            </span>
          </Link>
        ))}
      </nav>
    </article>
  );
}
