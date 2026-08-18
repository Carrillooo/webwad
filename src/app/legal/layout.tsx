import type { ReactNode } from "react";
import Link from "next/link";

/** Marco común de las páginas legales: legible, sobrio y con vuelta a la app. */
export default function LegalLayout({ children }: { children: ReactNode }) {
  return (
    <main className="min-h-[100dvh] px-5 py-8">
      <article className="max-w-2xl mx-auto space-y-4 text-sm leading-relaxed [&_h1]:text-2xl [&_h1]:font-semibold [&_h2]:text-base [&_h2]:font-semibold [&_h2]:mt-6 [&_p]:text-[13.5px] [&_li]:text-[13.5px] [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
        {children}
        <footer className="pt-6 text-[12px] text-faint border-t border-[rgb(var(--nova-fg)/0.1)]">
          <Link href="/" style={{ color: "rgb(var(--nova-accent))" }}>← Volver a ZERO</Link>
          {" · "}
          <a href="/legal/aviso-legal" style={{ color: "rgb(var(--nova-accent))" }}>Aviso legal</a>
          {" · "}
          <a href="/legal/terminos" style={{ color: "rgb(var(--nova-accent))" }}>Términos</a>
          {" · "}
          <a href="/legal/privacidad" style={{ color: "rgb(var(--nova-accent))" }}>Privacidad</a>
          {" · "}
          <a href="/legal/cookies" style={{ color: "rgb(var(--nova-accent))" }}>Cookies</a>
        </footer>
      </article>
    </main>
  );
}
