import { useState } from "react";
import { toast } from "sonner";
import { Check } from "lucide-react";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { POLITICAS, type Politica } from "@/lib/kt-data";
import { useAssinaturas, type Session } from "@/lib/kt-store";

export function Politicas({ session }: { session: Extract<Session, { tipo: "colaborador" }> }) {
  const [assinaturas, setAssinaturas] = useAssinaturas();
  const [aberta, setAberta] = useState<Politica | null>(null);

  const assinada = (id: string) => assinaturas.some((a) => a.politica === id && a.nome === session.nome);
  const total = assinaturas.filter((a) => a.nome === session.nome).length;

  return (
    <Section
      id="politicas"
      titulo="Políticas da empresa"
      intro="Ken Taki e Azumi RH desenvolveram juntos as políticas da casa. Leia cada uma e assine para concluir."
      contagem={`${total} de ${POLITICAS.length} assinadas`}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {POLITICAS.map((p) => {
          const ok = assinada(p.id);
          return (
            <article key={p.id} className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
              <div className="relative">
                <img
                  src={p.capa}
                  alt=""
                  width={1024}
                  height={512}
                  loading="lazy"
                  className="h-28 w-full object-cover"
                />
                {ok ? (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                    <Check className="h-3 w-3" /> Assinada
                  </span>
                ) : null}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-sm font-bold">{p.titulo}</h3>
                <p className="mt-1 flex-1 text-sm text-muted-foreground">{p.resumo}</p>
                <p className="mt-2 text-xs text-muted-foreground">{p.paginas} páginas · leitura rápida</p>
                <Button
                  variant={ok ? "outline" : "default"}
                  className="mt-3 w-full rounded-full"
                  onClick={() => setAberta(p)}
                >
                  {ok ? "Reler política" : "Ler e assinar"}
                </Button>
              </div>
            </article>
          );
        })}
      </div>

      <Dialog open={!!aberta} onOpenChange={(o) => !o && setAberta(null)}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          {aberta ? (
            <>
              <img
                src={aberta.capa}
                alt=""
                width={1024}
                height={512}
                className="h-28 w-full rounded-xl object-cover"
              />
              <DialogHeader>
                <DialogTitle>{aberta.titulo}</DialogTitle>
                <DialogDescription>{aberta.intro}</DialogDescription>
              </DialogHeader>
              <ul className="grid gap-3 text-sm text-muted-foreground">
                {aberta.conteudo.map((c, i) => (
                  <li key={i} className="rounded-xl bg-muted px-4 py-3">
                    {c}
                  </li>
                ))}
              </ul>
              <Button
                size="lg"
                className="w-full rounded-full"
                disabled={assinada(aberta.id)}
                onClick={() => {
                  setAssinaturas([
                    ...assinaturas,
                    {
                      politica: aberta.id,
                      nome: session.nome,
                      filial: session.filial,
                      ts: Date.now(),
                    },
                  ]);
                  toast.success(`${aberta.titulo} assinada.`);
                  setAberta(null);
                }}
              >
                {assinada(aberta.id) ? "Você já assinou" : "Li e assino esta política"}
              </Button>
            </>
          ) : null}
        </DialogContent>
      </Dialog>
    </Section>
  );
}
