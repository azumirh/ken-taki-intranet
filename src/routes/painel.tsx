import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Inbox, Mail, MessageCircle } from "lucide-react";
import { AppShell } from "@/components/kt/app-shell";
import { Avatar, EmptyState, Section } from "@/components/kt/section";
import { CheckIn } from "@/components/kt/checkin";
import { Documentos } from "@/components/kt/politicas";
import { Mural } from "@/components/kt/mural";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  AZUMI_CONTACT,
  FEEDBACK_TIPOS,
  HUMORES,
  SUGESTAO_CATEGORIAS,
  diaMes,
  filialNome,
  idade,
  youtubeEmbed,
} from "@/lib/kt-data";
import {
  uid,
  useAjuda,
  useAssinaturas,
  useBdayMsgs,
  useCheckins,
  useColaboradores,
  useDocumentos,
  useFeedbacks,
  useLeituras,
  useMural,
  useNoticias,
  usePesquisa,
  useSession,
  useSugestoes,
} from "@/lib/kt-store";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Meu painel · Portal Azumi RH" },
      {
        name: "description",
        content:
          "Check-in do dia, políticas, mural da equipe, aniversariantes, sugestões e feedback ao gestor em uma única página.",
      },
      { property: "og:title", content: "Meu painel · Portal Azumi RH" },
      {
        property: "og:description",
        content: "Tudo do seu dia a dia no Ken Taki em uma página só.",
      },
    ],
  }),
  component: Painel,
});

const SUG_DICAS: Record<string, string> = {
  Gestão: "Ex.: liderança, comunicação, processos internos",
  Operação: "Ex.: fluxo de trabalho, materiais, espaço físico",
  "Colaboradores / time": "Ex.: clima entre colegas, integração, reconhecimento",
  "Equipe Azumi RH": "Ex.: suporte de RH, benefícios, treinamentos",
};

const FB_DESC: Record<string, string> = {
  Elogio: "Reconheça algo ou alguém que fez a diferença",
  Crítica: "Aponte algo que pode melhorar — construtivo e bem-vindo",
  Dúvida: "Uma pergunta que ainda não tem resposta",
  "Situação urgente": "Algo que precisa de atenção imediata da gestão",
};

function calcDestino(tipo: string, anonimo: boolean): "gestor" | "azumi" {
  if (anonimo && (tipo === "Crítica" || tipo === "Situação urgente")) return "azumi";
  return "gestor";
}

function Chips({
  opcoes,
  valor,
  onChange,
}: {
  opcoes: readonly string[];
  valor: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {opcoes.map((o) => (
        <button
          key={o}
          onClick={() => onChange(o)}
          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
            valor === o ? "border-kt bg-kt-soft text-kt" : "border-border bg-card hover:bg-muted"
          }`}
        >
          {o}
        </button>
      ))}
    </div>
  );
}

function Painel() {
  const navigate = useNavigate();
  const [session, , sessaoPronta] = useSession();
  const [sugestoes, setSugestoes] = useSugestoes();
  const [feedbacks, setFeedbacks] = useFeedbacks();
  const [pesquisa, setPesquisa] = usePesquisa();
  const [noticias] = useNoticias();
  const [ajuda, setAjuda] = useAjuda();
  const [checkins] = useCheckins();
  const [mural] = useMural();

  const [documentos] = useDocumentos();
  const [assinaturas] = useAssinaturas();
  const [leituras] = useLeituras();

  const [colaboradores] = useColaboradores();
  const [bdayMsgs, setBdayMsgs] = useBdayMsgs();
  const [sugCat, setSugCat] = useState(SUGESTAO_CATEGORIAS[0]!);
  const [sugMsg, setSugMsg] = useState("");
  const [sugEnviado, setSugEnviado] = useState(false);
  const [fbTipo, setFbTipo] = useState(FEEDBACK_TIPOS[0]!);
  const [fbAnon, setFbAnon] = useState(true);
  const [fbMsg, setFbMsg] = useState("");
  const [fbEnviado, setFbEnviado] = useState(false);
  const [fbIdEnviado, setFbIdEnviado] = useState<string | null>(null);
  const [fbAceitaContato, setFbAceitaContato] = useState<boolean | null>(null);
  const [fbContatoTexto, setFbContatoTexto] = useState("");
  const [histFiltroData, setHistFiltroData] = useState("");
  const [bdayMsgParaId, setBdayMsgParaId] = useState<string | null>(null);
  const [bdayMsgTexto, setBdayMsgTexto] = useState("");
  const [bdayMsgEmoji, setBdayMsgEmoji] = useState("🎉");
  const [minhasSugIds, setMinhasSugIds] = useState<string[]>([]);
  const [meusFbIds, setMeusFbIds] = useState<string[]>([]);

  useEffect(() => {
    if (sessaoPronta && session === null) navigate({ to: "/colaborador" });
  }, [sessaoPronta, session, navigate]);

  if (!session || session.tipo !== "colaborador") return null;

  const hoje = new Date().toDateString();
  const hojeNegativas = checkins.filter(
    (c) =>
      c.nome === session.nome &&
      new Date(c.ts).toDateString() === hoje &&
      HUMORES.find((h) => h.id === c.humor)?.categoria === "negativa",
  );
  const alertaCritico = hojeNegativas.length >= 2;

  const mes = new Date().getMonth();
  const aniversariantes = colaboradores
    .filter(
      (c) => c.filial === session.filial && new Date(c.nascimento + "T00:00:00").getMonth() === mes,
    )
    .sort((a, b) => a.nascimento.slice(5).localeCompare(b.nascimento.slice(5)));

  const docsFilial = documentos.filter((d) => d.filial === session.filial || d.filial === "todas");

  const itensFilial = mural.filter(
    (m) => !m.filial || m.filial === "todas" || m.filial === session.filial,
  );

  return (
    <AppShell>
      <div className="grid gap-5">
        {/* Header — nome + unidade em destaque */}
        <div className="text-center sm:text-left">
          <h1 className="text-3xl font-extrabold leading-tight sm:text-3xl">
            👋 Olá, {session.nome.split(" ")[0]}!
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Bem-vindo(a) à intranet do Ken Taki × Azumi RH
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <strong className="text-foreground">Ken Taki · {filialNome(session.filial)}</strong> ·
            CPF ***{session.cpf3}
          </p>
        </div>

        {/* Precisa de apoio — movida para o topo */}
        <div className="overflow-hidden rounded-2xl border border-az/20 bg-gradient-to-br from-az-soft to-az/10">
          <div className="flex flex-col items-center gap-2 border-b border-az/20 px-5 py-4 text-center sm:flex-row sm:items-center sm:gap-3 sm:px-7 sm:text-left">
            <MessageCircle className="h-5 w-5 shrink-0 text-az" />
            <div className="min-w-0">
              <h2 className="font-bold text-az">Precisa de apoio?</h2>
              <p className="text-xs text-muted-foreground">
                Fale com a equipe Azumi RH — seu gestor não é identificado.
              </p>
            </div>
          </div>
          <div className="grid gap-3 px-4 py-5 sm:flex sm:flex-wrap sm:justify-start sm:px-7">
            <Button
              className="w-full rounded-full bg-az text-white hover:bg-az/90 sm:w-auto"
              onClick={() => {
                setAjuda([
                  {
                    id: uid(),
                    nome: session.nome,
                    filial: session.filial,
                    assunto: "Apoio registrado (intranet)",
                    ts: Date.now(),
                  },
                  ...ajuda,
                ]);
                toast.success("Pedido registrado. A equipe Azumi entrará em contato.");
              }}
            >
              <MessageCircle className="h-4 w-4" />
              <span className="sm:hidden">Registrar apoio</span>
              <span className="hidden sm:inline">
                Registrar pedido de apoio com a equipe Azumi RH
              </span>
            </Button>
            <a
              href={`https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(
                `Olá, equipe Azumi RH! Sou do Ken Taki, unidade ${filialNome(session.filial)}, e gostaria de conversar.`,
              )}`}
              target="_blank"
              rel="noreferrer"
              onClick={() =>
                setAjuda([
                  {
                    id: uid(),
                    nome: session.nome,
                    filial: session.filial,
                    assunto: "WhatsApp - apoio",
                    ts: Date.now(),
                  },
                  ...ajuda,
                ])
              }
              className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 sm:w-auto"
            >
              <MessageCircle className="h-4 w-4" /> WhatsApp Azumi RH
            </a>
          </div>
        </div>


        {/* Alerta persistente: 2+ check-ins negativos no mesmo dia */}
        {alertaCritico && (
          <div className="rounded-2xl border border-destructive bg-destructive/5 px-5 py-4">
            <p className="font-bold text-destructive">
              Você está tendo um dia muito difícil — isso importa.
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Registramos que hoje está sendo pesado. Você não precisa enfrentar isso sozinho(a).
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                size="sm"
                className="rounded-full"
                onClick={() => {
                  setFeedbacks([
                    {
                      id: uid(),
                      tipo: "Situação urgente",
                      mensagem: `${session.nome} sinalizou múltiplos momentos difíceis hoje e gostaria de conversar com o gestor.`,
                      anonimo: false,
                      autor: session.nome,
                      filial: session.filial,
                      ts: Date.now(),
                    },
                    ...feedbacks,
                  ]);
                  toast.success("Seu gestor foi notificado.");
                }}
              >
                Avisar meu gestor
              </Button>
              <a
                href={`https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(
                  `Olá, equipe Azumi RH! Sou ${session.nome} do Ken Taki, unidade ${filialNome(session.filial)}. Estou passando por um dia muito difícil e preciso de apoio.`,
                )}`}
                target="_blank"
                rel="noreferrer"
                onClick={() =>
                  setAjuda([
                    {
                      id: uid(),
                      nome: session.nome,
                      filial: session.filial,
                      assunto: "Alerta crítico — 2+ negativos no dia",
                      ts: Date.now(),
                    },
                    ...ajuda,
                  ])
                }
                className="inline-flex items-center gap-2 rounded-full border border-az px-4 py-2 text-sm font-medium text-az transition-colors hover:bg-az-soft"
              >
                <MessageCircle className="h-4 w-4" /> Falar com a Azumi agora
              </a>
            </div>
          </div>
        )}

        <CheckIn session={session} />

        {/* Banner: leu mas não assinou */}
        {(() => {
          const pendentes = documentos.filter(
            (d) =>
              (d.filial === session.filial || d.filial === "todas") &&
              leituras.some((l) => l.documentoId === d.id && l.nome === session.nome) &&
              !assinaturas.some((a) => a.politica === d.id && a.nome === session.nome),
          );
          if (pendentes.length === 0) return null;
          return (
            <div className="rounded-2xl border border-warn bg-warn-soft px-4 py-3">
              <p className="text-sm font-semibold text-warn">
                Não esqueça de assinar{" "}
                {pendentes.length === 1
                  ? `"${pendentes[0]!.titulo}"`
                  : `${pendentes.length} documentos que você já abriu`}
                .
              </p>
              <button
                className="mt-1 text-xs text-muted-foreground underline-offset-2 hover:underline"
                onClick={() =>
                  document.getElementById("politicas")?.scrollIntoView({ behavior: "smooth" })
                }
              >
                Ver documentos pendentes
              </button>
            </div>
          );
        })()}

        <Documentos session={session} collapsible defaultOpen={docsFilial.length > 0} />

        <Mural
          filial={session.filial}
          autorPadrao={session.nome}
          collapsible
          defaultOpen={itensFilial.length > 0}
        />

        <Section
          titulo="Pesquisa de clima"
          intro="Publicada pela Azumi RH. Quando houver uma pesquisa ativa, ela aparece aqui."
          contagem={pesquisa?.ativa ? "1 ativa" : "Nenhuma ativa"}
          collapsible
          defaultOpen={!!pesquisa?.ativa}
        >
          {pesquisa?.ativa ? (
            (() => {
              const jaRespondeu = (pesquisa.respondeu ?? []).includes(session.nome);
              const dias = pesquisa.prazo
                ? Math.ceil(
                    (new Date(pesquisa.prazo + "T00:00:00").getTime() -
                      new Date().setHours(0, 0, 0, 0)) /
                      86400000,
                  )
                : null;
              return (
                <div className="rounded-2xl border border-az bg-az-soft p-5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <h3 className="font-bold">{pesquisa.titulo}</h3>
                      {pesquisa.categoria && (
                        <span className="mt-1 inline-block rounded-full bg-az px-2.5 py-1 text-[11px] font-bold text-white">
                          {pesquisa.categoria}
                        </span>
                      )}
                    </div>
                    <div className="flex flex-wrap items-center gap-2">
                      {jaRespondeu && (
                        <span className="shrink-0 rounded-full bg-success px-2.5 py-1 text-xs font-bold text-white">
                          ✓ Respondida
                        </span>
                      )}
                      {dias !== null && (
                        <span
                          className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                            dias <= 2
                              ? "bg-destructive/10 text-destructive"
                              : dias <= 5
                                ? "bg-warn-soft text-warn"
                                : "bg-success-soft text-success"
                          }`}
                        >
                          {dias > 0 ? `${dias} dias restantes` : "Prazo encerrado"}
                        </span>
                      )}
                    </div>
                  </div>
                  <p className="mt-1 text-sm text-muted-foreground">{pesquisa.descricao}</p>
                  {pesquisa.prazo && (
                    <p className="mt-1 text-xs text-muted-foreground">
                      Prazo:{" "}
                      {new Date(pesquisa.prazo + "T00:00:00").toLocaleDateString("pt-BR", {
                        day: "2-digit",
                        month: "long",
                        year: "numeric",
                      })}
                    </p>
                  )}
                  {pesquisa.link && !jaRespondeu && (
                    <div className="mt-4 grid gap-3">
                      <a
                        href={pesquisa.link}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex w-fit items-center gap-1.5 rounded-full bg-az px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
                      >
                        Abrir formulário <span className="text-base">→</span>
                      </a>
                      <div className="flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          className="rounded-full bg-success hover:bg-success/90"
                          onClick={() =>
                            setPesquisa({
                              ...pesquisa,
                              respondeu: [...(pesquisa.respondeu ?? []), session.nome],
                              respondeuTs: {
                                ...(pesquisa.respondeuTs ?? {}),
                                [session.nome]: Date.now(),
                              },
                            })
                          }
                        >
                          ✓ Já respondi
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="rounded-full text-muted-foreground"
                        >
                          Ainda não respondi
                        </Button>
                      </div>
                    </div>
                  )}
                  {jaRespondeu && (
                    <p className="mt-3 text-sm font-medium text-success">
                      ✓ Respondida
                      {pesquisa.respondeuTs?.[session.nome]
                        ? ` em ${new Date(pesquisa.respondeuTs[session.nome]!).toLocaleDateString("pt-BR", { day: "2-digit", month: "long" })}`
                        : ""}
                    </p>
                  )}
                </div>
              );
            })()
          ) : (
            <EmptyState>Nenhuma pesquisa de clima ativa no momento.</EmptyState>
          )}
        </Section>

        <Section
          titulo="Aniversariantes do mês"
          intro={`Quem faz aniversário este mês na unidade ${filialNome(session.filial)}.`}
          contagem={`${aniversariantes.length} este mês`}
          collapsible
          defaultOpen={aniversariantes.length > 0}
        >
          {aniversariantes.length === 0 ? (
            <EmptyState>Ninguém faz aniversário este mês por aqui.</EmptyState>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {aniversariantes.map((c, idx) => {
                const hoje = new Date();
                const aniversario = new Date(c.nascimento + "T00:00:00");
                const ehHoje =
                  aniversario.getDate() === hoje.getDate() &&
                  aniversario.getMonth() === hoje.getMonth();
                const idadeAnos = idade(c.nascimento) + 1;
                const msgsDoPerfil = bdayMsgs.filter((m) => m.paraId === c.id);
                const jaEnviouMsg = msgsDoPerfil.some((m) => m.de === session.nome);
                const borderColors = [
                  "border-kt/30 bg-gradient-to-br from-kt-soft via-white to-az-soft",
                  "border-az/30 bg-gradient-to-br from-az-soft via-white to-success-soft",
                  "border-success/30 bg-gradient-to-br from-success-soft via-white to-warn-soft",
                ];
                const cardClass = ehHoje
                  ? "border-kt/40 bg-gradient-to-br from-kt-soft via-az-soft to-kt-soft"
                  : (borderColors[idx % borderColors.length] ?? borderColors[0]!);
                return (
                  <div key={c.id} className={`overflow-hidden rounded-2xl border-2 ${cardClass}`}>
                    {/* Decoração */}
                    <div className="py-2 text-center text-xl">
                      {ehHoje ? "🎊 🎉 🎈 🎂 🎈 🎉 🎊" : "🎈 🎉 🎂 🎉 🎈"}
                    </div>

                    {/* Foto quadrada centralizada */}
                    <div className="flex justify-center px-4">
                      {c.foto ? (
                        <img
                          src={c.foto}
                          alt={c.nome}
                          className="h-32 w-32 rounded-2xl object-cover object-center shadow-md"
                        />
                      ) : (
                        <div className="flex h-32 w-32 items-center justify-center rounded-2xl bg-gradient-to-br from-kt-soft to-az-soft shadow-md">
                          <Avatar nome={c.nome} size={80} />
                        </div>
                      )}
                    </div>
                    <div className="p-4 text-center">
                      <p className="text-lg font-extrabold">
                        {ehHoje ? "🥳 " : "🎂 "}Feliz aniversário, {c.nome.split(" ")[0]}!
                      </p>
                      <p className="mt-1 text-2xl font-extrabold text-kt">{idadeAnos} anos</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{diaMes(c.nascimento)}</p>
                      <div className="mt-2 flex flex-wrap justify-center gap-1.5">
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {c.cargo}
                        </span>
                        <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium text-muted-foreground">
                          {filialNome(c.filial)}
                        </span>
                      </div>

                      {/* Mensagens de parabéns */}
                      {msgsDoPerfil.length > 0 && (
                        <div className="mt-3 grid gap-1.5 text-left">
                          {msgsDoPerfil.map((m) => (
                            <div key={m.id} className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                              <span className="mr-1">{m.emoji}</span>
                              <span className="font-medium">{m.de}:</span>{" "}
                              <span className="text-muted-foreground">{m.mensagem}</span>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* Enviar mensagem */}
                      {!jaEnviouMsg &&
                        c.id !== (session as typeof session & { id?: string }).id && (
                          <div className="mt-3 text-left">
                            {bdayMsgParaId === c.id ? (
                              <div className="grid gap-2">
                                <div className="flex gap-2">
                                  {["🎉", "🎂", "🥳", "❤️", "🌟"].map((e) => (
                                    <button
                                      key={e}
                                      onClick={() => setBdayMsgEmoji(e)}
                                      className={`rounded-full p-1 text-lg transition-transform hover:scale-125 ${bdayMsgEmoji === e ? "ring-2 ring-kt" : ""}`}
                                    >
                                      {e}
                                    </button>
                                  ))}
                                </div>
                                <Textarea
                                  rows={2}
                                  placeholder="Deixe uma mensagem de parabéns..."
                                  value={bdayMsgTexto}
                                  onChange={(e) => setBdayMsgTexto(e.target.value)}
                                  maxLength={200}
                                  className="text-sm"
                                />
                                <div className="flex gap-2">
                                  <Button
                                    size="sm"
                                    className="rounded-full"
                                    disabled={!bdayMsgTexto.trim()}
                                    onClick={() => {
                                      setBdayMsgs([
                                        ...bdayMsgs,
                                        {
                                          id: uid(),
                                          paraId: c.id,
                                          de: session.nome,
                                          emoji: bdayMsgEmoji,
                                          mensagem: bdayMsgTexto.trim(),
                                          ts: Date.now(),
                                        },
                                      ]);
                                      setBdayMsgTexto("");
                                      setBdayMsgParaId(null);
                                    }}
                                  >
                                    Enviar parabéns
                                  </Button>
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="rounded-full"
                                    onClick={() => setBdayMsgParaId(null)}
                                  >
                                    Cancelar
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <button
                                className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                onClick={() => {
                                  setBdayMsgParaId(c.id);
                                  setBdayMsgTexto("");
                                }}
                              >
                                🎉 Deixar mensagem de parabéns
                              </button>
                            )}
                          </div>
                        )}
                      {jaEnviouMsg && (
                        <p className="mt-2 text-xs text-success">✓ Você já deixou uma mensagem</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          titulo="Notícias e vídeos"
          intro="Conteúdos publicados pela Azumi RH para todas as unidades."
          contagem={`${noticias.length} publicados`}
          collapsible
          defaultOpen={noticias.length > 0}
        >
          {noticias.length === 0 ? (
            <EmptyState>Nenhuma notícia publicada ainda.</EmptyState>
          ) : (
            <div className="grid gap-4 lg:grid-cols-2">
              {noticias.map((n) => {
                const embed = n.videoUrl ? youtubeEmbed(n.videoUrl) : null;
                return (
                  <article
                    key={n.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    {embed ? (
                      <div className="aspect-video w-full">
                        <iframe
                          src={embed}
                          title={n.titulo}
                          className="h-full w-full"
                          allow="accelerometer; clipboard-write; encrypted-media; picture-in-picture"
                          allowFullScreen
                        />
                      </div>
                    ) : n.imagemUrl ? (
                      <img
                        src={n.imagemUrl}
                        alt={n.titulo}
                        className="aspect-video w-full object-cover"
                      />
                    ) : null}
                    <div className="p-4">
                      <h3 className="text-sm font-bold">{n.titulo}</h3>
                      <p className="mt-1 text-sm text-muted-foreground">{n.resumo}</p>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </Section>

        {/* Meu histórico de check-ins */}
        {(() => {
          const meusCheckins = checkins
            .filter((c) => c.nome === session.nome)
            .sort((a, b) => b.ts - a.ts);
          const filtrados = histFiltroData
            ? meusCheckins.filter(
                (c) =>
                  new Date(c.ts).toLocaleDateString("pt-BR") ===
                  new Date(histFiltroData + "T00:00:00").toLocaleDateString("pt-BR"),
              )
            : meusCheckins.slice(0, 30);
          return (
            <Section
              titulo="Meu histórico de check-ins"
              intro="Seus registros de humor anteriores."
              contagem={`${meusCheckins.length} registros`}
              collapsible
              defaultOpen={false}
            >
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Label htmlFor="hist-data">Filtrar por data</Label>
                  <input
                    id="hist-data"
                    type="date"
                    value={histFiltroData}
                    onChange={(e) => setHistFiltroData(e.target.value)}
                    className="min-w-0 flex-1 rounded-lg border border-border bg-card px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-kt/30 sm:flex-none"
                  />
                  {histFiltroData && (
                    <button
                      onClick={() => setHistFiltroData("")}
                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                    >
                      Limpar
                    </button>
                  )}
                </div>
                {filtrados.length === 0 ? (
                  <EmptyState>Nenhum check-in nessa data.</EmptyState>
                ) : (
                  <>
                  {/* Mobile: lista */}
                  <div className="grid gap-2 sm:hidden">
                    {filtrados.map((c) => {
                      const h = HUMORES.find((x) => x.id === c.humor);
                      return (
                        <div key={c.id} className="rounded-xl border border-border p-3">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span
                              className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                h?.categoria === "positiva"
                                  ? "bg-success-soft text-success"
                                  : h?.categoria === "negativa"
                                    ? "bg-destructive/10 text-destructive"
                                    : "bg-warn-soft text-warn"
                              }`}
                            >
                              {h?.emoji} {h?.label}
                            </span>
                            <span className="text-xs text-muted-foreground">
                              {new Date(c.ts).toLocaleDateString("pt-BR", {
                                day: "2-digit",
                                month: "short",
                              })}
                              {" · "}
                              {new Date(c.ts).toLocaleTimeString("pt-BR", {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          </div>
                          {c.recado && (
                            <p className="mt-2 text-sm text-muted-foreground">
                              <em>"{c.recado}"</em>
                            </p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="hidden overflow-x-auto rounded-2xl border border-border sm:block">
                    <table className="w-full text-sm">

                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-4 py-3 text-left font-semibold">Humor</th>
                          <th className="px-4 py-3 text-left font-semibold">Data</th>
                          <th className="px-4 py-3 text-left font-semibold">Hora</th>
                          <th className="px-4 py-3 text-left font-semibold">Comentário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filtrados.map((c) => {
                          const h = HUMORES.find((x) => x.id === c.humor);
                          return (
                            <tr key={c.id} className="border-b border-border last:border-0">
                              <td className="px-4 py-3">
                                <span
                                  className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${
                                    h?.categoria === "positiva"
                                      ? "bg-success-soft text-success"
                                      : h?.categoria === "negativa"
                                        ? "bg-destructive/10 text-destructive"
                                        : "bg-warn-soft text-warn"
                                  }`}
                                >
                                  {h?.emoji} {h?.label}
                                </span>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {new Date(c.ts).toLocaleDateString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                })}
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                                {new Date(c.ts).toLocaleTimeString("pt-BR", {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="max-w-xs px-4 py-3 text-muted-foreground">
                                {c.recado ? <em>"{c.recado}"</em> : "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                    {!histFiltroData && meusCheckins.length > 30 && (
                      <p className="px-4 py-2 text-center text-xs text-muted-foreground">
                        Mostrando os 30 mais recentes. Use o filtro de data para ver outros.
                      </p>
                    )}
                  </div>
                  </>
                )}
              </div>
            </Section>
          );
        })()}

        {/* Caixinha de sugestão */}
        <Section
          titulo="Caixinha de sugestão"
          intro="Sem identificação. Sua unidade fica registrada só para direcionar para a área certa."
          contagem="Anônima"
          collapsible
          defaultOpen
        >
          <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
            <div className="grid gap-4">
              {/* icon header */}
              <div className="flex items-center gap-3">
                <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-kt-soft">
                  <Inbox className="h-6 w-6 text-kt" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Sua sugestão é completamente anônima — nenhum dado pessoal é vinculado ao envio.
                  Usamos a unidade só para entender o contexto.
                </p>
              </div>

              {sugEnviado ? (
                <div className="flex flex-col items-center gap-3 rounded-2xl border border-kt/30 bg-kt-soft py-8 text-center">
                  <Inbox className="h-10 w-10 animate-bounce text-kt" />
                  <p className="text-lg font-semibold text-kt">📬 Sugestão enviada!</p>
                  <p className="text-sm text-muted-foreground">
                    Obrigado por contribuir com a equipe.
                  </p>
                </div>
              ) : (
                <>
                  <div className="grid gap-2">
                    <Label>Sua sugestão é sobre:</Label>
                    <div className="flex flex-wrap gap-2">
                      {SUGESTAO_CATEGORIAS.map((cat) => (
                        <button
                          key={cat}
                          onClick={() => setSugCat(cat)}
                          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                            sugCat === cat
                              ? "border-kt bg-kt-soft text-kt"
                              : "border-border bg-card hover:bg-muted"
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                    {SUG_DICAS[sugCat] && (
                      <p className="text-xs text-muted-foreground">{SUG_DICAS[sugCat]}</p>
                    )}
                  </div>
                  <Textarea
                    rows={4}
                    maxLength={800}
                    placeholder="Conte sua ideia, elogio ou observação..."
                    value={sugMsg}
                    onChange={(e) => setSugMsg(e.target.value)}
                  />
                  <div>
                    <Button
                      className="rounded-full"
                      disabled={!sugMsg.trim()}
                      onClick={() => {
                        const novoSugId = uid();
                        setSugestoes([
                          {
                            id: novoSugId,
                            categoria: sugCat,
                            mensagem: sugMsg.trim(),
                            filial: session.filial,
                            ts: Date.now(),
                          },
                          ...sugestoes,
                        ]);
                        setSugMsg("");
                        setSugEnviado(true);
                        setMinhasSugIds((prev) => [...prev, novoSugId]);
                        setTimeout(() => setSugEnviado(false), 2500);
                      }}
                    >
                      Enviar anonimamente
                    </Button>
                  </div>
                </>
              )}
            </div>
            {/* Floating icon — visible on large screens */}
            <div className="hidden items-center justify-center lg:flex">
              <Inbox
                className="h-36 w-36 text-kt/15"
                style={{ animation: "kt-icon-float 3s ease-in-out infinite" }}
              />
            </div>
          </div>
        </Section>

        {/* Histórico de sugestões desta sessão */}
        {minhasSugIds.length > 0 && (() => {
          const minhasSugs = sugestoes
            .filter((s) => minhasSugIds.includes(s.id))
            .sort((a, b) => b.ts - a.ts);
          const statusLabel: Record<string, string> = {
            "enviado-rh": "Enviado ao RH",
            desconsiderado: "Desconsiderado",
            "considerar-depois": "Considerar depois",
            "para-socios": "Para sócios",
          };
          return (
            <Section
              titulo="Minhas sugestões"
              intro="Sugestões enviadas nesta sessão."
              contagem={`${minhasSugs.length} enviadas`}
              collapsible
              defaultOpen
            >
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left font-semibold">Data</th>
                      <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                      <th className="px-4 py-3 text-left font-semibold">Mensagem</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {minhasSugs.map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {new Date(s.ts).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 font-medium">{s.categoria}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {s.mensagem.length > 80 ? s.mensagem.slice(0, 80) + "…" : s.mensagem}
                        </td>
                        <td className="px-4 py-3">
                          {s.status ? (
                            <span className="rounded-full bg-muted px-2.5 py-1 text-xs font-medium">
                              {statusLabel[s.status] ?? s.status}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Aguardando</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          );
        })()}

        {/* Feedback ao gestor */}
        <Section
          titulo="Feedback ao gestor"
          intro="Elogio, crítica, dúvida ou uma situação pontual — você escolhe se assina ou não."
          contagem={fbEnviado ? "Enviado ✓" : fbAnon ? "Anônimo" : "Com meu nome"}
          collapsible
          defaultOpen
        >
          {fbEnviado ? (
            /* ── Pós-envio ── */
            <div className="grid gap-5">
              <div className="rounded-2xl border border-success/30 bg-success-soft p-5">
                <p className="font-semibold text-success">Recebemos sua mensagem.</p>
                <p className="mt-1 text-sm text-muted-foreground">Vamos analisar com cuidado.</p>
              </div>

              {/* opt-in contato */}
              {fbAceitaContato === null && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="text-sm font-medium">
                    Podemos entrar em contato com você caso seja necessário?
                  </p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Button
                      size="sm"
                      className="rounded-full"
                      onClick={() => setFbAceitaContato(true)}
                    >
                      Sim, pode entrar em contato
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="rounded-full"
                      onClick={() => {
                        setFbAceitaContato(false);
                        if (fbIdEnviado) {
                          setFeedbacks((prev) =>
                            prev.map((x) =>
                              x.id === fbIdEnviado ? { ...x, aceitaContato: false } : x,
                            ),
                          );
                        }
                      }}
                    >
                      Prefiro manter anônimo
                    </Button>
                  </div>
                </div>
              )}

              {fbAceitaContato === true && (
                <div className="rounded-2xl border border-border bg-card p-5">
                  <p className="mb-3 text-sm font-medium">
                    Deixe um telefone ou nome pra gente conseguir te encontrar:
                  </p>
                  <div className="flex gap-2">
                    <input
                      type="text"
                      placeholder="Nome, telefone ou outro contato"
                      value={fbContatoTexto}
                      onChange={(e) => setFbContatoTexto(e.target.value)}
                      className="min-w-0 flex-1 rounded-lg border border-border bg-transparent px-3 py-2 text-sm focus:outline-none focus:ring-1 focus:ring-kt/30"
                      maxLength={100}
                    />
                    <Button
                      size="sm"
                      className="rounded-full"
                      disabled={!fbContatoTexto.trim()}
                      onClick={() => {
                        if (fbIdEnviado) {
                          setFeedbacks((prev) =>
                            prev.map((x) =>
                              x.id === fbIdEnviado
                                ? { ...x, aceitaContato: true, contato: fbContatoTexto.trim() }
                                : x,
                            ),
                          );
                        }
                        setFbAceitaContato(false);
                        toast.success("Contato registrado. Obrigado!");
                      }}
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              )}

              {fbAceitaContato === false && (
                <p className="text-sm text-muted-foreground">
                  Entendido — seu feedback foi registrado.
                </p>
              )}

              {/* LGPD */}
              <p className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                Essa informação é tratada com confidencialidade, seguindo a LGPD, e a
                responsabilidade pela análise é só da equipe Azumi RH. Se em algum momento for
                necessário envolver outras pessoas na empresa por causa da gravidade da situação,{" "}
                <strong className="text-foreground">
                  você será avisado antes disso acontecer.
                </strong>
              </p>

              <button
                className="w-fit text-sm text-muted-foreground underline-offset-2 hover:underline"
                onClick={() => {
                  setFbEnviado(false);
                  setFbIdEnviado(null);
                  setFbAceitaContato(null);
                  setFbContatoTexto("");
                  setFbMsg("");
                }}
              >
                Enviar outro feedback
              </button>
            </div>
          ) : (
            /* ── Formulário ── */
            <div className="grid gap-6 lg:grid-cols-[1fr_auto]">
              <div className="grid gap-4">
                {/* texto explicativo — roteamento */}
                <div className="rounded-xl bg-muted/50 px-4 py-3 text-xs text-muted-foreground">
                  Feedbacks de elogio e dúvida vão direto pro seu gestor. Críticas ou situações
                  urgentes marcadas como anônimas vão direto pra equipe Azumi RH analisar, sem
                  passar pelo gestor primeiro.
                </div>

                <div className="grid gap-2">
                  <Label>Você quer se identificar?</Label>
                  <div className="flex flex-wrap gap-2">
                    {(["Anônimo", "Com meu nome"] as const).map((op) => (
                      <button
                        key={op}
                        onClick={() => setFbAnon(op === "Anônimo")}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                          (op === "Anônimo") === fbAnon
                            ? "border-kt bg-kt-soft text-kt"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        {op}
                      </button>
                    ))}
                  </div>
                  {fbAnon ? (
                    <p className="text-xs text-muted-foreground">
                      Sua identidade não será revelada.
                    </p>
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      O gestor verá seu nome vinculado ao feedback.
                    </p>
                  )}
                </div>
                <div className="grid gap-2">
                  <Label>Tipo de feedback</Label>
                  <div className="flex flex-wrap gap-2">
                    {FEEDBACK_TIPOS.map((tipo) => (
                      <button
                        key={tipo}
                        onClick={() => setFbTipo(tipo)}
                        className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                          fbTipo === tipo
                            ? "border-kt bg-kt-soft text-kt"
                            : "border-border bg-card hover:bg-muted"
                        }`}
                      >
                        {tipo}
                      </button>
                    ))}
                  </div>
                  {FB_DESC[fbTipo] && (
                    <p className="text-xs text-muted-foreground">{FB_DESC[fbTipo]}</p>
                  )}
                  {/* destino hint */}
                  {calcDestino(fbTipo, fbAnon) === "azumi" && (
                    <p className="text-xs font-medium text-az">
                      → Esse feedback vai direto pra equipe Azumi RH (anônimo + tipo sensível).
                    </p>
                  )}
                </div>
                <Textarea
                  rows={4}
                  maxLength={800}
                  placeholder="Escreva para seu gestor..."
                  value={fbMsg}
                  onChange={(e) => setFbMsg(e.target.value)}
                />
                <div>
                  <Button
                    className="rounded-full"
                    disabled={!fbMsg.trim()}
                    onClick={() => {
                      const novoId = uid();
                      const destino = calcDestino(fbTipo, fbAnon);
                      setFeedbacks([
                        {
                          id: novoId,
                          tipo: fbTipo,
                          mensagem: fbMsg.trim(),
                          anonimo: fbAnon,
                          autor: fbAnon ? "Anônimo" : session.nome,
                          filial: session.filial,
                          ts: Date.now(),
                          destino,
                        },
                        ...feedbacks,
                      ]);
                      setFbIdEnviado(novoId);
                      setMeusFbIds((prev) => [...prev, novoId]);
                      setFbEnviado(true);
                      setFbAceitaContato(null);
                    }}
                  >
                    Enviar feedback
                  </Button>
                </div>
              </div>
              {/* Floating icon */}
              <div className="hidden items-center justify-center lg:flex">
                <Mail
                  className="h-36 w-36 text-muted-foreground/10"
                  style={{ animation: "kt-icon-float 3.5s ease-in-out infinite" }}
                />
              </div>
            </div>
          )}
        </Section>

        {/* Histórico de feedbacks */}
        {(() => {
          const meusFbs = feedbacks
            .filter((f) => meusFbIds.includes(f.id) || (!f.anonimo && f.autor === session.nome))
            .sort((a, b) => b.ts - a.ts);
          if (meusFbs.length === 0) return null;
          const fbStatusLabel: Record<string, string> = {
            "em-andamento": "Em andamento",
            concluido: "Concluído",
            cancelado: "Cancelado",
          };
          return (
            <Section
              titulo="Meus feedbacks"
              intro="Histórico dos feedbacks que você enviou. Feedbacks anônimos aparecem apenas nesta sessão."
              contagem={`${meusFbs.length} registros`}
              collapsible
              defaultOpen
            >
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left font-semibold">Data</th>
                      <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                      <th className="px-4 py-3 text-left font-semibold">Identificação</th>
                      <th className="px-4 py-3 text-left font-semibold">Mensagem</th>
                      <th className="px-4 py-3 text-left font-semibold">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {meusFbs.map((f) => (
                      <tr key={f.id} className="border-b border-border last:border-0">
                        <td className="whitespace-nowrap px-4 py-3 text-muted-foreground">
                          {new Date(f.ts).toLocaleDateString("pt-BR")}
                        </td>
                        <td className="px-4 py-3 font-medium">{f.tipo}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${f.anonimo ? "bg-muted text-muted-foreground" : "bg-kt-soft text-kt"}`}>
                            {f.anonimo ? "Anônimo" : "Assinado"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {f.mensagem.length > 80 ? f.mensagem.slice(0, 80) + "…" : f.mensagem}
                        </td>
                        <td className="px-4 py-3">
                          {f.status ? (
                            <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${
                              f.status === "concluido" ? "bg-success-soft text-success"
                              : f.status === "cancelado" ? "bg-destructive/10 text-destructive"
                              : "bg-warn-soft text-warn"
                            }`}>
                              {fbStatusLabel[f.status] ?? f.status}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground">Aguardando</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Section>
          );
        })()}
      </div>
    </AppShell>
  );
}
