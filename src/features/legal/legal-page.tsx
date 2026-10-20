import Link from "next/link";
import { useId, type ReactNode } from "react";
import { LEGAL, LEGAL_PAGES, TO_COMPLETE } from "./legal-info";

/**
 * A numbered-free section of a legal text: a title and its paragraphs. Hierarchy, from the strongest down: the
 * section title (large, display font) under a divider, the lead-in words in bold at full strength, then the body in a
 * softer tone with accent bullets, kept to a comfortable line length.
 */
export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  const titleId = useId();
  return (
    <section
      aria-labelledby={titleId}
      className="flex flex-col gap-3 border-t border-line pt-section"
    >
      <h2 id={titleId} className="font-display text-xl font-bold tracking-tight">
        {title}
      </h2>
      <div className="flex max-w-[68ch] flex-col gap-3 text-sm leading-relaxed text-pretty text-foreground/80 [&_a]:font-medium [&_a]:text-accent [&_li]:ml-5 [&_li]:list-disc [&_li]:pl-1 [&_li]:marker:text-accent [&_strong]:font-semibold [&_strong]:text-foreground [&_ul]:flex [&_ul]:flex-col [&_ul]:gap-2.5">
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
      <header className="flex flex-col gap-2">
        <h1 className="page-title">{title}</h1>
        <p className="max-w-[60ch] text-base leading-snug text-pretty text-muted">{intro}</p>
        <p className="text-xs font-medium text-faint">Dernière mise à jour : {LEGAL.updatedOn}</p>
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
