import { Check, MessageCircle, Plus, ShieldCheck, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AZUMI_CONTACT, HUMORES, filialNome } from "@/lib/kt-data";
import { readEmployeeAccess } from "@/lib/employee-session";
import { supabase } from "@/lib/supabase";
import { uid, useCheckins, type Session } from "@/lib/kt-store";

type SupportDestination = "rh" | "gestor";

const HUMOR_HINT: Record<string, string> = {
  otimo: "Seu dia está fluindo muito bem.",
  bem: "O turno está indo bem.",
  neutro: "Um dia regular, sem grandes altos ou baixos.",
  dificil: "Tem algo deixando o dia mais pesado.",
  "muito-dificil": "Você sinalizou que precisa de atenção e cuidado.",
};

function gerarProtocolo() {
  return `KT-${Date.now().toString(36).toUpperCase().slice(-6)}`;
}

async function registrarPedidoApoio(
  session: Extract<Session, { tipo: "colaborador" }>,
  destino: SupportDestination,
  assunto: string,
) {
  const access = readEmployeeAccess();
  const protocolo = gerarProtocolo();
  const { error } = await supabase.from("kt_ajuda").insert({
    id: uid(),
    nome: session.nome,
    filial: session.filial,
    assunto,
    ts: new Date().toISOString(),
    protocolo,
    colaborador_id: access?.colaboradorId ?? null,
    destino_inicial: destino,
  });
  if (error) throw error;
  return protocolo;
}

function SupportChoice({
  session,
  onDone,
}: {
  session: Extract<Session, { tipo: "colaborador" }>;
  onDone: (destination: SupportDestination, protocol: string) => void;
}) {
  const [loading, setLoading] = useState<SupportDestination | null>(null);

  const request = async (destination: SupportDestination) => {
    setLoading(destination);
    try {
      const protocol = await registrarPedidoApoio(
        session,
        destination,
        destination === "gestor"
          ? "Colaborador solicitou conversa com a liderança pelo check-in"
          : "Colaborador solicitou apoio confidencial do RH pelo check-in",
      );
      onDone(destination, protocol);
      toast.success("Pedido registrado.");
    } catch {
      toast.error("Não foi possível registrar o pedido agora. Tente novamente.");
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <button
        type="button"
        disabled={loading !== null}
        onClick={() => void request("rh")}
        className="flex min-h-[94px] items-start gap-3 rounded-lg border border-kt/25 bg-kt-soft/45 p-4 text-left transition-colors hover:border-kt/45 hover:bg-kt-soft disabled:opacity-60"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card text-kt ring-1 ring-kt/15">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-bold text-foreground">
            {loading === "rh" ? "Registrando..." : "Falar primeiro com o RH"}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            Confidencial. A liderança só será envolvida depois se o RH entender que é necessário.
          </span>
        </span>
      </button>

      <button
        type="button"
        disabled={loading !== null}
        onClick={() => void request("gestor")}
        className="flex min-h-[94px] items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-foreground/25 hover:bg-muted/35 disabled:opacity-60"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
          <UserRound className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-bold text-foreground">
            {loading === "gestor" ? "Registrando..." : "Quero falar com meu gestor"}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            Seu gestor recebe o pedido. O RH também acompanha o registro para dar suporte quando necessário.
          </span>
        </span>
      </button>
    </div>
  );
}

export function CheckIn({ session }: { session: Extract<Session, { tipo: "colaborador" }> }) {
  const [checkins, setCheckins] = useCheckins();
  const [humor, setHumor] = useState("");
  const [comentario, setComentario] = useState("");
  const [showComment, setShowComment] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [support, setSupport] = useState<{ destination: SupportDestination; protocol: string } | null>(null);

  const today = new Date().toDateString();
  const todayItems = checkins
    .filter((item) => item.nome === session.nome && new Date(item.ts).toDateString() === today)
    .sort((a, b) => b.ts - a.ts);

  const selected = HUMORES.find((item) => item.id === humor);
  const isNegative = selected?.categoria === "negativa";
  const isNeutral = selected?.categoria === "neutra";

  const submit = () => {
    if (!selected) return;
    setCheckins((previous) => [
      {
        id: uid(),
        nome: session.nome,
        filial: session.filial,
        humor: selected.id,
        ts: Date.now(),
        ...(comentario.trim() ? { recado: comentario.trim() } : {}),
      },
      ...previous,
    ]);
    setSubmitted(true);
    setComentario("");
    setShowComment(false);
    setSupport(null);
    toast.success("Check-in registrado.");
  };

  const reset = () => {
    setHumor("");
    setSubmitted(false);
    setSupport(null);
  };

  return (
    <Section
      titulo="Como está seu dia?"
      intro="Um registro rápido para acompanhar o clima da equipe. Você pode atualizar novamente ao longo do turno."
      contagem="Check-in"
    >
      <div className="grid gap-5">
        {todayItems.length > 0 ? (
          <div className="flex flex-col gap-2 rounded-lg border border-success/20 bg-success-soft/55 px-3.5 py-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-2 text-sm font-semibold text-success">
              <Check className="h-4 w-4" />
              Você já registrou {todayItems.length === 1 ? "seu check-in" : `${todayItems.length} check-ins`} hoje.
            </div>
            <div className="text-xs text-muted-foreground">
              Último: {HUMORES.find((h) => h.id === todayItems[0]?.humor)?.emoji}{" "}
              {HUMORES.find((h) => h.id === todayItems[0]?.humor)?.label} ·{" "}
              {new Date(todayItems[0]!.ts).toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
        ) : null}

        {!submitted ? (
          <>
            <div>
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="text-sm font-semibold text-foreground">Selecione como você está agora</p>
                <span className="text-[11px] text-muted-foreground">{filialNome(session.filial)}</span>
              </div>

              <div className="relative pt-2">
                <div className="absolute left-[9%] right-[9%] top-[27px] h-1 rounded-full bg-gradient-to-r from-destructive via-warn to-success opacity-35" />
                <div className="relative grid grid-cols-5 gap-1.5 sm:gap-2">
                  {[...HUMORES].reverse().map((item) => {
                    const active = humor === item.id;
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => {
                          setHumor(item.id);
                          setSubmitted(false);
                          setSupport(null);
                        }}
                        className={`relative flex min-h-[78px] flex-col items-center justify-start gap-1 rounded-lg border px-1.5 py-2.5 text-center transition-all sm:min-h-[88px] sm:px-2 ${
                          active
                            ? "border-kt bg-kt-soft shadow-sm ring-1 ring-kt/10"
                            : "border-border bg-card hover:border-foreground/20 hover:bg-muted/30"
                        }`}
                      >
                        <span className={`grid h-9 w-9 place-items-center rounded-full bg-card text-2xl shadow-sm ring-1 ${active ? "ring-kt/30" : "ring-border"}`}>
                          {item.emoji}
                        </span>
                        <span className={`text-[10px] font-semibold leading-tight sm:text-xs ${active ? "text-kt" : "text-muted-foreground"}`}>
                          {item.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selected ? (
                <div className={`mt-3 rounded-lg border px-3.5 py-3 ${isNegative ? "border-destructive/20 bg-destructive/5" : isNeutral ? "border-warn/20 bg-warn-soft/55" : "border-success/20 bg-success-soft/45"}`}>
                  <p className="text-sm font-semibold text-foreground">{HUMOR_HINT[selected.id]}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    {isNegative
                      ? "Depois de registrar, você poderá escolher se quer apoio do RH ou uma conversa direta com seu gestor."
                      : isNeutral
                        ? "Se quiser, após registrar você também pode pedir uma conversa confidencial com o RH."
                        : "Obrigado por registrar. Essa informação compõe a leitura de clima da equipe."}
                  </p>
                </div>
              ) : null}
            </div>

            {selected ? (
              <div className="grid gap-3">
                {showComment ? (
                  <div className="grid gap-2">
                    <Textarea
                      rows={3}
                      maxLength={500}
                      value={comentario}
                      onChange={(event) => setComentario(event.target.value)}
                      placeholder="Comentário opcional sobre seu dia..."
                      className="resize-none"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setShowComment(false);
                        setComentario("");
                      }}
                      className="w-fit text-xs font-medium text-muted-foreground hover:text-foreground"
                    >
                      Remover comentário
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => setShowComment(true)}
                    className="inline-flex w-fit items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
                  >
                    <Plus className="h-3.5 w-3.5" /> Adicionar comentário opcional
                  </button>
                )}

                <Button className="h-11 w-full sm:w-fit sm:min-w-44" onClick={submit}>
                  Registrar check-in
                </Button>
              </div>
            ) : null}
          </>
        ) : (
          <div className="grid gap-4">
            <div className="rounded-lg border border-border bg-muted/30 px-4 py-4">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{selected?.emoji}</span>
                <div>
                  <p className="text-sm font-bold text-foreground">Check-in registrado como {selected?.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">Você pode fazer um novo registro mais tarde se seu dia mudar.</p>
                </div>
              </div>
            </div>

            {(isNegative || isNeutral) && !support ? (
              <div className="grid gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Quer conversar com alguém?</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Escolha quem deve receber seu pedido primeiro. O RH acompanha os registros de apoio para garantir continuidade e cuidado.
                  </p>
                </div>
                {isNegative ? (
                  <SupportChoice session={session} onDone={(destination, protocol) => setSupport({ destination, protocol })} />
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      try {
                        const protocol = await registrarPedidoApoio(session, "rh", "Colaborador solicitou contato do RH após check-in neutro");
                        setSupport({ destination: "rh", protocol });
                        toast.success("Pedido registrado.");
                      } catch {
                        toast.error("Não foi possível registrar o pedido agora.");
                      }
                    }}
                    className="flex min-h-[72px] items-start gap-3 rounded-lg border border-kt/25 bg-kt-soft/45 p-4 text-left hover:bg-kt-soft"
                  >
                    <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-kt" />
                    <span>
                      <span className="block text-sm font-bold">Quero falar com o RH</span>
                      <span className="mt-0.5 block text-xs text-muted-foreground">Pedido confidencial; o gestor não é notificado neste primeiro momento.</span>
                    </span>
                  </button>
                )}
              </div>
            ) : null}

            {support ? (
              <div className="rounded-lg border border-success/25 bg-success-soft px-4 py-4">
                <p className="text-sm font-bold text-success">Pedido de apoio registrado</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {support.destination === "rh"
                    ? "O RH recebeu seu pedido. Seu gestor não foi notificado neste momento."
                    : "Sua liderança recebeu o pedido e o RH também acompanha o registro."}
                </p>
                <p className="mt-2 text-[11px] font-semibold text-muted-foreground">Protocolo: {support.protocol}</p>
                {support.destination === "rh" ? (
                  <a
                    href={`https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(`Olá, sou ${session.nome} do Ken Taki ${filialNome(session.filial)}. Registrei o protocolo ${support.protocol} na intranet e gostaria de conversar com o RH.`)}`}
                    target="_blank"
                    rel="noreferrer"
                    className="mt-3 inline-flex min-h-9 items-center gap-2 rounded-md border border-success/25 bg-card px-3 text-xs font-semibold text-success hover:bg-success-soft"
                  >
                    <MessageCircle className="h-3.5 w-3.5" /> Abrir WhatsApp do RH
                  </a>
                ) : null}
              </div>
            ) : null}

            <button type="button" onClick={reset} className="w-fit text-xs font-semibold text-muted-foreground hover:text-foreground">
              Fazer outro check-in
            </button>
          </div>
        )}
      </div>
    </Section>
  );
}
