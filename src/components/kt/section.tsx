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
  const header = (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0 flex-1">
        <h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{titulo}</h2>
        <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
      </div>
      {(contagem || acao) ? (
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          {contagem ? (
            <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
              {contagem}
            </span>
          ) : null}
          {acao}
        </div>
      ) : null}
    </div>
  );

  if (!collapsible) {
    return (
      <section id={id} className="surface scroll-mt-24 overflow-hidden">
        <header className="border-b border-border bg-card px-4 py-4 sm:px-5 lg:px-6">{header}</header>
        <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">{children}</div>
      </section>
    );
  }

  return (
    <section id={id} className="surface scroll-mt-24 overflow-hidden">
      <AccordionPrimitive.Root
        type="single"
        collapsible
        {...(defaultOpen ? { defaultValue: "s" } : {})}
      >
        <AccordionPrimitive.Item value="s">
          <AccordionPrimitive.Header className="border-b border-border bg-card px-4 py-4 sm:px-5 lg:px-6">
            <div className="flex items-start gap-3">
              <AccordionPrimitive.Trigger className="flex min-w-0 flex-1 cursor-pointer items-start gap-3 text-left [&[data-state=open]>svg]:rotate-180">
                <div className="min-w-0 flex-1">
                  <h2 className="text-base font-bold leading-tight text-foreground sm:text-lg">{titulo}</h2>
                  <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{intro}</p>
                </div>
                <ChevronDown className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground transition-transform duration-200" />
              </AccordionPrimitive.Trigger>
              {(contagem || acao) ? (
                <div className="hidden shrink-0 items-center gap-2 sm:flex">
                  {contagem ? (
                    <span className="rounded-md border border-border bg-muted px-2.5 py-1 text-[11px] font-semibold text-muted-foreground">
                      {contagem}
                    </span>
                  ) : null}
                  {acao}
                </div>
              ) : null}
            </div>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="px-4 py-4 sm:px-5 sm:py-5 lg:px-6">{children}</div>
          </AccordionPrimitive.Content>
        </AccordionPrimitive.Item>
      </AccordionPrimitive.Root>
    </section>
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
      className="shrink-0 rounded-full object-cover ring-1 ring-border"
      style={{ width: size, height: size }}
    />
  ) : (
    <span
      className="grid shrink-0 place-items-center rounded-full bg-foreground text-sm font-bold text-background ring-1 ring-border"
      style={{ width: size, height: size }}
    >
      {iniciais(nome)}
    </span>
  );
}

export function EmptyState({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/35 px-4 py-8 text-center text-sm leading-relaxed text-muted-foreground">
      {children}
    </div>
  );
}
