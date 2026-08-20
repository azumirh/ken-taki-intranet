import {
  AlertTriangle,
  ArrowUpRight,
  Building2,
  CheckCircle2,
  FileCheck2,
  LifeBuoy,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { filialNome, iniciais } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Mode = "manager" | "hr";

type FeedbackRow = {
  id: string;
  tipo: string;
  mensagem: string;
  anonimo: boolean;
  autor: string | null;
  filial: string;
  ts: string;
  status: string | null;
  destino: string | null;
  triagem_rh_status: string | null;
  gestor_liberado: boolean | null;
  escalado_rh: boolean | null;
};

type SupportRow = {
  id: string;
  nome: string;
  filial: string;
  assunto: string | null;
  ts: string;
  status: string | null;
  destino_inicial: string | null;
  gestor_id: string | null;
};

type Profile = {
  id: string;
  tipo: string;
  filial: string | null;
  nome: string;
};

function when(value: string) {
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function needsRhTriage(item: FeedbackRow) {
  return item.triagem_rh_status === "pendente" || item.triagem_rh_status === "em_analise";
}

function Metric({
  label,
  value,
  detail,
  icon,
  attention = false,
}: {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  attention?: boolean;
}) {
  const activeAttention = attention && value > 0;
  return (
    <div
      className={`grid min-h-[112px] grid-cols-[auto_1fr_auto] items-start gap-3 rounded-lg border px-4 py-3.5 ${
        activeAttention ? "border-warn/35 bg-warn-soft/45" : "border-border bg-card"
      }`}
    >
      <span
        className={`grid h-9 w-9 place-items-center rounded-md ${
          activeAttention ? "bg-card text-warn" : "bg-muted text-muted-foreground"
        }`}
      >
        {icon}
      </span>
      <div className="min-w-0">
        <p className="text-xs font-bold text-foreground">{label}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      </div>
      <div className="text-right">
        <p className={`text-2xl font-bold tabular-nums ${activeAttention ? "text-warn" : "text-foreground"}`}>
          {value}
        </p>
        {activeAttention ? <span className="mt-1 inline-block h-2 w-2 rounded-full bg-warn" /> : null}
      </div>
    </div>
  );
}

function EmptyAttention({ mode }: { mode: Mode }) {
  return (
    <div className="flex items-start gap-3 rounded-lg border border-success/20 bg-success-soft/55 px-4 py-4">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-card text-success ring-1 ring-success/15">
        <CheckCircle2 className="h-4 w-4" />
      </span>
      <div>
        <p className="text-sm font-bold text-foreground">Nenhuma pendência crítica agora</p>
        <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
          {mode === "hr"
            ? "As filas de triagem e escalonamento estão sem itens urgentes neste momento."
            : "Não há feedbacks ou pedidos de conversa aguardando atuação imediata da gestão."}
        </p>
      </div>
    </div>
  );
}

export function WorkspaceOverview({ mode }: { mode: Mode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [supports, setSupports] = useState<SupportRow[]>([]);
  const [suggestionsPending, setSuggestionsPending] = useState(0);
  const [documentsPending, setDocumentsPending] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [workingId, setWorkingId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: p } = await supabase
        .from("kt_perfis")
        .select("id,tipo,filial,nome")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!p) return;

      const current = p as Profile;
      setProfile(current);

      if (mode === "hr") {
        const [fb, help, sg, people] = await Promise.all([
          supabase
            .from("kt_feedbacks")
            .select(
              "id,tipo,mensagem,anonimo,autor,filial,ts,status,destino,triagem_rh_status,gestor_liberado,escalado_rh",
            )
            .or("triagem_rh_status.in.(pendente,em_analise),escalado_rh.eq.true")
            .order("ts", { ascending: false })
            .limit(30),
          supabase
            .from("kt_ajuda")
            .select("id,nome,filial,assunto,ts,status,destino_inicial,gestor_id")
            .or("status.is.null,status.neq.resolvido")
            .order("ts", { ascending: false })
            .limit(40),
          supabase.from("kt_sugestoes").select("id,status").is("status", null),
          supabase
            .from("kt_colaboradores")
            .select("id", { count: "exact", head: true })
            .eq("ativo", true),
        ]);

        setFeedbacks(
          ((fb.data ?? []) as FeedbackRow[]).filter(
            (item) => item.status !== "concluido" && item.status !== "cancelado",
          ),
        );
        setSupports((help.data ?? []) as SupportRow[]);
        setSuggestionsPending(sg.data?.length ?? 0);
        setDocumentsPending(0);
        setPeopleCount(people.count ?? 0);
        return;
      }

      const filial = current.filial;
      if (!filial) return;

      const [fb, help, docs, signatures, people] = await Promise.all([
        supabase
          .from("kt_feedbacks")
          .select(
            "id,tipo,mensagem,anonimo,autor,filial,ts,status,destino,triagem_rh_status,gestor_liberado,escalado_rh",
          )
          .eq("filial", filial)
          .eq("destino", "gestor")
          .order("ts", { ascending: false })
          .limit(20),
        supabase
          .from("kt_ajuda")
          .select("id,nome,filial,assunto,ts,status,destino_inicial,gestor_id")
          .eq("filial", filial)
          .or(`destino_inicial.eq.gestor,gestor_id.eq.${current.id}`)
          .order("ts", { ascending: false })
          .limit(30),
        supabase
          .from("kt_documentos")
          .select("id,filial")
          .or(`filial.eq.${filial},filial.eq.todas`),
        supabase
          .from("kt_assinaturas")
          .select("politica,nome")
          .eq("nome", current.nome),
        supabase
          .from("kt_colaboradores")
          .select("id", { count: "exact", head: true })
          .eq("filial", filial)
          .eq("ativo", true),
      ]);

      setFeedbacks(
        ((fb.data ?? []) as FeedbackRow[]).filter(
          (item) => item.status !== "concluido" && item.status !== "cancelado",
        ),
      );
      setSupports(
        ((help.data ?? []) as SupportRow[]).filter((item) => item.status !== "resolvido"),
      );
      const signed = new Set((signatures.data ?? []).map((item) => String(item.politica)));
      setDocumentsPending((docs.data ?? []).filter((item) => !signed.has(String(item.id))).length);
      setSuggestionsPending(0);
      setPeopleCount(people.count ?? 0);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  const releaseToManager = async (id: string) => {
    setWorkingId(id);
    try {
      const { error } = await supabase.rpc("kt_liberar_feedback_gestor", {
        p_feedback_id: id,
      });
      if (error) throw error;
      toast.success("Relato compartilhado com a gestão da unidade.");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível compartilhar o relato.");
    } finally {
      setWorkingId(null);
    }
  };

  const keepWithHr = async (id: string) => {
    setWorkingId(id);
    try {
      const { error } = await supabase.rpc("kt_reter_feedback_rh", {
        p_feedback_id: id,
      });
      if (error) throw error;
      toast.success("Relato mantido restrito ao RH.");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível atualizar a triagem.");
    } finally {
      setWorkingId(null);
    }
  };

  const escalateToHr = async (id: string) => {
    setWorkingId(id);
    try {
      const { error } = await supabase.rpc("kt_escalar_feedback_rh", {
        p_feedback_id: id,
      });
      if (error) throw error;
      toast.success("RH envolvido neste acompanhamento.");
      await load();
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível envolver o RH.");
    } finally {
      setWorkingId(null);
    }
  };

  if (!profile) return null;

  const directSupport = supports.filter(
    (item) => item.destino_inicial === "gestor" || item.gestor_id === profile.id,
  );
  const triageItems = mode === "hr" ? feedbacks.filter(needsRhTriage) : [];
  const escalatedItems =
    mode === "hr"
      ? feedbacks.filter((item) => Boolean(item.escalado_rh) && !needsRhTriage(item))
      : [];
  const managerFeedbackCount = mode === "manager" ? feedbacks.length : 0;
  const attentionCount =
    mode === "hr"
      ? triageItems.length + escalatedItems.length + supports.length
      : managerFeedbackCount + directSupport.length + documentsPending;

  return (
    <section className="mb-5 grid gap-4" aria-label="Resumo de pendências">
      <div className="surface overflow-hidden">
        <div className="grid gap-4 px-4 py-4 sm:px-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center lg:px-6">
          <div className="flex min-w-0 items-center gap-3.5">
            <span className="grid h-12 w-12 shrink-0 place-items-center rounded-lg bg-foreground text-sm font-bold text-background">
              {iniciais(profile.nome)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md bg-kt-soft px-2 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-kt">
                  {mode === "hr" ? "RH" : "Gestão"}
                </span>
                <span className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground">
                  {mode === "hr" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                  {mode === "hr" ? "Todas as unidades" : filialNome(profile.filial ?? undefined)}
                </span>
              </div>
              <h1 className="mt-1 truncate text-xl font-bold text-foreground sm:text-2xl">{profile.nome}</h1>
              <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                {mode === "hr"
                  ? "Visão consolidada de pessoas, triagens, comunicações e governança."
                  : "Prioridades operacionais e acompanhamento da sua unidade."}
              </p>
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 border-t border-border pt-3 lg:justify-end lg:border-0 lg:pt-0">
            <div className="text-left lg:text-right">
              <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Pendências</p>
              <p className={`mt-0.5 text-2xl font-bold tabular-nums ${attentionCount > 0 ? "text-warn" : "text-success"}`}>
                {attentionCount}
              </p>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
              aria-label="Atualizar visão geral"
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div>
        <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
          {mode === "hr" ? "Radar de pessoas" : "Radar da unidade"}
        </p>
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {mode === "hr" ? (
            <>
              <Metric
                label="Triagens sensíveis"
                value={triageItems.length}
                detail="Relatos aguardando decisão do RH."
                icon={<ShieldCheck className="h-4 w-4" />}
                attention
              />
              <Metric
                label="Gestores pediram RH"
                value={escalatedItems.length}
                detail="Casos escalados pela liderança."
                icon={<UserRoundCheck className="h-4 w-4" />}
                attention
              />
              <Metric
                label="Pedidos de apoio"
                value={supports.length}
                detail="Atendimentos ainda em acompanhamento."
                icon={<LifeBuoy className="h-4 w-4" />}
                attention
              />
              <Metric
                label="Pessoas ativas"
                value={peopleCount}
                detail={`${suggestionsPending} sugestão${suggestionsPending === 1 ? "" : "ões"} sem classificação.`}
                icon={<UsersRound className="h-4 w-4" />}
              />
            </>
          ) : (
            <>
              <Metric
                label="Feedbacks em acompanhamento"
                value={managerFeedbackCount}
                detail="Somente itens liberados ou destinados à gestão."
                icon={<MessageSquareText className="h-4 w-4" />}
                attention
              />
              <Metric
                label="Pedidos de conversa"
                value={directSupport.length}
                detail="Pedidos diretos ou encaminhados pelo RH."
                icon={<LifeBuoy className="h-4 w-4" />}
                attention
              />
              <Metric
                label="Documentos pendentes"
                value={documentsPending}
                detail="Documentos da unidade ainda sem sua assinatura."
                icon={<FileCheck2 className="h-4 w-4" />}
              />
              <Metric
                label="Pessoas ativas"
                value={peopleCount}
                detail={`Equipe da unidade ${filialNome(profile.filial ?? undefined)}.`}
                icon={<UsersRound className="h-4 w-4" />}
              />
            </>
          )}
        </div>
      </div>

      {mode === "hr" && feedbacks.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-warn/30 bg-card">
          <div className="flex items-start gap-3 border-b border-border bg-warn-soft/45 px-4 py-3.5 sm:px-5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div>
              <p className="text-sm font-bold text-foreground">Fila de atenção do RH</p>
              <p className="mt-0.5 text-xs text-muted-foreground">
                Triagens confidenciais e casos que a gestão escalou para atuação do RH.
              </p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {feedbacks.slice(0, 6).map((item) => {
              const triage = needsRhTriage(item);
              return (
                <div
                  key={item.id}
                  className="grid gap-3 px-4 py-4 sm:px-5 xl:grid-cols-[160px_minmax(0,1fr)_auto] xl:items-center"
                >
                  <div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="inline-flex rounded-md bg-destructive/8 px-2 py-1 text-[11px] font-bold text-destructive">
                        {item.tipo}
                      </span>
                      {!triage && item.escalado_rh ? (
                        <span className="inline-flex rounded-md bg-success-soft px-2 py-1 text-[11px] font-bold text-success">
                          Gestor solicitou RH
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-1.5 text-[11px] text-muted-foreground">
                      {filialNome(item.filial)} · {when(item.ts)}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-foreground">
                      {item.anonimo ? "Relato anônimo" : item.autor || "Colaborador"}
                    </p>
                    <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">
                      {item.mensagem}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2 xl:justify-end">
                    {triage ? (
                      <>
                        <Button
                          variant="outline"
                          size="sm"
                          disabled={workingId === item.id}
                          onClick={() => void keepWithHr(item.id)}
                        >
                          Manter restrito ao RH
                        </Button>
                        <Button
                          size="sm"
                          disabled={workingId === item.id}
                          onClick={() => void releaseToManager(item.id)}
                        >
                          Compartilhar com gestor
                        </Button>
                      </>
                    ) : (
                      <span className="text-[11px] font-semibold text-success">Aguardando atuação do RH</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <button
            type="button"
            onClick={() => document.getElementById("feedbacks")?.scrollIntoView({ behavior: "smooth" })}
            className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-3 text-xs font-semibold text-kt hover:bg-kt-soft/35"
          >
            Ver todos os feedbacks <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : mode === "hr" ? (
        <EmptyAttention mode="hr" />
      ) : null}

      {mode === "manager" && (feedbacks.length > 0 || directSupport.length > 0) ? (
        <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,360px),1fr))]">
          {feedbacks.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3.5 sm:px-5">
                <p className="text-sm font-bold text-foreground">Feedbacks para acompanhamento</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Somente o que foi direcionado à sua gestão.</p>
              </div>
              <div className="divide-y divide-border">
                {feedbacks.slice(0, 4).map((item) => (
                  <div key={item.id} className="px-4 py-3.5 sm:px-5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">
                          {item.tipo} · {item.anonimo ? "Anônimo" : item.autor}
                        </p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.mensagem}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{when(item.ts)}</span>
                    </div>
                    <div className="mt-2.5">
                      {item.escalado_rh ? (
                        <span className="text-[11px] font-semibold text-success">RH já envolvido</span>
                      ) : (
                        <button
                          type="button"
                          disabled={workingId === item.id}
                          onClick={() => void escalateToHr(item.id)}
                          className="text-[11px] font-semibold text-kt hover:underline"
                        >
                          Envolver RH neste acompanhamento
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          {directSupport.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3.5 sm:px-5">
                <p className="text-sm font-bold text-foreground">Pedidos de conversa</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Ações direcionadas à liderança.</p>
              </div>
              <div className="divide-y divide-border">
                {directSupport.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3.5 sm:px-5">
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.nome}</p>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {item.gestor_id ? "Direcionado pelo RH" : "Pedido direto do colaborador"}
                      </p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{when(item.ts)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : mode === "manager" ? (
        <EmptyAttention mode="manager" />
      ) : null}
    </section>
  );
}
