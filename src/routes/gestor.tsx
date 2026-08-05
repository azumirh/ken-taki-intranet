import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { ExternalLink } from "lucide-react";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { Avatar, EmptyState, Section } from "@/components/kt/section";
import { Mural } from "@/components/kt/mural";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { COLABORADORES, FILIAIS, HUMORES, POLITICAS, filialNome, idade } from "@/lib/kt-data";
import {
  fmtData,
  uid,
  useAssinaturas,
  useCheckins,
  useFeedbacks,
  usePesquisa,
  useSession,
  useSugestoes,
  useVagas,
} from "@/lib/kt-store";

export const Route = createFileRoute("/gestor")({
  head: () => ({
    meta: [
      { title: "Painel do gestor · Intranet Ken Taki" },
      {
        name: "description",
        content:
          "Área do gestor Ken Taki: clima da equipe, assinaturas de políticas, feedbacks, sugestões e solicitação de vaga.",
      },
      { property: "og:title", content: "Painel do gestor · Intranet Ken Taki" },
      { property: "og:description", content: "Clima, políticas e equipe da sua unidade em um só lugar." },
    ],
  }),
  component: GestorPage,
});

const LINKS_GESTOR = [
  { label: "Drive de documentos da unidade", url: "https://drive.google.com" },
  { label: "Escala e ponto", url: "https://drive.google.com" },
  { label: "Manual de processos Ken Taki", url: "https://drive.google.com" },
];

function GestorPage() {
  const [session, setSession] = useSession();
  if (!session || session.tipo !== "gestor") return <LoginGestor onLogin={setSession} />;
  return <PainelGestor session={session} />;
}

function LoginGestor({ onLogin }: { onLogin: (s: never) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [filial, setFilial] = useState<string>(FILIAIS[0].id);
  const [erro, setErro] = useState("");

  return (
    <AppShell back={<BackLink onClick={() => navigate({ to: "/" })}>voltar ao início</BackLink>}>
      <div className="mx-auto w-full max-w-md surface p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">Área do gestor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesso com login e senha. Demonstração: <strong>gestor@kentaki.com</strong> / <strong>123456</strong>
        </p>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input id="email" type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="senha">Senha</Label>
            <Input id="senha" type="password" value={senha} onChange={(e) => setSenha(e.target.value)} />
          </div>
          <div className="grid gap-2">
            <Label>Unidade</Label>
            <div className="flex flex-wrap gap-2">
              {FILIAIS.map((f) => (
                <button
                  key={f.id}
                  onClick={() => setFilial(f.id)}
                  className={`rounded-full border px-3.5 py-1.5 text-sm font-medium ${
                    filial === f.id ? "border-kt bg-kt-soft text-kt" : "border-border"
                  }`}
                >
                  {f.nome}
                </button>
              ))}
            </div>
          </div>
          {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
          <Button
            size="lg"
            className="w-full rounded-full"
            onClick={() => {
              if (email.trim() === "gestor@kentaki.com" && senha === "123456") {
                onLogin({ tipo: "gestor", nome: "Marcos Tanaka", email, filial } as never);
              } else {
                setErro("E-mail ou senha inválidos.");
              }
            }}
          >
            Entrar
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

function PainelGestor({ session }: { session: { nome: string; filial: string } }) {
  const [checkins] = useCheckins();
  const [assinaturas] = useAssinaturas();
  const [sugestoes] = useSugestoes();
  const [feedbacks] = useFeedbacks();
  const [pesquisa] = usePesquisa();
  const [vagas, setVagas] = useVagas();

  const [cargo, setCargo] = useState("");
  const [motivo, setMotivo] = useState("");

  const daUnidade = <T extends { filial: string }>(arr: T[]) => arr.filter((i) => i.filial === session.filial);
  const meusCheckins = daUnidade(checkins);
  const equipe = COLABORADORES.filter((c) => c.filial === session.filial);

  return (
    <AppShell>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Painel do gestor</h1>
          <p className="text-sm text-muted-foreground">
            {session.nome} · unidade {filialNome(session.filial)}
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Check-ins registrados", valor: meusCheckins.length },
            { label: "Assinaturas de políticas", valor: daUnidade(assinaturas).length },
            { label: "Feedbacks recebidos", valor: daUnidade(feedbacks).length },
          ].map((k) => (
            <div key={k.label} className="surface p-5">
              <p className="text-3xl font-extrabold text-union">{k.valor}</p>
              <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        <Section
          titulo="Clima da equipe"
          intro="Como o time respondeu ao check-in diário nesta unidade."
          contagem={`${meusCheckins.length} respostas`}
        >
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-5">
            {HUMORES.map((h) => {
              const n = meusCheckins.filter((c) => c.humor === h.id).length;
              return (
                <div key={h.id} className="rounded-2xl border border-border bg-card p-4 text-center">
                  <span className="text-2xl">{h.emoji}</span>
                  <p className="mt-1 text-lg font-bold">{n}</p>
                  <p className="text-xs text-muted-foreground">{h.label}</p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          titulo="Assinaturas de políticas"
          intro="Quem já leu e assinou cada política da casa."
          contagem={`${POLITICAS.length} políticas`}
        >
          <div className="grid gap-3 sm:grid-cols-2">
            {POLITICAS.map((p) => {
              const n = daUnidade(assinaturas).filter((a) => a.politica === p.id).length;
              return (
                <div key={p.id} className="flex items-center justify-between gap-3 rounded-2xl border border-border bg-card px-4 py-3">
                  <span className="min-w-0 truncate text-sm font-medium">{p.titulo}</span>
                  <span className="shrink-0 rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
                    {n} assinaturas
                  </span>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          titulo="Feedbacks da equipe"
          intro="Elogios, críticas, dúvidas e situações registradas pelo time."
          contagem={`${daUnidade(feedbacks).length} recebidos`}
        >
          {daUnidade(feedbacks).length === 0 ? (
            <EmptyState>Nenhum feedback recebido ainda.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {daUnidade(feedbacks).map((f) => (
                <div key={f.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-kt-soft px-2.5 py-1 font-semibold text-kt">{f.tipo}</span>
                    <span className="text-muted-foreground">
                      {f.autor} · {fmtData(f.ts)}
                    </span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{f.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          titulo="Caixinha de sugestão"
          intro="Sugestões anônimas do time desta unidade."
          contagem={`${daUnidade(sugestoes).length} sugestões`}
        >
          {daUnidade(sugestoes).length === 0 ? (
            <EmptyState>Nenhuma sugestão registrada ainda.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {daUnidade(sugestoes).map((s) => (
                <div key={s.id} className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span className="rounded-full bg-az-soft px-2.5 py-1 font-semibold text-az">{s.categoria}</span>
                    <span className="text-muted-foreground">{fmtData(s.ts)}</span>
                  </div>
                  <p className="mt-2 text-sm text-muted-foreground">{s.mensagem}</p>
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          titulo="Pesquisa de clima"
          intro="Pesquisas publicadas pela Azumi RH aparecem aqui e no painel do time."
          contagem={pesquisa?.ativa ? "1 ativa" : "Nenhuma ativa"}
        >
          {pesquisa?.ativa ? (
            <div className="rounded-2xl border border-border bg-az-soft p-5">
              <h3 className="font-bold">{pesquisa.titulo}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{pesquisa.descricao}</p>
            </div>
          ) : (
            <EmptyState>Nenhuma pesquisa ativa no momento.</EmptyState>
          )}
        </Section>

        <Mural filial={session.filial} autorPadrao={`${session.nome} (gestão)`} />

        <Section
          titulo="Equipe da unidade"
          intro="Time cadastrado nesta unidade, com cargo, aniversário e tempo de casa."
          contagem={`${equipe.length} pessoas`}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {equipe.map((c) => (
              <div key={c.id} className="grid grid-cols-[auto_minmax(0,1fr)] items-center gap-4 rounded-2xl border border-border bg-card p-4">
                <Avatar nome={c.nome} foto={c.foto} size={48} />
                <div className="min-w-0">
                  <p className="truncate font-semibold">{c.nome}</p>
                  <p className="truncate text-sm text-muted-foreground">{c.cargo}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {idade(c.nascimento)} anos · na casa desde {new Date(c.admissao + "T00:00:00").getFullYear()}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Section>

        <Section
          titulo="Solicitar vaga"
          intro="Precisa de reforço na equipe? Abra uma solicitação direto com a Azumi RH."
          contagem={`${daUnidade(vagas).length} abertas`}
        >
          <div className="grid max-w-2xl gap-3">
            <Input placeholder="Cargo desejado" value={cargo} onChange={(e) => setCargo(e.target.value)} />
            <Textarea
              rows={3}
              placeholder="Motivo da solicitação (substituição, aumento de quadro, sazonalidade...)"
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
            />
            <div>
              <Button
                className="rounded-full"
                disabled={!cargo.trim()}
                onClick={() => {
                  setVagas([
                    { id: uid(), cargo: cargo.trim(), motivo: motivo.trim(), filial: session.filial, ts: Date.now() },
                    ...vagas,
                  ]);
                  setCargo("");
                  setMotivo("");
                  toast.success("Solicitação enviada à Azumi RH.");
                }}
              >
                Enviar solicitação
              </Button>
            </div>
            {daUnidade(vagas).map((v) => (
              <div key={v.id} className="rounded-xl bg-muted px-4 py-3 text-sm">
                <strong>{v.cargo}</strong> · {fmtData(v.ts)}
                {v.motivo ? <p className="text-muted-foreground">{v.motivo}</p> : null}
              </div>
            ))}
          </div>
        </Section>

        <Section titulo="Documentos e processos" intro="Atalhos para as pastas e materiais da unidade.">
          <div className="grid gap-3 sm:grid-cols-3">
            {LINKS_GESTOR.map((l) => (
              <a
                key={l.label}
                href={l.url}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-between gap-2 rounded-2xl border border-border bg-card px-4 py-3 text-sm font-medium transition-colors hover:bg-muted"
              >
                <span className="min-w-0 truncate">{l.label}</span>
                <ExternalLink className="h-4 w-4 shrink-0 text-muted-foreground" />
              </a>
            ))}
          </div>
        </Section>
      </div>
    </AppShell>
  );
}
