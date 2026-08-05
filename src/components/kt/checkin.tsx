import confetti from "canvas-confetti";
import { useState } from "react";
import { MessageCircle } from "lucide-react";
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

export function CheckIn({ session }: { session: Extract<Session, { tipo: "colaborador" }> }) {
  const [checkins, setCheckins] = useCheckins();
  const [feedbacks, setFeedbacks] = useFeedbacks();
  const [ajuda, setAjuda] = useAjuda();

  const hoje = new Date().toDateString();
  const feito = checkins.find(
    (c) => c.nome === session.nome && new Date(c.ts).toDateString() === hoje,
  );

  const [humor, setHumor] = useState<string>("");
  const [recado, setRecado] = useState("");
  const [opcaoNeg, setOpcaoNeg] = useState<OpcaoNeg | null>(null);

  // ─── Já fez o check-in hoje ────────────────────────────────
  if (feito) {
    const h = HUMORES.find((x) => x.id === feito.humor);
    const cat = h?.categoria;
    const frase = FRASES_POSITIVAS[feito.ts % FRASES_POSITIVAS.length] ?? FRASES_POSITIVAS[0]!;

    return (
      <Section
        titulo={`Olá, ${session.nome.split(" ")[0]}!`}
        intro="Seu check-in de hoje já está registrado."
        contagem="Check-in feito"
      >
        <div className="grid gap-4">
          <div
            className={`flex flex-wrap items-center gap-3 rounded-2xl px-4 py-4 ${
              cat === "positiva"
                ? "bg-success-soft"
                : cat === "negativa"
                  ? "border border-border bg-card"
                  : "bg-warn-soft"
            }`}
          >
            <span className="text-3xl">{h?.emoji}</span>
            <div className="min-w-0">
              <p className="font-semibold">Hoje você está: {h?.label}</p>
              {cat === "positiva" && <p className="text-sm text-muted-foreground">{frase}</p>}
              {cat === "neutra" && (
                <p className="text-sm text-muted-foreground">
                  Tudo bem não estar 100%. Se quiser conversar, a Azumi está aqui.
                </p>
              )}
              {cat === "negativa" && (
                <p className="text-sm text-muted-foreground">
                  Hoje está difícil — tudo bem falar sobre isso. Como você prefere?
                </p>
              )}
            </div>
          </div>

          {/* Positivo: botão do mural */}
          {cat === "positiva" && (
            <Button
              variant="outline"
              className="w-fit rounded-full"
              onClick={() =>
                document.getElementById("mural")?.scrollIntoView({ behavior: "smooth" })
              }
            >
              Deixar um recado no mural
            </Button>
          )}

          {/* Neutro: duas opções */}
          {cat === "neutra" && (
            <div className="flex flex-wrap gap-3">
              <Button
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
                className="rounded-full"
                onClick={() => toast.success("Tudo bem! Bom turno por aí.")}
              >
                Tudo bem, seguir em frente
              </Button>
            </div>
          )}

          {/* Negativo: três escolhas */}
          {cat === "negativa" && !opcaoNeg && (
            <div className="grid max-w-md gap-2">
              <Button
                variant="outline"
                className="h-auto w-full justify-start rounded-2xl px-4 py-3 text-left"
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
                className="h-auto w-full justify-start rounded-2xl px-4 py-3 text-left"
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

          {/* Negativo: após escolha — mostra WhatsApp em todos os casos */}
          {cat === "negativa" && opcaoNeg && (
            <div className="grid gap-3">
              <p className="text-sm text-muted-foreground">
                {opcaoNeg === "gestor" &&
                  "Seu gestor já foi notificado. Quando quiser, fale também com a equipe Azumi pelo WhatsApp:"}
                {opcaoNeg === "azumi" &&
                  "Pedido registrado. Se o WhatsApp não abriu automaticamente, use o botão abaixo:"}
                {opcaoNeg === "nao-agora" &&
                  "Tudo bem. Quando você precisar, a equipe Azumi está disponível pelo WhatsApp:"}
              </p>
              <BotaoWa session={session} assunto={`WhatsApp pós check-in negativo (${opcaoNeg})`} />
            </div>
          )}
        </div>
      </Section>
    );
  }

  // ─── Ainda não fez o check-in ──────────────────────────────
  const humorObj = HUMORES.find((h) => h.id === humor);

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
              if (humorObj?.categoria === "positiva") dispararConfete();
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
            }}
          >
            {humor ? `Enviar — ${humorObj?.emoji} ${humorObj?.label}` : "Selecione como você está"}
          </Button>
        </div>
      </div>
    </Section>
  );
}
