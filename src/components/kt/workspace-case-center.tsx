import {
  CalendarClock,
  CheckCircle2,
  FileUp,
  LifeBuoy,
  LockKeyhole,
  MessageSquareText,
  Send,
  ShieldAlert,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminPermissions } from "@/lib/admin-permissions";
import { filialNome } from "@/lib/kt-data";
import { listarGestoresFn } from "@/lib/server-fns";
import { supabase } from "@/lib/supabase";

type Mode = "manager" | "hr";
type CaseTab = "feedbacks" | "apoio";

type Profile = { id: string; nome: string; tipo: string; filial: string | null };
type Collaborator = { id: string; nome: string; filial: string; cargo: string | null };
type Manager = { id: string; nome: string; filial: string | null; ativo: boolean };
type Feedback = {
  id: string; tipo: string; mensagem: string; anonimo: boolean; autor: string | null; filial: string; ts: string;
  status: string | null; destino: string | null; triagem_rh_status: string | null; gestor_liberado: boolean | null;
  escalado_rh: boolean | null; referente_colaborador_id: string | null; responsavel_id: string | null;
  proxima_acao: string | null; proxima_acao_em: string | null; encerrado_motivo: string | null;
};
type FeedbackAction = {
  id: string; feedback_id: string; actor_id: string | null; actor_nome: string | null; action_type: string;
  message: string | null; visibility: "rh" | "gestor"; due_at: string | null; attachment_url: string | null; created_at: string;
};
type Support = {
  id: string; nome: string; filial: string; assunto: string | null; ts: string; status: string | null;
  destino_inicial: string | null; gestor_id: string | null; rh_solicitado: boolean | null; tipo_apoio: string | null;
  responsavel_id: string | null; proxima_acao: string | null; proxima_acao_em: string | null; encerrado_motivo: string | null;
};
type SupportMessage = {
  id: string; pedido_id: string; actor_id: string | null; actor_nome: string | null; message_type: string;
  message: string | null; visibility: "rh" | "gestor"; attachment_url: string | null; meeting_at: string | null; created_at: string;
};

const SUPPORT_TYPES = ["Conversa e escuta", "Orientação", "Conflito entre pessoas", "Relação com liderança", "Benefícios / documentação", "Saúde e bem-estar", "Outro"];
const ACTION_TYPES = [
  ["nota", "Comentário interno"], ["plano_acao", "Plano de ação"], ["reuniao", "Solicitar/agendar reunião"],
  ["devolutiva", "Registrar devolutiva"], ["arquivo", "Anexar arquivo"],
] as const;

function when(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", year: "2-digit", hour: "2-digit", minute: "2-digit" });
}

function statusLabel(value?: string | null) {
  if (value === "concluido" || value === "resolvido") return "Concluído";
  if (value === "cancelado") return "Cancelado";
  if (value === "em-andamento" || value === "em_andamento") return "Em acompanhamento";
  return "Novo / aguardando ação";
}

function priority(feedback: Feedback) {
  return ["Crítica", "Reclamação", "Denúncia", "Situação urgente"].includes(feedback.tipo) || feedback.triagem_rh_status === "pendente";
}

export function WorkspaceCaseCenter({ mode }: { mode: Mode }) {
  const { can } = useAdminPermissions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [tab, setTab] = useState<CaseTab>("feedbacks");
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [supports, setSupports] = useState<Support[]>([]);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [rhProfiles, setRhProfiles] = useState<Profile[]>([]);
  const [managers, setManagers] = useState<Manager[]>([]);
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [feedbackActions, setFeedbackActions] = useState<FeedbackAction[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [actionType, setActionType] = useState<(typeof ACTION_TYPES)[number][0]>("nota");
  const [message, setMessage] = useState("");
  const [visibility, setVisibility] = useState<"rh" | "gestor">("rh");
  const [dueAt, setDueAt] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const [selectedManager, setSelectedManager] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const canViewFeedback = mode === "manager" || can("feedbacks", "view");
  const canEditFeedback = mode === "manager" || can("feedbacks", "edit");
  const canViewSupport = mode === "manager" || can("apoio", "view");
  const canEditSupport = mode === "manager" || can("apoio", "edit");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase.from("kt_perfis").select("id,nome,tipo,filial").eq("id", auth.user.id).maybeSingle();
      if (!p) return;
      const current = p as Profile;
      setProfile(current);

      const fbQuery = supabase.from("kt_feedbacks").select("id,tipo,mensagem,anonimo,autor,filial,ts,status,destino,triagem_rh_status,gestor_liberado,escalado_rh,referente_colaborador_id,responsavel_id,proxima_acao,proxima_acao_em,encerrado_motivo").order("ts", { ascending: false }).limit(80);
      const supportQuery = supabase.from("kt_ajuda").select("id,nome,filial,assunto,ts,status,destino_inicial,gestor_id,rh_solicitado,tipo_apoio,responsavel_id,proxima_acao,proxima_acao_em,encerrado_motivo").order("ts", { ascending: false }).limit(80);

      if (mode === "manager" && current.filial) {
        const [fb, sp, people] = await Promise.all([
          fbQuery.eq("filial", current.filial).or("destino.eq.gestor,gestor_liberado.eq.true"),
          supportQuery.eq("filial", current.filial).or(`destino_inicial.eq.gestor,gestor_id.eq.${current.id}`),
          supabase.from("kt_colaboradores").select("id,nome,filial,cargo").eq("filial", current.filial).eq("ativo", true),
        ]);
        setFeedbacks((fb.data ?? []) as Feedback[]); setSupports((sp.data ?? []) as Support[]); setCollaborators((people.data ?? []) as Collaborator[]);
        setRhProfiles([]); setManagers([]);
      } else {
        const [fb, sp, people, rh, managerRows] = await Promise.all([
          fbQuery,
          supportQuery,
          supabase.from("kt_colaboradores").select("id,nome,filial,cargo").eq("ativo", true).order("nome"),
          supabase.from("kt_perfis").select("id,nome,tipo,filial").in("tipo", ["azumi","rh"]).eq("ativo", true).order("nome"),
          listarGestoresFn(),
        ]);
        setFeedbacks((fb.data ?? []) as Feedback[]); setSupports((sp.data ?? []) as Support[]); setCollaborators((people.data ?? []) as Collaborator[]);
        setRhProfiles((rh.data ?? []) as Profile[]); setManagers((managerRows as Manager[]).filter((item) => item.ativo));
      }
    } catch (error) { toast.error((error as Error).message || "Não foi possível carregar os casos."); }
    finally { setLoading(false); }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  const selectedFeedback = feedbacks.find((item) => item.id === selectedFeedbackId) ?? null;
  const selectedSupport = supports.find((item) => item.id === selectedSupportId) ?? null;

  useEffect(() => {
    if (!selectedFeedbackId) { setFeedbackActions([]); return; }
    supabase.from("kt_feedback_acoes").select("*").eq("feedback_id", selectedFeedbackId).order("created_at").then(({ data }) => setFeedbackActions((data ?? []) as FeedbackAction[]));
  }, [selectedFeedbackId]);
  useEffect(() => {
    if (!selectedSupportId) { setSupportMessages([]); return; }
    supabase.from("kt_apoio_mensagens").select("*").eq("pedido_id", selectedSupportId).order("created_at").then(({ data }) => setSupportMessages((data ?? []) as SupportMessage[]));
  }, [selectedSupportId]);

  const feedbackPending = useMemo(() => feedbacks.filter((item) => !["concluido","cancelado"].includes(item.status ?? "")).length, [feedbacks]);
  const supportPending = useMemo(() => supports.filter((item) => item.status !== "resolvido").length, [supports]);

  async function uploadCaseFile(file: File) {
    const path = `casos/${Date.now()}-${file.name.replace(/[^a-zA-Z0-9._-]/g,"_")}`;
    const { data, error } = await supabase.storage.from("kt-documentos").upload(path, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from("kt-documentos").getPublicUrl(data.path).data.publicUrl;
  }

  async function addFeedbackAction(attachmentUrl?: string) {
    if (!profile || !selectedFeedback || (!message.trim() && !attachmentUrl)) return;
    setWorking(true);
    try {
      const { error } = await supabase.from("kt_feedback_acoes").insert({
        feedback_id: selectedFeedback.id, actor_id: profile.id, actor_nome: profile.nome, action_type: attachmentUrl ? "arquivo" : actionType,
        message: message.trim() || (attachmentUrl ? "Arquivo anexado" : null), visibility: mode === "manager" ? "gestor" : visibility,
        due_at: dueAt ? new Date(dueAt).toISOString() : null, attachment_url: attachmentUrl ?? null,
      });
      if (error) throw error;
      if (actionType === "plano_acao" || actionType === "reuniao" || actionType === "devolutiva") {
        await supabase.rpc("kt_update_feedback_case", { p_feedback_id: selectedFeedback.id, p_status: "em-andamento", p_proxima_acao: message.trim(), p_proxima_acao_em: dueAt ? new Date(dueAt).toISOString() : null });
      }
      setMessage(""); setDueAt("");
      const { data } = await supabase.from("kt_feedback_acoes").select("*").eq("feedback_id", selectedFeedback.id).order("created_at");
      setFeedbackActions((data ?? []) as FeedbackAction[]); await load();
      toast.success("Histórico atualizado.");
    } catch (error) { toast.error((error as Error).message); }
    finally { setWorking(false); }
  }

  async function shareFeedback(share: boolean) {
    if (!selectedFeedback || mode !== "hr") return;
    setWorking(true);
    try {
      const rpc = share ? "kt_liberar_feedback_gestor" : "kt_reter_feedback_rh";
      const { error } = await supabase.rpc(rpc, { p_feedback_id: selectedFeedback.id });
      if (error) throw error;
      if (profile) await supabase.from("kt_feedback_acoes").insert({ feedback_id: selectedFeedback.id, actor_id: profile.id, actor_nome: profile.nome, action_type: "compartilhamento", message: share ? "RH compartilhou o caso com a gestão da unidade." : "RH manteve o caso restrito ao RH.", visibility: share ? "gestor" : "rh" });
      toast.success(share ? "Gestor notificado. O caso e o histórico liberado passam a aparecer para a gestão." : "Caso continua ativo, mas permanece visível somente ao RH.");
      await load();
    } catch (error) { toast.error((error as Error).message); }
    finally { setWorking(false); }
  }

  async function saveFeedbackMeta(field: "responsavel" | "referente", value: string) {
    if (!selectedFeedback) return;
    const params: Record<string, unknown> = { p_feedback_id: selectedFeedback.id };
    if (field === "responsavel") params.p_responsavel_id = value || null;
    if (field === "referente") params.p_referente_colaborador_id = value || null;
    const { error } = await supabase.rpc("kt_update_feedback_case", params); if (error) toast.error(error.message); else await load();
  }

  async function closeFeedback() {
    if (!selectedFeedback || !closeReason.trim()) { toast.error("Registre a conclusão/devolutiva antes de encerrar."); return; }
    setWorking(true);
    const { error } = await supabase.rpc("kt_update_feedback_case", { p_feedback_id: selectedFeedback.id, p_status: "concluido", p_encerrado_motivo: closeReason.trim() });
    if (error) toast.error(error.message); else { if (profile) await supabase.from("kt_feedback_acoes").insert({ feedback_id:selectedFeedback.id,actor_id:profile.id,actor_nome:profile.nome,action_type:"status",message:`Caso concluído: ${closeReason.trim()}`,visibility:mode==="manager"?"gestor":"rh" }); toast.success("Feedback concluído com histórico preservado."); setCloseReason(""); await load(); }
    setWorking(false);
  }

  async function addSupportMessage(attachmentUrl?: string) {
    if (!profile || !selectedSupport || (!message.trim() && !attachmentUrl)) return;
    setWorking(true);
    try {
      const { error } = await supabase.from("kt_apoio_mensagens").insert({ pedido_id:selectedSupport.id, actor_id:profile.id, actor_nome:profile.nome, message_type:attachmentUrl?"arquivo":actionType==="reuniao"?"reuniao":actionType==="devolutiva"?"devolutiva":"mensagem", message:message.trim() || (attachmentUrl?"Arquivo anexado":null), visibility:mode==="manager"?"gestor":visibility, attachment_url:attachmentUrl??null, meeting_at:actionType==="reuniao"&&dueAt?new Date(dueAt).toISOString():null });
      if (error) throw error;
      if (actionType === "reuniao" || actionType === "devolutiva" || actionType === "plano_acao") await supabase.rpc("kt_update_support_case", { p_pedido_id:selectedSupport.id,p_status:"em-andamento",p_proxima_acao:message.trim(),p_proxima_acao_em:dueAt?new Date(dueAt).toISOString():null });
      setMessage(""); setDueAt("");
      const { data } = await supabase.from("kt_apoio_mensagens").select("*").eq("pedido_id",selectedSupport.id).order("created_at"); setSupportMessages((data??[]) as SupportMessage[]); await load();
    } catch (error) { toast.error((error as Error).message); } finally { setWorking(false); }
  }

  async function updateSupportType(value: string) { if (!selectedSupport) return; const { error }=await supabase.rpc("kt_update_support_case",{p_pedido_id:selectedSupport.id,p_tipo_apoio:value,p_status:"em-andamento"}); if(error)toast.error(error.message);else await load(); }
  async function assignSupportManager() { if (!selectedSupport || !selectedManager) return; const {error}=await supabase.rpc("kt_envolver_gestor_apoio",{p_pedido_id:selectedSupport.id,p_gestor_id:selectedManager}); if(error)toast.error(error.message);else{toast.success("Gestor envolvido e notificado. O RH continua vendo todo o atendimento.");setVisibility("gestor");await load();} }
  async function closeSupport() { if(!selectedSupport||!closeReason.trim()){toast.error("Registre a devolutiva/motivo de encerramento.");return;} setWorking(true); const {error}=await supabase.rpc("kt_update_support_case",{p_pedido_id:selectedSupport.id,p_status:"resolvido",p_encerrado_motivo:closeReason.trim()}); if(error)toast.error(error.message);else{if(profile)await supabase.from("kt_apoio_mensagens").insert({pedido_id:selectedSupport.id,actor_id:profile.id,actor_nome:profile.nome,message_type:"status",message:`Atendimento encerrado: ${closeReason.trim()}`,visibility:mode==="manager"?"gestor":"rh"});toast.success("Atendimento encerrado com histórico preservado.");setCloseReason("");await load();} setWorking(false); }

  if ((!canViewFeedback && !canViewSupport) || !profile) return null;

  const feedbackList = feedbacks.filter((item) => !["concluido","cancelado"].includes(item.status ?? ""));
  const supportList = supports.filter((item) => item.status !== "resolvido");

  return (
    <section className="mb-5 overflow-hidden rounded-xl border border-border bg-card shadow-sm" aria-label="Casos e atendimentos">
      <div className="bg-[linear-gradient(120deg,#342330_0%,#4b3142_58%,#67515f_100%)] px-5 py-5 text-[#f7f1e9] lg:px-6">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between"><div><p className="text-[10px] font-bold uppercase tracking-[0.18em] text-white/55">Central de acompanhamento</p><h2 className="mt-1 text-xl font-bold">Pessoas não são uma linha de tabela</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-white/68">Abra o caso, registre o que foi feito, defina a próxima ação e preserve todo o histórico até a conclusão.</p></div><div className="flex gap-2 text-xs"><span className="rounded-md bg-white/10 px-2.5 py-1.5"><strong>{feedbackPending}</strong> feedbacks ativos</span><span className="rounded-md bg-white/10 px-2.5 py-1.5"><strong>{supportPending}</strong> apoios ativos</span></div></div>
      </div>
      <div className="flex border-b border-border bg-muted/30 px-4 pt-2 sm:px-5">{(["feedbacks","apoio"] as const).map((value)=><button key={value} onClick={()=>{setTab(value);setMessage("");setDueAt("");}} disabled={(value==="feedbacks"&&!canViewFeedback)||(value==="apoio"&&!canViewSupport)} className={`border-b-2 px-4 py-3 text-xs font-bold ${tab===value?"border-kt text-kt":"border-transparent text-muted-foreground"}`}>{value==="feedbacks"?"Feedbacks e ocorrências":"Pedidos de apoio / conversa"}</button>)}</div>

      {tab === "feedbacks" ? (
        <div id="feedbacks" className="grid min-h-[520px] scroll-mt-24 lg:grid-cols-[330px_minmax(0,1fr)]">
          <div className="border-b border-border lg:border-b-0 lg:border-r"><div className="border-b border-border px-4 py-3"><p className="text-xs font-bold">Fila de atenção</p><p className="mt-0.5 text-[11px] text-muted-foreground">Clique em um item para trabalhar no caso.</p></div><div className="max-h-[620px] overflow-y-auto">{feedbackList.map((item)=><button key={item.id} onClick={()=>{setSelectedFeedbackId(item.id);setVisibility(item.gestor_liberado||item.destino==="gestor"?"gestor":"rh");}} className={`block w-full border-b border-border px-4 py-3.5 text-left hover:bg-muted/45 ${selectedFeedbackId===item.id?"bg-kt-soft/55":priority(item)?"bg-destructive/[0.035]":""}`}><div className="flex items-start justify-between gap-2"><span className={`rounded-md px-2 py-0.5 text-[9px] font-bold uppercase ${priority(item)?"bg-destructive/10 text-destructive":"bg-muted text-muted-foreground"}`}>{item.tipo}</span><span className="text-[10px] text-muted-foreground">{when(item.ts)}</span></div><p className="mt-2 line-clamp-2 text-xs font-semibold leading-relaxed">{item.mensagem}</p><div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-muted-foreground"><span>{filialNome(item.filial)} · {item.anonimo?"Anônimo":item.autor||"Colaborador"}</span><span>{statusLabel(item.status)}</span></div></button>)}</div></div>
          <div className="min-w-0 p-4 sm:p-5 lg:p-6">{!selectedFeedback ? <div className="grid min-h-[360px] place-items-center text-center"><div><ShieldAlert className="mx-auto h-8 w-8 text-muted-foreground/40"/><p className="mt-3 text-sm font-bold">Selecione um feedback</p><p className="mt-1 text-xs text-muted-foreground">Aqui aparecem contexto, histórico e ações.</p></div></div> : <div className="grid gap-5"><div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_220px]"><div><div className="flex flex-wrap items-center gap-2"><span className={`rounded-md px-2 py-1 text-[10px] font-bold ${priority(selectedFeedback)?"bg-destructive/10 text-destructive":"bg-muted"}`}>{selectedFeedback.tipo}</span>{selectedFeedback.gestor_liberado||selectedFeedback.destino==="gestor"?<span className="rounded-md bg-success-soft px-2 py-1 text-[10px] font-bold text-success">Gestor tem acesso</span>:<span className="rounded-md bg-kt-soft px-2 py-1 text-[10px] font-bold text-kt"><LockKeyhole className="mr-1 inline h-3 w-3"/>Restrito ao RH</span>}</div><h3 className="mt-2 text-lg font-bold">{selectedFeedback.anonimo?"Feedback anônimo":selectedFeedback.autor||"Feedback recebido"}</h3><p className="mt-2 rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed">{selectedFeedback.mensagem}</p><p className="mt-2 text-xs text-muted-foreground">Registrado em {when(selectedFeedback.ts)} · {filialNome(selectedFeedback.filial)} · status: {statusLabel(selectedFeedback.status)}</p></div><div className="grid gap-3"><div><Label>Sobre quem / assunto</Label><select disabled={!canEditFeedback} value={selectedFeedback.referente_colaborador_id??""} onChange={(e)=>void saveFeedbackMeta("referente",e.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-xs"><option value="">Não definido</option>{collaborators.filter((c)=>c.filial===selectedFeedback.filial).map((c)=><option key={c.id} value={c.id}>{c.nome} · {c.cargo}</option>)}</select></div>{mode==="hr"?<div><Label>Responsável RH</Label><select disabled={!canEditFeedback} value={selectedFeedback.responsavel_id??""} onChange={(e)=>void saveFeedbackMeta("responsavel",e.target.value)} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-2 text-xs"><option value="">Atribuir...</option>{rhProfiles.map((p)=><option key={p.id} value={p.id}>{p.nome}</option>)}</select></div>:null}</div></div>
            {mode==="hr"&&canEditFeedback?<div className="grid gap-2 rounded-lg border border-border bg-muted/25 p-3 sm:grid-cols-2"><Button variant="outline" onClick={()=>void shareFeedback(false)}><LockKeyhole className="h-4 w-4"/> Manter restrito ao RH</Button><Button onClick={()=>void shareFeedback(true)}><UsersRound className="h-4 w-4"/> Compartilhar com gestor</Button><p className="sm:col-span-2 text-[11px] leading-relaxed text-muted-foreground">Ao compartilhar, o gestor da unidade recebe notificação e passa a enxergar este caso e apenas os registros do histórico marcados como visíveis à gestão. O RH continua acompanhando tudo.</p></div>:null}
            <div><div className="flex items-center justify-between"><h4 className="text-sm font-bold">Histórico do caso</h4><span className="text-[11px] text-muted-foreground">{feedbackActions.length} registro(s)</span></div><div className="mt-2 grid gap-2">{feedbackActions.length===0?<p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Ainda não existe histórico. Registre a primeira ação abaixo.</p>:feedbackActions.map((action)=><div key={action.id} className="rounded-lg border border-border bg-background px-3.5 py-3"><div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><span className="font-bold uppercase text-foreground">{action.action_type.replace("_"," ")}</span><span>· {action.actor_nome||"Sistema"}</span><span>· {when(action.created_at)}</span><span className={`ml-auto rounded px-1.5 py-0.5 ${action.visibility==="gestor"?"bg-success-soft text-success":"bg-kt-soft text-kt"}`}>{action.visibility==="gestor"?"RH + gestor":"Somente RH"}</span></div>{action.message?<p className="mt-1.5 text-xs leading-relaxed">{action.message}</p>:null}{action.due_at?<p className="mt-1 text-[10px] text-warn">Prazo/reunião: {when(action.due_at)}</p>:null}{action.attachment_url?<a href={action.attachment_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex text-xs font-semibold text-kt underline">Abrir arquivo</a>:null}</div>)}</div></div>
            {canEditFeedback?<div className="rounded-lg border border-border p-4"><div className="flex flex-wrap gap-2">{ACTION_TYPES.map(([value,label])=><button key={value} onClick={()=>setActionType(value)} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${actionType===value?"border-kt bg-kt-soft text-kt":"border-border text-muted-foreground"}`}>{label}</button>)}</div><Textarea className="mt-3" rows={3} placeholder={actionType==="plano_acao"?"Descreva o plano de ação e o combinado...":actionType==="devolutiva"?"Registre a devolutiva dada...":"Registre o que foi feito ou precisa ser feito..."} value={message} onChange={(e)=>setMessage(e.target.value)}/><div className="mt-3 flex flex-wrap items-end gap-3">{["plano_acao","reuniao","devolutiva"].includes(actionType)?<div><Label>Prazo / data</Label><Input className="mt-1" type="datetime-local" value={dueAt} onChange={(e)=>setDueAt(e.target.value)}/></div>:null}{mode==="hr"&&selectedFeedback.gestor_liberado?<div><Label>Visibilidade</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-2 text-xs" value={visibility} onChange={(e)=>setVisibility(e.target.value as "rh"|"gestor")}><option value="rh">Somente RH</option><option value="gestor">RH + gestor</option></select></div>:null}<input ref={fileRef} type="file" className="hidden" onChange={async(e)=>{const f=e.target.files?.[0];if(f){setWorking(true);try{await addFeedbackAction(await uploadCaseFile(f));}finally{setWorking(false);}}e.target.value="";}}/><Button variant="outline" onClick={()=>fileRef.current?.click()}><FileUp className="h-4 w-4"/> Arquivo</Button><Button disabled={working||!message.trim()} onClick={()=>void addFeedbackAction()}><Send className="h-4 w-4"/> Registrar ação</Button></div></div>:null}
            {canEditFeedback?<div className="rounded-lg border border-success/20 bg-success-soft/35 p-4"><h4 className="text-sm font-bold">Concluir feedback</h4><p className="mt-1 text-xs text-muted-foreground">Encerrar exige uma devolutiva ou justificativa. O histórico permanece disponível.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input placeholder="Conclusão / devolutiva final..." value={closeReason} onChange={(e)=>setCloseReason(e.target.value)}/><Button className="shrink-0" disabled={working} onClick={()=>void closeFeedback()}><CheckCircle2 className="h-4 w-4"/> Concluir</Button></div></div>:null}</div>}</div>
        </div>
      ) : (
        <div id="apoio" className="grid min-h-[520px] scroll-mt-24 lg:grid-cols-[330px_minmax(0,1fr)]"><div className="border-b border-border lg:border-b-0 lg:border-r"><div className="border-b border-border px-4 py-3"><p className="text-xs font-bold">Atendimentos em aberto</p><p className="mt-0.5 text-[11px] text-muted-foreground">Funciona como conversa com histórico, não como uma planilha.</p></div><div className="max-h-[620px] overflow-y-auto">{supportList.map((item)=><button key={item.id} onClick={()=>{setSelectedSupportId(item.id);setVisibility(item.gestor_id||item.destino_inicial==="gestor"?"gestor":"rh");setSelectedManager(item.gestor_id??"");}} className={`block w-full border-b border-border px-4 py-3.5 text-left hover:bg-muted/45 ${selectedSupportId===item.id?"bg-kt-soft/55":""}`}><div className="flex items-start justify-between gap-2"><span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-bold uppercase">{item.tipo_apoio||"Tipo não definido"}</span><span className="text-[10px] text-muted-foreground">{when(item.ts)}</span></div><p className="mt-2 text-sm font-semibold">{item.nome}</p><p className="mt-1 text-xs text-muted-foreground">{filialNome(item.filial)} · {item.destino_inicial==="gestor"?"Pediu liderança":"Entrada pelo RH"}</p></button>)}</div></div><div className="min-w-0 p-4 sm:p-5 lg:p-6">{!selectedSupport?<div className="grid min-h-[360px] place-items-center text-center"><div><LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground/40"/><p className="mt-3 text-sm font-bold">Selecione um pedido de apoio</p><p className="mt-1 text-xs text-muted-foreground">A conversa e as ações aparecem aqui.</p></div></div>:<div className="grid gap-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap gap-2"><span className="rounded-md bg-kt-soft px-2 py-1 text-[10px] font-bold text-kt">{selectedSupport.tipo_apoio||"Classificar apoio"}</span>{selectedSupport.gestor_id||selectedSupport.destino_inicial==="gestor"?<span className="rounded-md bg-success-soft px-2 py-1 text-[10px] font-bold text-success">Gestor envolvido</span>:<span className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold">Confidencial RH</span>}</div><h3 className="mt-2 text-lg font-bold">{selectedSupport.nome}</h3><p className="mt-1 text-xs text-muted-foreground">{filialNome(selectedSupport.filial)} · aberto em {when(selectedSupport.ts)} · {statusLabel(selectedSupport.status)}</p></div>{canEditSupport?<select value={selectedSupport.tipo_apoio??""} onChange={(e)=>void updateSupportType(e.target.value)} className="h-9 rounded-md border border-border bg-card px-2 text-xs"><option value="">Tipo de apoio...</option>{SUPPORT_TYPES.map((type)=><option key={type} value={type}>{type}</option>)}</select>:null}</div>
          {mode==="hr"&&canEditSupport?<div className="rounded-lg border border-border bg-muted/25 p-3"><p className="text-xs font-bold">Envolver liderança</p><p className="mt-1 text-[11px] text-muted-foreground">O RH continua com visão do caso. Se fizer sentido, selecione um gestor da mesma unidade.</p><div className="mt-2 flex flex-col gap-2 sm:flex-row"><select className="h-9 flex-1 rounded-md border border-border bg-card px-2 text-xs" value={selectedManager} onChange={(e)=>setSelectedManager(e.target.value)} disabled={Boolean(selectedSupport.gestor_id)}><option value="">Selecionar gestor...</option>{managers.filter((m)=>m.filial===selectedSupport.filial).map((m)=><option key={m.id} value={m.id}>{m.nome}</option>)}</select><Button variant="outline" disabled={!selectedManager||Boolean(selectedSupport.gestor_id)} onClick={()=>void assignSupportManager()}><UserRoundCheck className="h-4 w-4"/> Envolver gestor</Button></div></div>:null}
          <div><div className="flex items-center justify-between"><h4 className="text-sm font-bold">Conversa e histórico</h4><span className="text-[11px] text-muted-foreground">{supportMessages.length} mensagem(ns)</span></div><div className="mt-2 grid max-h-[360px] gap-2 overflow-y-auto rounded-lg border border-border bg-background p-3">{supportMessages.length===0?<p className="py-6 text-center text-xs text-muted-foreground">Nenhuma ação registrada ainda. Comece a conversa abaixo.</p>:supportMessages.map((item)=><div key={item.id} className={`max-w-[88%] rounded-lg px-3 py-2.5 text-xs ${item.actor_id===profile.id?"ml-auto bg-kt-soft":"bg-card border border-border"}`}><div className="flex items-center gap-2 text-[10px] text-muted-foreground"><strong className="text-foreground">{item.actor_nome||"Sistema"}</strong><span>· {item.message_type}</span><span>· {when(item.created_at)}</span></div>{item.message?<p className="mt-1 leading-relaxed">{item.message}</p>:null}{item.meeting_at?<p className="mt-1 font-semibold text-warn"><CalendarClock className="mr-1 inline h-3 w-3"/> {when(item.meeting_at)}</p>:null}{item.attachment_url?<a className="mt-1 inline-block font-semibold text-kt underline" target="_blank" rel="noreferrer" href={item.attachment_url}>Abrir arquivo</a>:null}</div>)}</div></div>
          {canEditSupport?<div className="rounded-lg border border-border p-4"><div className="flex flex-wrap gap-2">{ACTION_TYPES.map(([value,label])=><button key={value} onClick={()=>setActionType(value)} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${actionType===value?"border-kt bg-kt-soft text-kt":"border-border text-muted-foreground"}`}>{label}</button>)}</div><Textarea className="mt-3" rows={3} placeholder="Escreva a mensagem, orientação, devolutiva ou ação tomada..." value={message} onChange={(e)=>setMessage(e.target.value)}/><div className="mt-3 flex flex-wrap items-end gap-3">{actionType==="reuniao"?<div><Label>Data da reunião</Label><Input className="mt-1" type="datetime-local" value={dueAt} onChange={(e)=>setDueAt(e.target.value)}/></div>:null}{mode==="hr"&&selectedSupport.gestor_id?<div><Label>Visibilidade</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-2 text-xs" value={visibility} onChange={(e)=>setVisibility(e.target.value as "rh"|"gestor")}><option value="rh">Somente RH</option><option value="gestor">RH + gestor</option></select></div>:null}<input ref={fileRef} type="file" className="hidden" onChange={async(e)=>{const f=e.target.files?.[0];if(f){setWorking(true);try{await addSupportMessage(await uploadCaseFile(f));}finally{setWorking(false);}}e.target.value="";}}/><Button variant="outline" onClick={()=>fileRef.current?.click()}><FileUp className="h-4 w-4"/> Arquivo</Button><Button disabled={working||!message.trim()} onClick={()=>void addSupportMessage()}><Send className="h-4 w-4"/> Enviar / registrar</Button></div></div>:null}
          {canEditSupport?<div className="rounded-lg border border-success/20 bg-success-soft/35 p-4"><h4 className="text-sm font-bold">Encerrar atendimento</h4><p className="mt-1 text-xs text-muted-foreground">Registre a devolutiva final ou por que o atendimento está sendo encerrado.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input placeholder="Devolutiva / conclusão..." value={closeReason} onChange={(e)=>setCloseReason(e.target.value)}/><Button className="shrink-0" disabled={working} onClick={()=>void closeSupport()}><CheckCircle2 className="h-4 w-4"/> Encerrar</Button></div></div>:null}</div>}</div></div>
      )}
    </section>
  );
}
