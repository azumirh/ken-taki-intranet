import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Check, Copy, ExternalLink, Trash2, UserPlus2 } from "lucide-react";
import { AppShell, BackLink } from "@/components/kt/app-shell";
import { EmptyState, Section } from "@/components/kt/section";
import { Mural } from "@/components/kt/mural";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  if (linhas.length < 2) return [];
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

function labelAssunto(assunto: string): string {
  if (assunto === "suporte-checkin") return "Apoio via check-in";
  if (assunto === "crise-checkin") return "Situação crítica";
  if (assunto === "whatsapp-gestor") return "Contato do gestor";
  return assunto;
}

function PainelAzumi({ perfil, onLogout }: { perfil: KtPerfil; onLogout: () => void }) {
  const [checkins] = useCheckins();
  const [assinaturas] = useAssinaturas();
  const [leituras] = useLeituras();
  const [sugestoes] = useSugestoes();
  const [ajuda, setAjuda] = useAjuda();
  const [pesquisa, setPesquisa] = usePesquisa();
  const [noticias, setNoticias] = useNoticias();
  const [colaboradores, setColaboradores] = useColaboradores();
  const [documentos, setDocumentos] = useDocumentos();

  // ─── Estado: formulário de documento ────────────────────────────────────────
  const docInputRef = useRef<HTMLInputElement>(null);
  const [docTitulo, setDocTitulo] = useState("");
  const [docFilial, setDocFilial] = useState<FilialId | "todas">("todas");
  const [docCorTag, setDocCorTag] = useState("#8a2058");
  const [docTextoTag, setDocTextoTag] = useState("");
  const [docUploading, setDocUploading] = useState(false);
  const [docErro, setDocErro] = useState("");

  const [pTitulo, setPTitulo] = useState("");
  const [pDesc, setPDesc] = useState("");
  const [pLink, setPLink] = useState("");
  const [pPrazo, setPPrazo] = useState("");

  const [nTitulo, setNTitulo] = useState("");
  const [nResumo, setNResumo] = useState("");
  const [nVideo, setNVideo] = useState("");
  const [nData, setNData] = useState("");

  const [filtroAjuda, setFiltroAjuda] = useState<string>("Todas");

  const [gNome, setGNome] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gFilial, setGFilial] = useState<"cristo-rei" | "champagnat">(FILIAIS[0].id);
  const [gCriando, setGCriando] = useState(false);
  const [gErro, setGErro] = useState("");
  const [gSucesso, setGSucesso] = useState<{ email: string; senha: string } | null>(null);

  const csvInputRef = useRef<HTMLInputElement>(null);
  const [csvPreview, setCsvPreview] = useState<{
    adicionar: Colaborador[];
    atualizar: Colaborador[];
  } | null>(null);
  const [csvErro, setCsvErro] = useState("");

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

  async function realizarUpload(file: File) {
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
        },
        ...prev,
      ]);
      setDocTitulo("");
      setDocTextoTag("");
      setDocCorTag("#8a2058");
      setDocFilial("todas");
      toast.success("Documento publicado com sucesso.");
    } catch (e) {
      setDocErro(`Erro ao enviar: ${(e as Error).message}`);
    } finally {
      setDocUploading(false);
    }
  }

  return (
    <AppShell onLogout={onLogout}>
      <div className="grid gap-5">
        <div>
          <h1 className="text-2xl font-extrabold sm:text-3xl">Área Azumi RH</h1>
          <p className="text-sm text-muted-foreground">
            Olá, {perfil.nome}! Visão consolidada de Cristo Rei e Champagnat.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {[
            { label: "Check-ins", valor: checkins.length },
            { label: "Assinaturas", valor: assinaturas.length },
            { label: "Pedidos de apoio", valor: ajuda.length },
          ].map((k) => (
            <div key={k.label} className="surface p-5">
              <p className="text-3xl font-extrabold text-union">{k.valor}</p>
              <p className="mt-1 text-sm text-muted-foreground">{k.label}</p>
            </div>
          ))}
        </div>

        <Section
          titulo="Clima por unidade"
          intro="Distribuição dos check-ins de humor nas duas unidades."
        >
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
        </Section>

        <Section
          titulo="Publicar notícia ou vídeo"
          intro="Cole o link do YouTube e o vídeo aparece direto no painel do colaborador."
          contagem={`${noticias.length} publicados`}
        >
          <div className="grid max-w-2xl gap-3">
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
                      data: nData || new Date().toISOString().slice(0, 10),
                    },
                    ...noticias,
                  ]);
                  setNTitulo("");
                  setNResumo("");
                  setNVideo("");
                  setNData("");
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
                <div>
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
                      });
                      setPTitulo("");
                      setPDesc("");
                      setPLink("");
                      setPPrazo("");
                      toast.success("Pesquisa publicada.");
                    }}
                  >
                    Publicar pesquisa
                  </Button>
                </div>
              </>
            )}
          </div>
        </Section>

        <Mural filial="todas" autorPadrao="Equipe Azumi RH" />

        <Section
          titulo="Pedidos de apoio"
          intro="Histórico de acionamentos da Azumi RH via intranet. Adicione notas internas em cada registro."
          contagem={`${ajuda.length} registros`}
        >
          {ajuda.length === 0 ? (
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
                        : "border-border text-muted-foreground hover:border-foreground hover:text-foreground"
                    }`}
                  >
                    {f}
                  </button>
                ))}
              </div>
              <div className="grid gap-3">
                {ajuda
                  .filter((a) => filtroAjuda === "Todas" || filialNome(a.filial) === filtroAjuda)
                  .map((a) => (
                    <div
                      key={a.id}
                      className="rounded-2xl border border-border bg-card p-4 text-sm"
                    >
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide ${
                            a.assunto === "crise-checkin"
                              ? "bg-destructive/10 text-destructive"
                              : a.assunto === "suporte-checkin"
                                ? "bg-warn-soft text-warn"
                                : "bg-az-soft text-az"
                          }`}
                        >
                          {labelAssunto(a.assunto)}
                        </span>
                        <span className="text-muted-foreground">
                          {a.nome} · {filialNome(a.filial)}
                        </span>
                        <span className="ml-auto text-xs text-muted-foreground">
                          {new Date(a.ts).toLocaleString("pt-BR", {
                            day: "2-digit",
                            month: "short",
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      </div>
                      <Textarea
                        className="mt-3 text-xs"
                        rows={2}
                        placeholder="Nota interna (visível só para a Azumi RH)..."
                        value={a.nota ?? ""}
                        onChange={(e) => {
                          const nota = e.target.value;
                          setAjuda((prev) => prev.map((x) => (x.id === a.id ? { ...x, nota } : x)));
                        }}
                      />
                    </div>
                  ))}
              </div>
            </div>
          )}
        </Section>

        <Section
          titulo="Documentos e políticas"
          intro="Publique documentos para colaboradores e gestores. Upload de PDF direto no sistema."
          contagem={`${documentos.length} publicados`}
        >
          {/* Formulário de novo documento */}
          <div className="grid max-w-2xl gap-3">
            <div className="grid gap-2">
              <Label htmlFor="doc-titulo">Título do documento</Label>
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
                      docFilial === f ? "border-kt bg-kt-soft text-kt" : "border-border bg-card"
                    }`}
                  >
                    {f === "todas" ? "Todas as unidades" : filialNome(f)}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="grid gap-2">
                <Label htmlFor="doc-texto-tag">Etiqueta (texto)</Label>
                <Input
                  id="doc-texto-tag"
                  placeholder="Ex: Ética, Segurança"
                  value={docTextoTag}
                  onChange={(e) => setDocTextoTag(e.target.value)}
                  maxLength={20}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="doc-cor-tag">Cor da etiqueta</Label>
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
            <input ref={docInputRef} type="file" accept=".pdf,.doc,.docx" className="hidden" />
            {docErro ? <p className="text-sm font-medium text-destructive">{docErro}</p> : null}
            <div className="flex flex-wrap gap-2">
              <Button
                className="rounded-full"
                disabled={!docTitulo.trim() || !docTextoTag.trim() || docUploading}
                onClick={async () => {
                  const file = docInputRef.current?.files?.[0];
                  if (!file) {
                    // No file selected: open picker first
                    docInputRef.current?.click();
                    docInputRef.current!.onchange = async () => {
                      const f = docInputRef.current?.files?.[0];
                      if (!f) return;
                      await realizarUpload(f);
                      if (docInputRef.current) docInputRef.current.value = "";
                    };
                    return;
                  }
                  await realizarUpload(file);
                  if (docInputRef.current) docInputRef.current.value = "";
                }}
              >
                {docUploading ? "Enviando..." : "Selecionar arquivo e publicar"}
              </Button>
            </div>
          </div>

          {/* Lista de documentos existentes */}
          {documentos.length > 0 && (
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              {documentos.map((doc) => {
                const totalAssinaturas = assinaturas.filter((a) => a.politica === doc.id).length;
                const totalLeituras = leituras.filter((l) => l.documentoId === doc.id).length;
                return (
                  <div
                    key={doc.id}
                    className="overflow-hidden rounded-2xl border border-border bg-card"
                  >
                    <div className="relative">
                      <img src={capaPadrao} alt="" className="h-16 w-full object-cover" />
                      <span
                        className="absolute left-2 top-2 rounded-full px-2 py-0.5 text-[10px] font-bold text-white"
                        style={{ backgroundColor: doc.corTag }}
                      >
                        {doc.textoTag}
                      </span>
                    </div>
                    <div className="p-3">
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
                            title="Abrir documento"
                          >
                            <ExternalLink className="h-3.5 w-3.5 text-muted-foreground" />
                          </a>
                          <button
                            className="rounded-full p-1.5 text-destructive hover:bg-destructive/10"
                            title="Remover documento"
                            onClick={() =>
                              setDocumentos((prev) => prev.filter((d) => d.id !== doc.id))
                            }
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      </div>
                      <div className="mt-2 flex gap-2 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1 rounded-full bg-success-soft px-2 py-0.5 text-success">
                          <Check className="h-3 w-3" /> {totalAssinaturas}
                        </span>
                        <span className="rounded-full bg-muted px-2 py-0.5">
                          {totalLeituras} leram
                        </span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </Section>

        <Section
          titulo="Importar colaboradores (CSV)"
          intro="Importe a planilha com os colaboradores das unidades. Cabeçalhos esperados: nome_completo, ultimos_3_digitos_cpf, cargo, filial, data_nascimento, data_admissao."
          contagem={`${colaboradores.length} cadastrados`}
        >
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
          {csvErro ? <p className="mb-3 text-sm font-medium text-destructive">{csvErro}</p> : null}
          {!csvPreview ? (
            <Button className="rounded-full" onClick={() => csvInputRef.current?.click()}>
              Selecionar arquivo CSV
            </Button>
          ) : (
            <div className="grid max-w-2xl gap-4">
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
                    setColaboradores([...base, ...csvPreview.atualizar, ...csvPreview.adicionar]);
                    toast.success(
                      `${csvPreview.adicionar.length} adicionados, ${csvPreview.atualizar.length} atualizados.`,
                    );
                    setCsvPreview(null);
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
        </Section>

        <Section
          titulo="Criar acesso de gestor"
          intro="Provisiona login e senha temporária para um novo gestor. O gestor cria a senha definitiva no primeiro acesso."
        >
          {gSucesso ? (
            <div className="grid max-w-2xl gap-4">
              <div className="rounded-2xl border border-success bg-success-soft p-5">
                <p className="font-bold text-success">Acesso criado com sucesso!</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  Comunique as credenciais abaixo por WhatsApp ou pessoalmente. O gestor precisará
                  criar uma nova senha no primeiro acesso.
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
                        title="Copiar senha"
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
            <div className="grid max-w-2xl gap-3">
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
                        gFilial === f.id ? "border-kt bg-kt-soft text-kt" : "border-border bg-card"
                      }`}
                    >
                      {f.nome}
                    </button>
                  ))}
                </div>
              </div>
              {gErro ? <p className="text-sm font-medium text-destructive">{gErro}</p> : null}
              <div>
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
                      setGSucesso({ email: gEmail.trim().toLowerCase(), senha: result.senhaTemp });
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
            </div>
          )}
        </Section>
      </div>
    </AppShell>
  );
}
