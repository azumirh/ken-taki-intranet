import type { ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { iniciais } from "@/lib/kt-data";

export function Section({
  id,
  titulo,
  intro,
  contagem,
  acao,
  children,
  collapsible = false,
  defaultOpen = true,
}: {
  id?: string;
  titulo: string;
  intro: string;
  contagem?: string;
  acao?: ReactNode;
  children: ReactNode;
  collapsible?: boolean | undefined;
  defaultOpen?: boolean | undefined;
}) {
  if (!collapsible) {
    return (
      <section id={id} className="surface overflow-hidden">
        <header className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 border-b border-border px-5 py-5 sm:px-7">
          <div className="min-w-0">
            <h2 className="text-lg font-bold sm:text-xl">{titulo}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            {contagem ? (
              <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                {contagem}
              </span>
            ) : null}
            {acao}
          </div>
        </header>
        <div className="px-5 py-5 sm:px-7">{children}</div>
      </section>
    );
  }

  return (
    <div id={id} className="surface overflow-hidden">
      <AccordionPrimitive.Root
        type="single"
        collapsible
        {...(defaultOpen ? { defaultValue: "s" } : {})}
      >
        <AccordionPrimitive.Item value="s">
          <AccordionPrimitive.Header className="flex items-start gap-2 border-b border-border px-5 py-5 sm:px-7">
            <AccordionPrimitive.Trigger className="flex flex-1 cursor-pointer items-start gap-2 text-left transition-all [&[data-state=open]>svg]:rotate-180">
              <div className="min-w-0 flex-1">
                <h2 className="text-lg font-bold sm:text-xl">{titulo}</h2>
                <p className="mt-1 text-sm text-muted-foreground">{intro}</p>
              </div>
              <ChevronDown className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
            </AccordionPrimitive.Trigger>
            {(contagem || acao) && (
              <div className="flex shrink-0 items-center gap-2 pt-1">
                {contagem && (
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    {contagem}
                  </span>
                )}
                {acao}
              </div>
            )}
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="px-5 py-5 sm:px-7">{children}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      </AccordionPrimitive.Root>
    </div>
  );
}

export function Avatar({
  nome,
  foto,
  size = 48,
}: {
  nome: string;
  foto?: string | undefined;
  size?: number | undefined;
}) {
  return foto ? (
    <img
      src={foto}
      alt={nome}
      width={size}
      height={size}
      loading="lazy"
      className="shrink-0 rounded-full object-cover"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full text-sm font-bold text-primary-foreground gradient-union"
      style={{ width: size, height: size }}
    >
      {iniciais(nome)}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <p className="rounded-xl border border-dashed border-border px-4 py-6 text-center text-sm text-muted-foreground">
      {children}
    </p>
  );
}
