import {
  CalendarClock,
  CheckCircle2,
  ChevronRight,
  FileUp,
  HeartHandshake,
  History,
  LifeBuoy,
  MessageSquarePlus,
  Send,
  Sparkles,
  UserRound,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Tab = "feedbacks" | "apoio";
type Scope = "abertos" | "concluidos";
type Profile = { id: string; nome: string; filial: string | null };
type Collaborator = { id: string; nome: string; filial: string; cargo: string | null };
type Feedback = {
  id: string;
  tipo: string;
  mensagem: string;
  anonimo: boolean;
  autor: string | null;
  filial: string;
  ts: string;
  fato_em: string | null;
  status: string | null;
  gestor_liberado: boolean | null;
  escalado_rh: boolean | null;
  referente_colaborador_id: string | null;
  proxima_acao: string | null;
  proxima_acao_em: string | null;
  encerrado_em: string | null;
  encerrado_motivo: string | null;
  origem: string | null;
};
type FeedbackAction = {
  id: string;
  actor_id: string | null;
  actor_nome: string | null;
  action_type: string;
  message: string | null;
  due_at: string | null;
  attachment_url: string | null;
  created_at: string;
};
type Support = {
  id: string;
  nome: string;
  filial: string;
  assunto: string | null;
  ts: string;
  status: string | null;
  rh_solicitado: boolean | null;
  tipo_apoio: string | null;
  proxima_acao: string | null;
  proxima_acao_em: string | null;
  encerrado_em: string | null;
  encerrado_motivo: string | null;
  origem: string | null;
};
type SupportMessage = {
  id: string;
  actor_id: string | null;
  actor_nome: string | null;
  message_type: string;
  message: string | null;
  attachment_url: string | null;
  meeting_at: string | null;
  created_at: string;
};

type ActionType = "nota" | "plano_acao" | "reuniao" | "devolutiva" | "arquivo";

const FEEDBACK_TYPES = ["Reconhecimento / elogio", "Feedback construtivo", "Orientação", "Ocorrência", "Desenvolvimento", "Outro"];
const SUPPORT_TYPES = ["Conversa e orientação", "Conflito / mediação", "Dúvida de pessoas", "Documentação / benefício", "Apoio administrativo", "Outro"];
const ACTIONS: Array<{ id: ActionType; label: string; help: string }> = [
  { id: "nota", label: "Comentário interno", help: "Registre contexto, observações e fatos que precisam ficar documentados no histórico." },
  { id: "plano_acao", label: "Plano de ação", help: "Descreva o que será feito, o combinado e, quando houver, defina um prazo." },
  { id: "reuniao", label: "Solicitar/agendar reunião", help: "Registre a conversa necessária e a data combinada para não perder o acompanhamento." },
  { id: "devolutiva", label: "Registrar devolutiva", help: "Documente o retorno dado à pessoa e os principais combinados da conversa." },
  { id: "arquivo", label: "Anexar arquivo", help: "Inclua evidências ou documentos relacionados ao caso. O arquivo fica vinculado ao histórico." },
];

function when(value?: string | null) {
  if (!value) return "—";
  return new Date(value).toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function statusLabel(value?: string | null) {
  if (value === "concluido" || value === "resolvido") return "Concluído";
  if (value === "cancelado") return "Cancelado";
  if (value === "em-andamento" || value === "em_andamento") return "Em acompanhamento";
  return "Novo";
}

function isClosed(value?: string | null) {
  return ["concluido", "resolvido", "cancelado"].includes(value ?? "");
}

export function WorkspaceManagerCaseCenter() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
  const [feedbacks, setFeedbacks] = useState<Feedback[]>([]);
  const [supports, setSupports] = useState<Support[]>([]);
  const [feedbackActions, setFeedbackActions] = useState<FeedbackAction[]>([]);
  const [supportMessages, setSupportMessages] = useState<SupportMessage[]>([]);
  const [tab, setTab] = useState<Tab>("feedbacks");
  const [scope, setScope] = useState<Scope>("abertos");
  const [selectedFeedbackId, setSelectedFeedbackId] = useState<string | null>(null);
  const [selectedSupportId, setSelectedSupportId] = useState<string | null>(null);
  const [working, setWorking] = useState(false);

  const [feedbackType, setFeedbackType] = useState(FEEDBACK_TYPES[0]!);
  const [feedbackTarget, setFeedbackTarget] = useState("");
  const [feedbackDate, setFeedbackDate] = useState(() => new Date().toISOString().slice(0, 16));
  const [feedbackText, setFeedbackText] = useState("");
  const [feedbackWithRh, setFeedbackWithRh] = useState(false);

  const [supportType, setSupportType] = useState(SUPPORT_TYPES[0]!);
  const [supportSubject, setSupportSubject] = useState("");
  const [supportText, setSupportText] = useState("");

  const [actionType, setActionType] = useState<ActionType>("nota");
  const [message, setMessage] = useState("");
  const [dueAt, setDueAt] = useState("");
  const [closeReason, setCloseReason] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: current } = await supabase
        .from("kt_perfis")
        .select("id,nome,filial")
        .eq("id", auth.user.id)
        .eq("tipo", "gestor")
        .maybeSingle();
      if (!current?.filial) return;
      const manager = current as Profile;
      setProfile(manager);

      const [people, fb, sp] = await Promise.all([
        supabase
          .from("kt_colaboradores")
          .select("id,nome,filial,cargo")
          .eq("filial", manager.filial)
          .eq("ativo", true)
          .order("nome"),
        supabase
          .from("kt_feedbacks")
          .select("id,tipo,mensagem,anonimo,autor,filial,ts,fato_em,status,gestor_liberado,escalado_rh,referente_colaborador_id,proxima_acao,proxima_acao_em,encerrado_em,encerrado_motivo,origem")
          .eq("filial", manager.filial)
          .or("destino.eq.gestor,gestor_liberado.eq.true")
          .order("ts", { ascending: false })
          .limit(120),
        supabase
          .from("kt_ajuda")
          .select("id,nome,filial,assunto,ts,status,rh_solicitado,tipo_apoio,proxima_acao,proxima_acao_em,encerrado_em,encerrado_motivo,origem")
          .eq("filial", manager.filial)
          .or(`destino_inicial.eq.gestor,gestor_id.eq.${manager.id}`)
          .order("ts", { ascending: false })
          .limit(120),
      ]);
      setCollaborators((people.data ?? []) as Collaborator[]);
      setFeedbacks((fb.data ?? []) as Feedback[]);
      setSupports((sp.data ?? []) as Support[]);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível carregar os acompanhamentos.");
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const selectedFeedback = feedbacks.find((item) => item.id === selectedFeedbackId) ?? null;
  const selectedSupport = supports.find((item) => item.id === selectedSupportId) ?? null;

  useEffect(() => {
    if (!selectedFeedbackId) {
      setFeedbackActions([]);
      return;
    }
    supabase
      .from("kt_feedback_acoes")
      .select("id,actor_id,actor_nome,action_type,message,due_at,attachment_url,created_at")
      .eq("feedback_id", selectedFeedbackId)
      .order("created_at")
      .then(({ data }) => setFeedbackActions((data ?? []) as FeedbackAction[]));
  }, [selectedFeedbackId]);

  useEffect(() => {
    if (!selectedSupportId) {
      setSupportMessages([]);
      return;
    }
    supabase
      .from("kt_apoio_mensagens")
      .select("id,actor_id,actor_nome,message_type,message,attachment_url,meeting_at,created_at")
      .eq("pedido_id", selectedSupportId)
      .order("created_at")
      .then(({ data }) => setSupportMessages((data ?? []) as SupportMessage[]));
  }, [selectedSupportId]);

  const feedbackList = useMemo(
    () => feedbacks.filter((item) => (scope === "concluidos" ? isClosed(item.status) : !isClosed(item.status))),
    [feedbacks, scope],
  );
  const supportList = useMemo(
    () => supports.filter((item) => (scope === "concluidos" ? isClosed(item.status) : !isClosed(item.status))),
    [scope, supports],
  );

  const targetName = selectedFeedback?.referente_colaborador_id
    ? collaborators.find((item) => item.id === selectedFeedback.referente_colaborador_id)
    : null;
  const selectedAction = ACTIONS.find((item) => item.id === actionType) ?? ACTIONS[0]!;

  async function createFeedback() {
    if (!feedbackText.trim()) {
      toast.error("Descreva o feedback antes de registrar.");
      return;
    }
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc("kt_manager_create_feedback", {
        p_tipo: feedbackType,
        p_mensagem: feedbackText.trim(),
        p_referente_colaborador_id: feedbackTarget || null,
        p_envolver_rh: feedbackWithRh,
        p_fato_em: feedbackDate ? new Date(feedbackDate).toISOString() : new Date().toISOString(),
      });
      if (error) throw error;
      setFeedbackText("");
      setFeedbackTarget("");
      setFeedbackWithRh(false);
      setScope("abertos");
      await load();
      if (data) setSelectedFeedbackId(String(data));
      toast.success(feedbackWithRh ? "Feedback registrado e RH envolvido." : "Feedback registrado no histórico da gestão.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível registrar o feedback.");
    } finally {
      setWorking(false);
    }
  }

  async function createSupport() {
    if (!supportSubject.trim()) {
      toast.error("Explique o apoio que você precisa do RH.");
      return;
    }
    setWorking(true);
    try {
      const { data, error } = await supabase.rpc("kt_manager_create_support", {
        p_assunto: supportSubject.trim(),
        p_tipo_apoio: supportType,
        p_mensagem: supportText.trim() || null,
      });
      if (error) throw error;
      setSupportSubject("");
      setSupportText("");
      setScope("abertos");
      await load();
      if (data) setSelectedSupportId(String(data));
      toast.success("Pedido enviado ao RH e aberto para acompanhamento.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível pedir apoio ao RH.");
    } finally {
      setWorking(false);
    }
  }

  async function updateFeedbackStatus(value: string) {
    if (!selectedFeedback) return;
    setWorking(true);
    const { error } = await supabase.rpc("kt_update_feedback_case", {
      p_feedback_id: selectedFeedback.id,
      p_status: value,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado.");
      await load();
    }
    setWorking(false);
  }

  async function updateSupportStatus(value: string) {
    if (!selectedSupport) return;
    setWorking(true);
    const { error } = await supabase.rpc("kt_update_support_case", {
      p_pedido_id: selectedSupport.id,
      p_status: value,
    });
    if (error) toast.error(error.message);
    else {
      toast.success("Status atualizado.");
      await load();
    }
    setWorking(false);
  }

  async function uploadCaseFile(file: File) {
    const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
    const path = `casos/${Date.now()}-${safeName}`;
    const { data, error } = await supabase.storage.from("kt-documentos").upload(path, file, { upsert: false });
    if (error) throw error;
    return supabase.storage.from("kt-documentos").getPublicUrl(data.path).data.publicUrl;
  }

  async function addFeedbackAction(attachmentUrl?: string) {
    if (!profile || !selectedFeedback || (!message.trim() && !attachmentUrl)) return;
    setWorking(true);
    try {
      const { error } = await supabase.from("kt_feedback_acoes").insert({
        feedback_id: selectedFeedback.id,
        actor_id: profile.id,
        actor_nome: profile.nome,
        action_type: attachmentUrl ? "arquivo" : actionType,
        message: message.trim() || (attachmentUrl ? "Arquivo anexado" : null),
        visibility: "gestor",
        due_at: dueAt ? new Date(dueAt).toISOString() : null,
        attachment_url: attachmentUrl ?? null,
      });
      if (error) throw error;
      if (["plano_acao", "reuniao", "devolutiva"].includes(actionType)) {
        const update = await supabase.rpc("kt_update_feedback_case", {
          p_feedback_id: selectedFeedback.id,
          p_status: "em-andamento",
          p_proxima_acao: message.trim(),
          p_proxima_acao_em: dueAt ? new Date(dueAt).toISOString() : null,
        });
        if (update.error) throw update.error;
      }
      setMessage("");
      setDueAt("");
      const { data } = await supabase
        .from("kt_feedback_acoes")
        .select("id,actor_id,actor_nome,action_type,message,due_at,attachment_url,created_at")
        .eq("feedback_id", selectedFeedback.id)
        .order("created_at");
      setFeedbackActions((data ?? []) as FeedbackAction[]);
      await load();
      toast.success("Ação registrada no histórico.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível registrar a ação.");
    } finally {
      setWorking(false);
    }
  }

  async function addSupportMessage(attachmentUrl?: string) {
    if (!profile || !selectedSupport || (!message.trim() && !attachmentUrl)) return;
    setWorking(true);
    try {
      const messageType = attachmentUrl
        ? "arquivo"
        : actionType === "reuniao"
          ? "reuniao"
          : actionType === "devolutiva"
            ? "devolutiva"
            : actionType === "plano_acao"
              ? "plano_acao"
              : "mensagem";
      const { error } = await supabase.from("kt_apoio_mensagens").insert({
        pedido_id: selectedSupport.id,
        actor_id: profile.id,
        actor_nome: profile.nome,
        message_type: messageType,
        message: message.trim() || (attachmentUrl ? "Arquivo anexado" : null),
        visibility: "gestor",
        attachment_url: attachmentUrl ?? null,
        meeting_at: actionType === "reuniao" && dueAt ? new Date(dueAt).toISOString() : null,
      });
      if (error) throw error;
      if (["plano_acao", "reuniao", "devolutiva"].includes(actionType)) {
        const update = await supabase.rpc("kt_update_support_case", {
          p_pedido_id: selectedSupport.id,
          p_status: "em-andamento",
          p_proxima_acao: message.trim(),
          p_proxima_acao_em: dueAt ? new Date(dueAt).toISOString() : null,
        });
        if (update.error) throw update.error;
      }
      setMessage("");
      setDueAt("");
      const { data } = await supabase
        .from("kt_apoio_mensagens")
        .select("id,actor_id,actor_nome,message_type,message,attachment_url,meeting_at,created_at")
        .eq("pedido_id", selectedSupport.id)
        .order("created_at");
      setSupportMessages((data ?? []) as SupportMessage[]);
      await load();
      toast.success("Histórico atualizado.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível registrar a ação.");
    } finally {
      setWorking(false);
    }
  }

  async function involveRhFeedback() {
    if (!selectedFeedback || selectedFeedback.escalado_rh) return;
    const { error } = await supabase.rpc("kt_escalar_feedback_rh", { p_feedback_id: selectedFeedback.id });
    if (error) toast.error(error.message);
    else {
      toast.success("RH foi notificado e passa a acompanhar o caso.");
      await load();
    }
  }

  async function involveRhSupport() {
    if (!selectedSupport || selectedSupport.rh_solicitado) return;
    const { error } = await supabase.rpc("kt_escalar_apoio_rh", { p_pedido_id: selectedSupport.id });
    if (error) toast.error(error.message);
    else {
      toast.success("RH foi notificado e passa a acompanhar o atendimento.");
      await load();
    }
  }

  async function closeFeedback() {
    if (!profile || !selectedFeedback || !closeReason.trim()) {
      toast.error("Registre a conclusão/devolutiva final.");
      return;
    }
    setWorking(true);
    try {
      const { error } = await supabase.rpc("kt_update_feedback_case", {
        p_feedback_id: selectedFeedback.id,
        p_status: "concluido",
        p_encerrado_motivo: closeReason.trim(),
      });
      if (error) throw error;
      await supabase.from("kt_feedback_acoes").insert({
        feedback_id: selectedFeedback.id,
        actor_id: profile.id,
        actor_nome: profile.nome,
        action_type: "status",
        message: `Caso concluído: ${closeReason.trim()}`,
        visibility: "gestor",
      });
      setCloseReason("");
      await load();
      toast.success("Feedback concluído. O histórico continua disponível.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  async function closeSupport() {
    if (!profile || !selectedSupport || !closeReason.trim()) {
      toast.error("Registre a devolutiva final do atendimento.");
      return;
    }
    setWorking(true);
    try {
      const { error } = await supabase.rpc("kt_update_support_case", {
        p_pedido_id: selectedSupport.id,
        p_status: "resolvido",
        p_encerrado_motivo: closeReason.trim(),
      });
      if (error) throw error;
      await supabase.from("kt_apoio_mensagens").insert({
        pedido_id: selectedSupport.id,
        actor_id: profile.id,
        actor_nome: profile.nome,
        message_type: "status",
        message: `Atendimento encerrado: ${closeReason.trim()}`,
        visibility: "gestor",
      });
      setCloseReason("");
      await load();
      toast.success("Atendimento encerrado. O histórico foi preservado.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setWorking(false);
    }
  }

  if (!profile) return null;

  return (
    <section className="mb-5 grid gap-4" aria-label="Acompanhamentos da gestão">
      <div className="grid gap-3 lg:grid-cols-2">
        <div id="manager-new-feedback" className="scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg bg-[var(--profile-accent,var(--kt))] text-white"><MessageSquarePlus className="h-4 w-4" /></span>
            <div><h2 className="text-sm font-bold">Registrar feedback</h2><p className="mt-1 text-xs text-muted-foreground">Formalize uma conversa, reconhecimento, orientação ou ocorrência da sua equipe.</p></div>
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div><Label>Tipo</Label><select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-xs">{FEEDBACK_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div><Label>Sobre quem / situação</Label><select value={feedbackTarget} onChange={(event) => setFeedbackTarget(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-xs"><option value="">Situação geral / equipe</option>{collaborators.map((item) => <option key={item.id} value={item.id}>{item.nome} · {item.cargo || "sem cargo"}</option>)}</select></div>
            <div className="sm:col-span-2"><Label>Quando aconteceu</Label><Input className="mt-1" type="datetime-local" value={feedbackDate} onChange={(event) => setFeedbackDate(event.target.value)} /></div>
            <div className="sm:col-span-2"><Label>Registro do feedback</Label><Textarea className="mt-1" rows={3} placeholder="O que aconteceu, o que foi conversado e qual é o contexto?" value={feedbackText} onChange={(event) => setFeedbackText(event.target.value)} /></div>
            <label className="sm:col-span-2 flex cursor-pointer items-start gap-2 rounded-lg border border-border bg-muted/25 p-3 text-xs"><input type="checkbox" className="mt-0.5" checked={feedbackWithRh} onChange={(event) => setFeedbackWithRh(event.target.checked)} /><span><strong>Envolver o RH desde o início</strong><span className="mt-0.5 block text-muted-foreground">O RH recebe uma notificação e acompanha o caso junto com você.</span></span></label>
          </div>
          <Button className="mt-4" disabled={working || !feedbackText.trim()} onClick={() => void createFeedback()}><MessageSquarePlus className="h-4 w-4" /> Registrar feedback</Button>
        </div>

        <div id="manager-new-support" className="scroll-mt-24 rounded-xl border border-border bg-card p-4 shadow-sm sm:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-border bg-muted/45 text-[var(--profile-accent,var(--kt))]"><HeartHandshake className="h-4 w-4" /></span>
            <div><h2 className="text-sm font-bold">Pedir apoio ao RH</h2><p className="mt-1 text-xs text-muted-foreground">Abra uma conversa com o RH e acompanhe todas as respostas dentro da plataforma.</p></div>
          </div>
          <div className="mt-4 grid gap-3">
            <div><Label>Tipo de apoio</Label><select value={supportType} onChange={(event) => setSupportType(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-xs">{SUPPORT_TYPES.map((item) => <option key={item}>{item}</option>)}</select></div>
            <div><Label>O que você precisa?</Label><Input className="mt-1" placeholder="Ex.: orientação para conduzir uma conversa" value={supportSubject} onChange={(event) => setSupportSubject(event.target.value)} /></div>
            <div><Label>Contexto inicial</Label><Textarea className="mt-1" rows={3} placeholder="Conte o contexto para o RH começar o atendimento com informação suficiente." value={supportText} onChange={(event) => setSupportText(event.target.value)} /></div>
          </div>
          <Button variant="outline" className="mt-4" disabled={working || !supportSubject.trim()} onClick={() => void createSupport()}><LifeBuoy className="h-4 w-4" /> Abrir conversa com RH</Button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-sm">
        <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
          <div><p className="text-[10px] font-bold uppercase tracking-[0.17em] text-muted-foreground">Central de acompanhamento</p><h2 className="mt-1 text-lg font-bold">Casos e conversas da sua unidade</h2><p className="mt-1 text-xs text-muted-foreground">Selecione um item para ver contexto, status, histórico e próxima ação.</p></div>
          <div className="flex rounded-lg border border-border bg-muted/25 p-1">{(["abertos", "concluidos"] as const).map((value) => <button key={value} type="button" onClick={() => { setScope(value); setSelectedFeedbackId(null); setSelectedSupportId(null); }} className={`rounded-md px-3 py-1.5 text-[11px] font-bold ${scope === value ? "bg-card shadow-sm" : "text-muted-foreground"}`}>{value === "abertos" ? "Em aberto" : "Histórico"}</button>)}</div>
        </div>
        <div className="flex border-b border-border bg-muted/20 px-3 pt-2 sm:px-4">{(["feedbacks", "apoio"] as const).map((value) => <button key={value} type="button" onClick={() => { setTab(value); setMessage(""); setDueAt(""); setCloseReason(""); }} className={`border-b-2 px-4 py-3 text-xs font-bold ${tab === value ? "border-[var(--profile-accent,var(--kt))] text-foreground" : "border-transparent text-muted-foreground"}`}>{value === "feedbacks" ? `Feedbacks (${feedbackList.length})` : `Apoio / conversa (${supportList.length})`}</button>)}</div>

        {tab === "feedbacks" ? (
          <div id="feedbacks" className="grid min-h-[500px] scroll-mt-24 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-b border-border lg:border-b-0 lg:border-r"><div className="max-h-[650px] overflow-y-auto">{feedbackList.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Nenhum feedback {scope === "abertos" ? "em aberto" : "concluído"}.</p> : feedbackList.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedFeedbackId(item.id); setCloseReason(""); }} className={`block w-full border-b border-border px-4 py-3.5 text-left transition hover:bg-muted/40 ${selectedFeedbackId === item.id ? "bg-[color-mix(in_srgb,var(--profile-accent,var(--kt))_8%,transparent)]" : ""}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase text-muted-foreground">{item.tipo}</span><span className="text-[10px] text-muted-foreground">{when(item.fato_em || item.ts)}</span></div><p className="mt-1.5 line-clamp-2 text-xs font-semibold leading-relaxed">{item.mensagem}</p><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{item.origem === "gestor" ? "Registrado por você" : item.anonimo ? "Anônimo" : item.autor || "Colaborador"}</span><span>{statusLabel(item.status)}</span></div></button>)}</div></div>
            <div className="min-w-0 p-4 sm:p-5 lg:p-6">{!selectedFeedback ? <div className="grid min-h-[330px] place-items-center text-center"><div><MessageSquarePlus className="mx-auto h-8 w-8 text-muted-foreground/35" /><p className="mt-3 text-sm font-bold">Selecione um feedback</p><p className="mt-1 text-xs text-muted-foreground">O histórico e as ações aparecem aqui.</p></div></div> : <div className="grid gap-5"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold">{selectedFeedback.tipo}</span>{selectedFeedback.escalado_rh ? <span className="rounded-md bg-[#efe7ed] px-2 py-1 text-[10px] font-bold text-[#4b3142]"><UsersRound className="mr-1 inline h-3 w-3" /> RH acompanhando</span> : null}</div><div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div className="min-w-0"><p className="text-[10px] font-bold uppercase tracking-wide text-muted-foreground">Contexto</p><h3 className="mt-1 text-lg font-bold">{targetName ? `${targetName.nome} · ${targetName.cargo || "Equipe"}` : selectedFeedback.origem === "gestor" ? "Situação geral / equipe" : selectedFeedback.anonimo ? "Feedback anônimo" : selectedFeedback.autor || "Feedback recebido"}</h3><p className="mt-2 rounded-lg border border-border bg-background px-4 py-3 text-sm leading-relaxed">{selectedFeedback.mensagem}</p><p className="mt-2 text-[11px] text-muted-foreground">Ocorrido/registrado em {when(selectedFeedback.fato_em || selectedFeedback.ts)}</p></div>{!isClosed(selectedFeedback.status) ? <div className="w-full shrink-0 sm:w-48"><Label>Status</Label><select disabled={working} value={selectedFeedback.status === "em-andamento" || selectedFeedback.status === "em_andamento" ? "em-andamento" : "novo"} onChange={(event) => void updateFeedbackStatus(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-xs"><option value="novo">Novo / aguardando ação</option><option value="em-andamento">Em acompanhamento</option></select></div> : null}</div></div>
              {!isClosed(selectedFeedback.status) ? <div className="flex flex-wrap gap-2">{selectedFeedback.escalado_rh ? <span className="inline-flex min-h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-xs font-semibold text-muted-foreground">RH já está acompanhando</span> : <Button variant="outline" size="sm" onClick={() => void involveRhFeedback()}><UsersRound className="h-4 w-4" /> Envolver RH</Button>}{selectedFeedback.proxima_acao ? <span className="inline-flex min-h-9 items-center rounded-md bg-[#fff7ec] px-3 text-xs text-[#8e541e]">Próxima ação: {selectedFeedback.proxima_acao}{selectedFeedback.proxima_acao_em ? ` · ${when(selectedFeedback.proxima_acao_em)}` : ""}</span> : null}</div> : null}
              <div><div className="flex items-center justify-between"><h4 className="text-sm font-bold">Histórico do caso</h4><span className="text-[11px] text-muted-foreground">{feedbackActions.length} registro(s)</span></div><div className="mt-2 grid gap-2">{feedbackActions.length === 0 ? <p className="rounded-lg border border-dashed border-border p-4 text-xs text-muted-foreground">Ainda não há ação registrada. Use o bloco abaixo para documentar o próximo passo.</p> : feedbackActions.map((item) => <div key={item.id} className="rounded-lg border border-border bg-background p-3"><div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><strong className="uppercase text-foreground">{item.action_type.replaceAll("_", " ")}</strong><span>· {item.actor_nome || "Sistema"}</span><span>· {when(item.created_at)}</span></div>{item.message ? <p className="mt-1.5 text-xs leading-relaxed">{item.message}</p> : null}{item.due_at ? <p className="mt-1 text-[10px] font-semibold text-[#a45e20]">Data/prazo: {when(item.due_at)}</p> : null}{item.attachment_url ? <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-xs font-semibold underline">Abrir arquivo</a> : null}</div>)}</div></div>
              {!isClosed(selectedFeedback.status) ? <div className="rounded-xl border border-border bg-card p-4"><div className="flex flex-wrap gap-2">{ACTIONS.map((item) => <button key={item.id} type="button" onClick={() => setActionType(item.id)} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${actionType === item.id ? "border-[var(--profile-accent,var(--kt))] bg-muted text-foreground" : "border-border text-muted-foreground"}`}>{item.label}</button>)}</div><div className="mt-3 flex gap-2 rounded-lg border border-[#e3b77f]/45 bg-[#fff8ef] p-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#a45e20]" /><p className="text-[11px] leading-relaxed text-[#805127]">{selectedAction.help}</p></div><Textarea className="mt-3" rows={3} placeholder="Registre aqui o que foi feito, combinado ou precisa acontecer..." value={message} onChange={(event) => setMessage(event.target.value)} /><div className="mt-3 flex flex-wrap items-end gap-3">{["plano_acao", "reuniao", "devolutiva"].includes(actionType) ? <div><Label>Data / prazo</Label><Input className="mt-1" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div> : null}<input ref={fileRef} type="file" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { setWorking(true); try { await addFeedbackAction(await uploadCaseFile(file)); } finally { setWorking(false); } } event.target.value = ""; }} /><Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Arquivo</Button><Button disabled={working || !message.trim()} onClick={() => void addFeedbackAction()}><Send className="h-4 w-4" /> Registrar ação</Button></div></div> : null}
              {!isClosed(selectedFeedback.status) ? <div className="rounded-xl border border-success/20 bg-success-soft/30 p-4"><h4 className="text-sm font-bold">Concluir acompanhamento</h4><p className="mt-1 text-xs text-muted-foreground">Registre a devolutiva ou o resultado final. A data de conclusão é salva automaticamente e todo o histórico permanece consultável.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input placeholder="Resultado / devolutiva final..." value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /><Button disabled={working || !closeReason.trim()} onClick={() => void closeFeedback()}><CheckCircle2 className="h-4 w-4" /> Concluir</Button></div></div> : <div className="rounded-xl border border-border bg-muted/25 p-4"><p className="text-xs font-bold">Concluído em {when(selectedFeedback.encerrado_em)}</p><p className="mt-1 text-xs text-muted-foreground">{selectedFeedback.encerrado_motivo || "Sem observação final."}</p></div>}</div>}</div>
          </div>
        ) : (
          <div id="apoio" className="grid min-h-[500px] scroll-mt-24 lg:grid-cols-[300px_minmax(0,1fr)]">
            <div className="border-b border-border lg:border-b-0 lg:border-r"><div className="max-h-[650px] overflow-y-auto">{supportList.length === 0 ? <p className="p-5 text-xs text-muted-foreground">Nenhum atendimento {scope === "abertos" ? "em aberto" : "concluído"}.</p> : supportList.map((item) => <button key={item.id} type="button" onClick={() => { setSelectedSupportId(item.id); setCloseReason(""); }} className={`block w-full border-b border-border px-4 py-3.5 text-left transition hover:bg-muted/40 ${selectedSupportId === item.id ? "bg-[color-mix(in_srgb,var(--profile-accent,var(--kt))_8%,transparent)]" : ""}`}><div className="flex items-center justify-between gap-2"><span className="text-[10px] font-bold uppercase text-muted-foreground">{item.tipo_apoio || "Apoio"}</span><span className="text-[10px] text-muted-foreground">{when(item.ts)}</span></div><p className="mt-1.5 line-clamp-2 text-xs font-semibold">{item.assunto || item.nome}</p><div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground"><span>{item.origem === "gestor" ? "Pedido feito por você" : item.nome}</span><span>{statusLabel(item.status)}</span></div></button>)}</div></div>
            <div className="min-w-0 p-4 sm:p-5 lg:p-6">{!selectedSupport ? <div className="grid min-h-[330px] place-items-center text-center"><div><LifeBuoy className="mx-auto h-8 w-8 text-muted-foreground/35" /><p className="mt-3 text-sm font-bold">Selecione um atendimento</p><p className="mt-1 text-xs text-muted-foreground">A conversa e as ações aparecem aqui.</p></div></div> : <div className="grid gap-5"><div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between"><div><div className="flex flex-wrap items-center gap-2"><span className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold">{selectedSupport.tipo_apoio || "Apoio"}</span>{selectedSupport.rh_solicitado ? <span className="rounded-md bg-[#efe7ed] px-2 py-1 text-[10px] font-bold text-[#4b3142]">RH acompanhando</span> : null}</div><h3 className="mt-2 text-lg font-bold">{selectedSupport.assunto || selectedSupport.nome}</h3><p className="mt-1 text-[11px] text-muted-foreground">Aberto em {when(selectedSupport.ts)}</p></div>{!isClosed(selectedSupport.status) ? <div className="w-full shrink-0 sm:w-48"><Label>Status</Label><select disabled={working} value={selectedSupport.status === "em-andamento" || selectedSupport.status === "em_andamento" ? "em-andamento" : "novo"} onChange={(event) => void updateSupportStatus(event.target.value)} className="mt-1 h-10 w-full rounded-md border border-border bg-card px-3 text-xs"><option value="novo">Novo / aguardando ação</option><option value="em-andamento">Em acompanhamento</option></select></div> : null}</div>
              {!isClosed(selectedSupport.status) ? <div className="flex flex-wrap gap-2">{selectedSupport.rh_solicitado ? <span className="inline-flex min-h-9 items-center rounded-md border border-border bg-muted/30 px-3 text-xs font-semibold text-muted-foreground">RH já foi acionado</span> : <Button variant="outline" size="sm" onClick={() => void involveRhSupport()}><HeartHandshake className="h-4 w-4" /> Envolver RH</Button>}{selectedSupport.proxima_acao ? <span className="inline-flex min-h-9 items-center rounded-md bg-[#fff7ec] px-3 text-xs text-[#8e541e]">Próxima ação: {selectedSupport.proxima_acao}{selectedSupport.proxima_acao_em ? ` · ${when(selectedSupport.proxima_acao_em)}` : ""}</span> : null}</div> : null}
              <div><div className="flex items-center justify-between"><h4 className="text-sm font-bold">Conversa e histórico</h4><span className="text-[11px] text-muted-foreground">{supportMessages.length} registro(s)</span></div><div className="mt-2 grid max-h-[380px] gap-2 overflow-y-auto rounded-xl border border-border bg-background p-3">{supportMessages.length === 0 ? <p className="py-6 text-center text-xs text-muted-foreground">Nenhuma mensagem registrada ainda.</p> : supportMessages.map((item) => <div key={item.id} className={`max-w-[90%] rounded-lg px-3 py-2.5 text-xs ${item.actor_id === profile.id ? "ml-auto bg-[color-mix(in_srgb,var(--profile-accent,var(--kt))_9%,white)]" : "border border-border bg-card"}`}><div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground"><strong className="text-foreground">{item.actor_nome || "Sistema"}</strong><span>· {item.message_type.replaceAll("_", " ")}</span><span>· {when(item.created_at)}</span></div>{item.message ? <p className="mt-1 leading-relaxed">{item.message}</p> : null}{item.meeting_at ? <p className="mt-1 font-semibold text-[#a45e20]"><CalendarClock className="mr-1 inline h-3 w-3" /> {when(item.meeting_at)}</p> : null}{item.attachment_url ? <a href={item.attachment_url} target="_blank" rel="noreferrer" className="mt-1 inline-block font-semibold underline">Abrir arquivo</a> : null}</div>)}</div></div>
              {!isClosed(selectedSupport.status) ? <div className="rounded-xl border border-border p-4"><div className="flex flex-wrap gap-2">{ACTIONS.map((item) => <button key={item.id} type="button" onClick={() => setActionType(item.id)} className={`rounded-md border px-2.5 py-1.5 text-[11px] font-semibold ${actionType === item.id ? "border-[var(--profile-accent,var(--kt))] bg-muted text-foreground" : "border-border text-muted-foreground"}`}>{item.label}</button>)}</div><div className="mt-3 flex gap-2 rounded-lg border border-[#e3b77f]/45 bg-[#fff8ef] p-3"><Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-[#a45e20]" /><p className="text-[11px] leading-relaxed text-[#805127]">{selectedAction.help}</p></div><Textarea className="mt-3" rows={3} placeholder="Registre a mensagem, orientação, combinado ou ação tomada..." value={message} onChange={(event) => setMessage(event.target.value)} /><div className="mt-3 flex flex-wrap items-end gap-3">{["plano_acao", "reuniao", "devolutiva"].includes(actionType) ? <div><Label>Data / prazo</Label><Input className="mt-1" type="datetime-local" value={dueAt} onChange={(event) => setDueAt(event.target.value)} /></div> : null}<input ref={fileRef} type="file" className="hidden" onChange={async (event) => { const file = event.target.files?.[0]; if (file) { setWorking(true); try { await addSupportMessage(await uploadCaseFile(file)); } finally { setWorking(false); } } event.target.value = ""; }} /><Button variant="outline" onClick={() => fileRef.current?.click()}><FileUp className="h-4 w-4" /> Arquivo</Button><Button disabled={working || !message.trim()} onClick={() => void addSupportMessage()}><Send className="h-4 w-4" /> Enviar / registrar</Button></div></div> : null}
              {!isClosed(selectedSupport.status) ? <div className="rounded-xl border border-success/20 bg-success-soft/30 p-4"><h4 className="text-sm font-bold">Encerrar atendimento</h4><p className="mt-1 text-xs text-muted-foreground">Registre a devolutiva final. A data é salva automaticamente e o histórico continua disponível.</p><div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input placeholder="Devolutiva / conclusão final..." value={closeReason} onChange={(event) => setCloseReason(event.target.value)} /><Button disabled={working || !closeReason.trim()} onClick={() => void closeSupport()}><CheckCircle2 className="h-4 w-4" /> Encerrar</Button></div></div> : <div className="rounded-xl border border-border bg-muted/25 p-4"><p className="text-xs font-bold">Concluído em {when(selectedSupport.encerrado_em)}</p><p className="mt-1 text-xs text-muted-foreground">{selectedSupport.encerrado_motivo || "Sem observação final."}</p></div>}</div>}</div>
          </div>
        )}
      </div>
    </section>
  );
}
