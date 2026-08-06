import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { Check, ExternalLink, MessageCircle, UserPlus, Briefcase, UserMinus } from "lucide-react";
import capaPadrao from "@/assets/capa-padrao-politicas.jpg";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { Avatar, EmptyState, Section } from "@/components/kt/section";
import { Mural } from "@/components/kt/mural";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  AZUMI_CONTACT,
  FILIAIS,
  HUMORES,
  filialNome,
  idade,
  type Colaborador,
  type FilialId,
} from "@/lib/kt-data";
import {
  fmtData,
  uid,
  useAjuda,
  useAssinaturas,
  useCheckins,
  useColaboradores,
  useDocumentos,
  useFeedbacks,
  useLeituras,
  usePesquisa,
  useSugestoes,
  useVagas,
} from "@/lib/kt-store";
import { type KtPerfil, useKtAuth } from "@/lib/kt-auth";

export const Route = createFileRoute("/gestor")({
  head: () => ({
    meta: [
      { title: "Painel do gestor · Portal Azumi RH" },
      {
        name: "description",
        content:
          "Área do gestor Ken Taki: clima da equipe, assinaturas de políticas, feedbacks, sugestões e solicitação de vaga.",
      },
      { property: "og:title", content: "Painel do gestor · Portal Azumi RH" },
      {
        property: "og:description",
        content: "Clima, políticas e equipe da sua unidade em um só lugar.",
      },
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
  const { state, login, logout, esqueceuSenha, trocarSenha } = useKtAuth();

  if (state.status === "loading") {
    return (
      <AppShell>
        <div className="flex items-center justify-center py-20">
          <p className="text-sm text-muted-foreground">Carregando...</p>
        </div>
      </AppShell>
    );
  }

  if (state.status === "anon" || state.perfil.tipo !== "gestor") {
    return <LoginGestor onLogin={login} onEsqueceu={esqueceuSenha} />;
  }

  if (state.perfil.precisa_trocar_senha) {
    return <TrocarSenhaObrigatoria onTrocar={trocarSenha} onSair={logout} />;
  }

  return <PainelGestor perfil={state.perfil} onLogout={logout} />;
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginGestor({
  onLogin,
  onEsqueceu,
}: {
  onLogin: (email: string, senha: string) => Promise<void>;
  onEsqueceu: (email: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [filial, setFilial] = useState<string>(FILIAIS[0].id);
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [mostraEsqueceu, setMostraEsqueceu] = useState(false);
  const [emailEnviado, setEmailEnviado] = useState(false);

  if (mostraEsqueceu) {
    return (
      <AppShell
        back={<BackLink onClick={() => setMostraEsqueceu(false)}>voltar ao login</BackLink>}
      >
        <div className="surface mx-auto w-full max-w-md p-6 sm:p-8">
          <h1 className="text-2xl font-extrabold">Recuperar senha</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Digite seu e-mail e enviaremos um link para criar uma nova senha.
          </p>
          {emailEnviado ? (
            <div className="mt-6 rounded-2xl bg-success-soft px-4 py-4">
              <p className="font-semibold">E-mail enviado!</p>
              <p className="mt-1 text-sm text-muted-foreground">
                Verifique sua caixa de entrada (e a pasta de spam) e clique no link.
              </p>
            </div>
          ) : (
            <div className="mt-6 grid gap-4">
              <div className="grid gap-2">
                <Label htmlFor="email-rec">Seu e-mail</Label>
                <Input
                  id="email-rec"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                />
              </div>
              {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
              <Button
                size="lg"
                className="w-full rounded-full"
                disabled={!email.trim() || carregando}
                onClick={async () => {
                  setCarregando(true);
                  setErro("");
                  try {
                    await onEsqueceu(email);
                    setEmailEnviado(true);
                  } catch (e) {
                    setErro((e as Error).message);
                  } finally {
                    setCarregando(false);
                  }
                }}
              >
                {carregando ? "Enviando..." : "Enviar link de recuperação"}
              </Button>
            </div>
          )}
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell back={<BackLink onClick={() => navigate({ to: "/" })}>voltar ao início</BackLink>}>
      <div className="surface mx-auto w-full max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">Área do gestor</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse com seu e-mail e senha de gestor Ken Taki.
        </p>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("senha")?.focus()}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="senha">Senha</Label>
            <Input
              id="senha"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label>Confirme sua unidade</Label>
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
            disabled={!email.trim() || !senha || carregando}
            onClick={async () => {
              setCarregando(true);
              setErro("");
              try {
                await onLogin(email, senha);
              } catch {
                setErro("E-mail ou senha inválidos.");
              } finally {
                setCarregando(false);
              }
            }}
          >
            {carregando ? "Entrando..." : "Entrar"}
          </Button>
          <button
            className="text-center text-sm text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => {
              setMostraEsqueceu(true);
              setEmailEnviado(false);
              setErro("");
            }}
          >
            Esqueci minha senha
          </button>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Troca de senha obrigatória (primeiro acesso) ─────────────────────────────

function TrocarSenhaObrigatoria({
  onTrocar,
  onSair,
}: {
  onTrocar: (senha: string) => Promise<void>;
  onSair: () => void;
}) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [erro, setErro] = useState("");
  const [carregando, setCarregando] = useState(false);

  return (
    <AppShell onLogout={onSair}>
      <div className="surface mx-auto max-w-md p-6 sm:p-8">
        <h1 className="text-2xl font-extrabold">Crie sua senha pessoal</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Este é seu primeiro acesso. Por segurança, crie uma senha própria antes de continuar.
        </p>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="ns">Nova senha</Label>
            <Input
              id="ns"
              type="password"
              value={senha}
              placeholder="Mínimo 8 caracteres"
              onChange={(e) => setSenha(e.target.value)}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="cs">Confirmar senha</Label>
            <Input
              id="cs"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
            />
          </div>
          {erro ? <p className="text-sm font-medium text-destructive">{erro}</p> : null}
          <Button
            size="lg"
            className="w-full rounded-full"
            disabled={senha.length < 8 || carregando}
            onClick={async () => {
              if (senha !== confirmar) {
                setErro("As senhas não coincidem.");
                return;
              }
              setCarregando(true);
              setErro("");
              try {
                await onTrocar(senha);
                toast.success("Senha criada com sucesso!");
              } catch (e) {
                setErro((e as Error).message);
              } finally {
                setCarregando(false);
              }
            }}
          >
            {carregando ? "Salvando..." : "Criar senha e acessar"}
          </Button>
        </div>
      </div>
    </AppShell>
  );
}

// ─── Painel ───────────────────────────────────────────────────────────────────

function PainelGestor({ perfil, onLogout }: { perfil: KtPerfil; onLogout: () => void }) {
  const [checkins] = useCheckins();
  const [assinaturas] = useAssinaturas();
  const [leituras] = useLeituras();
  const [sugestoes] = useSugestoes();
  const [feedbacks] = useFeedbacks();
  const [pesquisa] = usePesquisa();
  const [vagas, setVagas] = useVagas();
  const [colaboradores, setColaboradores] = useColaboradores();
  const [documentos] = useDocumentos();
  const [ajuda, setAjuda] = useAjuda();

  const [desligarTarget, setDesligarTarget] = useState<Colaborador | null>(null);

  const [vagaOpen, setVagaOpen] = useState(false);
  const [cargo, setCargo] = useState("");
  const [motivo, setMotivo] = useState("");

  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [filtroCargoEquipe, setFiltroCargoEquipe] = useState("Todos");
  const [nomeCol, setNomeCol] = useState("");
  const [cpf3Col, setCpf3Col] = useState("");
  const [cargoCol, setCargoCol] = useState("");
  const [nascimentoCol, setNascimentoCol] = useState("");
  const [admissaoCol, setAdmissaoCol] = useState("");
  const [erroCol, setErroCol] = useState("");

  const session = { nome: perfil.nome, filial: perfil.filial! };
  const daUnidade = <T extends { filial: string }>(arr: T[]) =>
    arr.filter((i) => i.filial === session.filial);
  const meusCheckins = daUnidade(checkins);
  const equipe = colaboradores.filter((c) => c.filial === session.filial);
  const cargosUnicos = ["Todos", ...Array.from(new Set(equipe.map((c) => c.cargo))).sort()];
  const equipeFiltrada =
    filtroCargoEquipe === "Todos" ? equipe : equipe.filter((c) => c.cargo === filtroCargoEquipe);

  return (
    <AppShell onLogout={onLogout}>
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

        <div className="grid gap-3 sm:grid-cols-2">
          <Dialog
            open={vagaOpen}
            onOpenChange={(o) => {
              setVagaOpen(o);
              if (!o) {
                setCargo("");
                setMotivo("");
              }
            }}
          >
            <DialogTrigger asChild>
              <Button
                size="lg"
                className="w-full justify-start gap-3 rounded-2xl px-5 py-4 text-left h-auto"
              >
                <Briefcase className="h-5 w-5 shrink-0" />
                <div>
                  <p className="font-bold">Solicitar vaga</p>
                  <p className="text-xs font-normal opacity-80">
                    Abra uma solicitação com a Azumi RH
                  </p>
                </div>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Solicitar vaga</DialogTitle>
                <DialogDescription>
                  Precisa de reforço? A Azumi RH receberá o pedido e entrará em contato.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="vaga-cargo">Cargo desejado</Label>
                  <Input
                    id="vaga-cargo"
                    placeholder="Ex.: Atendente"
                    value={cargo}
                    onChange={(e) => setCargo(e.target.value)}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="vaga-motivo">Motivo (opcional)</Label>
                  <Textarea
                    id="vaga-motivo"
                    rows={3}
                    placeholder="Substituição, aumento de quadro, sazonalidade..."
                    value={motivo}
                    onChange={(e) => setMotivo(e.target.value)}
                  />
                </div>
                {daUnidade(vagas).length > 0 && (
                  <div className="grid gap-2">
                    <p className="text-xs font-semibold text-muted-foreground">
                      Solicitações anteriores
                    </p>
                    {daUnidade(vagas).map((v) => (
                      <div key={v.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                        <strong>{v.cargo}</strong> · {fmtData(v.ts)}
                        {v.motivo ? <p className="text-muted-foreground">{v.motivo}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
                <Button
                  className="w-full rounded-full"
                  disabled={!cargo.trim()}
                  onClick={() => {
                    setVagas([
                      {
                        id: uid(),
                        cargo: cargo.trim(),
                        motivo: motivo.trim(),
                        filial: session.filial,
                        ts: Date.now(),
                      },
                      ...vagas,
                    ]);
                    setCargo("");
                    setMotivo("");
                    setVagaOpen(false);
                    toast.success("Solicitação enviada à Azumi RH.");
                  }}
                >
                  Enviar solicitação
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <a
            href={`https://wa.me/${AZUMI_CONTACT.whatsapp}?text=${encodeURIComponent(`Olá, sou ${session.nome}, gestor(a) da unidade ${filialNome(session.filial)}. Gostaria de falar com o consultor Azumi RH.`)}`}
            target="_blank"
            rel="noreferrer"
            onClick={() =>
              setAjuda([
                ...ajuda,
                {
                  id: uid(),
                  nome: session.nome,
                  filial: session.filial,
                  assunto: "whatsapp-gestor",
                  ts: Date.now(),
                },
              ])
            }
            className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-sm transition-colors hover:bg-muted"
          >
            <MessageCircle className="h-5 w-5 shrink-0 text-success" />
            <div>
              <p className="font-bold">Fale com o consultor Azumi</p>
              <p className="text-xs text-muted-foreground">
                {AZUMI_CONTACT.whatsappLabel} · WhatsApp
              </p>
            </div>
          </a>
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
                <div
                  key={h.id}
                  className="rounded-2xl border border-border bg-card p-4 text-center"
                >
                  <span className="text-2xl">{h.emoji}</span>
                  <p className="mt-1 text-lg font-bold">{n}</p>
                  <p className="text-xs text-muted-foreground">{h.label}</p>
                </div>
              );
            })}
          </div>
        </Section>

        <Section
          titulo="Documentos e políticas"
          intro="Documentos publicados para esta unidade. Veja quem assinou e quem está pendente."
          contagem={`${documentos.filter((d) => d.filial === session.filial || d.filial === "todas").length} documentos`}
        >
          {documentos.filter((d) => d.filial === session.filial || d.filial === "todas").length ===
          0 ? (
            <EmptyState>Nenhum documento publicado para esta unidade ainda.</EmptyState>
          ) : (
            <div className="grid gap-5">
              {documentos
                .filter((d) => d.filial === session.filial || d.filial === "todas")
                .map((doc) => {
                  const assinantes = daUnidade(assinaturas).filter((a) => a.politica === doc.id);
                  const leram = daUnidade(leituras).filter((l) => l.documentoId === doc.id);
                  const nomesAssinantes = new Set(assinantes.map((a) => a.nome));
                  const pendentes = equipe.filter(
                    (c) => !nomesAssinantes.has(c.nome) && leram.some((l) => l.nome === c.nome),
                  );
                  return (
                    <div
                      key={doc.id}
                      className="overflow-hidden rounded-2xl border border-border bg-card"
                    >
                      <div className="relative">
                        <img
                          src={capaPadrao}
                          alt=""
                          width={1024}
                          height={256}
                          loading="lazy"
                          className="h-20 w-full object-cover"
                        />
                        <span
                          className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                          style={{ backgroundColor: doc.corTag }}
                        >
                          {doc.textoTag}
                        </span>
                      </div>
                      <div className="p-4">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <h3 className="font-semibold">{doc.titulo}</h3>
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                          >
                            <ExternalLink className="h-3.5 w-3.5" /> Abrir
                          </a>
                        </div>
                        <div className="mt-3 flex flex-wrap gap-3 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-success">
                            <Check className="h-3 w-3" /> {assinantes.length} assinaturas
                          </span>
                          <span className="rounded-full bg-warn-soft px-2.5 py-1 text-warn">
                            {pendentes.length} leram e não assinaram
                          </span>
                        </div>
                        {pendentes.length > 0 && (
                          <div className="mt-3">
                            <p className="text-xs font-medium text-muted-foreground">
                              Pendentes de assinatura:
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              {pendentes.map((c) => (
                                <span
                                  key={c.id}
                                  className="rounded-full bg-muted px-2.5 py-1 text-xs"
                                >
                                  {c.nome.split(" ")[0]}
                                </span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
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
                    <span className="rounded-full bg-kt-soft px-2.5 py-1 font-semibold text-kt">
                      {f.tipo}
                    </span>
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
                    <span className="rounded-full bg-az-soft px-2.5 py-1 font-semibold text-az">
                      {s.categoria}
                    </span>
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
            <div className="rounded-2xl border border-az bg-az-soft p-5">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <h3 className="font-bold">{pesquisa.titulo}</h3>
                {pesquisa.prazo &&
                  (() => {
                    const dias = Math.ceil(
                      (new Date(pesquisa.prazo + "T00:00:00").getTime() -
                        new Date().setHours(0, 0, 0, 0)) /
                        86400000,
                    );
                    return (
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
                    );
                  })()}
              </div>
              <p className="mt-1 text-sm text-muted-foreground">{pesquisa.descricao}</p>
              {pesquisa.link && (
                <a
                  href={pesquisa.link}
                  target="_blank"
                  rel="noreferrer"
                  className="mt-3 inline-flex items-center gap-1 rounded-full bg-az px-3 py-1.5 text-xs font-semibold text-primary-foreground"
                >
                  Responder pesquisa <ExternalLink className="h-3 w-3" />
                </a>
              )}
            </div>
          ) : (
            <EmptyState>Nenhuma pesquisa ativa no momento.</EmptyState>
          )}
        </Section>

        <Mural filial={session.filial} autorPadrao={`${session.nome} (gestão)`} />

        <Section
          titulo="Equipe da unidade"
          intro="Time cadastrado nesta unidade."
          contagem={`${equipe.length} pessoas`}
          acao={
            <Dialog
              open={cadastrarOpen}
              onOpenChange={(o) => {
                setCadastrarOpen(o);
                if (!o) {
                  setNomeCol("");
                  setCpf3Col("");
                  setCargoCol("");
                  setNascimentoCol("");
                  setAdmissaoCol("");
                  setErroCol("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-full">
                  <UserPlus className="h-3.5 w-3.5" /> Cadastrar colaborador
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-md">
                <DialogHeader>
                  <DialogTitle>Cadastrar colaborador</DialogTitle>
                  <DialogDescription>
                    Adicione um novo membro à unidade {filialNome(session.filial)}.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="col-nome">Nome completo</Label>
                    <Input
                      id="col-nome"
                      value={nomeCol}
                      onChange={(e) => setNomeCol(e.target.value)}
                      maxLength={80}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="col-cpf3">Últimos 3 dígitos do CPF</Label>
                    <Input
                      id="col-cpf3"
                      inputMode="numeric"
                      maxLength={3}
                      value={cpf3Col}
                      onChange={(e) => setCpf3Col(e.target.value.replace(/\D/g, ""))}
                      className="w-28 tracking-[0.4em]"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="col-cargo">Cargo</Label>
                    <Input
                      id="col-cargo"
                      value={cargoCol}
                      onChange={(e) => setCargoCol(e.target.value)}
                      maxLength={60}
                    />
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="grid gap-2">
                      <Label htmlFor="col-nasc">Data de nascimento</Label>
                      <Input
                        id="col-nasc"
                        type="date"
                        value={nascimentoCol}
                        onChange={(e) => setNascimentoCol(e.target.value)}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="col-adm">Data de admissão</Label>
                      <Input
                        id="col-adm"
                        type="date"
                        value={admissaoCol}
                        onChange={(e) => setAdmissaoCol(e.target.value)}
                      />
                    </div>
                  </div>
                  {erroCol ? (
                    <p className="text-sm font-medium text-destructive">{erroCol}</p>
                  ) : null}
                  <Button
                    className="w-full rounded-full"
                    disabled={!nomeCol.trim() || cpf3Col.length !== 3 || !cargoCol.trim()}
                    onClick={() => {
                      const duplicado = colaboradores.find(
                        (c) => c.filial === session.filial && c.cpf3 === cpf3Col,
                      );
                      if (duplicado) {
                        setErroCol(
                          `CPF ${cpf3Col} já cadastrado nesta unidade (${duplicado.nome}).`,
                        );
                        return;
                      }
                      setErroCol("");
                      setColaboradores([
                        ...colaboradores,
                        {
                          id: uid(),
                          nome: nomeCol.trim(),
                          cpf3: cpf3Col,
                          cargo: cargoCol.trim(),
                          filial: session.filial as FilialId,
                          nascimento: nascimentoCol || "2000-01-01",
                          admissao: admissaoCol || new Date().toISOString().slice(0, 10),
                        },
                      ]);
                      setNomeCol("");
                      setCpf3Col("");
                      setCargoCol("");
                      setNascimentoCol("");
                      setAdmissaoCol("");
                      setCadastrarOpen(false);
                      toast.success("Colaborador cadastrado com sucesso!");
                    }}
                  >
                    Cadastrar colaborador
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        >
          {equipe.length === 0 ? (
            <EmptyState>Nenhum colaborador cadastrado nesta unidade ainda.</EmptyState>
          ) : (
            <div className="grid gap-4">
              {cargosUnicos.length > 2 && (
                <div className="flex flex-wrap gap-2">
                  {cargosUnicos.map((c) => (
                    <button
                      key={c}
                      onClick={() => setFiltroCargoEquipe(c)}
                      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                        filtroCargoEquipe === c
                          ? "border-kt bg-kt-soft text-kt"
                          : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                      }`}
                    >
                      {c}
                    </button>
                  ))}
                </div>
              )}
              <div className="overflow-x-auto rounded-2xl border border-border">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/40">
                      <th className="px-4 py-3 text-left font-semibold">Nome</th>
                      <th className="px-4 py-3 text-left font-semibold">Cargo</th>
                      <th className="px-4 py-3 text-left font-semibold">Idade</th>
                      <th className="px-4 py-3 text-left font-semibold">Na casa desde</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {equipeFiltrada.map((c) => (
                      <tr key={c.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar nome={c.nome} foto={c.foto} size={32} />
                            <span className="font-medium">{c.nome}</span>
                          </div>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">{c.cargo}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {idade(c.nascimento)} anos
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {new Date(c.admissao + "T00:00:00").getFullYear()}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setDesligarTarget(c)}
                            title="Desligar colaborador"
                            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                          >
                            <UserMinus className="h-4 w-4" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </Section>

        <Dialog
          open={!!desligarTarget}
          onOpenChange={(o) => {
            if (!o) setDesligarTarget(null);
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Desligar colaborador</DialogTitle>
              <DialogDescription>
                Tem certeza que deseja desligar <strong>{desligarTarget?.nome}</strong>? O cadastro
                será removido desta unidade.
              </DialogDescription>
            </DialogHeader>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setDesligarTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                variant="destructive"
                className="rounded-full"
                onClick={() => {
                  if (!desligarTarget) return;
                  setColaboradores(colaboradores.filter((c) => c.id !== desligarTarget.id));
                  toast.success(`${desligarTarget.nome.split(" ")[0]} foi desligado(a).`);
                  setDesligarTarget(null);
                }}
              >
                Confirmar desligamento
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        <Section
          titulo="Documentos e processos"
          intro="Atalhos para as pastas e materiais da unidade."
        >
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
