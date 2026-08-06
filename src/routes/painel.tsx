import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { MessageCircle } from "lucide-react";
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
  COLABORADORES,
  FEEDBACK_TIPOS,
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
  useDocumentos,
  useFeedbacks,
  useLeituras,
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
  const [pesquisa] = usePesquisa();
  const [noticias] = useNoticias();
  const [ajuda, setAjuda] = useAjuda();

  const [documentos] = useDocumentos();
  const [assinaturas] = useAssinaturas();
  const [leituras] = useLeituras();

  const [sugCat, setSugCat] = useState(SUGESTAO_CATEGORIAS[0]!);
  const [sugMsg, setSugMsg] = useState("");
  const [fbTipo, setFbTipo] = useState(FEEDBACK_TIPOS[0]!);
  const [fbAnon, setFbAnon] = useState(true);
  const [fbMsg, setFbMsg] = useState("");

  useEffect(() => {
    if (sessaoPronta && session === null) navigate({ to: "/colaborador" });
  }, [sessaoPronta, session, navigate]);

  if (!session || session.tipo !== "colaborador") return null;

  const mes = new Date().getMonth();
  const aniversariantes = COLABORADORES.filter(
    (c) => c.filial === session.filial && new Date(c.nascimento + "T00:00:00").getMonth() === mes,
  ).sort((a, b) => a.nascimento.slice(5).localeCompare(b.nascimento.slice(5)));

  return (
    <AppShell>
      <div className="grid gap-5">
        <p className="text-sm text-muted-foreground">
          Ken Taki · unidade {filialNome(session.filial)} · CPF ***{session.cpf3}
        </p>

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

        <Documentos session={session} />

        <Mural filial={session.filial} autorPadrao={session.nome} />

        <Section
          titulo="Pesquisa de clima"
          intro="Publicada pela Azumi RH. Quando houver uma pesquisa ativa, ela aparece aqui."
          contagem={pesquisa?.ativa ? "1 ativa" : "Nenhuma ativa"}
        >
          {pesquisa?.ativa ? (
            <div className="rounded-2xl border border-border bg-az-soft p-5">
              <h3 className="font-bold">{pesquisa.titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{pesquisa.descricao}</p>
              {pesquisa.link ? (
                <Button asChild className="mt-4 rounded-full">
                  <a href={pesquisa.link} target="_blank" rel="noreferrer">
                    Responder pesquisa
                  </a>
                </Button>
              ) : null}
            </div>
          ) : (
            <EmptyState>Nenhuma pesquisa de clima ativa no momento.</EmptyState>
          )}
        </Section>

        <Section
          titulo="Aniversariantes do mês"
          intro={`Quem faz aniversário este mês na unidade ${filialNome(session.filial)}.`}
          contagem={`${aniversariantes.length} este mês`}
        >
          {aniversariantes.length === 0 ? (
            <EmptyState>Ninguém faz aniversário este mês por aqui.</EmptyState>
          ) : (
            <div className="grid gap-3 md:grid-cols-2">
              {aniversariantes.map((c) => (
                <div
                  key={c.id}
                  className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-2xl border border-border bg-card p-4"
                >
                  <Avatar nome={c.nome} foto={c.foto} size={52} />
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{c.nome}</p>
                    <p className="truncate text-sm text-muted-foreground">{c.cargo}</p>
                    <p className="truncate text-xs text-muted-foreground">
                      {filialNome(c.filial)} · faz {idade(c.nascimento) + 1} anos
                    </p>
                  </div>
                  <span className="shrink-0 rounded-xl bg-kt-soft px-3 py-2 text-center text-xs font-bold text-kt">
                    {diaMes(c.nascimento)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          titulo="Notícias e vídeos"
          intro="Conteúdos publicados pela Azumi RH para todas as unidades."
          contagem={`${noticias.length} publicados`}
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

        <Section
          titulo="Caixinha de sugestão"
          intro="Sem identificação. Sua unidade fica registrada só para direcionar para a área certa."
          contagem="Anônima"
        >
          <div className="grid max-w-2xl gap-4">
            <div className="grid gap-2">
              <Label>Sua sugestão é sobre:</Label>
              <Chips opcoes={SUGESTAO_CATEGORIAS} valor={sugCat} onChange={setSugCat} />
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
                  toast.success("Sugestão enviada anonimamente.");
                }}
              >
                Enviar anonimamente
              </Button>
            </div>
          </div>
        </Section>

        <Section
          titulo="Feedback ao gestor"
          intro="Elogio, crítica, dúvida ou uma situação pontual — você escolhe se assina ou não."
          contagem={fbAnon ? "Anônimo" : "Com meu nome"}
        >
          <div className="grid max-w-2xl gap-4">
            <div className="grid gap-2">
              <Label>Você quer se identificar?</Label>
              <Chips
                opcoes={["Anônimo", "Com meu nome"]}
                valor={fbAnon ? "Anônimo" : "Com meu nome"}
                onChange={(v) => setFbAnon(v === "Anônimo")}
              />
            </div>
            <div className="grid gap-2">
              <Label>Tipo de feedback</Label>
              <Chips opcoes={FEEDBACK_TIPOS} valor={fbTipo} onChange={setFbTipo} />
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

        <Section
          titulo="Precisa de apoio?"
          intro="Fale direto com a equipe Azumi RH pelo WhatsApp. Seu gestor não é identificado nessa conversa."
          contagem={`${ajuda.length} pedidos registrados`}
        >
          <Button
            variant="outline"
            className="rounded-full border-az text-az hover:bg-az-soft"
            onClick={() => {
              setAjuda([
                {
                  id: uid(),
                  nome: session.nome,
                  filial: session.filial,
                  assunto: "Apoio pelo WhatsApp",
                  ts: Date.now(),
                },
                ...ajuda,
              ]);
              window.open(
                `https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(
                  `Olá, equipe Azumi RH! Sou do Ken Taki, unidade ${filialNome(session.filial)}, e gostaria de conversar.`,
                )}`,
                "_blank",
              );
              toast.success("Pedido registrado. Abrindo o WhatsApp da Azumi.");
            }}
          >
            <MessageCircle className="h-4 w-4" /> Falar com a equipe Azumi
          </Button>
        </Section>
      </div>
    </AppShell>
  );
}
