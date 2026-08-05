import { useState } from "react";
import { toast } from "sonner";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { HUMORES } from "@/lib/kt-data";
import { uid, useCheckins, type Session } from "@/lib/kt-store";

export function CheckIn({ session }: { session: Extract<Session, { tipo: "colaborador" }> }) {
  const [checkins, setCheckins] = useCheckins();
  const hoje = new Date().toDateString();
  const feito = checkins.find(
    (c) => c.nome === session.nome && new Date(c.ts).toDateString() === hoje,
  );

  const [humor, setHumor] = useState<string>("");
  const [recado, setRecado] = useState("");

  if (feito) {
    const h = HUMORES.find((x) => x.id === feito.humor);
    return (
      <Section
        titulo={`Olá, ${session.nome.split(" ")[0]}!`}
        intro="Seu check-in de hoje já está registrado. Obrigado por compartilhar."
        contagem="Check-in feito"
      >
        <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-success-soft px-4 py-4">
          <span className="text-3xl">{h?.emoji}</span>
          <div className="min-w-0">
            <p className="font-semibold">Hoje você está: {h?.label}</p>
            {feito.recado ? (
              <p className="text-sm text-muted-foreground">“{feito.recado}”</p>
            ) : (
              <p className="text-sm text-muted-foreground">
                Se algo mudar durante o turno, fale com sua liderança ou com a equipe Azumi.
              </p>
            )}
          </div>
        </div>
      </Section>
    );
  }

  return (
    <Section
      titulo={`Olá, ${session.nome.split(" ")[0]}!`}
      intro="Conta pra gente: como você está hoje? Sem certo ou errado — é só pra sua liderança entender o clima do time."
      contagem="Leva 20 segundos"
    >
      <div className="grid grid-cols-5 gap-2 sm:max-w-lg">
        {HUMORES.map((h) => (
          <button
            key={h.id}
            onClick={() => setHumor(h.id)}
            className={`rounded-2xl border px-1 py-3 text-center transition-all ${
              humor === h.id
                ? "border-kt bg-kt-soft shadow-[var(--shadow-soft)]"
                : "border-border bg-card hover:border-kt/40"
            }`}
          >
            <span className="block text-2xl">{h.emoji}</span>
            <span className="mt-1 block text-[11px] font-medium leading-tight">{h.label}</span>
          </button>
        ))}
      </div>

      <div className="mt-4 grid gap-3">
        <Textarea
          placeholder="Quer contar alguma coisa? (opcional)"
          value={recado}
          onChange={(e) => setRecado(e.target.value)}
          maxLength={400}
          rows={3}
        />
        <div>
          <Button
            className="rounded-full"
            size="lg"
            disabled={!humor}
            onClick={() => {
              setCheckins([
                {
                  id: uid(),
                  nome: session.nome,
                  filial: session.filial,
                  humor,
                  recado: recado.trim() || undefined,
                  ts: Date.now(),
                },
                ...checkins,
              ]);
              toast.success("Check-in enviado. Obrigado por compartilhar!");
            }}
          >
            Enviar check-in
          </Button>
        </div>
      </div>
    </Section>
  );
}
