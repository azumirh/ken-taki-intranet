import { CakeSlice, ChevronRight, MessageCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { toast } from "sonner";
import { Avatar } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { diaMes, filialNome } from "@/lib/kt-data";
import { uid, useBdayMsgs, useSession } from "@/lib/kt-store";
import { supabase } from "@/lib/supabase";

const REACTIONS = ["🎉", "🎂", "❤️", "🥳"] as const;

type BirthdayPerson = {
  id: string;
  nome: string;
  cargo: string;
  filial: string;
  nascimento: string;
  foto: string | null;
};

function isDemoName(name: string) {
  return name.toUpperCase().includes("DEMO");
}

function birthdayDay(value: string) {
  const day = Number(value.slice(8, 10));
  return Number.isFinite(day) ? day : 0;
}

export function EmployeeBirthdayFeed() {
  const [session] = useSession();
  const [messages, setMessages] = useBdayMsgs();
  const [birthdays, setBirthdays] = useState<BirthdayPerson[]>([]);
  const [host, setHost] = useState<HTMLElement | null>(null);
  const [messageTarget, setMessageTarget] = useState<string | null>(null);
  const [messageText, setMessageText] = useState("");
  const [openMessagesFor, setOpenMessagesFor] = useState<string | null>(null);
  const [reactionSavingFor, setReactionSavingFor] = useState<string | null>(null);

  useEffect(() => {
    if (!session || session.tipo !== "colaborador") {
      setBirthdays([]);
      return;
    }

    let cancelled = false;
    void supabase
      .rpc("kt_employee_month_birthdays")
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.warn("[employee-birthdays] load", error.message);
          setBirthdays([]);
          return;
        }

        const rows = ((data ?? []) as BirthdayPerson[])
          .filter((person) => person.filial === session.filial && Boolean(person.nascimento))
          .sort((a, b) => birthdayDay(b.nascimento) - birthdayDay(a.nascimento));
        setBirthdays(rows);
      });

    return () => {
      cancelled = true;
    };
  }, [session]);

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

  return createPortal(
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
        <div className="flex items-center gap-3">
          {birthdays.length > 2 ? (
            <span className="hidden items-center gap-1 text-[11px] font-semibold text-muted-foreground md:inline-flex">
              Role para ver os demais <ChevronRight className="h-3.5 w-3.5" />
            </span>
          ) : null}
          <span className="w-fit rounded-full bg-muted px-2.5 py-1 text-[11px] font-bold text-muted-foreground">
            {birthdays.length} este mês
          </span>
        </div>
      </header>

      <div className="overflow-x-auto overscroll-x-contain px-5 py-5 sm:px-6 sm:py-6 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="flex snap-x snap-mandatory gap-3">
          {birthdays.map((person) => {
            const reactions = messages.filter((item) => item.paraId === person.id && item.mensagem === "__reacao__");
            const myReaction = reactions.find((item) => item.de === session.nome);
            const congratulations = messages
              .filter((item) => item.paraId === person.id && item.mensagem !== "__reacao__")
              .sort((a, b) => b.ts - a.ts);
            const writing = messageTarget === person.id;
            const showingMessages = openMessagesFor === person.id;
            const savingReaction = reactionSavingFor === person.id;

            return (
              <article
                key={person.id}
                className="min-w-[90%] snap-start rounded-xl border border-border bg-background p-4 sm:min-w-[calc(50%-0.375rem)] sm:max-w-[calc(50%-0.375rem)] sm:p-5"
              >
                <div className="flex items-start gap-4">
                  <div className="shrink-0">
                    {person.foto ? (
                      <img
                        src={person.foto}
                        alt={person.nome}
                        loading="lazy"
                        className="h-28 w-28 rounded-2xl object-cover ring-1 ring-border sm:h-32 sm:w-32"
                      />
                    ) : (
                      <div className="grid h-28 w-28 place-items-center rounded-2xl bg-card ring-1 ring-border sm:h-32 sm:w-32">
                        <Avatar nome={person.nome} size={78} />
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="truncate text-base font-extrabold text-foreground">🎂 {person.nome.replace(/\s*·\s*DEMO$/i, "")}</p>
                        <p className="mt-1 text-xl font-black tracking-tight text-kt">{diaMes(person.nascimento)}</p>
                        <p className="mt-1 text-sm leading-snug text-muted-foreground">
                          {person.cargo || "Colaborador(a)"} · {filialNome(person.filial)}
                        </p>
                      </div>
                      {isDemoName(person.nome) ? (
                        <span className="shrink-0 rounded-full bg-kt-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-kt">Demo</span>
                      ) : null}
                    </div>

                    <div className="mt-4 flex flex-wrap items-center gap-2">
                      {REACTIONS.map((emoji) => {
                        const mine = myReaction?.emoji === emoji;
                        const count = reactions.filter((item) => item.emoji === emoji).length;
                        return (
                          <button
                            key={emoji}
                            type="button"
                            disabled={savingReaction}
                            aria-pressed={mine}
                            onClick={async () => {
                              const nextEmoji = mine ? null : emoji;
                              setReactionSavingFor(person.id);
                              const { error } = await supabase.rpc("kt_set_birthday_reaction", {
                                p_para_id: person.id,
                                p_emoji: nextEmoji,
                              });
                              setReactionSavingFor(null);

                              if (error) {
                                toast.error("Não foi possível salvar sua reação.");
                                return;
                              }

                              setMessages((current) => {
                                const withoutMine = current.filter(
                                  (item) =>
                                    !(
                                      item.paraId === person.id &&
                                      item.de === session.nome &&
                                      item.mensagem === "__reacao__"
                                    ),
                                );
                                if (!nextEmoji) return withoutMine;
                                return [
                                  ...withoutMine,
                                  {
                                    id: uid(),
                                    paraId: person.id,
                                    de: session.nome,
                                    emoji: nextEmoji,
                                    mensagem: "__reacao__",
                                    ts: Date.now(),
                                  },
                                ];
                              });
                            }}
                            className={`inline-flex min-h-8 items-center gap-1.5 rounded-full border px-2.5 text-xs font-semibold transition-colors disabled:cursor-wait disabled:opacity-60 ${
                              mine ? "border-kt/30 bg-kt-soft text-kt" : "border-border bg-card text-muted-foreground hover:bg-muted"
                            }`}
                          >
                            <span className="text-base">{emoji}</span>
                            {count > 0 ? <span>{count}</span> : null}
                          </button>
                        );
                      })}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setMessageTarget(writing ? null : person.id);
                          setMessageText("");
                          setOpenMessagesFor(null);
                        }}
                        className="inline-flex min-h-8 items-center gap-1.5 rounded-full border border-border bg-card px-3 text-xs font-bold text-foreground hover:bg-muted"
                      >
                        <MessageCircle className="h-3.5 w-3.5" /> Deixar mensagem
                      </button>

                      {congratulations.length > 0 ? (
                        <button
                          type="button"
                          onClick={() => {
                            setOpenMessagesFor(showingMessages ? null : person.id);
                            setMessageTarget(null);
                            setMessageText("");
                          }}
                          className="inline-flex min-h-8 items-center rounded-full px-2.5 text-xs font-bold text-kt hover:bg-kt-soft"
                        >
                          {congratulations.length} {congratulations.length === 1 ? "mensagem" : "mensagens"} de parabéns
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>

                {showingMessages ? (
                  <div className="mt-4 grid gap-1.5 border-t border-border pt-3">
                    {congratulations.slice(0, 4).map((item) => (
                      <div key={item.id} className="rounded-lg bg-muted/45 px-3 py-2 text-xs leading-relaxed">
                        <strong>{item.de}:</strong>{" "}
                        <span className="text-muted-foreground">{item.emoji} {item.mensagem}</span>
                      </div>
                    ))}
                  </div>
                ) : null}

                {writing ? (
                  <div className="mt-4 grid gap-2 border-t border-border pt-3">
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
              </article>
            );
          })}
        </div>
      </div>
    </section>,
    host,
  );
}
