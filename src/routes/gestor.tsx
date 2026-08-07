import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
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
  useMural,
  usePesquisa,
  useSugestoes,
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
  const [assinaturas, setAssinaturas] = useAssinaturas();
  const [leituras, setLeituras] = useLeituras();
  const [sugestoes, setSugestoes] = useSugestoes();
  const [feedbacks, setFeedbacks] = useFeedbacks();
  const [pesquisa] = usePesquisa();
  const [colaboradores, setColaboradores] = useColaboradores();
  const [documentos] = useDocumentos();
  const [ajuda, setAjuda] = useAjuda();
  const [mural, setMural] = useMural();

  const [desligarTarget, setDesligarTarget] = useState<Colaborador | null>(null);
  const [cadastrarOpen, setCadastrarOpen] = useState(false);
  const [editarTarget, setEditarTarget] = useState<Colaborador | null>(null);
  const [filtroCargoEquipe, setFiltroCargoEquipe] = useState("Todos");
  const [nomeCol, setNomeCol] = useState("");
  const [cpf3Col, setCpf3Col] = useState("");
  const [cargoCol, setCargoCol] = useState("");
  const [nascimentoCol, setNascimentoCol] = useState("");
  const [admissaoCol, setAdmissaoCol] = useState("");
  const [erroCol, setErroCol] = useState("");

  // clima chart
  const [climaPeriodo, setClimaPeriodo] = useState<"7d" | "30d">("7d");
  const [drillDia, setDrillDia] = useState<string | null>(null);
  const [drillBusca, setDrillBusca] = useState("");

  // feedback filters
  const [fbPagina, setFbPagina] = useState(0);
  const [fbFiltroMes, setFbFiltroMes] = useState("Todos");
  const [fbFiltroColab, setFbFiltroColab] = useState("");

  // documento categoria filter
  const [filtroDocTag, setFiltroDocTag] = useState("Todos");

  const session = { nome: perfil.nome, filial: perfil.filial! };
  const daUnidade = <T extends { filial: string }>(arr: T[]) =>
    arr.filter((i) => i.filial === session.filial);
  const meusCheckins = daUnidade(checkins);
  const equipe = colaboradores.filter((c) => c.filial === session.filial);
  const cargosUnicos = ["Todos", ...Array.from(new Set(equipe.map((c) => c.cargo))).sort()];
  const equipeFiltrada =
    filtroCargoEquipe === "Todos" ? equipe : equipe.filter((c) => c.cargo === filtroCargoEquipe);

  function tempoDeCasa(admissao: string): string {
    const anos = idade(admissao);
    if (anos < 1) {
      const meses = Math.floor(
        (Date.now() - new Date(admissao + "T00:00:00").getTime()) / (30 * 24 * 3600 * 1000),
      );
      return meses <= 1 ? "menos de 1 mês" : `${meses} meses`;
    }
    return `${anos} ano${anos > 1 ? "s" : ""}`;
  }

  const hoje = new Date();
  const aniversariantesEquipe = equipe.filter((c) => {
    const d = new Date(c.nascimento + "T00:00:00");
    return d.getMonth() === hoje.getMonth();
  });
  const anivAdmissao = equipe.filter((c) => {
    const d = new Date(c.admissao + "T00:00:00");
    return d.getMonth() === hoje.getMonth() && d.getDate() === hoje.getDate();
  });

  // climate chart data
  const numDias = climaPeriodo === "7d" ? 7 : 30;
  // check-ins from this unit that the gestor can see by name (private Azumi requests excluded)
  // privacy rule: if someone chose "falar só com a Azumi" for a check-in (assunto = "Apoio - check-in negativo"),
  // hide their name. Matched by same person + same hour bucket.
  const apoioPrivadoSet = new Set(
    daUnidade(ajuda)
      .filter((a) => a.assunto === "Apoio - check-in negativo")
      .map((a) => `${a.nome}:${Math.floor(a.ts / 3_600_000)}`),
  );
  const isPrivadoGestor = (c: { nome: string; ts: number }) =>
    apoioPrivadoSet.has(`${c.nome}:${Math.floor(c.ts / 3_600_000)}`);

  const dadosCli = Array.from({ length: numDias }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (numDias - 1 - i));
    const ds = d.toDateString();
    const doDia = meusCheckins.filter((c) => new Date(c.ts).toDateString() === ds);
    return {
      data: d.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }),
      dataStr: ds,
      Pos: doDia.filter((c) => HUMORES.find((h) => h.id === c.humor)?.categoria === "positiva")
        .length,
      Neu: doDia.filter((c) => HUMORES.find((h) => h.id === c.humor)?.categoria === "neutra")
        .length,
      Neg: doDia.filter((c) => HUMORES.find((h) => h.id === c.humor)?.categoria === "negativa")
        .length,
    };
  });

  const drillCheckins = drillDia
    ? meusCheckins.filter((c) => new Date(c.ts).toDateString() === drillDia)
    : [];

  const recadosRecentes = meusCheckins
    .filter((c) => c.recado)
    .sort((a, b) => b.ts - a.ts)
    .slice(0, 5);

  // feedback filtered + paginated
  const mesesFB = [
    "Todos",
    ...Array.from(
      new Set(
        daUnidade(feedbacks).map((f) =>
          new Date(f.ts).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }),
        ),
      ),
    ),
  ];
  const fbFiltrado = daUnidade(feedbacks)
    .filter((f) => {
      const mesOk =
        fbFiltroMes === "Todos" ||
        new Date(f.ts).toLocaleDateString("pt-BR", { month: "long", year: "numeric" }) ===
          fbFiltroMes;
      const colabOk =
        !fbFiltroColab.trim() || f.autor.toLowerCase().includes(fbFiltroColab.toLowerCase());
      return mesOk && colabOk;
    })
    .sort((a, b) => b.ts - a.ts);
  const FB_POR_PAG = 10;
  const fbPaginado = fbFiltrado.slice(fbPagina * FB_POR_PAG, (fbPagina + 1) * FB_POR_PAG);
  const fbTotalPags = Math.max(1, Math.ceil(fbFiltrado.length / FB_POR_PAG));

  // documento helpers
  const docsFilial = documentos.filter((d) => d.filial === session.filial || d.filial === "todas");
  const tagsUnicas = ["Todos", ...Array.from(new Set(docsFilial.map((d) => d.textoTag))).sort()];
  const docsFiltrados =
    filtroDocTag === "Todos" ? docsFilial : docsFilial.filter((d) => d.textoTag === filtroDocTag);

  const assinou = (docId: string, nome: string) =>
    assinaturas.some((a) => a.politica === docId && a.nome === nome);
  const leu = (docId: string, nome: string) =>
    leituras.some((l) => l.documentoId === docId && l.nome === nome);

  const assinarDocGestor = (docId: string) => {
    if (assinou(docId, session.nome)) return;
    if (!leu(docId, session.nome)) {
      setLeituras((prev) => [
        { documentoId: docId, nome: session.nome, filial: session.filial, ts: Date.now() },
        ...prev,
      ]);
    }
    setAssinaturas((prev) => [
      ...prev,
      { politica: docId, nome: session.nome, filial: session.filial, ts: Date.now() },
    ]);
    toast.success("Documento assinado.");
  };

  return (
    <AppShell onLogout={onLogout}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            👋 Olá, {session.nome.split(" ")[0]}!
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bem-vindo(a) à intranet do Ken Taki × Azumi RH
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestor(a) · unidade{" "}
            <strong className="text-foreground">{filialNome(session.filial)}</strong>
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
          <a
            href="https://portal.azumirh.com.br/vaga"
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 rounded-2xl bg-kt px-5 py-4 text-primary-foreground transition-colors hover:bg-kt/90"
          >
            <Briefcase className="h-5 w-5 shrink-0" />
            <div>
              <p className="font-bold">Solicitar vaga</p>
              <p className="text-xs font-normal opacity-80">Abrir portal de vagas Azumi RH</p>
            </div>
          </a>

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

        {/* Clima — gráfico + resumo */}
        <Section
          titulo="Clima da equipe"
          intro="Como o time respondeu ao check-in diário nesta unidade."
          contagem={`${meusCheckins.length} respostas`}
          collapsible
          defaultOpen={meusCheckins.length > 0}
        >
          <div className="grid gap-5">
            {/* Emoji totais */}
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

            {/* Gráfico por dia */}
            {meusCheckins.length > 0 && (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-medium">Período:</span>
                  {(["7d", "30d"] as const).map((p) => (
                    <button
                      key={p}
                      onClick={() => setClimaPeriodo(p)}
                      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                        climaPeriodo === p
                          ? "border-kt bg-kt-soft text-kt"
                          : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {p === "7d" ? "7 dias" : "30 dias"}
                    </button>
                  ))}
                </div>
                <div className="h-44 w-full cursor-pointer">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={dadosCli}
                      margin={{ top: 4, right: 4, bottom: 0, left: -20 }}
                      onClick={(d) => {
                        const ds = d?.activePayload?.[0]?.payload?.dataStr as string | undefined;
                        if (ds) setDrillDia((prev) => (prev === ds ? null : ds));
                      }}
                    >
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar dataKey="Pos" name="Positivos" stackId="a" fill="#22c55e" />
                      <Bar dataKey="Neu" name="Neutros" stackId="a" fill="#f59e0b" />
                      <Bar
                        dataKey="Neg"
                        name="Negativos"
                        stackId="a"
                        fill="#ef4444"
                        radius={[3, 3, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="text-center text-[11px] text-muted-foreground">
                  Clique em uma barra para ver os check-ins do dia
                </p>

                {/* Drill-down tabela */}
                {drillDia && drillCheckins.length > 0 && (
                  <div className="rounded-2xl border border-border bg-muted/50 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {new Date(drillDia).toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}{" "}
                        · {drillCheckins.length} check-in
                        {drillCheckins.length > 1 ? "s" : ""}
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Buscar por nome..."
                          value={drillBusca}
                          onChange={(e) => setDrillBusca(e.target.value)}
                          className="h-8 w-40 text-xs"
                        />
                        <button
                          className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                          onClick={() => {
                            setDrillDia(null);
                            setDrillBusca("");
                          }}
                        >
                          Fechar
                        </button>
                      </div>
                    </div>
                    <div className="overflow-x-auto rounded-xl border border-border">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="px-3 py-2 text-left font-semibold">Humor</th>
                            <th className="px-3 py-2 text-left font-semibold">Nome</th>
                            <th className="px-3 py-2 text-left font-semibold">Horário</th>
                            <th className="px-3 py-2 text-left font-semibold">Comentário</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillCheckins
                            .filter((c) => {
                              if (!drillBusca) return true;
                              const privado = isPrivadoGestor(c);
                              return (
                                !privado &&
                                c.nome.toLowerCase().includes(drillBusca.toLowerCase())
                              );
                            })
                            .map((c) => {
                              const h = HUMORES.find((x) => x.id === c.humor);
                              const privado = isPrivadoGestor(c);
                              return (
                                <tr
                                  key={c.id}
                                  className="border-b border-border last:border-0"
                                >
                                  <td className="px-3 py-2 text-base">{h?.emoji}</td>
                                  <td
                                    className={`px-3 py-2 ${privado ? "italic text-muted-foreground" : "font-medium"}`}
                                  >
                                    {privado ? "— privado" : c.nome}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                                    {new Date(c.ts).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {!privado && c.recado ? c.recado : "—"}
                                  </td>
                                </tr>
                              );
                            })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Comentários recentes */}
            {recadosRecentes.length > 0 && (
              <div className="grid gap-2">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                  Comentários recentes
                </p>
                {recadosRecentes.map((c) => (
                  <div key={c.id} className="rounded-xl bg-muted px-3 py-2 text-sm">
                    <p className="text-foreground">{c.recado}</p>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {c.nome} · {fmtData(c.ts)}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </Section>

        {/* Documentos e políticas */}
        <Section
          titulo="Documentos e políticas"
          intro="Documentos publicados para esta unidade. Você também pode assinar como gestor(a)."
          contagem={`${docsFilial.length} documentos`}
          collapsible
          defaultOpen={docsFilial.length > 0}
        >
          {docsFilial.length === 0 ? (
            <EmptyState>Nenhum documento publicado para esta unidade ainda.</EmptyState>
          ) : (
            <div className="grid gap-5">
              {/* Filtro por tag/categoria */}
              {tagsUnicas.length > 2 && (
                <div className="flex flex-wrap gap-2">
                  {tagsUnicas.map((tag) => (
                    <button
                      key={tag}
                      onClick={() => setFiltroDocTag(tag)}
                      className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                        filtroDocTag === tag
                          ? "border-kt bg-kt-soft text-kt"
                          : "border-border text-muted-foreground hover:border-foreground"
                      }`}
                    >
                      {tag}
                    </button>
                  ))}
                </div>
              )}
              {docsFiltrados.map((doc) => {
                const assinantes = assinaturas.filter((a) => a.politica === doc.id);
                const leram = leituras.filter(
                  (l) =>
                    l.documentoId === doc.id &&
                    (l.filial === session.filial || doc.filial === "todas"),
                );
                const nomesAssinantes = new Set(assinantes.map((a) => a.nome));
                const pendentes = equipe.filter(
                  (c) => !nomesAssinantes.has(c.nome) && leram.some((l) => l.nome === c.nome),
                );
                const gestorJaAssinou = assinou(doc.id, session.nome);
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
                      {gestorJaAssinou && (
                        <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                          <Check className="h-3 w-3" /> Assinado
                        </span>
                      )}
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
                      <div className="mt-3 flex flex-wrap gap-2 text-xs">
                        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2.5 py-1 text-success">
                          <Check className="h-3 w-3" /> {assinantes.length} assinaturas
                        </span>
                        {pendentes.length > 0 && (
                          <span className="rounded-full bg-warn-soft px-2.5 py-1 text-warn">
                            {pendentes.length} leram e não assinaram
                          </span>
                        )}
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
                      {!gestorJaAssinou && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="mt-3 rounded-full"
                          onClick={() => assinarDocGestor(doc.id)}
                        >
                          <Check className="h-3.5 w-3.5" /> Assinar como gestor(a)
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Feedbacks — tabela com paginação */}
        <Section
          titulo="Feedbacks da equipe"
          intro="Elogios, críticas, dúvidas e situações registradas pelo time."
          contagem={`${daUnidade(feedbacks).length} recebidos`}
          collapsible
          defaultOpen={daUnidade(feedbacks).length > 0}
        >
          {daUnidade(feedbacks).length === 0 ? (
            <EmptyState>Nenhum feedback recebido ainda.</EmptyState>
          ) : (
            <div className="grid gap-4">
              {/* Filtros */}
              <div className="flex flex-wrap items-end gap-3">
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Mês</label>
                  <select
                    value={fbFiltroMes}
                    onChange={(e) => {
                      setFbFiltroMes(e.target.value);
                      setFbPagina(0);
                    }}
                    className="rounded-lg border border-border bg-card px-3 py-1.5 text-sm"
                  >
                    {mesesFB.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="grid gap-1">
                  <label className="text-xs font-medium text-muted-foreground">Colaborador</label>
                  <Input
                    placeholder="Filtrar por nome..."
                    value={fbFiltroColab}
                    onChange={(e) => {
                      setFbFiltroColab(e.target.value);
                      setFbPagina(0);
                    }}
                    className="h-9 w-48 text-sm"
                  />
                </div>
                {(fbFiltroMes !== "Todos" || fbFiltroColab) && (
                  <button
                    onClick={() => {
                      setFbFiltroMes("Todos");
                      setFbFiltroColab("");
                      setFbPagina(0);
                    }}
                    className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                  >
                    Limpar filtros
                  </button>
                )}
              </div>

              {fbFiltrado.length === 0 ? (
                <EmptyState>Nenhum feedback corresponde aos filtros.</EmptyState>
              ) : (
                <>
                  <div className="overflow-x-auto rounded-2xl border border-border">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-border bg-muted/40">
                          <th className="px-4 py-3 text-left font-semibold">Tipo</th>
                          <th className="px-4 py-3 text-left font-semibold">Autor</th>
                          <th className="px-4 py-3 text-left font-semibold">Data</th>
                          <th className="px-4 py-3 text-left font-semibold">Mensagem</th>
                          <th className="px-4 py-3 text-left font-semibold">Status</th>
                          <th className="px-4 py-3 text-left font-semibold">Comentário</th>
                        </tr>
                      </thead>
                      <tbody>
                        {fbPaginado.map((f) => (
                          <tr key={f.id} className="border-b border-border last:border-0">
                            <td className="px-4 py-3">
                              <span className="rounded-full bg-kt-soft px-2.5 py-1 text-xs font-semibold text-kt">
                                {f.tipo}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-muted-foreground">{f.autor}</td>
                            <td className="px-4 py-3 whitespace-nowrap text-muted-foreground">
                              {fmtData(f.ts)}
                            </td>
                            <td className="px-4 py-3 text-muted-foreground max-w-xs">
                              {f.mensagem}
                            </td>
                            <td className="px-4 py-2">
                              <select
                                className={`rounded-full border px-2 py-1 text-[11px] font-medium focus:outline-none ${
                                  f.status === "concluido"
                                    ? "border-success/30 bg-success-soft text-success"
                                    : "border-warn/30 bg-warn-soft text-warn"
                                }`}
                                value={f.status ?? "em-andamento"}
                                onChange={(e) =>
                                  setFeedbacks((prev) =>
                                    prev.map((x) =>
                                      x.id === f.id
                                        ? {
                                            ...x,
                                            status: e.target.value as
                                              | "em-andamento"
                                              | "concluido",
                                          }
                                        : x,
                                    ),
                                  )
                                }
                              >
                                <option value="em-andamento">Em andamento</option>
                                <option value="concluido">Concluído</option>
                              </select>
                            </td>
                            <td className="px-4 py-2 min-w-[160px]">
                              <input
                                type="text"
                                className="w-full rounded-lg border border-border bg-transparent px-2 py-1 text-xs text-muted-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:ring-1 focus:ring-kt/30"
                                placeholder="Adicionar comentário..."
                                value={f.comentarioGestor ?? ""}
                                onChange={(e) => {
                                  const v = e.target.value;
                                  setFeedbacks((prev) =>
                                    prev.map((x) =>
                                      x.id === f.id ? { ...x, comentarioGestor: v } : x,
                                    ),
                                  );
                                }}
                              />
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  {fbTotalPags > 1 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">
                        {fbFiltrado.length} resultado{fbFiltrado.length > 1 ? "s" : ""} · página{" "}
                        {fbPagina + 1} de {fbTotalPags}
                      </span>
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={fbPagina === 0}
                          onClick={() => setFbPagina((p) => p - 1)}
                        >
                          Anterior
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="rounded-full"
                          disabled={fbPagina >= fbTotalPags - 1}
                          onClick={() => setFbPagina((p) => p + 1)}
                        >
                          Próxima
                        </Button>
                      </div>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </Section>

        <Section
          titulo="Caixinha de sugestão"
          intro="Sugestões anônimas do time desta unidade."
          contagem={`${daUnidade(sugestoes).length} sugestões`}
          collapsible
          defaultOpen={daUnidade(sugestoes).length > 0}
        >
          {daUnidade(sugestoes).length === 0 ? (
            <EmptyState>Nenhuma sugestão registrada ainda.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                    <th className="px-4 py-3 text-left font-semibold">Sugestão</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {daUnidade(sugestoes).map((s) => (
                    <tr key={s.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-3">
                        <span className="rounded-full bg-az-soft px-2.5 py-1 text-xs font-semibold text-az">
                          {s.categoria}
                        </span>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                        {fmtData(s.ts)}
                      </td>
                      <td className="px-4 py-3 text-muted-foreground max-w-xs">{s.mensagem}</td>
                      <td className="px-4 py-2 min-w-[180px]">
                        <select
                          className="w-full rounded-lg border border-border bg-card px-2 py-1 text-xs focus:outline-none"
                          value={s.status ?? ""}
                          onChange={(e) => {
                            const v = e.target.value as
                              | "enviado-rh"
                              | "desconsiderado"
                              | "considerar-depois"
                              | "para-socios"
                              | "";
                            setSugestoes((prev) =>
                              prev.map((x) =>
                                x.id === s.id
                                  ? {
                                      ...x,
                                      ...(v ? { status: v, statusTs: Date.now() } : {}),
                                    }
                                  : x,
                              ),
                            );
                          }}
                        >
                          <option value="">— Sem status —</option>
                          <option value="enviado-rh">Enviado para o RH</option>
                          <option value="para-socios">Levado para os sócios</option>
                          <option value="considerar-depois">Considerar em outro momento</option>
                          <option value="desconsiderado">Desconsiderado</option>
                        </select>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        <Section
          titulo="Pesquisa de clima"
          intro="Pesquisas publicadas pela Azumi RH aparecem aqui e no painel do time."
          contagem={pesquisa?.ativa ? "1 ativa" : "Nenhuma ativa"}
          collapsible
          defaultOpen={!!pesquisa?.ativa}
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

        <Mural
          filial={session.filial}
          autorPadrao={`${session.nome} (gestão)`}
          collapsible
          defaultOpen
        />

        <Section
          titulo="Equipe da unidade"
          intro="Time cadastrado nesta unidade."
          contagem={`${equipe.length} pessoas`}
          collapsible
          defaultOpen={equipe.length > 0}
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
                      <th className="px-4 py-3 text-left font-semibold">Tempo de casa</th>
                      <th className="px-4 py-3 text-left font-semibold">Admissão</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {equipeFiltrada.map((c) => {
                      const anivEsseMes = aniversariantesEquipe.some((a) => a.id === c.id);
                      return (
                        <tr key={c.id} className="border-b border-border last:border-0">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <Avatar nome={c.nome} foto={c.foto} size={32} />
                              <div>
                                <span className="font-medium">{c.nome}</span>
                                {anivEsseMes && (
                                  <span
                                    className="ml-1.5 text-sm"
                                    title="Aniversário este mês 🎉"
                                  >
                                    🎂
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">{c.cargo}</td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {idade(c.nascimento)} anos
                            <span className="ml-1 text-xs text-muted-foreground/60">
                              ({new Date(c.nascimento + "T00:00:00").toLocaleDateString("pt-BR")})
                            </span>
                          </td>
                          <td className="px-4 py-3 text-muted-foreground">
                            {tempoDeCasa(c.admissao)}
                          </td>
                          <td className="px-4 py-3 text-xs text-muted-foreground">
                            {new Date(c.admissao + "T00:00:00").toLocaleDateString("pt-BR")}
                          </td>
                          <td className="px-4 py-3 text-right">
                            <div className="flex items-center justify-end gap-1">
                              <button
                                onClick={() => {
                                  setEditarTarget(c);
                                  setNomeCol(c.nome);
                                  setCpf3Col(c.cpf3);
                                  setCargoCol(c.cargo);
                                  setNascimentoCol(c.nascimento);
                                  setAdmissaoCol(c.admissao);
                                  setErroCol("");
                                }}
                                title="Editar colaborador"
                                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-kt-soft hover:text-kt"
                              >
                                <UserPlus className="h-4 w-4" />
                              </button>
                              <button
                                onClick={() => setDesligarTarget(c)}
                                title="Desligar colaborador"
                                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive"
                              >
                                <UserMinus className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })}
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

        {/* Editar colaborador */}
        <Dialog
          open={!!editarTarget}
          onOpenChange={(o) => {
            if (!o) {
              setEditarTarget(null);
              setErroCol("");
            }
          }}
        >
          <DialogContent className="sm:max-w-sm">
            <DialogHeader>
              <DialogTitle>Editar colaborador</DialogTitle>
              <DialogDescription>
                Atualize os dados de <strong>{editarTarget?.nome}</strong>.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-3">
              <div className="grid gap-1.5">
                <Label htmlFor="edit-nome">Nome completo</Label>
                <Input
                  id="edit-nome"
                  value={nomeCol}
                  onChange={(e) => setNomeCol(e.target.value)}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-cpf3">Últimos 3 dígitos do CPF</Label>
                <Input
                  id="edit-cpf3"
                  value={cpf3Col}
                  maxLength={3}
                  onChange={(e) => setCpf3Col(e.target.value.replace(/\D/g, ""))}
                />
              </div>
              <div className="grid gap-1.5">
                <Label htmlFor="edit-cargo">Cargo</Label>
                <Input
                  id="edit-cargo"
                  value={cargoCol}
                  onChange={(e) => setCargoCol(e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-nasc">Nascimento</Label>
                  <Input
                    id="edit-nasc"
                    type="date"
                    value={nascimentoCol}
                    onChange={(e) => setNascimentoCol(e.target.value)}
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="edit-adm">Admissão</Label>
                  <Input
                    id="edit-adm"
                    type="date"
                    value={admissaoCol}
                    onChange={(e) => setAdmissaoCol(e.target.value)}
                  />
                </div>
              </div>
              {erroCol && <p className="text-sm text-destructive">{erroCol}</p>}
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button
                variant="outline"
                className="rounded-full"
                onClick={() => setEditarTarget(null)}
              >
                Cancelar
              </Button>
              <Button
                className="rounded-full"
                disabled={!nomeCol.trim() || cpf3Col.length !== 3 || !cargoCol.trim()}
                onClick={() => {
                  if (!editarTarget) return;
                  const cargoAnterior = editarTarget.cargo;
                  const novosCargo = cargoCol.trim();
                  const promovido = novosCargo !== cargoAnterior;
                  setColaboradores((prev) =>
                    prev.map((c) =>
                      c.id === editarTarget.id
                        ? {
                            ...c,
                            nome: nomeCol.trim(),
                            cpf3: cpf3Col,
                            cargo: novosCargo,
                            nascimento: nascimentoCol || c.nascimento,
                            admissao: admissaoCol || c.admissao,
                          }
                        : c,
                    ),
                  );
                  if (promovido) {
                    const primeiroNome = nomeCol.trim().split(" ")[0];
                    setMural((prev) => [
                      {
                        id: uid(),
                        tipo: "novidade" as const,
                        titulo: `Parabéns, ${primeiroNome}! 🎉`,
                        mensagem: `${nomeCol.trim()} foi promovido(a) a ${novosCargo}. Parabéns pela conquista!`,
                        autor: `${session.nome} (gestão)`,
                        data: new Date().toISOString().slice(0, 10),
                        filial: session.filial,
                        emoji: "🏆",
                      },
                      ...prev,
                    ]);
                    toast.success("Promoção publicada no mural!");
                  } else {
                    toast.success("Cadastro atualizado.");
                  }
                  setEditarTarget(null);
                }}
              >
                Salvar alterações
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
