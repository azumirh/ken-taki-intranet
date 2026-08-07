import type { ReactNode } from "react";
import * as AccordionPrimitive from "@radix-ui/react-accordion";
import { ChevronDown } from "lucide-react";
import { iniciais } from "@/lib/kt-data";

function Meta({ contagem, acao }: { contagem?: string | undefined; acao?: ReactNode }) {
  if (!contagem && !acao) return null;
  return (
    <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-end">
      {contagem ? (
        <span className="rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
          {contagem}
        </span>
      ) : null}
      {acao}
    </div>
  );
}

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
        <header className="border-b border-border px-5 py-5 sm:px-7">
          <div className="flex flex-col gap-3 text-center sm:flex-row sm:items-start sm:justify-between sm:text-left">
            <div className="min-w-0">
              <h2 className="text-xl font-bold sm:text-xl">{titulo}</h2>
              <p className="mx-auto mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground sm:mx-0">
                {intro}
              </p>
            </div>
            <Meta contagem={contagem} acao={acao} />
          </div>
        </header>
        <div className="px-4 py-5 sm:px-7">{children}</div>
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
          <AccordionPrimitive.Header className="border-b border-border px-5 py-5 sm:px-7">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <AccordionPrimitive.Trigger className="group flex w-full cursor-pointer items-start gap-2 text-center sm:text-left [&[data-state=open]>svg]:rotate-180">
                <div className="min-w-0 flex-1">
                  <h2 className="text-xl font-bold sm:text-xl">{titulo}</h2>
                  <p className="mx-auto mt-1.5 max-w-prose text-sm leading-relaxed text-muted-foreground sm:mx-0">
                    {intro}
                  </p>
                </div>
                <ChevronDown className="mt-1.5 h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200" />
              </AccordionPrimitive.Trigger>
              <Meta contagem={contagem} acao={acao} />
            </div>
          </AccordionPrimitive.Header>
          <AccordionPrimitive.Content className="overflow-hidden data-[state=closed]:animate-accordion-up data-[state=open]:animate-accordion-down">
            <div className="px-4 py-5 sm:px-7">{children}</div>
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
