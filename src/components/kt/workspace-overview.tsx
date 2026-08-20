import { AlertTriangle, ArrowUpRight, FileCheck2, LifeBuoy, MessageSquareText, ShieldCheck } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { filialNome } from "@/lib/kt-data";
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
  icon: React.ReactNode;
  attention?: boolean;
}) {
  return (
    <div className={`rounded-lg border p-4 ${attention && value > 0 ? "border-warn/30 bg-warn-soft/45" : "border-border bg-card"}`}>
      <div className="flex items-start justify-between gap-3">
        <span className={`grid h-9 w-9 place-items-center rounded-md ${attention && value > 0 ? "bg-card text-warn" : "bg-muted text-muted-foreground"}`}>
          {icon}
        </span>
        {attention && value > 0 ? <span className="h-2 w-2 rounded-full bg-warn" /> : null}
      </div>
      <p className="mt-4 text-2xl font-bold tabular-nums text-foreground">{value}</p>
      <p className="mt-0.5 text-sm font-semibold text-foreground">{label}</p>
      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{detail}</p>
    </div>
  );
}

export function WorkspaceOverview({ mode }: { mode: Mode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feedbacks, setFeedbacks] = useState<FeedbackRow[]>([]);
  const [supports, setSupports] = useState<SupportRow[]>([]);
  const [suggestionsPending, setSuggestionsPending] = useState(0);
  const [documentsPending, setDocumentsPending] = useState(0);
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
        const [fb, help, sg, docs, signatures] = await Promise.all([
          supabase
            .from("kt_feedbacks")
            .select("id,tipo,mensagem,anonimo,autor,filial,ts,status,destino,triagem_rh_status,gestor_liberado,escalado_rh")
            .in("triagem_rh_status", ["pendente", "em_analise", "retido_rh"])
            .order("ts", { ascending: false })
            .limit(20),
          supabase
            .from("kt_ajuda")
            .select("id,nome,filial,assunto,ts,status,destino_inicial,gestor_id")
            .neq("status", "resolvido")
            .order("ts", { ascending: false })
            .limit(40),
          supabase.from("kt_sugestoes").select("id,status").is("status", null),
          supabase.from("kt_documentos").select("id"),
          supabase.from("kt_assinaturas").select("politica"),
        ]);
        setFeedbacks((fb.data ?? []) as FeedbackRow[]);
        setSupports((help.data ?? []) as SupportRow[]);
        setSuggestionsPending(sg.data?.length ?? 0);
        const docIds = new Set((docs.data ?? []).map((d) => String(d.id)));
        const signedIds = new Set((signatures.data ?? []).map((s) => String(s.politica)));
        setDocumentsPending([...docIds].filter((id) => !signedIds.has(id)).length);
      } else {
        const filial = current.filial;
        if (!filial) return;
        const [fb, help, docs, signatures] = await Promise.all([
          supabase
            .from("kt_feedbacks")
            .select("id,tipo,mensagem,anonimo,autor,filial,ts,status,destino,triagem_rh_status,gestor_liberado,escalado_rh")
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
          supabase.from("kt_documentos").select("id,filial").or(`filial.eq.${filial},filial.eq.todas`),
          supabase.from("kt_assinaturas").select("politica,nome").eq("nome", current.nome),
        ]);
        setFeedbacks(
          ((fb.data ?? []) as FeedbackRow[]).filter((item) => item.status !== "concluido" && item.status !== "cancelado"),
        );
        setSupports(
          ((help.data ?? []) as SupportRow[]).filter((item) => item.status !== "resolvido"),
        );
        const signed = new Set((signatures.data ?? []).map((item) => String(item.politica)));
        setDocumentsPending((docs.data ?? []).filter((item) => !signed.has(String(item.id))).length);
        setSuggestionsPending(0);
      }
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
      const { error } = await supabase.rpc("kt_liberar_feedback_gestor", { p_feedback_id: id });
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
      const { error } = await supabase.rpc("kt_reter_feedback_rh", { p_feedback_id: id });
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
      const { error } = await supabase.rpc("kt_escalar_feedback_rh", { p_feedback_id: id });
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

  const directSupport = supports.filter((item) => item.destino_inicial === "gestor" || item.gestor_id === profile.id);
  const triageCount = mode === "hr" ? feedbacks.length : 0;
  const managerFeedbackCount = mode === "manager" ? feedbacks.length : 0;

  return (
    <section className="mb-5 grid gap-4" aria-label="Resumo de pendências">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">
            {mode === "hr" ? "Operação de pessoas" : `Unidade ${filialNome(profile.filial ?? undefined)}`}
          </p>
          <h1 className="mt-1 text-2xl font-bold text-foreground sm:text-3xl">
            {mode === "hr" ? "O que precisa da atenção do RH" : "O que precisa da sua atenção"}
          </h1>
        </div>
        {!loading ? (
          <button type="button" onClick={() => void load()} className="w-fit text-xs font-semibold text-muted-foreground hover:text-foreground">
            Atualizar
          </button>
        ) : null}
      </div>

      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        {mode === "hr" ? (
          <>
            <Metric label="Triagens sensíveis" value={triageCount} detail="Relatos que ainda não foram liberados à gestão." icon={<ShieldCheck className="h-4 w-4" />} attention />
            <Metric label="Pedidos de apoio" value={supports.length} detail="Atendimentos em acompanhamento pelo RH." icon={<LifeBuoy className="h-4 w-4" />} attention />
            <Metric label="Sugestões sem status" value={suggestionsPending} detail="Itens que ainda precisam de classificação." icon={<MessageSquareText className="h-4 w-4" />} />
            <Metric label="Documentos sem assinatura RH" value={documentsPending} detail="Referência de documentos ainda sem assinatura registrada." icon={<FileCheck2 className="h-4 w-4" />} />
          </>
        ) : (
          <>
            <Metric label="Feedbacks em acompanhamento" value={managerFeedbackCount} detail="Somente itens destinados ou liberados para sua unidade." icon={<MessageSquareText className="h-4 w-4" />} attention />
            <Metric label="Pedidos de conversa" value={directSupport.length} detail="Colaboradores que pediram contato da liderança ou foram direcionados pelo RH." icon={<LifeBuoy className="h-4 w-4" />} attention />
            <Metric label="Documentos pendentes" value={documentsPending} detail="Documentos da sua unidade sem sua assinatura registrada." icon={<FileCheck2 className="h-4 w-4" />} />
            <Metric label="Privacidade preservada" value={0} detail="Relatos restritos ao RH não aparecem para a gestão." icon={<ShieldCheck className="h-4 w-4" />} />
          </>
        )}
      </div>

      {mode === "hr" && feedbacks.length > 0 ? (
        <div className="overflow-hidden rounded-lg border border-warn/30 bg-card">
          <div className="flex items-start gap-3 border-b border-border bg-warn-soft/45 px-4 py-3.5">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warn" />
            <div>
              <p className="text-sm font-bold text-foreground">Fila de triagem confidencial</p>
              <p className="mt-0.5 text-xs text-muted-foreground">O gestor não enxerga estes relatos até o RH decidir compartilhar.</p>
            </div>
          </div>
          <div className="divide-y divide-border">
            {feedbacks.slice(0, 6).map((item) => (
              <div key={item.id} className="grid gap-3 px-4 py-4 xl:grid-cols-[160px_minmax(0,1fr)_auto] xl:items-center">
                <div>
                  <span className="inline-flex rounded-md bg-destructive/8 px-2 py-1 text-[11px] font-bold text-destructive">{item.tipo}</span>
                  <p className="mt-1.5 text-[11px] text-muted-foreground">{filialNome(item.filial)} · {when(item.ts)}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-foreground">{item.anonimo ? "Relato anônimo" : item.autor || "Colaborador"}</p>
                  <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.mensagem}</p>
                </div>
                <div className="flex flex-wrap gap-2 xl:justify-end">
                  <Button variant="outline" size="sm" disabled={workingId === item.id} onClick={() => void keepWithHr(item.id)}>
                    Manter no RH
                  </Button>
                  <Button size="sm" disabled={workingId === item.id} onClick={() => void releaseToManager(item.id)}>
                    Compartilhar com gestor
                  </Button>
                </div>
              </div>
            ))}
          </div>
          <button type="button" onClick={() => document.getElementById("feedbacks")?.scrollIntoView({ behavior: "smooth" })} className="flex w-full items-center justify-center gap-1.5 border-t border-border px-4 py-3 text-xs font-semibold text-kt hover:bg-kt-soft/35">
            Ver todos os feedbacks <ArrowUpRight className="h-3.5 w-3.5" />
          </button>
        </div>
      ) : null}

      {mode === "manager" && (feedbacks.length > 0 || directSupport.length > 0) ? (
        <div className="grid gap-3 xl:grid-cols-2">
          {feedbacks.length > 0 ? (
            <div className="overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border px-4 py-3.5">
                <p className="text-sm font-bold text-foreground">Feedbacks para acompanhamento</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Somente o que foi direcionado à sua gestão.</p>
              </div>
              <div className="divide-y divide-border">
                {feedbacks.slice(0, 4).map((item) => (
                  <div key={item.id} className="px-4 py-3.5">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="text-xs font-bold text-foreground">{item.tipo} · {item.anonimo ? "Anônimo" : item.autor}</p>
                        <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{item.mensagem}</p>
                      </div>
                      <span className="shrink-0 text-[10px] text-muted-foreground">{when(item.ts)}</span>
                    </div>
                    <div className="mt-2.5">
                      {item.escalado_rh ? (
                        <span className="text-[11px] font-semibold text-success">RH já envolvido</span>
                      ) : (
                        <button type="button" disabled={workingId === item.id} onClick={() => void escalateToHr(item.id)} className="text-[11px] font-semibold text-kt hover:underline">
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
              <div className="border-b border-border px-4 py-3.5">
                <p className="text-sm font-bold text-foreground">Pedidos de conversa</p>
                <p className="mt-0.5 text-xs text-muted-foreground">Ações direcionadas à liderança.</p>
              </div>
              <div className="divide-y divide-border">
                {directSupport.slice(0, 4).map((item) => (
                  <div key={item.id} className="flex items-start justify-between gap-3 px-4 py-3.5">
                    <div>
                      <p className="text-xs font-bold text-foreground">{item.nome}</p>
                      <p className="mt-1 text-xs text-muted-foreground">{item.gestor_id ? "Direcionado pelo RH" : "Pedido direto do colaborador"}</p>
                    </div>
                    <span className="text-[10px] text-muted-foreground">{when(item.ts)}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
