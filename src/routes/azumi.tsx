import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { Check, Copy, Download, ExternalLink, Plus, Trash2, Upload, UserPlus2 } from "lucide-react";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { EmptyState, Section } from "@/components/kt/section";
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
import capaPadrao from "@/assets/capa-padrao-politicas.jpg";
import {
  FILIAIS,
  HUMORES,
  filialNome,
  youtubeEmbed,
  type Colaborador,
  type FilialId,
} from "@/lib/kt-data";
import {
  fmtData,
  uid,
  useAjuda,
  useAnotacoesApoio,
  useAssinaturas,
  useCheckins,
  useColaboradores,
  useDocumentos,
  useLeituras,
  useNoticias,
  usePesquisa,
  useSugestoes,
} from "@/lib/kt-store";
import { type KtPerfil, useKtAuth } from "@/lib/kt-auth";
import { supabase } from "@/lib/supabase";
import { criarGestorFn } from "@/lib/server-fns";

// ─── Helpers de importação CSV ───────────────────────────────────────────────

function normalizarFilial(txt: string): FilialId | null {
  const t = txt.toLowerCase().trim();
  if (t.includes("cristo")) return "cristo-rei";
  if (t.includes("champagnat")) return "champagnat";
  return null;
}

function parsearCsv(texto: string): Array<Record<string, string>> {
  const linhas = texto.trim().split(/\r?\n/).filter(Boolean);
  if (linhas.length < 2 || !linhas[0]) return [];
  const cabs = linhas[0].split(",").map((h) => h.trim().toLowerCase().replace(/\s+/g, "_"));
  return linhas.slice(1).map((linha) => {
    const campos: string[] = [];
    let atual = "";
    let aspas = false;
    for (const ch of linha) {
      if (ch === '"') {
        aspas = !aspas;
      } else if (ch === "," && !aspas) {
        campos.push(atual.trim());
        atual = "";
      } else {
        atual += ch;
      }
    }
    campos.push(atual.trim());
    return Object.fromEntries(cabs.map((h, i) => [h, campos[i] ?? ""]));
  });
}

function rowParaColaborador(row: Record<string, string>): Colaborador | null {
  const nome = row["nome_completo"]?.trim();
  const cpf3 = row["ultimos_3_digitos_cpf"]?.replace(/\D/g, "").slice(-3);
  const cargo = row["cargo"]?.trim();
  const filial = normalizarFilial(row["filial"] ?? "");
  const nascimento = row["data_nascimento"]?.trim() || "2000-01-01";
  const admissao = row["data_admissao"]?.trim() || new Date().toISOString().slice(0, 10);
  if (!nome || !cpf3 || cpf3.length !== 3 || !cargo || !filial) return null;
  return { id: uid(), nome, cpf3, cargo, filial, nascimento, admissao };
}

// ─── Rota ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute("/azumi")({
  head: () => ({
    meta: [
      { title: "Área Azumi RH · Portal Azumi RH" },
      {
        name: "description",
        content:
          "Área da Azumi RH: publicar mural e notícias em vídeo, abrir pesquisas de clima e acompanhar as unidades Ken Taki.",
      },
      { property: "og:title", content: "Área Azumi RH · Portal Azumi RH" },
      {
        property: "og:description",
        content: "Visão consolidada das unidades Cristo Rei e Champagnat.",
      },
    ],
  }),
  component: AzumiPage,
});

function AzumiPage() {
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

  if (state.status === "anon" || state.perfil.tipo !== "azumi") {
    return <LoginAzumi onLogin={login} onEsqueceu={esqueceuSenha} />;
  }

  if (state.perfil.precisa_trocar_senha) {
    return <TrocarSenhaObrigatoria onTrocar={trocarSenha} onSair={logout} />;
  }

  return <PainelAzumi perfil={state.perfil} onLogout={logout} />;
}

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginAzumi({
  onLogin,
  onEsqueceu,
}: {
  onLogin: (email: string, senha: string) => Promise<void>;
  onEsqueceu: (email: string) => Promise<void>;
}) {
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
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
        <h1 className="text-2xl font-extrabold">Área Azumi RH</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Acesse com seu e-mail e senha da equipe Azumi.
        </p>
        <div className="mt-6 grid gap-4">
          <div className="grid gap-2">
            <Label htmlFor="email">E-mail</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && document.getElementById("senha-az")?.focus()}
            />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="senha-az">Senha</Label>
            <Input
              id="senha-az"
              type="password"
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
            />
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

// ─── Troca de senha obrigatória ───────────────────────────────────────────────

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

// ─── Painel Azumi ─────────────────────────────────────────────────────────────

function diasRestantes(prazo: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.ceil((new Date(prazo + "T00:00:00").getTime() - hoje.getTime()) / 86400000);
}

// assuntos que representam pedido explícito de apoio do colaborador
const ASSUNTOS_APOIO = new Set([
  "Apoio - check-in neutro",
  "Apoio - check-in negativo",
  "Apoio registrado (intranet)",
  "WhatsApp - apoio",
  "Alerta crítico — 2+ negativos no dia",
  "Apoio pelo WhatsApp",
]);

function isPedidoApoio(assunto: string) {
  if (ASSUNTOS_APOIO.has(assunto)) return true;
  if (assunto.startsWith("WhatsApp pós check-in negativo")) return true;
  return false;
}

function labelAssunto(assunto: string): string {
  if (assunto === "suporte-checkin" || assunto === "Apoio - check-in neutro")
    return "Check-in neutro";
  if (assunto === "crise-checkin" || assunto === "Apoio - check-in negativo")
    return "Check-in negativo";
  if (assunto.startsWith("WhatsApp pós")) return "WhatsApp pós check-in";
  if (assunto === "Apoio registrado (intranet)") return "Intranet";
  if (assunto === "WhatsApp - apoio") return "WhatsApp";
  if (assunto === "Alerta crítico — 2+ negativos no dia") return "Alerta crítico";
  if (assunto === "Apoio pelo WhatsApp") return "WhatsApp";
  return assunto;
}

function badgeAssunto(assunto: string): string {
  if (assunto.includes("Alerta crítico") || assunto === "crise-checkin")
    return "bg-destructive/10 text-destructive";
  if (assunto.includes("negativo")) return "bg-warn-soft text-warn";
  return "bg-az-soft text-az";
}

function canalApoio(assunto: string): string {
  if (assunto.toLowerCase().includes("whatsapp")) return "WhatsApp";
  return "App";
}

function baixarCsvClima(checkins: ReturnType<typeof useCheckins>[0], filialFiltro: string) {
  const dados = filialFiltro ? checkins.filter((c) => c.filial === filialFiltro) : checkins;
  const linhas = [
    "nome,filial,humor,data,hora",
    ...dados.map((c) => {
      const d = new Date(c.ts);
      return [
        c.nome,
        c.filial,
        c.humor,
        d.toLocaleDateString("pt-BR"),
        d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      ].join(",");
    }),
  ];
  const blob = new Blob([linhas.join("\n")], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `clima-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

function PainelAzumi({ perfil, onLogout }: { perfil: KtPerfil; onLogout: () => void }) {
  const [checkins] = useCheckins();
  const [assinaturas] = useAssinaturas();
  const [leituras] = useLeituras();
  const [sugestoes, setSugestoes] = useSugestoes();
  const [ajuda, setAjuda] = useAjuda();
  const [anotacoes, setAnotacoes] = useAnotacoesApoio();
  const [pesquisa, setPesquisa] = usePesquisa();
  const [noticias, setNoticias] = useNoticias();
  const [colaboradores, setColaboradores] = useColaboradores();
  const [documentos, setDocumentos] = useDocumentos();

  // document upload state
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docOpen, setDocOpen] = useState(false);
  const [docTitulo, setDocTitulo] = useState("");
  const [docFilial, setDocFilial] = useState<FilialId | "todas">("todas");
  const [docCategoria, setDocCategoria] = useState<"todos" | "gestao">("todos");
  const [docCorTag, setDocCorTag] = useState("#8a2058");
  const [docTextoTag, setDocTextoTag] = useState("");
  const [docUploading, setDocUploading] = useState(false);
  const [docErro, setDocErro] = useState("");

  // notícia state
  const nFotoInputRef = useRef<HTMLInputElement>(null);
  const [nTitulo, setNTitulo] = useState("");
  const [nResumo, setNResumo] = useState("");
  const [nVideo, setNVideo] = useState("");
  const [nData, setNData] = useState("");
  const [nFotoUrl, setNFotoUrl] = useState("");
  const [nFotoUploading, setNFotoUploading] = useState(false);

  // pesquisa state
  const [pTitulo, setPTitulo] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pLink, setPLink] = useState("");
  const [pPrazo, setPPrazo] = useState("");
  const [pCategoria, setPCategoria] = useState("");

  // clima chart state
  const [climaPeriodo, setClimaPeriodo] = useState<"7d" | "30d" | "mes">("7d");
  const [climaFilial, setClimaFilial] = useState<string>("todas");
  const [drillDia, setDrillDia] = useState<string | null>(null);
  const [drillBusca, setDrillBusca] = useState("");

  // pedidos de apoio state
  const [filtroAjuda, setFiltroAjuda] = useState<string>("Todas");
  const [filtroStatus, setFiltroStatus] = useState<string>("Todos");
  const [anotandoId, setAnotandoId] = useState<string | null>(null);
  const [expandedApoioId, setExpandedApoioId] = useState<string | null>(null);
  const [novaAnotacaoTexto, setNovaAnotacaoTexto] = useState("");
  const [novaAnotacaoCanal, setNovaAnotacaoCanal] = useState<
    "WhatsApp" | "E-mail" | "Presencial" | ""
  >("");

  // CSV import state (now in Dialog)
  const [csvOpen, setCsvOpen] = useState(false);
  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{
    adicionar: Colaborador[];
    atualizar: Colaborador[];
  } | null>(null);
  const [csvErro, setCsvErro] = useState("");

  // criar gestor state (now in Dialog)
  const [gestorOpen, setGestorOpen] = useState(false);
  const [gNome, setGNome] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gFilial, setGFilial] = useState<"cristo-rei" | "champagnat">(FILIAIS[0].id);
  const [gCriando, setGCriando] = useState(false);
  const [gErro, setGErro] = useState("");
  const [gSucesso, setGSucesso] = useState<{ email: string; senha: string } | null>(null);

  function processarCsv(arquivo: File) {
    setCsvErro("");
    const reader = new FileReader();
    reader.onload = (e) => {
      const texto = e.target?.result as string;
      const linhas = parsearCsv(texto);
      if (linhas.length === 0) {
        setCsvErro("Arquivo vazio ou formato inválido.");
        return;
      }
      const adicionar: Colaborador[] = [];
      const atualizar: Colaborador[] = [];
      for (const row of linhas) {
        const novo = rowParaColaborador(row);
        if (!novo) continue;
        const existente = colaboradores.find(
          (c) =>
            c.nome.toLowerCase() === novo.nome.toLowerCase() &&
            c.cpf3 === novo.cpf3 &&
            c.filial === novo.filial,
        );
        if (existente) {
          atualizar.push({ ...novo, id: existente.id });
        } else {
          adicionar.push(novo);
        }
      }
      if (adicionar.length === 0 && atualizar.length === 0) {
        setCsvErro("Nenhum colaborador válido encontrado. Verifique os cabeçalhos do CSV.");
        return;
      }
      setCsvPreview({ adicionar, atualizar });
    };
    reader.readAsText(arquivo, "utf-8");
  }

  async function realizarUploadDoc(file: File) {
    if (!docTitulo.trim() || !docTextoTag.trim()) {
      setDocErro("Preencha título e etiqueta antes de enviar.");
      return;
    }
    setDocUploading(true);
    setDocErro("");
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage.from("kt-documentos").upload(path, file, {
        cacheControl: "3600",
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("kt-documentos").getPublicUrl(data.path);
      setDocumentos((prev) => [
        {
          id: uid(),
          titulo: docTitulo.trim(),
          filial: docFilial,
          url: urlData.publicUrl,
          corTag: docCorTag,
          textoTag: docTextoTag.trim(),
          data: new Date().toISOString().slice(0, 10),
          categoria: docCategoria,
        },
        ...prev,
      ]);
      setDocTitulo("");
      setDocTextoTag("");
      setDocCorTag("#8a2058");
      setDocFilial("todas");
      setDocCategoria("todos");
      setDocOpen(false);
      toast.success("Documento publicado com sucesso.");
    } catch (e) {
      setDocErro(`Erro ao enviar: ${(e as Error).message}`);
    } finally {
      setDocUploading(false);
    }
  }

  async function uploadFotoNoticia(file: File) {
    setNFotoUploading(true);
    try {
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `fotos/${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage.from("kt-documentos").upload(path, file, {
        cacheControl: "86400",
        upsert: false,
      });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("kt-documentos").getPublicUrl(data.path);
      setNFotoUrl(urlData.publicUrl);
    } catch (e) {
      toast.error(`Erro ao enviar foto: ${(e as Error).message}`);
    } finally {
      setNFotoUploading(false);
    }
  }

  // climate chart data
  function getDias() {
    if (climaPeriodo === "7d") return 7;
    if (climaPeriodo === "30d") return 30;
    return new Date().getDate(); // dias do mês atual
  }

  const numDias = getDias();
  const climaCheckins =
    climaFilial === "todas" ? checkins : checkins.filter((c) => c.filial === climaFilial);

  const dadosCli = Array.from({ length: numDias }, (_, i) => {
    const d = new Date();
    if (climaPeriodo === "mes") {
      d.setDate(i + 1);
    } else {
      d.setDate(d.getDate() - (numDias - 1 - i));
    }
    const ds = d.toDateString();
    const doDia = climaCheckins.filter((c) => new Date(c.ts).toDateString() === ds);
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
    ? climaCheckins.filter((c) => new Date(c.ts).toDateString() === drillDia)
    : [];

  // pedidos de apoio
  const pedidosReais = ajuda.filter((a) => isPedidoApoio(a.assunto));
  const pedidosFiltrados = pedidosReais
    .filter((a) => filtroAjuda === "Todas" || filialNome(a.filial) === filtroAjuda)
    .filter((a) => {
      if (filtroStatus === "Todos") return true;
      if (filtroStatus === "Em andamento") return !a.status || a.status === "em-andamento";
      if (filtroStatus === "Resolvidos") return a.status === "resolvido";
      return true;
    })
    .sort((a, b) => b.ts - a.ts);

  return (
    <AppShell onLogout={onLogout}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">
            👋 Olá, {perfil.nome.split(" ")[0]}!
          </h1>
          <p className="mt-0.5 text-sm text-muted-foreground">
            Bem-vinda à intranet do Ken Taki × Azumi RH
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            Visão consolidada · Cristo Rei e Champagnat
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Check-ins", valor: checkins.length },
            { label: "Assinaturas", valor: assinaturas.length },
            { label: "Pedidos de apoio", valor: pedidosReais.length },
          ].map((k) => (
            <div key={k.label} className="surface p-5">
              <p className="text-3xl font-extrabold text-union">{k.valor}</p>
              <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        {/* Gráfico de clima */}
        <Section
          titulo="Clima por unidade"
          intro="Distribuição dos check-ins de humor. Clique em uma barra para ver os detalhes do dia."
          contagem={`${checkins.length} check-ins`}
          collapsible
          defaultOpen={checkins.length > 0}
        >
          <div className="grid gap-4">
            {/* Emoji totais por filial */}
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
                          <p className="text-sm font-bold">
                            {dados.filter((c) => c.humor === h.id).length}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Filtros do gráfico */}
            {checkins.length > 0 && (
              <div className="grid gap-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap gap-2">
                    {(
                      [
                        { v: "7d", l: "7 dias" },
                        { v: "30d", l: "30 dias" },
                        { v: "mes", l: "Este mês" },
                      ] as const
                    ).map(({ v, l }) => (
                      <button
                        key={v}
                        onClick={() => {
                          setClimaPeriodo(v);
                          setDrillDia(null);
                        }}
                        className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                          climaPeriodo === v
                            ? "border-kt bg-kt-soft text-kt"
                            : "border-border text-muted-foreground hover:border-foreground"
                        }`}
                      >
                        {l}
                      </button>
                    ))}
                    <span className="h-6 w-px bg-border" />
                    {["todas", ...FILIAIS.map((f) => f.id)].map((fid) => (
                      <button
                        key={fid}
                        onClick={() => {
                          setClimaFilial(fid);
                          setDrillDia(null);
                        }}
                        className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                          climaFilial === fid
                            ? "border-az bg-az-soft text-az"
                            : "border-border text-muted-foreground hover:border-foreground"
                        }`}
                      >
                        {fid === "todas" ? "Todas" : filialNome(fid as FilialId)}
                      </button>
                    ))}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    className="rounded-full"
                    onClick={() =>
                      baixarCsvClima(checkins, climaFilial === "todas" ? "" : climaFilial)
                    }
                  >
                    <Download className="h-3.5 w-3.5" /> CSV
                  </Button>
                </div>

                <div className="h-52 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={dadosCli} margin={{ top: 4, right: 4, bottom: 0, left: -20 }}>
                      <XAxis dataKey="data" tick={{ fontSize: 10 }} />
                      <YAxis allowDecimals={false} tick={{ fontSize: 10 }} />
                      <Tooltip />
                      <Bar
                        dataKey="Pos"
                        name="Positivos"
                        stackId="a"
                        fill="#22c55e"
                        style={{ cursor: "pointer" }}
                        onClick={(d) => setDrillDia(d.dataStr === drillDia ? null : d.dataStr)}
                      />
                      <Bar
                        dataKey="Neu"
                        name="Neutros"
                        stackId="a"
                        fill="#f59e0b"
                        style={{ cursor: "pointer" }}
                        onClick={(d) => setDrillDia(d.dataStr === drillDia ? null : d.dataStr)}
                      />
                      <Bar
                        dataKey="Neg"
                        name="Negativos"
                        stackId="a"
                        fill="#ef4444"
                        radius={[3, 3, 0, 0]}
                        style={{ cursor: "pointer" }}
                        onClick={(d) => setDrillDia(d.dataStr === drillDia ? null : d.dataStr)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Drill-down */}
                {drillDia && drillCheckins.length > 0 && (
                  <div className="rounded-2xl border border-border bg-muted/50 p-4">
                    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold">
                        {new Date(drillDia).toLocaleDateString("pt-BR", {
                          weekday: "long",
                          day: "2-digit",
                          month: "long",
                        })}{" "}
                        · {drillCheckins.length} check-in{drillCheckins.length > 1 ? "s" : ""}
                      </p>
                      <div className="flex items-center gap-2">
                        <Input
                          placeholder="Buscar nome..."
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
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="border-b border-border bg-muted/40">
                            <th className="px-3 py-2 text-left font-semibold">Humor</th>
                            <th className="px-3 py-2 text-left font-semibold">Nome</th>
                            <th className="px-3 py-2 text-left font-semibold">Filial</th>
                            <th className="px-3 py-2 text-left font-semibold">Hora</th>
                            <th className="px-3 py-2 text-left font-semibold">Recado</th>
                          </tr>
                        </thead>
                        <tbody>
                          {drillCheckins
                            .filter(
                              (c) =>
                                !drillBusca ||
                                c.nome.toLowerCase().includes(drillBusca.toLowerCase()),
                            )
                            .map((c) => {
                              const h = HUMORES.find((x) => x.id === c.humor);
                              return (
                                <tr key={c.id} className="border-b border-border last:border-0">
                                  <td className="px-3 py-2">
                                    <span className="text-base" title={h?.label}>
                                      {h?.emoji}
                                    </span>
                                  </td>
                                  <td className="px-3 py-2 font-medium">{c.nome}</td>
                                  <td className="px-3 py-2 text-muted-foreground">
                                    {filialNome(c.filial)}
                                  </td>
                                  <td className="px-3 py-2 whitespace-nowrap text-xs text-muted-foreground">
                                    {new Date(c.ts).toLocaleTimeString("pt-BR", {
                                      hour: "2-digit",
                                      minute: "2-digit",
                                    })}
                                  </td>
                                  <td className="px-3 py-2 text-xs text-muted-foreground max-w-[200px]">
                                    {c.recado && `"${c.recado}"`}
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
          </div>
        </Section>

        {/* Notícia + Pesquisa — lado a lado */}
        <div className="grid gap-5 md:grid-cols-2">
          <Section
            titulo="Publicar notícia ou vídeo"
            intro="Cole o link do YouTube e o vídeo aparece no painel do colaborador."
            contagem={`${noticias.length} publicados`}
            collapsible
            defaultOpen
          >
            <div className="grid gap-3">
              <Input
                placeholder="Título"
                value={nTitulo}
                onChange={(e) => setNTitulo(e.target.value)}
              />
              <Textarea
                rows={2}
                placeholder="Resumo"
                value={nResumo}
                onChange={(e) => setNResumo(e.target.value)}
              />
              <Input
                placeholder="Link do vídeo (YouTube)"
                value={nVideo}
                onChange={(e) => setNVideo(e.target.value)}
              />
              <div className="grid gap-2">
                <Label htmlFor="n-data">Data de publicação</Label>
                <Input
                  id="n-data"
                  type="date"
                  value={nData}
                  onChange={(e) => setNData(e.target.value)}
                />
              </div>
              {/* Foto da notícia */}
              <div className="grid gap-2">
                <Label>Foto (opcional)</Label>
                <input
                  ref={nFotoInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) await uploadFotoNoticia(f);
                    e.target.value = "";
                  }}
                />
                {nFotoUrl ? (
                  <div className="relative overflow-hidden rounded-xl">
                    <img
                      src={nFotoUrl}
                      alt="Foto da notícia"
                      className="h-32 w-full object-cover"
                    />
                    <button
                      className="absolute right-2 top-2 rounded-full bg-destructive/80 p-1 text-white hover:bg-destructive"
                      onClick={() => setNFotoUrl("")}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-fit rounded-full"
                    disabled={nFotoUploading}
                    onClick={() => nFotoInputRef.current?.click()}
                  >
                    <Upload className="h-3.5 w-3.5" />
                    {nFotoUploading ? "Enviando..." : "Adicionar foto"}
                  </Button>
                )}
              </div>
              {nVideo && youtubeEmbed(nVideo) ? (
                <div className="aspect-video w-full overflow-hidden rounded-xl">
                  <iframe
                    src={youtubeEmbed(nVideo)!}
                    title="Prévia"
                    className="h-full w-full"
                    allowFullScreen
                  />
                </div>
              ) : null}
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
                      imagemUrl: nFotoUrl || undefined,
                      data: nData || new Date().toISOString().slice(0, 10),
                    },
                    ...noticias,
                  ]);
                  setNTitulo("");
                  setNResumo("");
                  setNVideo("");
                  setNData("");
                  setNFotoUrl("");
                  toast.success("Notícia publicada para todas as unidades.");
                }}
              >
                Publicar
              </Button>
            </div>
          </Section>

          <Section
            titulo="Pesquisa de clima"
            intro="Abra uma pesquisa e ela aparece no painel de colaboradores e gestores."
            contagem={pesquisa?.ativa ? "Ativa" : "Nenhuma ativa"}
            collapsible
            defaultOpen
          >
            <div className="grid gap-3">
              {pesquisa?.ativa && (
                <div className="rounded-2xl border border-az bg-az-soft p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <p className="font-bold">{pesquisa.titulo}</p>
                      {pesquisa.descricao && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{pesquisa.descricao}</p>
                      )}
                    </div>
                    {pesquisa.prazo && (
                      <span
                        className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-bold ${
                          diasRestantes(pesquisa.prazo) <= 2
                            ? "bg-destructive/10 text-destructive"
                            : diasRestantes(pesquisa.prazo) <= 5
                              ? "bg-warn-soft text-warn"
                              : "bg-success-soft text-success"
                        }`}
                      >
                        {diasRestantes(pesquisa.prazo) > 0
                          ? `${diasRestantes(pesquisa.prazo)} dias restantes`
                          : "Prazo encerrado"}
                      </span>
                    )}
                  </div>
                  {pesquisa.link && (
                    <a
                      href={pesquisa.link}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-2 inline-flex items-center gap-1 text-xs text-az underline underline-offset-2"
                    >
                      Ver formulário <ExternalLink className="h-3 w-3" />
                    </a>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    className="mt-3 rounded-full"
                    onClick={() => setPesquisa(null)}
                  >
                    Encerrar pesquisa
                  </Button>
                </div>
              )}
              {!pesquisa?.ativa && (
                <>
                  <Input
                    placeholder="Título da pesquisa"
                    value={pTitulo}
                    onChange={(e) => setPTitulo(e.target.value)}
                  />
                  <Textarea
                    rows={2}
                    placeholder="Descrição"
                    value={pDesc}
                    onChange={(e) => setPDesc(e.target.value)}
                  />
                  <Input
                    placeholder="Link do formulário"
                    value={pLink}
                    onChange={(e) => setPLink(e.target.value)}
                  />
                  <div className="grid gap-2">
                    <Label htmlFor="p-prazo">Prazo de resposta (opcional)</Label>
                    <Input
                      id="p-prazo"
                      type="date"
                      value={pPrazo}
                      onChange={(e) => setPPrazo(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Categoria (opcional)</Label>
                    <div className="flex flex-wrap gap-2">
                      {["Clima organizacional", "Satisfação", "Saúde e bem-estar", "Operação"].map(
                        (c) => (
                          <button
                            key={c}
                            onClick={() => setPCategoria((prev) => (prev === c ? "" : c))}
                            className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                              pCategoria === c
                                ? "border-az bg-az-soft text-az"
                                : "border-border text-muted-foreground hover:border-foreground"
                            }`}
                          >
                            {c}
                          </button>
                        ),
                      )}
                    </div>
                  </div>
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
                        prazo: pPrazo || undefined,
                        categoria: pCategoria || undefined,
                      });
                      setPTitulo("");
                      setPDesc("");
                      setPLink("");
                      setPPrazo("");
                      setPCategoria("");
                      toast.success("Pesquisa publicada.");
                    }}
                  >
                    Publicar pesquisa
                  </Button>
                </>
              )}
            </div>
          </Section>
        </div>

        <Mural filial="todas" autorPadrao="Equipe Azumi RH" collapsible defaultOpen />

        {/* Pedidos de apoio — somente pedidos explícitos */}
        <Section
          titulo="Pedidos de apoio"
          intro="Registros de colaboradores que solicitaram suporte explicitamente."
          contagem={`${pedidosReais.length} registros`}
          collapsible
          defaultOpen={pedidosReais.length > 0}
        >
          {pedidosReais.length === 0 ? (
            <EmptyState>Nenhum pedido de apoio registrado ainda.</EmptyState>
          ) : (
            <div className="grid gap-4">
              <div className="flex flex-wrap gap-2">
                {["Todas", ...FILIAIS.map((f) => f.nome)].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFiltroAjuda(f)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      filtroAjuda === f
                        ? "border-kt bg-kt-soft text-kt"
                        : "border-border text-muted-foreground hover:border-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
                <span className="h-6 w-px bg-border" />
                {["Todos", "Em andamento", "Resolvidos"].map((s) => (
                  <button
                    key={s}
                    onClick={() => setFiltroStatus(s)}
                    className={`rounded-full border px-3 py-1 text-sm font-medium transition-colors ${
                      filtroStatus === s
                        ? "border-success bg-success-soft text-success"
                        : "border-border text-muted-foreground hover:border-foreground"
                    }`}
                  >
                    {s}
                  </button>
                ))}
              </div>
              {pedidosFiltrados.length === 0 ? (
                <EmptyState>Nenhum registro com estes filtros.</EmptyState>
              ) : (
                <div className="overflow-x-auto rounded-2xl border border-border">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-muted/40">
                        <th className="px-4 py-3 text-left font-semibold">Nome</th>
                        <th className="px-4 py-3 text-left font-semibold">Canal</th>
                        <th className="px-4 py-3 text-left font-semibold">Status</th>
                        <th className="px-4 py-3 text-left font-semibold">Anotações</th>
                        <th className="px-4 py-3 text-left font-semibold">Data/Hora</th>
                        <th className="px-4 py-3 text-left font-semibold">Gestor</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pedidosFiltrados.map((a) => {
                        const anotacoesRow = anotacoes
                          .filter((n) => n.pedidoId === a.id)
                          .sort((x, y) => x.criadoEm - y.criadoEm);
                        const isExpanded = expandedApoioId === a.id;
                        return (
                          <>
                            <tr
                              key={a.id}
                              className={`border-b border-border last:border-0 cursor-pointer hover:bg-muted/30 ${a.status === "resolvido" ? "opacity-60" : ""}`}
                              onClick={() => setExpandedApoioId(isExpanded ? null : a.id)}
                            >
                              <td className="px-4 py-3">
                                <div className="font-medium">{a.nome}</div>
                                <div className="text-xs text-muted-foreground">
                                  {filialNome(a.filial)}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span
                                  className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${badgeAssunto(a.assunto)}`}
                                >
                                  {canalApoio(a.assunto)}
                                </span>
                              </td>
                              <td className="px-4 py-2">
                                <select
                                  className={`rounded-full border px-2 py-1 text-[11px] font-bold focus:outline-none ${
                                    a.status === "resolvido"
                                      ? "border-success/30 bg-success-soft text-success"
                                      : "border-warn/30 bg-warn-soft text-warn"
                                  }`}
                                  value={a.status ?? "em-andamento"}
                                  onClick={(e) => e.stopPropagation()}
                                  onChange={(e) =>
                                    setAjuda((prev) =>
                                      prev.map((x) =>
                                        x.id === a.id
                                          ? {
                                              ...x,
                                              status: e.target.value as
                                                "em-andamento" | "resolvido",
                                            }
                                          : x,
                                      ),
                                    )
                                  }
                                >
                                  <option value="em-andamento">Em andamento</option>
                                  <option value="resolvido">Resolvido</option>
                                </select>
                              </td>
                              <td className="px-4 py-3">
                                <button
                                  className="text-xs text-az underline-offset-2 hover:underline"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setExpandedApoioId(isExpanded ? null : a.id);
                                  }}
                                >
                                  {anotacoesRow.length > 0
                                    ? `${anotacoesRow.length} anotaç${anotacoesRow.length === 1 ? "ão" : "ões"}`
                                    : "Adicionar"}
                                </button>
                              </td>
                              <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                                {new Date(a.ts).toLocaleString("pt-BR", {
                                  day: "2-digit",
                                  month: "short",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </td>
                              <td className="px-4 py-3">
                                {a.assunto.includes("gestor") && (
                                  <span className="rounded-full bg-warn-soft px-2 py-0.5 text-[11px] font-medium text-warn">
                                    sim
                                  </span>
                                )}
                              </td>
                            </tr>
                            {isExpanded && (
                              <tr
                                key={`${a.id}-expand`}
                                className="border-b border-border bg-muted/20"
                              >
                                <td colSpan={6} className="px-4 py-3">
                                  {anotacoesRow.length > 0 && (
                                    <div className="mb-2 grid gap-1.5">
                                      {anotacoesRow.map((n) => (
                                        <div
                                          key={n.id}
                                          className="rounded-xl bg-card px-3 py-2 text-xs"
                                        >
                                          <p className="text-foreground">{n.texto}</p>
                                          <p className="mt-0.5 text-muted-foreground">
                                            {n.canal && (
                                              <span className="mr-1 font-medium">{n.canal} ·</span>
                                            )}
                                            {new Date(n.criadoEm).toLocaleString("pt-BR", {
                                              day: "2-digit",
                                              month: "short",
                                              hour: "2-digit",
                                              minute: "2-digit",
                                            })}
                                          </p>
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                  {anotandoId === a.id ? (
                                    <div className="grid gap-2">
                                      <Textarea
                                        className="text-xs"
                                        rows={2}
                                        autoFocus
                                        placeholder="Descreva a ação tomada..."
                                        value={novaAnotacaoTexto}
                                        onChange={(e) => setNovaAnotacaoTexto(e.target.value)}
                                      />
                                      <div className="flex flex-wrap gap-1.5">
                                        {(["WhatsApp", "E-mail", "Presencial"] as const).map(
                                          (c) => (
                                            <button
                                              key={c}
                                              onClick={() =>
                                                setNovaAnotacaoCanal((prev) =>
                                                  prev === c ? "" : c,
                                                )
                                              }
                                              className={`rounded-full border px-2.5 py-1 text-[11px] font-medium transition-colors ${novaAnotacaoCanal === c ? "border-az bg-az-soft text-az" : "border-border"}`}
                                            >
                                              {c}
                                            </button>
                                          ),
                                        )}
                                      </div>
                                      <div className="flex gap-2">
                                        <Button
                                          size="sm"
                                          className="rounded-full"
                                          disabled={!novaAnotacaoTexto.trim()}
                                          onClick={() => {
                                            setAnotacoes((prev) => [
                                              ...prev,
                                              {
                                                id: uid(),
                                                pedidoId: a.id,
                                                texto: novaAnotacaoTexto.trim(),
                                                ...(novaAnotacaoCanal
                                                  ? {
                                                      canal: novaAnotacaoCanal as
                                                        "WhatsApp" | "E-mail" | "Presencial",
                                                    }
                                                  : {}),
                                                criadoEm: Date.now(),
                                              },
                                            ]);
                                            setNovaAnotacaoTexto("");
                                            setNovaAnotacaoCanal("");
                                            setAnotandoId(null);
                                          }}
                                        >
                                          Salvar anotação
                                        </Button>
                                        <Button
                                          size="sm"
                                          variant="ghost"
                                          className="rounded-full"
                                          onClick={() => {
                                            setAnotandoId(null);
                                            setNovaAnotacaoTexto("");
                                            setNovaAnotacaoCanal("");
                                          }}
                                        >
                                          Cancelar
                                        </Button>
                                      </div>
                                    </div>
                                  ) : (
                                    <button
                                      className="text-xs text-muted-foreground underline-offset-2 hover:underline"
                                      onClick={() => {
                                        setAnotandoId(a.id);
                                        setNovaAnotacaoTexto("");
                                        setNovaAnotacaoCanal("");
                                      }}
                                    >
                                      + Adicionar anotação
                                    </button>
                                  )}
                                </td>
                              </tr>
                            )}
                          </>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </Section>

        {/* Sugestões — visão consolidada todas as filiais */}
        <Section
          titulo="Caixinha de sugestão"
          intro="Sugestões anônimas de todas as unidades. Classifique o encaminhamento de cada uma."
          contagem={`${sugestoes.length} sugestões`}
          collapsible
          defaultOpen={sugestoes.length > 0}
        >
          {sugestoes.length === 0 ? (
            <EmptyState>Nenhuma sugestão registrada ainda.</EmptyState>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-border">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-muted/40">
                    <th className="px-4 py-3 text-left font-semibold">Filial</th>
                    <th className="px-4 py-3 text-left font-semibold">Categoria</th>
                    <th className="px-4 py-3 text-left font-semibold">Data</th>
                    <th className="px-4 py-3 text-left font-semibold">Sugestão</th>
                    <th className="px-4 py-3 text-left font-semibold">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {[...sugestoes]
                    .sort((a, b) => b.ts - a.ts)
                    .map((s) => (
                      <tr key={s.id} className="border-b border-border last:border-0">
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {filialNome(s.filial)}
                        </td>
                        <td className="px-4 py-3">
                          <span className="rounded-full bg-az-soft px-2.5 py-1 text-xs font-semibold text-az">
                            {s.categoria}
                          </span>
                        </td>
                        <td className="px-4 py-3 whitespace-nowrap text-xs text-muted-foreground">
                          {fmtData(s.ts)}
                        </td>
                        <td className="max-w-xs px-4 py-3 text-muted-foreground">{s.mensagem}</td>
                        <td className="min-w-[200px] px-4 py-2">
                          <div className="flex flex-wrap items-center gap-1.5">
                            {s.status && (
                              <span
                                className={`rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${
                                  s.status === "enviado-rh"
                                    ? "bg-success-soft text-success"
                                    : s.status === "para-socios"
                                      ? "bg-az-soft text-az"
                                      : s.status === "considerar-depois"
                                        ? "bg-warn-soft text-warn"
                                        : "bg-muted text-muted-foreground"
                                }`}
                              >
                                {s.status === "enviado-rh"
                                  ? "Enviado RH"
                                  : s.status === "para-socios"
                                    ? "Para sócios"
                                    : s.status === "considerar-depois"
                                      ? "Considerar depois"
                                      : "Desconsiderado"}
                              </span>
                            )}
                          </div>
                          <select
                            className="mt-1 w-full rounded-lg border border-border bg-card px-2 py-1 text-xs focus:outline-none"
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
                                    ? { ...x, ...(v ? { status: v, statusTs: Date.now() } : {}) }
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
                          {s.statusTs && (
                            <p className="mt-0.5 text-[10px] text-muted-foreground">
                              {fmtData(s.statusTs)}
                            </p>
                          )}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </Section>

        {/* Documentos */}
        <Section
          titulo="Documentos e políticas"
          intro="Documentos publicados para colaboradores e gestores."
          contagem={`${documentos.length} publicados`}
          collapsible
          defaultOpen={documentos.length > 0}
          acao={
            <Dialog
              open={docOpen}
              onOpenChange={(o) => {
                setDocOpen(o);
                if (!o) {
                  setDocTitulo("");
                  setDocTextoTag("");
                  setDocCorTag("#8a2058");
                  setDocFilial("todas");
                  setDocCategoria("todos");
                  setDocErro("");
                }
              }}
            >
              <DialogTrigger asChild>
                <Button size="sm" className="rounded-full">
                  <Plus className="h-3.5 w-3.5" /> Publicar documento
                </Button>
              </DialogTrigger>
              <DialogContent className="sm:max-w-lg">
                <DialogHeader>
                  <DialogTitle>Publicar documento</DialogTitle>
                  <DialogDescription>
                    Upload de PDF — aparece no painel dos colaboradores e gestores.
                  </DialogDescription>
                </DialogHeader>
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="doc-titulo">Título</Label>
                    <Input
                      id="doc-titulo"
                      placeholder="Ex: Código de Ética e Conduta"
                      value={docTitulo}
                      onChange={(e) => setDocTitulo(e.target.value)}
                      maxLength={100}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Filial</Label>
                    <div className="flex flex-wrap gap-2">
                      {(["todas", ...FILIAIS.map((f) => f.id)] as const).map((f) => (
                        <button
                          key={f}
                          onClick={() => setDocFilial(f)}
                          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                            docFilial === f
                              ? "border-kt bg-kt-soft text-kt"
                              : "border-border bg-card"
                          }`}
                        >
                          {f === "todas" ? "Todas" : filialNome(f)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid gap-2">
                    <Label>Visibilidade</Label>
                    <div className="flex gap-2">
                      {(["todos", "gestao"] as const).map((c) => (
                        <button
                          key={c}
                          onClick={() => setDocCategoria(c)}
                          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                            docCategoria === c
                              ? "border-kt bg-kt-soft text-kt"
                              : "border-border bg-card"
                          }`}
                        >
                          {c === "todos" ? "Todos (colaboradores e gestores)" : "Só gestores"}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="grid gap-2">
                      <Label htmlFor="doc-texto-tag">Etiqueta</Label>
                      <Input
                        id="doc-texto-tag"
                        placeholder="Ex: Ética"
                        value={docTextoTag}
                        onChange={(e) => setDocTextoTag(e.target.value)}
                        maxLength={20}
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="doc-cor-tag">Cor</Label>
                      <div className="flex items-center gap-2">
                        <input
                          id="doc-cor-tag"
                          type="color"
                          value={docCorTag}
                          onChange={(e) => setDocCorTag(e.target.value)}
                          className="h-10 w-12 cursor-pointer rounded border border-border p-1"
                        />
                        <span className="text-xs text-muted-foreground">{docCorTag}</span>
                      </div>
                    </div>
                  </div>
                  <input
                    ref={docInputRef}
                    type="file"
                    accept=".pdf,.doc,.docx"
                    className="hidden"
                  />
                  {docErro ? (
                    <p className="text-sm font-medium text-destructive">{docErro}</p>
                  ) : null}
                  <Button
                    className="rounded-full"
                    disabled={!docTitulo.trim() || !docTextoTag.trim() || docUploading}
                    onClick={async () => {
                      docInputRef.current?.click();
                      docInputRef.current!.onchange = async () => {
                        const f = docInputRef.current?.files?.[0];
                        if (!f) return;
                        await realizarUploadDoc(f);
                        if (docInputRef.current) docInputRef.current.value = "";
                      };
                    }}
                  >
                    {docUploading ? "Enviando..." : "Selecionar arquivo e publicar"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          }
        >
          {documentos.length === 0 ? (
            <EmptyState>Nenhum documento publicado ainda.</EmptyState>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {documentos.map((doc) => {
                const nomesAssinantes = new Set(
                  assinaturas.filter((a) => a.politica === doc.id).map((a) => a.nome),
                );
                const nomesLeram = new Set(
                  leituras.filter((l) => l.documentoId === doc.id).map((l) => l.nome),
                );
                const colabsFilial =
                  doc.filial === "todas"
                    ? colaboradores
                    : colaboradores.filter((c) => c.filial === doc.filial);
                const nuncaAbriram = colabsFilial.filter(
                  (c) => !nomesAssinantes.has(c.nome) && !nomesLeram.has(c.nome),
                ).length;
                return (
                  <div
                    key={doc.id}
                    className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="relative">
                      <img src={capaPadrao} alt="" className="h-28 w-full object-cover" />
                      <span
                        className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                        style={{ backgroundColor: doc.corTag }}
                      >
                        {doc.textoTag}
                      </span>
                      {doc.categoria === "gestao" && (
                        <span className="absolute right-3 top-3 rounded-full bg-az px-2.5 py-1 text-[11px] font-bold text-white">
                          Gestão
                        </span>
                      )}
                    </div>
                    <div className="flex flex-1 flex-col p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{doc.titulo}</p>
                          <p className="text-xs text-muted-foreground">
                            {filialNome(doc.filial === "todas" ? undefined : doc.filial) ||
                              "Todas as unidades"}{" "}
                            · {new Date(doc.data + "T00:00:00").toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                        <div className="flex shrink-0 items-center gap-1">
                          <a
                            href={doc.url}
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full p-1.5 hover:bg-muted"
                            title="Abrir"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                          <button
                            className="rounded-full p-1.5 text-destructive hover:bg-destructive/10"
                            onClick={() =>
                              setDocumentos((prev) => prev.filter((d) => d.id !== doc.id))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-auto flex flex-wrap gap-2 pt-3 text-xs">
                        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success">
                          <Check className="h-3 w-3" /> {nomesAssinantes.size} assinaram
                        </span>
                        {nomesLeram.size - nomesAssinantes.size > 0 && (
                          <span className="rounded-full bg-warn-soft px-2 py-0.5 text-warn">
                            {nomesLeram.size - nomesAssinantes.size} leram, não assinaram
                          </span>
                        )}
                        {nuncaAbriram > 0 && (
                          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                            {nuncaAbriram} nunca abriram
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        {/* Ações administrativas — botões que abrem popups */}
        <div className="grid gap-3 sm:grid-cols-2">
          {/* Importar CSV */}
          <Dialog
            open={csvOpen}
            onOpenChange={(o) => {
              setCsvOpen(o);
              if (!o) {
                setCsvPreview(null);
                setCsvErro("");
              }
            }}
          >
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-left text-sm transition-colors hover:bg-muted">
                <Upload className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-bold">Importar colaboradores (CSV)</p>
                  <p className="text-xs text-muted-foreground">
                    {colaboradores.length} cadastrados
                  </p>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>Importar colaboradores (CSV)</DialogTitle>
                <DialogDescription>
                  Cabeçalhos esperados: nome_completo, ultimos_3_digitos_cpf, cargo, filial,
                  data_nascimento, data_admissao.
                </DialogDescription>
              </DialogHeader>
              <input
                ref={csvInputRef}
                type="file"
                accept=".csv"
                className="hidden"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) processarCsv(file);
                  e.target.value = "";
                }}
              />
              {csvErro ? <p className="text-sm font-medium text-destructive">{csvErro}</p> : null}
              {!csvPreview ? (
                <Button className="rounded-full" onClick={() => csvInputRef.current?.click()}>
                  Selecionar arquivo CSV
                </Button>
              ) : (
                <div className="grid gap-4">
                  <div className="rounded-2xl bg-muted px-4 py-4 text-sm">
                    <p className="font-semibold">Prévia da importação</p>
                    <p className="mt-1 text-muted-foreground">
                      {csvPreview.adicionar.length > 0
                        ? `${csvPreview.adicionar.length} colaborador${csvPreview.adicionar.length > 1 ? "es" : ""} serão adicionados`
                        : "Nenhum novo colaborador"}
                      {csvPreview.atualizar.length > 0
                        ? ` · ${csvPreview.atualizar.length} serão atualizados`
                        : ""}
                      .
                    </p>
                    {csvPreview.adicionar.length > 0 ? (
                      <ul className="mt-2 grid gap-0.5 text-xs text-muted-foreground">
                        {csvPreview.adicionar.slice(0, 6).map((c) => (
                          <li key={c.id}>
                            + {c.nome} · {filialNome(c.filial)}
                          </li>
                        ))}
                        {csvPreview.adicionar.length > 6 ? (
                          <li>…e mais {csvPreview.adicionar.length - 6}</li>
                        ) : null}
                      </ul>
                    ) : null}
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      className="rounded-full"
                      onClick={() => {
                        const idsAtualizar = new Set(csvPreview.atualizar.map((c) => c.id));
                        const base = colaboradores.filter((c) => !idsAtualizar.has(c.id));
                        setColaboradores([
                          ...base,
                          ...csvPreview.atualizar,
                          ...csvPreview.adicionar,
                        ]);
                        toast.success(
                          `${csvPreview.adicionar.length} adicionados, ${csvPreview.atualizar.length} atualizados.`,
                        );
                        setCsvPreview(null);
                        setCsvOpen(false);
                      }}
                    >
                      Confirmar importação
                    </Button>
                    <Button
                      variant="outline"
                      className="rounded-full"
                      onClick={() => setCsvPreview(null)}
                    >
                      Cancelar
                    </Button>
                  </div>
                </div>
              )}
            </DialogContent>
          </Dialog>

          {/* Criar acesso de gestor */}
          <Dialog
            open={gestorOpen}
            onOpenChange={(o) => {
              setGestorOpen(o);
              if (!o) {
                setGSucesso(null);
                setGNome("");
                setGEmail("");
                setGFilial(FILIAIS[0].id);
                setGErro("");
              }
            }}
          >
            <DialogTrigger asChild>
              <button className="flex items-center gap-3 rounded-2xl border border-border bg-card px-5 py-4 text-left text-sm transition-colors hover:bg-muted">
                <UserPlus2 className="h-5 w-5 shrink-0 text-muted-foreground" />
                <div>
                  <p className="font-bold">Criar acesso de gestor</p>
                  <p className="text-xs text-muted-foreground">Provisiona login temporário</p>
                </div>
              </button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>Criar acesso de gestor</DialogTitle>
                <DialogDescription>
                  O gestor cria a senha definitiva no primeiro acesso.
                </DialogDescription>
              </DialogHeader>
              {gSucesso ? (
                <div className="grid gap-4">
                  <div className="rounded-2xl border border-success bg-success-soft p-5">
                    <p className="font-bold text-success">Acesso criado com sucesso!</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Comunique as credenciais por WhatsApp ou pessoalmente.
                    </p>
                    <div className="mt-4 grid gap-2">
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">E-mail</span>
                        <span className="font-mono font-semibold">{gSucesso.email}</span>
                      </div>
                      <div className="flex items-center justify-between gap-2 rounded-xl bg-card px-4 py-2.5 text-sm">
                        <span className="text-muted-foreground">Senha temporária</span>
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold tracking-wider">
                            {gSucesso.senha}
                          </span>
                          <button
                            onClick={() => {
                              navigator.clipboard.writeText(gSucesso!.senha);
                              toast.success("Senha copiada!");
                            }}
                            className="rounded-full p-1 hover:bg-muted"
                          >
                            <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    className="w-fit rounded-full"
                    onClick={() => {
                      setGSucesso(null);
                      setGNome("");
                      setGEmail("");
                      setGFilial(FILIAIS[0].id);
                    }}
                  >
                    <UserPlus2 className="h-4 w-4" /> Criar outro acesso
                  </Button>
                </div>
              ) : (
                <div className="grid gap-3">
                  <div className="grid gap-2">
                    <Label htmlFor="g-nome">Nome completo</Label>
                    <Input
                      id="g-nome"
                      placeholder="Ex.: Marcos Tanaka"
                      value={gNome}
                      onChange={(e) => setGNome(e.target.value)}
                      maxLength={80}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="g-email">E-mail de acesso</Label>
                    <Input
                      id="g-email"
                      type="email"
                      placeholder="gestor@email.com"
                      value={gEmail}
                      onChange={(e) => setGEmail(e.target.value)}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Unidade</Label>
                    <div className="flex flex-wrap gap-2">
                      {FILIAIS.map((f) => (
                        <button
                          key={f.id}
                          onClick={() => setGFilial(f.id)}
                          className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors ${
                            gFilial === f.id
                              ? "border-kt bg-kt-soft text-kt"
                              : "border-border bg-card"
                          }`}
                        >
                          {f.nome}
                        </button>
                      ))}
                    </div>
                  </div>
                  {gErro ? <p className="text-sm font-medium text-destructive">{gErro}</p> : null}
                  <Button
                    className="rounded-full"
                    disabled={!gNome.trim() || !gEmail.trim() || gCriando}
                    onClick={async () => {
                      setGCriando(true);
                      setGErro("");
                      try {
                        const result = await criarGestorFn({
                          data: { nome: gNome, email: gEmail, filial: gFilial },
                        });
                        setGSucesso({
                          email: gEmail.trim().toLowerCase(),
                          senha: result.senhaTemp,
                        });
                      } catch (e) {
                        setGErro((e as Error).message);
                      } finally {
                        setGCriando(false);
                      }
                    }}
                  >
                    {gCriando ? "Criando acesso..." : "Criar acesso de gestor"}
                  </Button>
                </div>
              )}
            </DialogContent>
          </Dialog>
        </div>
      </div>
    </AppShell>
  );
}
