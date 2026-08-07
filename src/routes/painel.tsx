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
  const [sugCat, setSugCat] = useState(SUGESTAO_CATEGORIAS[0]!);
  const [sugMsg, setSugMsg] = useState("");
  const [sugEnviado, setSugEnviado] = useState(false);
  const [fbTipo, setFbTipo] = useState(FEEDBACK_TIPOS[0]!);
  const [fbAnon, setFbAnon] = useState(true);
  const [fbMsg, setFbMsg] = useState("");

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
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            👋 Olá, {session.nome.split(" ")[0]}!
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bem-vindo(a) à intranet do Ken Taki × Azumi RH
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            <strong className="text-foreground">Ken Taki · {filialNome(session.filial)}</strong> ·
            CPF ***{session.cpf3}
          </p>
        </div>

        {/* Precisa de apoio — movida para o topo */}
        <div className="overflow-hidden rounded-2xl border border-az/20 bg-gradient-to-br from-az-soft to-az/10">
          <div className="flex items-center gap-3 border-b border-az/20 px-5 py-4 sm:px-7">
            <MessageCircle className="h-5 w-5 shrink-0 text-az" />
            <div>
              <h2 className="font-bold text-az">Precisa de apoio?</h2>
              <p className="text-xs text-muted-foreground">
                Fale com a equipe Azumi RH — seu gestor não é identificado.
              </p>
            </div>
          </div>
          <div className="flex flex-wrap justify-center gap-3 px-5 py-5 sm:justify-start sm:px-7">
            <Button
              className="rounded-full bg-az text-white hover:bg-az/90"
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
              Registrar pedido de apoio com a equipe Azumi RH
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
              className="inline-flex items-center gap-2 rounded-full bg-[#25D366] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
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
                        <span className="mt-1 inline-block rounded-full bg-az px-2.5 py-0.5 text-[11px] font-bold text-white">
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
                  {pesquisa.link && !jaRespondeu ? (
                    <Button
                      className="mt-4 rounded-full"
                      onClick={() => {
                        setPesquisa({
                          ...pesquisa,
                          respondeu: [...(pesquisa.respondeu ?? []), session.nome],
                        });
                        window.open(pesquisa.link, "_blank", "noreferrer");
                      }}
                    >
                      Responder pesquisa
                    </Button>
                  ) : pesquisa.link && jaRespondeu ? (
                    <a
                      href={pesquisa.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex items-center gap-1 text-sm text-az underline underline-offset-2"
                    >
                      Ver formulário novamente
                    </a>
                  ) : null}
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
            <div className="grid gap-3 md:grid-cols-2">
              {aniversariantes.map((c) => {
                const hoje = new Date();
                const aniversario = new Date(c.nascimento + "T00:00:00");
                const ehHoje =
                  aniversario.getDate() === hoje.getDate() &&
                  aniversario.getMonth() === hoje.getMonth();
                return (
                  <div
                    key={c.id}
                    className={`grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 overflow-hidden rounded-2xl border p-4 ${
                      ehHoje
                        ? "border-kt/30 bg-gradient-to-br from-kt-soft via-az-soft to-kt-soft"
                        : "border-border bg-card"
                    }`}
                  >
                    <Avatar nome={c.nome} foto={c.foto} size={52} />
                    <div className="min-w-0">
                      <p className="truncate font-semibold">
                        {ehHoje && <span className="mr-1">🥳</span>}
                        {c.nome}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">{c.cargo}</p>
                      <p className="truncate text-xs text-muted-foreground">
                        {filialNome(c.filial)} · faz {idade(c.nascimento) + 1} anos
                      </p>
                    </div>
                    <div className="shrink-0 text-center">
                      {ehHoje ? (
                        <span className="block text-2xl">🎂</span>
                      ) : (
                        <span className="block rounded-xl bg-kt-soft px-3 py-2 text-xs font-bold text-kt">
                          {diaMes(c.nascimento)}
                        </span>
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

        {/* Caixinha de sugestão */}
        <Section
          titulo="Caixinha de sugestão"
          intro="Sem identificação. Sua unidade fica registrada só para direcionar para a área certa."
          contagem="Anônima"
          collapsible
          defaultOpen
        >
          <div className="grid max-w-2xl gap-4">
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
                      <div key={cat} className="flex flex-col items-start gap-0.5">
                        <button
                          onClick={() => setSugCat(cat)}
                          title={SUG_DICAS[cat]}
                          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                            sugCat === cat
                              ? "border-kt bg-kt-soft text-kt"
                              : "border-border bg-card hover:bg-muted"
                          }`}
                        >
                          {cat}
                        </button>
                        {sugCat === cat && SUG_DICAS[cat] && (
                          <p className="px-1 text-xs text-muted-foreground">{SUG_DICAS[cat]}</p>
                        )}
                      </div>
                    ))}
                  </div>
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
                      setSugestoes([
                        {
                          id: uid(),
                          categoria: sugCat,
                          mensagem: sugMsg.trim(),
                          filial: session.filial,
                          ts: Date.now(),
                        },
                        ...sugestoes,
                      ]);
                      setSugMsg("");
                      setSugEnviado(true);
                      setTimeout(() => setSugEnviado(false), 2500);
                    }}
                  >
                    Enviar anonimamente
                  </Button>
                </div>
              </>
            )}
          </div>
        </Section>

        {/* Feedback ao gestor */}
        <Section
          titulo="Feedback ao gestor"
          intro="Elogio, crítica, dúvida ou uma situação pontual — você escolhe se assina ou não."
          contagem={fbAnon ? "Anônimo" : "Com meu nome"}
          collapsible
          defaultOpen
        >
          <div className="grid max-w-2xl gap-4">
            {/* icon header */}
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted">
                <Mail className="h-6 w-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Seu gestor recebe o feedback pelo painel. Escolha se quer se identificar ou não.
              </p>
            </div>
            <div className="grid gap-2">
              <Label>Você quer se identificar?</Label>
              <div className="flex flex-wrap gap-2">
                {(["Anônimo", "Com meu nome"] as const).map((op) => (
                  <div key={op} className="flex flex-col gap-0.5">
                    <button
                      onClick={() => setFbAnon(op === "Anônimo")}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        (op === "Anônimo") === fbAnon
                          ? "border-kt bg-kt-soft text-kt"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      {op}
                    </button>
                    {op === "Com meu nome" && !fbAnon && (
                      <p className="px-1 text-xs text-muted-foreground">
                        O gestor verá seu nome vinculado ao feedback.
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
            <div className="grid gap-2">
              <Label>Tipo de feedback</Label>
              <div className="flex flex-wrap gap-2">
                {FEEDBACK_TIPOS.map((tipo) => (
                  <div key={tipo} className="flex flex-col gap-0.5">
                    <button
                      onClick={() => setFbTipo(tipo)}
                      className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                        fbTipo === tipo
                          ? "border-kt bg-kt-soft text-kt"
                          : "border-border bg-card hover:bg-muted"
                      }`}
                    >
                      {tipo}
                    </button>
                    {fbTipo === tipo && FB_DESC[tipo] && (
                      <p className="px-1 text-xs text-muted-foreground">{FB_DESC[tipo]}</p>
                    )}
                  </div>
                ))}
              </div>
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
                  setFeedbacks([
                    {
                      id: uid(),
                      tipo: fbTipo,
                      mensagem: fbMsg.trim(),
                      anonimo: fbAnon,
                      autor: fbAnon ? "Anônimo" : session.nome,
                      filial: session.filial,
                      ts: Date.now(),
                    },
                    ...feedbacks,
                  ]);
                  setFbMsg("");
                  toast.success("Feedback enviado ao seu gestor.");
                }}
              >
                Enviar feedback ao gestor
              </Button>
            </div>
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
