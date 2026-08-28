import { CakeSlice, ChevronDown, ChevronUp, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { Avatar } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { diaMes, filialNome } from "@/lib/kt-data";
import { uid, useBdayMsgs, useColaboradores, useSession } from "@/lib/kt-store";

const REACTIONS = ["🎉", "🎂", "❤️", "🥳"] as const;

function isDemoName(name: string) {
  return name.toUpperCase().includes("DEMO");
}

export function EmployeeBirthdayFeed() {
  const [session] = useSession();
  const [colaboradores] = useColaboradores();
  const [messages, setMessages] = useBdayMsgs();
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [showAll, setShowAll] = useState(false);
  const [messageTarget, setMessageTarget] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");

  const birthdays = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return [];
    const month = new Date().getMonth();
    return colaboradores
      .filter((person) => {
        if (!person.ativo || person.filial !== session.filial || !person.nascimento) return false;
        const birthDate = new Date(`${person.nascimento}T12:00:00`);
        return !Number.isNaN(birthDate.getTime()) && birthDate.getMonth() === month;
      })
      .sort((a, b) => {
        const demoDifference = Number(isDemoName(b.nome)) - Number(isDemoName(a.nome));
        if (demoDifference !== 0) return demoDifference;
        return a.nascimento.slice(5).localeCompare(b.nascimento.slice(5));
      });
  }, [colaboradores, session]);

  useEffect(() => {
    if (birthdays.length === 0) {
      setHost(null);
      return;
    }

    const mural = document.getElementById("mural");
    if (!mural) return;

    let slot = document.getElementById("employee-birthdays-slot");
    let created = false;
    if (!slot) {
      slot = document.createElement("div");
      slot.id = "employee-birthdays-slot";
      slot.className = "scroll-mt-24";
      mural.insertAdjacentElement("afterend", slot);
      created = true;
    }
    setHost(slot);

    return () => {
      setHost(null);
      if (created) slot?.remove();
    };
  }, [birthdays.length]);

  if (!session || session.tipo !== "colaborador" || birthdays.length === 0 || !host) return null;

  const visible = showAll ? birthdays : birthdays.slice(0, 2);

  const content = (
    <section id="aniversariantes" className="mt-6 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-3 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kt-soft text-kt">
            <CakeSlice className="h-5 w-5" />
          </span>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Celebrações</p>
            <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-foreground sm:text-xl">Aniversariantes do mês</h2>
            <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
              Celebre quem faz aniversário este mês na unidade {filialNome(session.filial)}.
            </p>
          </div>
        </div>
        <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
          {birthdays.length} este mês
        </span>
      </header>

      <div className="grid gap-3 px-5 py-5 sm:px-6 sm:py-6">
        {visible.map((person) => {
          const reactions = messages.filter((item) => item.paraId === person.id && item.mensagem === "__reacao__");
          const congratulations = messages
            .filter((item) => item.paraId === person.id && item.mensagem !== "__reacao__")
            .sort((a, b) => b.ts - a.ts);
          const writing = messageTarget === person.id;

          return (
            <article key={person.id} className="rounded-xl border border-border bg-background p-4 sm:p-5">
              <div className="flex items-start gap-4 sm:gap-5">
                <div className="shrink-0">
                  {person.foto ? (
                    <img
                      src={person.foto}
                      alt={person.nome}
                      loading="lazy"
                      className="h-20 w-20 rounded-xl object-cover ring-1 ring-border sm:h-24 sm:w-24"
                    />
                  ) : (
                    <div className="grid h-20 w-20 place-items-center rounded-xl bg-card ring-1 ring-border sm:h-24 sm:w-24">
                      <Avatar nome={person.nome} size={64} />
                    </div>
                  )}
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="text-base font-extrabold text-foreground">🎂 {person.nome.replace(/\s*·\s*DEMO$/i, "")}</p>
                      <p className="mt-1 text-lg font-black text-kt">{diaMes(person.nascimento)}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {person.cargo || "Colaborador(a)"} · {filialNome(person.filial)}
                      </p>
                    </div>
                    {isDemoName(person.nome) ? (
                      <span className="rounded-full bg-kt-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-kt">Demo</span>
                    ) : null}
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    Hoje o espaço é para celebrar. Deixe uma reação ou uma mensagem para tornar o mês dessa pessoa ainda mais especial.
                  </p>

                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    {REACTIONS.map((emoji) => {
                      const mine = reactions.find((item) => item.de === session.nome && item.emoji === emoji);
                      const count = reactions.filter((item) => item.emoji === emoji).length;
                      return (
                        <button
                          key={emoji}
                          type="button"
                          aria-pressed={Boolean(mine)}
                          onClick={() => {
                            if (mine) {
                              setMessages((current) => current.filter((item) => item.id !== mine.id));
                            } else {
                              setMessages((current) => [
                                ...current,
                                { id: uid(), paraId: person.id, de: session.nome, emoji, mensagem: "__reacao__", ts: Date.now() },
                              ]);
                            }
                          }}
                          className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors ${
                            mine ? "border-kt/30 bg-kt-soft text-kt" : "border-border bg-card text-muted-foreground hover:bg-muted"
                          }`}
                        >
                          <span className="text-base">{emoji}</span>{count > 0 ? <span>{count}</span> : null}
                        </button>
                      );
                    })}
                    <button
                      type="button"
                      onClick={() => {
                        setMessageTarget(writing ? null : person.id);
                        setMessageText("");
                      }}
                      className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
                    >
                      <MessageCircle className="h-3.5 w-3.5" /> Deixar mensagem
                    </button>
                  </div>

                  {congratulations.length > 0 ? (
                    <div className="mt-3 grid gap-1.5">
                      {congratulations.slice(0, 2).map((item) => (
                        <div key={item.id} className="rounded-lg bg-muted/45 px-3 py-2 text-xs leading-relaxed">
                          <strong>{item.de}:</strong> <span className="text-muted-foreground">{item.emoji} {item.mensagem}</span>
                        </div>
                      ))}
                    </div>
                  ) : null}

                  {writing ? (
                    <div className="mt-3 grid gap-2 rounded-lg border border-border bg-card p-3">
                      <Textarea
                        rows={2}
                        maxLength={220}
                        value={messageText}
                        onChange={(event) => setMessageText(event.target.value)}
                        placeholder={`Escreva uma mensagem para ${person.nome.split(" ")[0]}...`}
                      />
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          disabled={!messageText.trim()}
                          onClick={() => {
                            if (!messageText.trim()) return;
                            setMessages((current) => [
                              ...current,
                              { id: uid(), paraId: person.id, de: session.nome, emoji: "🎉", mensagem: messageText.trim(), ts: Date.now() },
                            ]);
                            setMessageText("");
                            setMessageTarget(null);
                          }}
                        >
                          Enviar parabéns
                        </Button>
                        <Button size="sm" variant="ghost" onClick={() => { setMessageTarget(null); setMessageText(""); }}>
                          Cancelar
                        </Button>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </article>
          );
        })}

        {birthdays.length > 2 ? (
          <button
            type="button"
            onClick={() => setShowAll((current) => !current)}
            className="mx-auto inline-flex min-h-9 items-center gap-1.5 rounded-full px-3 text-xs font-bold text-kt hover:bg-kt-soft"
          >
            {showAll ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {showAll ? "Mostrar somente dois" : `Ver todos os ${birthdays.length} aniversariantes`}
          </button>
        ) : null}
      </div>
    </section>
  );

  return createPortal(content, host);
}
