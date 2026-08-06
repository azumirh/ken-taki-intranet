import confetti from "canvas-confetti";
import { useState } from "react";
import { ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { AZUMI_CONTACT, HUMORES, filialNome } from "@/lib/kt-data";
import { uid, useAjuda, useCheckins, useFeedbacks, type Session } from "@/lib/kt-store";

const FRASES_POSITIVAS = [
  "Que bom! Times animados fazem a diferença. Continue assim!",
  "Energia boa contagia! Obrigado por trazer isso hoje.",
  "Ótimo clima começa com você. Valeu por compartilhar!",
];

function dispararConfete() {
  if (typeof window === "undefined") return;
  const end = Date.now() + 1500;
  const cores = ["#a855f7", "#ec4899", "#3b82f6"];
  const frame = () => {
    confetti({ particleCount: 4, angle: 60, spread: 55, origin: { x: 0 }, colors: cores });
    confetti({ particleCount: 4, angle: 120, spread: 55, origin: { x: 1 }, colors: cores });
    if (Date.now() < end) requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}

type OpcaoNeg = "gestor" | "azumi" | "nao-agora";

function BotaoWa({
  session,
  assunto,
}: {
  session: Extract<Session, { tipo: "colaborador" }>;
  assunto: string;
}) {
  const [ajuda, setAjuda] = useAjuda();
  return (
    <Button
      className="w-fit rounded-full"
      onClick={() => {
        setAjuda([
          { id: uid(), nome: session.nome, filial: session.filial, assunto, ts: Date.now() },
          ...ajuda,
        ]);
        window.open(
          `https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(
            `Olá, equipe Azumi RH! Sou do Ken Taki, unidade ${filialNome(session.filial)}, e gostaria de conversar.`,
          )}`,
          "_blank",
        );
      }}
    >
      <MessageCircle className="h-4 w-4" /> Falar com a Azumi pelo WhatsApp
    </Button>
  );
}

function CvvInfo() {
  return (
    <div className="mt-3 rounded-xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm">
      <p className="font-semibold text-destructive">Você não está sozinho.</p>
      <p className="mt-0.5 text-muted-foreground">
        Se precisar conversar agora: <strong className="text-foreground">CVV — ligue 188</strong>{" "}
        (gratuito, 24h, todos os dias) ou acesse{" "}
        <a
          href="https://cvv.org.br"
          target="_blank"
          rel="noreferrer"
          className="text-kt underline underline-offset-2"
        >
          cvv.org.br
        </a>{" "}
        (chat e e-mail disponíveis).
      </p>
    </div>
  );
}

function BlocoNegativo({
  session,
  opcaoNeg,
  setOpcaoNeg,
  feedbacks,
  setFeedbacks,
  ajuda,
  setAjuda,
}: {
  session: Extract<Session, { tipo: "colaborador" }>;
  opcaoNeg: OpcaoNeg | null;
  setOpcaoNeg: (o: OpcaoNeg) => void;
  feedbacks: ReturnType<typeof useFeedbacks>[0];
  setFeedbacks: ReturnType<typeof useFeedbacks>[1];
  ajuda: ReturnType<typeof useAjuda>[0];
  setAjuda: ReturnType<typeof useAjuda>[1];
}) {
  return (
    <div className="rounded-2xl border border-destructive/40 bg-destructive/5 px-4 py-4">
      <p className="font-semibold text-destructive">
        Hoje está difícil — tudo bem falar sobre isso.
      </p>
      <p className="mt-0.5 text-sm text-muted-foreground">Como você prefere?</p>

      {!opcaoNeg && (
        <div className="mt-3 grid gap-2">
          <Button
            variant="outline"
            className="h-auto w-full justify-start rounded-2xl border-destructive/30 px-4 py-3 text-left hover:bg-destructive/5"
            onClick={() => {
              setFeedbacks([
                {
                  id: uid(),
                  tipo: "Situação urgente",
                  mensagem: `${session.nome} sinalizou que está passando por um momento difícil e gostaria de conversar.`,
                  anonimo: false,
                  autor: session.nome,
                  filial: session.filial,
                  ts: Date.now(),
                },
                ...feedbacks,
              ]);
              setOpcaoNeg("gestor");
            }}
          >
            <span className="grid gap-0.5">
              <span className="font-semibold">Conversar com meu gestor</span>
              <span className="text-xs font-normal text-muted-foreground">
                Seu gestor vai saber que você pediu uma conversa.
              </span>
            </span>
          </Button>
          <Button
            variant="outline"
            className="h-auto w-full justify-start rounded-2xl border-destructive/30 px-4 py-3 text-left hover:bg-destructive/5"
            onClick={() => {
              setAjuda([
                {
                  id: uid(),
                  nome: session.nome,
                  filial: session.filial,
                  assunto: "Apoio - check-in negativo",
                  ts: Date.now(),
                },
                ...ajuda,
              ]);
              setOpcaoNeg("azumi");
              window.open(
                `https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(
                  `Olá, equipe Azumi RH! Sou do Ken Taki, unidade ${filialNome(session.filial)}, e estou passando por um momento difícil. Gostaria de conversar.`,
                )}`,
                "_blank",
              );
            }}
          >
            <span className="grid gap-0.5">
              <span className="font-semibold">Falar com a equipe Azumi</span>
              <span className="text-xs font-normal text-muted-foreground">
                Conversa privada — seu gestor não é identificado.
              </span>
            </span>
          </Button>
          <Button
            variant="ghost"
            className="h-auto w-full justify-start rounded-2xl px-4 py-3 text-left text-muted-foreground"
            onClick={() => setOpcaoNeg("nao-agora")}
          >
            Prefiro não falar agora
          </Button>
        </div>
      )}

      {opcaoNeg && (
        <div className="mt-3 grid gap-3">
          <p className="text-sm text-muted-foreground">
            {opcaoNeg === "gestor" &&
              "Seu gestor foi notificado. Quando quiser, fale também com a equipe Azumi:"}
            {opcaoNeg === "azumi" && "Pedido registrado. Se o WhatsApp não abriu automaticamente:"}
            {opcaoNeg === "nao-agora" && "Tudo bem. Quando você precisar, a Azumi está disponível:"}
          </p>
          <BotaoWa session={session} assunto={`WhatsApp pós check-in negativo (${opcaoNeg})`} />
        </div>
      )}

      <CvvInfo />
    </div>
  );
}

export function CheckIn({ session }: { session: Extract<Session, { tipo: "colaborador" }> }) {
  const [checkins, setCheckins] = useCheckins();
  const [feedbacks, setFeedbacks] = useFeedbacks();
  const [ajuda, setAjuda] = useAjuda();

  const hoje = new Date().toDateString();
  const hojeCheckins = checkins
    .filter((c) => c.nome === session.nome && new Date(c.ts).toDateString() === hoje)
    .sort((a, b) => b.ts - a.ts);

  const [humor, setHumor] = useState<string>("");
  const [recado, setRecado] = useState("");
  const [mostrarRecado, setMostrarRecado] = useState(false);
  const [opcaoNeg, setOpcaoNeg] = useState<OpcaoNeg | null>(null);
  const [enviado, setEnviado] = useState(false);

  const humorObj = HUMORES.find((h) => h.id === humor);
  const categoria = humorObj?.categoria;

  const selecionarHumor = (id: string) => {
    if (humor !== id) {
      setOpcaoNeg(null);
      setEnviado(false);
    }
    setHumor(id);
  };

  const enviar = () => {
    if (!humor) return;
    if (categoria === "positiva") dispararConfete();
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
    setEnviado(true);
    setRecado("");
    setMostrarRecado(false);
  };

  const frasePosIdx = hojeCheckins.length % FRASES_POSITIVAS.length;
  const frasePos = FRASES_POSITIVAS[frasePosIdx] ?? FRASES_POSITIVAS[0]!;

  return (
    <Section
      titulo={`Olá, ${session.nome.split(" ")[0]}!`}
      intro="Conta pra gente: como você está hoje? Sem certo ou errado — é só pra sua liderança entender o clima do time."
      contagem="Leva 20 segundos"
    >
      <div className="grid gap-4">
        {/* Histórico de check-ins hoje */}
        {hojeCheckins.length > 0 && (
          <div className="rounded-2xl border border-border bg-muted/50 px-4 py-3 text-sm">
            <p className="font-medium">
              {hojeCheckins.length === 1
                ? "Você já fez um check-in hoje."
                : `Você fez ${hojeCheckins.length} check-ins hoje.`}
            </p>
            <div className="mt-2 grid gap-1">
              {hojeCheckins.map((c) => {
                const h = HUMORES.find((x) => x.id === c.humor);
                return (
                  <span key={c.id} className="text-muted-foreground">
                    {h?.emoji} {h?.label} ·{" "}
                    {new Date(c.ts).toLocaleTimeString("pt-BR", {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                    {c.recado ? <em className="ml-1">"{c.recado}"</em> : null}
                  </span>
                );
              })}
            </div>
            <p className="mt-2 text-muted-foreground">Quer registrar como está agora?</p>
          </div>
        )}

        {/* Confirmação pós-envio (positivo) */}
        {enviado && categoria === "positiva" && (
          <div className="rounded-2xl bg-success-soft px-4 py-4">
            <p className="font-semibold">
              {humorObj?.emoji} Check-in registrado — {humorObj?.label}!
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">{frasePos}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3 rounded-full"
              onClick={() => {
                setHumor("");
                setEnviado(false);
                document.getElementById("mural")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              Deixar um recado no mural
            </Button>
          </div>
        )}

        {/* Confirmação pós-envio (neutro) */}
        {enviado && categoria === "neutra" && (
          <div className="rounded-2xl bg-warn-soft px-4 py-4">
            <p className="font-semibold">
              {humorObj?.emoji} Check-in registrado — {humorObj?.label}.
            </p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Tudo bem não estar 100%. Se quiser conversar, a Azumi está aqui.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setAjuda([
                    {
                      id: uid(),
                      nome: session.nome,
                      filial: session.filial,
                      assunto: "Apoio - check-in neutro",
                      ts: Date.now(),
                    },
                    ...ajuda,
                  ]);
                  window.open(
                    `https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(
                      `Olá, equipe Azumi RH! Sou ${session.nome} do Ken Taki, unidade ${filialNome(session.filial)}. Quero conversar um pouco.`,
                    )}`,
                    "_blank",
                  );
                }}
              >
                <MessageCircle className="h-4 w-4" /> Quero falar com a equipe Azumi
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setHumor("");
                  setEnviado(false);
                  toast.success("Tudo bem! Bom turno por aí.");
                }}
              >
                Tudo bem, seguir em frente
              </Button>
            </div>
          </div>
        )}

        {/* Confirmação pós-envio (negativo) - só aviso que foi registrado, o bloco de apoio já está visível */}
        {enviado && categoria === "negativa" && (
          <div className="rounded-2xl border border-destructive/20 bg-destructive/5 px-4 py-3">
            <p className="text-sm font-medium text-destructive">
              {humorObj?.emoji} Check-in registrado — as opções de apoio estão logo abaixo.
            </p>
          </div>
        )}

        {/* Grade de emojis — sempre visível enquanto não enviou positivo/neutro */}
        {!(enviado && (categoria === "positiva" || categoria === "neutra")) && (
          <>
            <div className="grid grid-cols-5 gap-2 sm:max-w-lg">
              {HUMORES.map((h) => {
                const isSelected = humor === h.id;
                const selectedClass = isSelected
                  ? h.categoria === "positiva"
                    ? "border-success bg-success-soft shadow-[var(--shadow-soft)]"
                    : h.categoria === "neutra"
                      ? "border-warn bg-warn-soft shadow-[var(--shadow-soft)]"
                      : "border-destructive bg-destructive/10 shadow-[var(--shadow-soft)]"
                  : "border-border bg-card hover:border-kt/40";
                return (
                  <button
                    key={h.id}
                    onClick={() => selecionarHumor(h.id)}
                    className={`rounded-2xl border px-1 py-3 text-center transition-all ${selectedClass}`}
                  >
                    <span className="block text-2xl">{h.emoji}</span>
                    <span className="mt-1 block text-[11px] font-medium leading-tight">
                      {h.label}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Bloco de apoio negativo — aparece ao selecionar emoji negativo */}
            {humor && categoria === "negativa" && (
              <BlocoNegativo
                session={session}
                opcaoNeg={opcaoNeg}
                setOpcaoNeg={setOpcaoNeg}
                feedbacks={feedbacks}
                setFeedbacks={setFeedbacks}
                ajuda={ajuda}
                setAjuda={setAjuda}
              />
            )}

            {/* Botão opcional de comentário */}
            {humor && !enviado && (
              <div>
                {!mostrarRecado ? (
                  <button
                    className="flex items-center gap-1 text-sm text-muted-foreground underline-offset-2 hover:text-foreground hover:underline"
                    onClick={() => setMostrarRecado(true)}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                    Deixar um comentário (opcional)
                  </button>
                ) : (
                  <div className="grid gap-1.5">
                    <button
                      className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
                      onClick={() => {
                        setMostrarRecado(false);
                        setRecado("");
                      }}
                    >
                      <ChevronUp className="h-3.5 w-3.5" />
                      Fechar comentário
                    </button>
                    <Textarea
                      placeholder="O que você quer compartilhar? (opcional)"
                      value={recado}
                      onChange={(e) => setRecado(e.target.value)}
                      maxLength={400}
                      rows={2}
                      className="text-sm"
                    />
                  </div>
                )}
              </div>
            )}

            {/* Botão de envio */}
            {humor && !enviado && (
              <div>
                <Button className="rounded-full" size="lg" onClick={enviar}>
                  Enviar — {humorObj?.emoji} {humorObj?.label}
                </Button>
              </div>
            )}

            {/* Botão para novo check-in após envio */}
            {enviado && categoria === "negativa" && (
              <Button
                variant="ghost"
                size="sm"
                className="w-fit rounded-full text-muted-foreground"
                onClick={() => {
                  setHumor("");
                  setEnviado(false);
                  setOpcaoNeg(null);
                }}
              >
                Alterar resposta
              </Button>
            )}
          </>
        )}

        {/* Botão "novo check-in" quando positivo/neutro já foi enviado */}
        {enviado && (categoria === "positiva" || categoria === "neutra") && (
          <button
            className="w-fit text-sm text-muted-foreground underline-offset-2 hover:underline"
            onClick={() => {
              setHumor("");
              setEnviado(false);
              setOpcaoNeg(null);
            }}
          >
            Registrar de novo mais tarde
          </button>
        )}
      </div>
    </Section>
  );
}
