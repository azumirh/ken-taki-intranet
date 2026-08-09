import { useEffect, useState } from "react";

export type NavItem = { id: string; label: string; emoji: string };

/**
 * Navegação lateral fixa (somente desktop). Apenas rolagem — não altera dados.
 */
export function SideNav({ titulo, itens }: { titulo?: string; itens: NavItem[] }) {
  const [ativo, setAtivo] = useState<string>("");

  useEffect(() => {
    const alvos = itens
      .map((i) => document.getElementById(i.id))
      .filter((el): el is HTMLElement => !!el);
    if (alvos.length === 0) return;
    const obs = new IntersectionObserver(
      (entries) => {
        const visivel = entries
          .filter((e) => e.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visivel) setAtivo(visivel.target.id);
      },
      { rootMargin: "-20% 0px -65% 0px", threshold: 0 },
    );
    alvos.forEach((el) => obs.observe(el));
    return () => obs.disconnect();
  }, [itens]);

  return (
    <nav aria-label="Seções da página" className="surface p-3">
      {titulo ? (
        <p className="px-3 pb-2 pt-1 text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
          {titulo}
        </p>
      ) : null}
      <ul className="grid gap-0.5">
        {itens.map((i) => (
          <li key={i.id}>
            <button
              type="button"
              onClick={() =>
                document.getElementById(i.id)?.scrollIntoView({ behavior: "smooth", block: "start" })
              }
              className={`flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-left text-sm transition-colors ${
                ativo === i.id
                  ? "bg-kt-soft font-semibold text-kt"
                  : "text-muted-foreground hover:bg-muted hover:text-foreground"
              }`}
            >
              <span aria-hidden className="text-base leading-none">
                {i.emoji}
              </span>
              <span className="min-w-0 truncate">{i.label}</span>
            </button>
          </li>
        ))}
      </ul>
    </nav>
  );
}
