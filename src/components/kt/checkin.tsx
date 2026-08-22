import {
  Check,
  HandHeart,
  HeartHandshake,
  MessageCircle,
  Plus,
  ShieldCheck,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { AZUMI_CONTACT, HUMORES, filialNome } from "@/lib/kt-data";
import { readEmployeeAccess } from "@/lib/employee-session";
import { supabase } from "@/lib/supabase";
import { uid, useCheckins, type Session } from "@/lib/kt-store";

type SupportDestination = "rh" | "gestor";
type MoodKind = "positive" | "neutral" | "negative";

type MoodCopy = {
  title: string;
  body: string;
  after: string;
  prompt?: string;
};

const MOOD_COPY: Record<string, MoodCopy> = {
  otimo: {
    title: "Oba! Que dia maravilhoso por aí ✨",
    body: "Que bom saber que você está se sentindo muito bem. Aproveite essa energia e, se puder, espalhe um pouco dela pelo time.",
    after: "Que seu dia continue leve e positivo. E lembre: mesmo nos dias ótimos, sua liderança e o RH continuam por perto se você precisar.",
  },
  bem: {
    title: "Que bom que seu dia está indo bem 💛",
    body: "Ficamos felizes em saber disso. Esperamos que o restante do seu turno siga tranquilo e com boas trocas.",
    after: "Estamos na torcida para que seu dia continue bem. Se algo mudar, você pode atualizar seu check-in a qualquer momento.",
  },
  neutro: {
    title: "Tudo bem ter um dia mais neutro.",
    body: "Nem todo dia precisa ser incrível ou difícil. Às vezes estamos apenas seguindo o ritmo, e isso também faz parte.",
    after: "Se perceber que existe algo te incomodando, não precisa esperar piorar. Você pode conversar com alguém de confiança, com seu gestor ou com o RH.",
    prompt: "Tem algo que você gostaria de dividir com alguém?",
  },
  dificil: {
    title: "Entendemos. Tem dias que realmente não são fáceis.",
    body: "Obrigado por registrar como você está. Você não precisa lidar com um dia difícil sozinho(a), e pedir ajuda não precisa esperar a situação ficar maior.",
    after: "Seu check-in foi registrado. Não esqueça: você não está sozinho(a). Podemos passar por esse momento junto com você e ajudar a encontrar o próximo passo.",
    prompt: "Quer conversar com alguém agora ou deixar um comentário para nos ajudar a entender melhor?",
  },
  "muito-dificil": {
    title: "Você sinalizou que precisa de atenção e cuidado agora.",
    body: "Obrigado por nos contar. Um momento muito difícil merece espaço, acolhimento e apoio. Você não precisa resolver tudo sozinho(a) e não precisa esperar para pedir ajuda.",
    after: "Seu check-in foi registrado e queremos reforçar uma coisa importante: você não está sozinho(a). Falar com alguém pode ser o primeiro passo para atravessar esse momento com mais apoio.",
    prompt: "Precisa de ajuda agora? Escolha com quem você se sente mais confortável para conversar.",
  },
};

const POSITIVE_PARTICLES = ["❤️", "✨", "🎉", "💛", "✦", "❤️", "✨", "🎊", "💫", "❤️", "✦", "🎉"];
const NEUTRAL_PARTICLES = ["✨", "•", "✦", "✨", "•", "✦", "✨", "•"];

function moodKind(category?: string): MoodKind {
  if (category === "positiva") return "positive";
  if (category === "neutra") return "neutral";
  return "negative";
}

function MoodBurst({ id, kind }: { id: number; kind: MoodKind }) {
  if (kind === "negative") {
    return (
      <div key={id} className="kt-mood-alert-burst" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
    );
  }

  const particles = kind === "positive" ? POSITIVE_PARTICLES : NEUTRAL_PARTICLES;
  return (
    <div key={id} className={`kt-mood-burst kt-mood-burst-${kind}`} aria-hidden="true">
      {particles.map((particle, index) => (
        <span
          key={`${id}-${index}`}
          className="kt-mood-particle"
          style={{
            left: `${8 + ((index * 17) % 84)}%`,
            animationDelay: `${(index % 5) * 55}ms`,
            animationDuration: `${900 + (index % 4) * 120}ms`,
          }}
        >
          {particle}
        </span>
      ))}
    </div>
  );
}

function PsychosocialSupportInfo({ prominent = false }: { prominent?: boolean }) {
  return (
    <div
      className={`rounded-lg border border-destructive/25 bg-destructive/5 ${prominent ? "px-4 py-4" : "px-3.5 py-3"}`}
    >
      <div className="flex items-start gap-3">
        <HeartHandshake className="mt-0.5 h-5 w-5 shrink-0 text-destructive" />
        <div>
          <p className="font-bold text-destructive">Você não está sozinho(a).</p>
          <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
            Se precisar conversar agora, o CVV oferece apoio emocional gratuito e confidencial 24 horas por dia.
          </p>
          <div className="mt-2 flex flex-wrap gap-2">
            <a
              href="tel:188"
              className="inline-flex min-h-9 items-center rounded-md border border-destructive/20 bg-card px-3 text-xs font-bold text-destructive hover:bg-destructive/5"
            >
              Ligar 188
            </a>
            <a
              href="https://www.cvv.org.br/"
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-9 items-center rounded-md border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
            >
              Acessar apoio online
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}

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
  onTrusted,
}: {
  session: Extract<Session, { tipo: "colaborador" }>;
  onDone: (destination: SupportDestination, protocol: string) => void;
  onTrusted: () => void;
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
    <div className="grid gap-2 md:grid-cols-3">
      <button
        type="button"
        disabled={loading !== null}
        onClick={() => void request("rh")}
        className="flex min-h-[112px] items-start gap-3 rounded-lg border border-kt/25 bg-kt-soft/45 p-4 text-left transition-colors hover:border-kt/45 hover:bg-kt-soft disabled:opacity-60"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card text-kt ring-1 ring-kt/15">
          <ShieldCheck className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-bold text-foreground">
            {loading === "rh" ? "Registrando..." : "Quero falar com o RH"}
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
        className="flex min-h-[112px] items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-foreground/25 hover:bg-muted/35 disabled:opacity-60"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
          <UserRound className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-bold text-foreground">
            {loading === "gestor" ? "Registrando..." : "Quero falar com meu gestor"}
          </span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            Seu gestor recebe o pedido. O RH acompanha o registro para garantir continuidade.
          </span>
        </span>
      </button>

      <button
        type="button"
        disabled={loading !== null}
        onClick={onTrusted}
        className="flex min-h-[112px] items-start gap-3 rounded-lg border border-border bg-card p-4 text-left transition-colors hover:border-foreground/25 hover:bg-muted/35 disabled:opacity-60"
      >
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-muted text-foreground">
          <UsersRound className="h-4 w-4" />
        </span>
        <span>
          <span className="block text-sm font-bold text-foreground">Vou falar com alguém próximo</span>
          <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
            Pode ser um familiar, amigo ou alguém de confiança. Esse contato fica fora da plataforma.
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
  const [trustedSupport, setTrustedSupport] = useState(false);
  const [burst, setBurst] = useState<{ id: number; kind: MoodKind } | null>(null);
  const [aftercareOpen, setAftercareOpen] = useState(false);

  const today = new Date().toDateString();
  const todayItems = checkins
    .filter((item) => item.nome === session.nome && new Date(item.ts).toDateString() === today)
    .sort((a, b) => b.ts - a.ts);

  const selected = HUMORES.find((item) => item.id === humor);
  const selectedCopy = selected ? MOOD_COPY[selected.id] : undefined;
  const isNegative = selected?.categoria === "negativa";
  const isNeutral = selected?.categoria === "neutra";
  const isVeryDifficult = selected?.id === "muito-dificil";
  const selectedKind = moodKind(selected?.categoria);

  const chooseMood = (id: string, category: string) => {
    setHumor(id);
    setSubmitted(false);
    setSupport(null);
    setTrustedSupport(false);
    setBurst({ id: Date.now(), kind: moodKind(category) });
  };

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
    setTrustedSupport(false);
    setBurst({ id: Date.now(), kind: moodKind(selected.categoria) });
    setAftercareOpen(true);
    toast.success("Check-in registrado.");
  };

  const reset = () => {
    setHumor("");
    setSubmitted(false);
    setSupport(null);
    setTrustedSupport(false);
    setBurst(null);
  };

  const handleTrusted = () => {
    setTrustedSupport(true);
    toast.success("Boa decisão. Procure alguém em quem você confia e não fique sozinho(a) com isso.");
  };

  return (
    <Section
      titulo="Como está seu dia?"
      intro="Seu check-in ajuda a acompanhar como você está hoje. Se algo mudar ao longo do turno, você pode registrar novamente."
      contagem="Check-in"
    >
      <Dialog open={aftercareOpen} onOpenChange={setAftercareOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl">
              <span aria-hidden>{selected?.emoji}</span>
              {selectedCopy?.title ?? "Check-in registrado"}
            </DialogTitle>
            <DialogDescription className="text-sm leading-relaxed">
              {selectedCopy?.after}
            </DialogDescription>
          </DialogHeader>

          {(isNegative || isNeutral) && selected ? (
            <div className="grid gap-4">
              <div className={`rounded-lg border p-4 ${isVeryDifficult ? "border-destructive/30 bg-destructive/5" : "border-warn/30 bg-warn-soft/55"}`}>
                <p className="text-sm font-bold text-foreground">
                  {selectedCopy?.prompt ?? "Quer conversar com alguém?"}
                </p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  Você decide com quem se sente mais confortável para começar. Pedir apoio não gera nenhum tipo de penalização.
                </p>
              </div>
              <SupportChoice
                session={session}
                onDone={(destination, protocol) => setSupport({ destination, protocol })}
                onTrusted={handleTrusted}
              />
              {isNegative ? <PsychosocialSupportInfo prominent={isVeryDifficult} /> : null}
            </div>
          ) : (
            <div className="rounded-lg border border-success/25 bg-success-soft/60 p-4 text-sm leading-relaxed text-success">
              Que bom ter esse registro. Esperamos que o restante do seu dia siga bem. 💛
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="relative grid gap-5 overflow-visible">
        {burst ? <MoodBurst id={burst.id} kind={burst.kind} /> : null}

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
              <p className="mb-2 text-sm font-semibold text-foreground">Selecione como você está agora</p>

              <div className="relative pt-2">
                <div className="absolute left-[9%] right-[9%] top-[27px] h-1 rounded-full bg-gradient-to-r from-destructive via-warn to-success opacity-45" />
                <div className="relative grid grid-cols-5 gap-1.5 sm:gap-2">
                  {[...HUMORES].reverse().map((item) => {
                    const active = humor === item.id;
                    const activeClass =
                      item.categoria === "positiva"
                        ? "border-success bg-success-soft/80 text-success ring-1 ring-success/20"
                        : item.categoria === "neutra"
                          ? "border-warn bg-warn-soft/85 text-warn ring-1 ring-warn/20"
                          : "border-destructive bg-destructive/8 text-destructive ring-1 ring-destructive/20";
                    const iconRing =
                      item.categoria === "positiva"
                        ? "ring-success/35"
                        : item.categoria === "neutra"
                          ? "ring-warn/35"
                          : "ring-destructive/30";
                    return (
                      <button
                        key={item.id}
                        type="button"
                        aria-pressed={active}
                        onClick={() => chooseMood(item.id, item.categoria)}
                        className={`relative flex min-h-[78px] flex-col items-center justify-start gap-1 rounded-lg border px-1.5 py-2.5 text-center transition-all sm:min-h-[88px] sm:px-2 ${
                          active ? activeClass : "border-border bg-card text-muted-foreground hover:border-foreground/20 hover:bg-muted/30"
                        }`}
                      >
                        <span className={`grid h-9 w-9 place-items-center rounded-full bg-card text-2xl shadow-sm ring-1 ${active ? iconRing : "ring-border"}`}>
                          {item.emoji}
                        </span>
                        <span className="text-[10px] font-semibold leading-tight sm:text-xs">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {selected && selectedCopy ? (
                <div
                  className={`mt-3 rounded-lg border ${
                    isVeryDifficult
                      ? "border-destructive/35 bg-destructive/7 px-5 py-5 shadow-sm"
                      : isNegative
                        ? "border-destructive/30 bg-destructive/7 px-4 py-4"
                        : isNeutral
                          ? "border-warn/30 bg-warn-soft/70 px-4 py-4"
                          : "border-success/30 bg-success-soft/65 px-4 py-4"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span className={`grid shrink-0 place-items-center rounded-full bg-card ${isVeryDifficult ? "h-11 w-11 text-2xl" : "h-9 w-9 text-xl"}`}>
                      {selected.emoji}
                    </span>
                    <div>
                      <p className={`${isVeryDifficult ? "text-base" : "text-sm"} font-bold ${isNegative ? "text-destructive" : isNeutral ? "text-warn" : "text-success"}`}>
                        {selectedCopy.title}
                      </p>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                        {selectedCopy.body}
                      </p>
                      {selectedCopy.prompt ? (
                        <p className="mt-2 text-xs font-semibold text-foreground">{selectedCopy.prompt}</p>
                      ) : null}
                    </div>
                  </div>
                  {isNegative ? <div className="mt-4"><PsychosocialSupportInfo prominent={isVeryDifficult} /></div> : null}
                </div>
              ) : null}
            </div>

            {selected ? (
              <div className="grid gap-3">
                {showComment ? (
                  <div className="grid gap-2">
                    <Textarea
                      rows={4}
                      maxLength={700}
                      value={comentario}
                      onChange={(event) => setComentario(event.target.value)}
                      placeholder={isNegative ? "Se quiser, conte um pouco mais sobre o que aconteceu ou sobre como você está se sentindo..." : "Comentário opcional sobre seu dia..."}
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
                    <Plus className="h-3.5 w-3.5" /> {isNegative ? "Quero contar um pouco mais" : "Adicionar comentário opcional"}
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
            <div
              className={`rounded-lg border px-4 py-4 ${
                selectedKind === "positive"
                  ? "border-success/30 bg-success-soft/65"
                  : selectedKind === "neutral"
                    ? "border-warn/30 bg-warn-soft/70"
                    : "border-destructive/30 bg-destructive/7"
              }`}
            >
              <div className="flex items-start gap-3">
                <span className="text-2xl">{selected?.emoji}</span>
                <div>
                  <p
                    className={`text-sm font-bold ${
                      selectedKind === "positive" ? "text-success" : selectedKind === "neutral" ? "text-warn" : "text-destructive"
                    }`}
                  >
                    {selectedCopy?.after ?? `Check-in registrado como ${selected?.label}`}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">Você pode fazer um novo registro mais tarde se seu dia mudar.</p>
                </div>
              </div>
            </div>

            {(isNegative || isNeutral) && !support && !trustedSupport ? (
              <div className="grid gap-3">
                <div>
                  <p className="text-sm font-bold text-foreground">Quer conversar com alguém?</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Você escolhe com quem quer começar. O RH só é notificado quando você escolhe RH ou quando o fluxo institucional exige acompanhamento.
                  </p>
                </div>
                <SupportChoice
                  session={session}
                  onDone={(destination, protocol) => setSupport({ destination, protocol })}
                  onTrusted={handleTrusted}
                />
              </div>
            ) : null}

            {isNegative ? <PsychosocialSupportInfo prominent={isVeryDifficult} /> : null}

            {support ? (
              <div className="rounded-lg border border-success/25 bg-success-soft px-4 py-4">
                <p className="text-sm font-bold text-success">Pedido de apoio registrado</p>
                <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                  {support.destination === "rh"
                    ? "O RH recebeu seu pedido. Seu gestor não foi notificado neste momento."
                    : "Sua liderança recebeu o pedido e o RH acompanha o registro institucional."}
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

            {trustedSupport ? (
              <div className="rounded-lg border border-border bg-muted/35 px-4 py-4">
                <div className="flex items-start gap-3">
                  <HandHeart className="mt-0.5 h-5 w-5 shrink-0 text-kt" />
                  <div>
                    <p className="text-sm font-bold text-foreground">Procure alguém em quem você confia.</p>
                    <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                      Um familiar, amigo ou pessoa próxima pode ajudar a não atravessar esse momento sozinho(a). A plataforma não registra quem você escolheu contatar.
                    </p>
                  </div>
                </div>
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
