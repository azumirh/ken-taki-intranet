import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { EmptyState, Section } from "@/components/kt/section";
import { Mural } from "@/components/kt/mural";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { FILIAIS, HUMORES, filialNome, youtubeEmbed } from "@/lib/kt-data";
import {
  fmtData,
  uid,
  useAjuda,
  useAssinaturas,
  useCheckins,
  useNoticias,
  usePesquisa,
  useSession,
  useSugestoes,
  useVagas,
} from "@/lib/kt-store";

export const Route = createFileRoute("/azumi")({
  head: () => ({
    meta: [
      { title: "Área Azumi RH · Intranet Ken Taki" },
      {
        name: "description",
        content:
          "Área da Azumi RH: publicar mural e notícias em vídeo, abrir pesquisas de clima e acompanhar as unidades Ken Taki.",
      },
      { property: "og:title", content: "Área Azumi RH · Intranet Ken Taki" },
      { property: "og:description", content: "Visão consolidada das unidades Cristo Rei e Champagnat." },
    ],
  }),
  component: AzumiPage,
});

function AzumiPage() {
  const [session, setSession] = useSession();
  if (!session || session.tipo !== "azumi") return <LoginAzumi onLogin={setSession} />;
  return <PainelAzumi />;
}

function LoginAzumi({ onLogin }: { onLogin: (s: never) => void }) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");

  return (
    <AppShell back={<BackLink onClick={() => navigate({ to: "/" })}>voltar ao início</BackLink>}>
      <div className="mx-auto w-full max-w-md surface p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">Área Azumi RH</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Demonstração: <strong>rh@azumirh.com.br</strong> / <strong>123456</strong>
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
          {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
          <Button
            size="lg"
            className="w-full rounded-full"
            onClick={() => {
              if (email.trim() === "rh@azumirh.com.br" && senha === "123456") {
                onLogin({ tipo: "azumi", nome: "Equipe Azumi RH", email } as never);
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

function PainelAzumi() {
  const [checkins] = useCheckins();
  const [assinaturas] = useAssinaturas();
  const [sugestoes] = useSugestoes();
  const [vagas] = useVagas();
  const [ajuda] = useAjuda();
  const [pesquisa, setPesquisa] = usePesquisa();
  const [noticias, setNoticias] = useNoticias();

  const [pTitulo, setPTitulo] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pLink, setPLink] = useState("");

  const [nTitulo, setNTitulo] = useState("");
  const [nResumo, setNResumo] = useState("");
  const [nVideo, setNVideo] = useState("");

  return (
    <AppShell>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Área Azumi RH</h1>
          <p className="text-sm text-muted-foreground">Visão consolidada de Cristo Rei e Champagnat.</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-4">
          {[
            { label: "Check-ins", valor: checkins.length },
            { label: "Assinaturas", valor: assinaturas.length },
            { label: "Sugestões", valor: sugestoes.length },
            { label: "Vagas solicitadas", valor: vagas.length },
          ].map((k) => (
            <div key={k.label} className="surface p-5">
              <p className="text-3xl font-extrabold text-union">{k.valor}</p>
              <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        <Section titulo="Clima por unidade" intro="Distribuição dos check-ins de humor nas duas unidades.">
          <div className="grid gap-4 md:grid-cols-2">
            {FILIAIS.map((f) => {
              const dados = checkins.filter((c) => c.filial === f.id);
              return (
                <div key={f.id} className="rounded-2xl border border-border bg-card p-4">
                  <p className="font-semibold">{f.nome}</p>
                  <p className="text-xs text-muted-foreground">{dados.length} respostas</p>
                  <div className="mt-3 grid grid-cols-5 gap-2 text-center">
                    {HUMORES.map((h) => (
                      <div key={h.id} className="rounded-xl bg-muted py-2">
                        <span className="text-lg">{h.emoji}</span>
                        <p className="text-sm font-bold">{dados.filter((c) => c.humor === h.id).length}</p>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          titulo="Publicar notícia ou vídeo"
          intro="Cole o link do YouTube e o vídeo aparece direto no painel do colaborador."
          contagem={`${noticias.length} publicados`}
        >
          <div className="grid max-w-2xl gap-3">
            <Input placeholder="Título" value={nTitulo} onChange={(e) => setNTitulo(e.target.value)} />
            <Textarea rows={2} placeholder="Resumo" value={nResumo} onChange={(e) => setNResumo(e.target.value)} />
            <Input
              placeholder="Link do vídeo (YouTube)"
              value={nVideo}
              onChange={(e) => setNVideo(e.target.value)}
            />
            {nVideo && youtubeEmbed(nVideo) ? (
              <div className="aspect-video w-full overflow-hidden rounded-xl">
                <iframe src={youtubeEmbed(nVideo)!} title="Prévia" className="h-full w-full" allowFullScreen />
              </div>
            ) : null}
            <div>
              <Button
                className="rounded-full"
                disabled={!nTitulo.trim()}
                onClick={() => {
                  setNoticias([
                    {
                      id: uid(),
                      titulo: nTitulo.trim(),
                      resumo: nResumo.trim(),
                      videoUrl: nVideo.trim() || undefined,
                      data: new Date().toISOString().slice(0, 10),
                    },
                    ...noticias,
                  ]);
                  setNTitulo("");
                  setNResumo("");
                  setNVideo("");
                  toast.success("Notícia publicada para todas as unidades.");
                }}
              >
                Publicar
              </Button>
            </div>
          </div>
        </Section>

        <Section
          titulo="Pesquisa de clima"
          intro="Abra uma pesquisa e ela aparece no painel de colaboradores e gestores."
          contagem={pesquisa?.ativa ? "Ativa" : "Nenhuma ativa"}
        >
          <div className="grid max-w-2xl gap-3">
            <Input placeholder="Título da pesquisa" value={pTitulo} onChange={(e) => setPTitulo(e.target.value)} />
            <Textarea rows={2} placeholder="Descrição" value={pDesc} onChange={(e) => setPDesc(e.target.value)} />
            <Input placeholder="Link do formulário" value={pLink} onChange={(e) => setPLink(e.target.value)} />
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                disabled={!pTitulo.trim()}
                onClick={() => {
                  setPesquisa({
                    id: uid(),
                    titulo: pTitulo.trim(),
                    descricao: pDesc.trim(),
                    link: pLink.trim(),
                    ativa: true,
                    ts: Date.now(),
                  });
                  toast.success("Pesquisa publicada.");
                }}
              >
                Publicar pesquisa
              </Button>
              {pesquisa?.ativa ? (
                <Button variant="outline" className="rounded-full" onClick={() => setPesquisa(null)}>
                  Encerrar pesquisa
                </Button>
              ) : null}
            </div>
          </div>
        </Section>

        <Mural filial="todas" autorPadrao="Equipe Azumi RH" />

        <Section
          titulo="Pedidos de apoio pelo WhatsApp"
          intro="Registro de quem acionou a Azumi RH direto pela intranet."
          contagem={`${ajuda.length} registros`}
        >
          {ajuda.length === 0 ? (
            <EmptyState>Nenhum pedido de apoio registrado ainda.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {ajuda.map((a) => (
                <div key={a.id} className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                  <strong>{a.nome}</strong> · {filialNome(a.filial)} · {fmtData(a.ts)}
                </div>
              ))}
            </div>
          )}
        </Section>

        <Section
          titulo="Vagas solicitadas pelos gestores"
          intro="Solicitações abertas pelas unidades."
          contagem={`${vagas.length} solicitações`}
        >
          {vagas.length === 0 ? (
            <EmptyState>Nenhuma vaga solicitada ainda.</EmptyState>
          ) : (
            <div className="grid gap-3">
              {vagas.map((v) => (
                <div key={v.id} className="rounded-2xl border border-border bg-card px-4 py-3 text-sm">
                  <strong>{v.cargo}</strong> · {filialNome(v.filial)} · {fmtData(v.ts)}
                  {v.motivo ? <p className="text-muted-foreground">{v.motivo}</p> : null}
                </div>
              ))}
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
