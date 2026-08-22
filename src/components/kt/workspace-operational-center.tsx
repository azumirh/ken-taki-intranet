import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { toast } from "sonner";
import { BellRing, BriefcaseBusiness, CheckCircle2, ClipboardList, HeartHandshake, History, ShieldCheck, UserMinus, UserRoundCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminPermissions, type AdminSection } from "@/lib/admin-permissions";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Mode = "manager" | "hr";
type Profile = { id: string; tipo: string; filial: string | null; nome: string };
type Person = { id: string; nome: string; filial: string; cargo: string | null; ativo: boolean };
type CaseRow = { id: string; tipo: string; origem_tabela: string | null; origem_id: string | null; filial: string; titulo: string; descricao: string | null; status: string; confidencialidade: string; responsavel_id: string | null; plano_acao: string | null; prazo_acao: string | null; acompanhamento_em: string | null; encerrado_em: string | null; encerrado_motivo: string | null; created_at: string; updated_at: string };
type InvolvedRow = { id: string; caso_id: string; colaborador_id: string | null; profile_id: string | null; nome_snapshot: string | null; papel: string };
type HistoryRow = { id: string; caso_id: string; actor_nome_snapshot: string | null; evento: string; mensagem: string | null; visibilidade: string; created_at: string };
type AlertRow = { id: string; caso_id: string | null; tipo: string; due_at: string; status: string; recipient_user_id: string; payload: Record<string, unknown> | null };
type Offboarding = { id: string; colaborador_id: string; filial: string; tipo: string; motivo: string; comunicado_em: string; ultimo_dia_em: string | null; recontratavel: boolean; status: string; iniciado_por: string; revisado_por: string | null; revisado_em: string | null; observacao_rh: string | null; created_at: string };
type Checklist = { id: string; offboarding_id?: string; onboarding_id?: string; label: string; categoria?: string; concluido: boolean; observacao: string | null };
type Vacancy = { id: string; cargo: string; filial: string; motivo: string; status: string; solicitante_id: string | null; status_at: string | null; observacao: string | null; preenchida_em: string | null; cancelada_motivo: string | null; ts: string };
type VacancyHistory = { id: string; vaga_id: string; status_anterior: string | null; status_novo: string; observacao: string | null; created_at: string };
type Recognition = { id: string; colaborador_id: string; filial: string; motivo: string; elogio_cliente: boolean; destaque_mes: string | null; status: string; created_at: string };
type Onboarding = { id: string; colaborador_id: string; filial: string; inicio_em: string; status: string; experiencia_fim_em: string | null; responsavel_profile_id: string | null; observacao: string | null; created_at: string };
type Survey = { id: string; titulo: string; descricao: string | null; prazo: string | null; ativa: boolean; modo: string; anonima: boolean; filial_alvo: string | null; encerrada_em: string | null; ts: string };
type SurveySummary = { pergunta_id: string; pergunta: string; tipo: string; total_respostas: number; media: number | null; sim: number; nao: number };

const STATUS_CASE = ["aberto", "em_andamento", "aguardando_acompanhamento", "reavaliado", "concluido", "arquivado"];
const STATUS_VAGA = ["solicitado", "triagem_rh", "divulgando", "entrevistas", "preenchida", "cancelada"];
const STATUS_ONBOARDING = ["pre_admissao", "documentacao_pendente", "primeira_semana", "experiencia", "efetivado", "cancelado"];
const OFFBOARDING_TYPES = [
  ["pedido_demissao", "Pedido de demissão"],
  ["dispensa_sem_justa_causa", "Dispensa sem justa causa"],
  ["justa_causa", "Justa causa"],
  ["termino_experiencia", "Término de experiência"],
  ["outro", "Outro"],
] as const;

function fmt(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function SectionHeader({ title, intro, count }: { title: string; intro: string; count?: number }) {
  return <div className="flex flex-col gap-2 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between lg:px-6"><div><h2 className="text-lg font-bold text-foreground">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{intro}</p></div>{typeof count === "number" ? <span className="w-fit rounded-md bg-muted px-2.5 py-1 text-xs font-bold text-muted-foreground">{count}</span> : null}</div>;
}

function Empty({ children }: { children: string }) {
  return <p className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">{children}</p>;
}

function FieldSelect({ label, value, onChange, children, disabled = false }: { label: string; value: string; onChange: (value: string) => void; children: ReactNode; disabled?: boolean }) {
  return <div className="grid gap-1.5"><Label>{label}</Label><select value={value} disabled={disabled} onChange={(event) => onChange(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground">{children}</select></div>;
}

export function WorkspaceOperationalCenter({ mode }: { mode: Mode }) {
  const admin = useAdminPermissions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [people, setPeople] = useState<Person[]>([]);
  const [cases, setCases] = useState<CaseRow[]>([]);
  const [involved, setInvolved] = useState<InvolvedRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [alerts, setAlerts] = useState<AlertRow[]>([]);
  const [offboardings, setOffboardings] = useState<Offboarding[]>([]);
  const [offChecklist, setOffChecklist] = useState<Checklist[]>([]);
  const [vacancies, setVacancies] = useState<Vacancy[]>([]);
  const [vacancyHistory, setVacancyHistory] = useState<VacancyHistory[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [onboardings, setOnboardings] = useState<Onboarding[]>([]);
  const [onChecklist, setOnChecklist] = useState<Checklist[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [surveySummary, setSurveySummary] = useState<Record<string, SurveySummary[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedCaseId, setSelectedCaseId] = useState<string | null>(null);

  const [casePlan, setCasePlan] = useState("");
  const [caseDeadline, setCaseDeadline] = useState("");
  const [caseFollowup, setCaseFollowup] = useState("");
  const [caseStatus, setCaseStatus] = useState("em_andamento");
  const [caseCloseReason, setCaseCloseReason] = useState("");
  const [caseNote, setCaseNote] = useState("");
  const [casePerson, setCasePerson] = useState("");
  const [caseRole, setCaseRole] = useState("mencionado");

  const [offPerson, setOffPerson] = useState("");
  const [offType, setOffType] = useState("pedido_demissao");
  const [offReason, setOffReason] = useState("");
  const [offCommunicated, setOffCommunicated] = useState(new Date().toISOString().slice(0, 10));
  const [offLastDay, setOffLastDay] = useState("");
  const [offRehire, setOffRehire] = useState(true);

  const [vacancyRole, setVacancyRole] = useState("");
  const [vacancyReason, setVacancyReason] = useState("");
  const [vacancyBranch, setVacancyBranch] = useState<"cristo-rei" | "champagnat">("champagnat");

  const [recPerson, setRecPerson] = useState("");
  const [recReason, setRecReason] = useState("");
  const [recClient, setRecClient] = useState(false);

  const [onPerson, setOnPerson] = useState("");
  const [onStart, setOnStart] = useState(new Date().toISOString().slice(0, 10));
  const [onObservation, setOnObservation] = useState("");

  const [surveyTitle, setSurveyTitle] = useState("");
  const [surveyDescription, setSurveyDescription] = useState("");
  const [surveyDeadline, setSurveyDeadline] = useState("");
  const [surveyBranch, setSurveyBranch] = useState("todas");
  const [surveyQuestions, setSurveyQuestions] = useState("Como você avalia seu ambiente de trabalho?\nComo você avalia a comunicação da liderança?\nS/N: Você se sente ouvido(a) quando precisa?\nComo você avalia o reconhecimento no dia a dia?");

  const can = useCallback((section: AdminSection, action: "view" | "edit" | "delete" = "view") => mode === "manager" || admin.can(section, action), [admin, mode]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p, error: profileError } = await supabase.from("kt_perfis").select("id,tipo,filial,nome").eq("id", auth.user.id).maybeSingle();
      if (profileError) throw profileError;
      if (!p) return;
      const current = p as Profile;
      setProfile(current);
      const branch = mode === "manager" ? current.filial : null;

      const peoplePromise = supabase.rpc("kt_operational_people_directory");
      let caseQuery = supabase.from("kt_casos").select("id,tipo,origem_tabela,origem_id,filial,titulo,descricao,status,confidencialidade,responsavel_id,plano_acao,prazo_acao,acompanhamento_em,encerrado_em,encerrado_motivo,created_at,updated_at").order("updated_at", { ascending: false }).limit(100);
      let offQuery = supabase.from("kt_offboardings").select("id,colaborador_id,filial,tipo,motivo,comunicado_em,ultimo_dia_em,recontratavel,status,iniciado_por,revisado_por,revisado_em,observacao_rh,created_at").order("created_at", { ascending: false }).limit(80);
      let vacancyQuery = supabase.from("kt_vagas").select("id,cargo,filial,motivo,status,solicitante_id,status_at,observacao,preenchida_em,cancelada_motivo,ts").order("ts", { ascending: false }).limit(80);
      let recQuery = supabase.from("kt_reconhecimentos").select("id,colaborador_id,filial,motivo,elogio_cliente,destaque_mes,status,created_at").order("created_at", { ascending: false }).limit(80);
      let onQuery = supabase.from("kt_onboardings").select("id,colaborador_id,filial,inicio_em,status,experiencia_fim_em,responsavel_profile_id,observacao,created_at").order("created_at", { ascending: false }).limit(80);
      const surveyQuery = supabase.from("kt_pesquisas").select("id,titulo,descricao,prazo,ativa,modo,anonima,filial_alvo,encerrada_em,ts").eq("modo", "interna").order("ts", { ascending: false }).limit(50);
      if (branch) {
        caseQuery = caseQuery.eq("filial", branch);
        offQuery = offQuery.eq("filial", branch);
        vacancyQuery = vacancyQuery.eq("filial", branch);
        recQuery = recQuery.eq("filial", branch);
        onQuery = onQuery.eq("filial", branch);
      }

      const [peopleResult, caseResult, offResult, vacancyResult, recResult, onResult, surveyResult] = await Promise.all([peoplePromise, caseQuery, offQuery, vacancyQuery, recQuery, onQuery, surveyQuery]);
      for (const result of [peopleResult, caseResult, offResult, vacancyResult, recResult, onResult, surveyResult]) if (result.error) throw result.error;
      const nextCases = (caseResult.data ?? []) as CaseRow[];
      const nextOff = (offResult.data ?? []) as Offboarding[];
      const nextVacancies = (vacancyResult.data ?? []) as Vacancy[];
      const nextOn = (onResult.data ?? []) as Onboarding[];
      const nextSurveys = (surveyResult.data ?? []) as Survey[];
      setPeople((peopleResult.data ?? []) as Person[]);
      setCases(nextCases);
      setOffboardings(nextOff);
      setVacancies(nextVacancies);
      setRecognitions((recResult.data ?? []) as Recognition[]);
      setOnboardings(nextOn);
      setSurveys(nextSurveys);

      const caseIds = nextCases.map((item) => item.id);
      const offIds = nextOff.map((item) => item.id);
      const vacancyIds = nextVacancies.map((item) => item.id);
      const onIds = nextOn.map((item) => item.id);
      const [involvedResult, historyResult, alertResult, offChecklistResult, vacancyHistoryResult, onChecklistResult] = await Promise.all([
        caseIds.length ? supabase.from("kt_caso_envolvidos").select("id,caso_id,colaborador_id,profile_id,nome_snapshot,papel").in("caso_id", caseIds) : Promise.resolve({ data: [], error: null }),
        caseIds.length ? supabase.from("kt_caso_historico").select("id,caso_id,actor_nome_snapshot,evento,mensagem,visibilidade,created_at").in("caso_id", caseIds).order("created_at", { ascending: false }).limit(300) : Promise.resolve({ data: [], error: null }),
        caseIds.length ? supabase.from("kt_alertas_agendados").select("id,caso_id,tipo,due_at,status,recipient_user_id,payload").in("caso_id", caseIds).order("due_at").limit(200) : Promise.resolve({ data: [], error: null }),
        offIds.length ? supabase.from("kt_offboarding_checklist").select("id,offboarding_id,label,concluido,observacao").in("offboarding_id", offIds) : Promise.resolve({ data: [], error: null }),
        vacancyIds.length ? supabase.from("kt_vaga_historico").select("id,vaga_id,status_anterior,status_novo,observacao,created_at").in("vaga_id", vacancyIds).order("created_at", { ascending: false }) : Promise.resolve({ data: [], error: null }),
        onIds.length ? supabase.from("kt_onboarding_checklist").select("id,onboarding_id,label,categoria,concluido,observacao").in("onboarding_id", onIds) : Promise.resolve({ data: [], error: null }),
      ]);
      for (const result of [involvedResult, historyResult, alertResult, offChecklistResult, vacancyHistoryResult, onChecklistResult]) if (result.error) throw result.error;
      setInvolved((involvedResult.data ?? []) as InvolvedRow[]);
      setHistory((historyResult.data ?? []) as HistoryRow[]);
      setAlerts((alertResult.data ?? []) as AlertRow[]);
      setOffChecklist((offChecklistResult.data ?? []) as Checklist[]);
      setVacancyHistory((vacancyHistoryResult.data ?? []) as VacancyHistory[]);
      setOnChecklist((onChecklistResult.data ?? []) as Checklist[]);

      const summaries = await Promise.all(nextSurveys.map(async (survey) => {
        const { data, error } = await supabase.rpc("kt_internal_survey_summary", { p_pesquisa_id: survey.id, p_filial: branch });
        if (error) throw error;
        return [survey.id, (data ?? []) as SurveySummary[]] as const;
      }));
      setSurveySummary(Object.fromEntries(summaries));
      setSelectedCaseId((currentId) => currentId && nextCases.some((item) => item.id === currentId) ? currentId : nextCases[0]?.id ?? null);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível carregar os fluxos operacionais.");
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => { void load(); }, [load]);

  const personById = useMemo(() => new Map(people.map((person) => [person.id, person])), [people]);
  const selectedCase = cases.find((item) => item.id === selectedCaseId) ?? null;
  const activePeople = people.filter((person) => person.ativo);
  const openCases = cases.filter((item) => !item.encerrado_em && !["concluido", "resolvido", "arquivado", "cancelado", "preenchida", "efetivado", "aprovado"].includes(item.status));
  const caseStatusEditable = Boolean(selectedCase && (selectedCase.origem_tabela === "kt_feedbacks" || selectedCase.origem_tabela === "kt_ajuda" || !selectedCase.origem_tabela));

  useEffect(() => {
    if (!selectedCase) return;
    setCasePlan(selectedCase.plano_acao ?? "");
    setCaseDeadline(selectedCase.prazo_acao?.slice(0, 16) ?? "");
    setCaseFollowup(selectedCase.acompanhamento_em?.slice(0, 16) ?? "");
    setCaseStatus(selectedCase.status || "em_andamento");
    setCaseCloseReason(selectedCase.encerrado_motivo ?? "");
  }, [selectedCase]);

  async function saveCase() {
    if (!selectedCase || !can("casos", "edit")) return;
    try {
      const { error } = await supabase.rpc("kt_update_case_workflow", {
        p_case_id: selectedCase.id,
        p_status: caseStatusEditable ? caseStatus : null,
        p_responsavel_id: profile?.id ?? null,
        p_plano_acao: casePlan || null,
        p_prazo_acao: caseDeadline ? new Date(caseDeadline).toISOString() : null,
        p_acompanhamento_em: caseFollowup ? new Date(caseFollowup).toISOString() : null,
        p_encerrado_motivo: caseCloseReason || null,
      });
      if (error) throw error;
      toast.success("Caso atualizado e histórico preservado.");
      await load();
    } catch (error) { toast.error((error as Error).message); }
  }

  async function addCaseNote() {
    if (!selectedCase || !caseNote.trim()) return;
    const { error } = await supabase.rpc("kt_add_case_note", { p_case_id: selectedCase.id, p_evento: "registro_operacional", p_mensagem: caseNote.trim(), p_visibilidade: mode === "hr" ? "ambos" : "gestor" });
    if (error) return toast.error(error.message);
    setCaseNote("");
    toast.success("Registro incluído no histórico.");
    await load();
  }

  async function addCaseInvolved() {
    if (!selectedCase || !casePerson) return;
    const person = personById.get(casePerson);
    const { error } = await supabase.from("kt_caso_envolvidos").insert({ caso_id: selectedCase.id, colaborador_id: casePerson, nome_snapshot: person?.nome ?? "Colaborador", papel: caseRole });
    if (error) return toast.error(error.message);
    setCasePerson("");
    toast.success("Pessoa vinculada ao caso.");
    await load();
  }

  async function createOffboarding() {
    if (!profile || !offPerson || offReason.trim().length < 3) return;
    const person = personById.get(offPerson);
    if (!person) return;
    const { error } = await supabase.from("kt_offboardings").insert({ colaborador_id: offPerson, filial: person.filial, tipo: offType, motivo: offReason.trim(), comunicado_em: offCommunicated, ultimo_dia_em: offLastDay || null, recontratavel: offRehire, status: "aguardando_rh", iniciado_por: profile.id });
    if (error) return toast.error(error.message);
    setOffPerson(""); setOffReason(""); setOffLastDay("");
    toast.success("Desligamento enviado ao RH sem apagar o histórico do colaborador.");
    await load();
  }

  async function updateOffboarding(row: Offboarding, status: string) {
    if (!profile) return;
    const updates: Record<string, unknown> = { status };
    if (mode === "hr") { updates.revisado_por = profile.id; updates.revisado_em = new Date().toISOString(); }
    const { error } = await supabase.from("kt_offboardings").update(updates).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success(status === "aprovado" ? "Desligamento aprovado; cadastro preservado como inativo." : "Desligamento atualizado.");
    await load();
  }

  async function toggleChecklist(table: "kt_offboarding_checklist" | "kt_onboarding_checklist", item: Checklist) {
    const { error } = await supabase.from(table).update({ concluido: !item.concluido, concluido_por: profile?.id ?? null, concluido_em: !item.concluido ? new Date().toISOString() : null }).eq("id", item.id);
    if (error) return toast.error(error.message);
    await load();
  }

  async function createVacancy() {
    if (!profile || !vacancyRole.trim() || !vacancyReason.trim()) return;
    const branch = mode === "manager" ? profile.filial : vacancyBranch;
    if (!branch) return toast.error("Defina a filial da vaga.");
    const id = `vaga-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const { error } = await supabase.from("kt_vagas").insert({ id, cargo: vacancyRole.trim(), filial: branch, motivo: vacancyReason.trim(), ts: now, status: "solicitado", solicitante_id: profile.id, status_at: now });
    if (error) return toast.error(error.message);
    setVacancyRole(""); setVacancyReason("");
    toast.success("Solicitação de vaga registrada dentro da intranet.");
    await load();
  }

  async function updateVacancy(row: Vacancy, status: string) {
    const updates: Record<string, unknown> = { status, status_at: new Date().toISOString() };
    if (status === "preenchida") updates.preenchida_em = new Date().toISOString();
    if (status === "cancelada") updates.cancelada_motivo = row.cancelada_motivo || "Cancelada pela gestão/RH";
    const { error } = await supabase.from("kt_vagas").update(updates).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Status da vaga atualizado.");
    await load();
  }

  async function createRecognition() {
    if (!profile || !recPerson || recReason.trim().length < 3) return;
    const person = personById.get(recPerson);
    if (!person) return;
    const { error } = await supabase.from("kt_reconhecimentos").insert({ colaborador_id: recPerson, filial: person.filial, motivo: recReason.trim(), elogio_cliente: recClient, registrado_por_profile_id: profile.id, status: "ativo" });
    if (error) return toast.error(error.message);
    setRecPerson(""); setRecReason(""); setRecClient(false);
    toast.success("Reconhecimento registrado no histórico do colaborador.");
    await load();
  }

  async function highlightRecognition(row: Recognition) {
    const month = new Date(); month.setDate(1);
    const { error } = await supabase.from("kt_reconhecimentos").update({ status: "destaque", destaque_mes: month.toISOString().slice(0, 10) }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Reconhecimento marcado como destaque do mês.");
    await load();
  }

  async function createOnboarding() {
    if (!profile || !onPerson) return;
    const person = personById.get(onPerson);
    if (!person) return;
    const end = new Date(`${onStart}T12:00:00`); end.setDate(end.getDate() + 90);
    const { error } = await supabase.from("kt_onboardings").insert({ colaborador_id: onPerson, filial: person.filial, inicio_em: onStart, status: "pre_admissao", experiencia_fim_em: end.toISOString().slice(0, 10), responsavel_profile_id: profile.id, iniciado_por: profile.id, observacao: onObservation.trim() || null });
    if (error) return toast.error(error.message);
    setOnPerson(""); setOnObservation("");
    toast.success("Onboarding iniciado com alertas de 40 e 75 dias.");
    await load();
  }

  async function updateOnboarding(row: Onboarding, status: string) {
    const { error } = await supabase.from("kt_onboardings").update({ status }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Etapa do onboarding atualizada.");
    await load();
  }

  async function createSurvey() {
    if (!profile || mode !== "hr" || !surveyTitle.trim() || !surveyDeadline) return;
    const id = `pesq-${crypto.randomUUID().slice(0, 12)}`;
    const now = new Date().toISOString();
    const filialAlvo = surveyBranch === "todas" ? null : surveyBranch;
    const { error } = await supabase.from("kt_pesquisas").insert({ id, titulo: surveyTitle.trim(), descricao: surveyDescription.trim() || null, prazo: surveyDeadline, link: "", categoria: "clima", ativa: true, ts: now, modo: "interna", anonima: true, filial_alvo: filialAlvo });
    if (error) return toast.error(error.message);
    const lines = surveyQuestions.split("\n").map((line) => line.trim()).filter(Boolean);
    const questions = lines.map((line, index) => ({ pesquisa_id: id, pergunta: line.replace(/^S\/N:\s*/i, ""), tipo: /^S\/N:/i.test(line) ? "sim_nao" : "escala_1_5", ordem: index + 1, obrigatoria: true }));
    const questionResult = await supabase.from("kt_pesquisa_perguntas").insert(questions);
    if (questionResult.error) { await supabase.from("kt_pesquisas").delete().eq("id", id); return toast.error(questionResult.error.message); }
    setSurveyTitle(""); setSurveyDescription("");
    toast.success("Pesquisa interna publicada com respostas anônimas e histórico preservado.");
    await load();
  }

  async function closeSurvey(row: Survey) {
    const { error } = await supabase.from("kt_pesquisas").update({ ativa: false, encerrada_em: new Date().toISOString() }).eq("id", row.id);
    if (error) return toast.error(error.message);
    toast.success("Pesquisa encerrada; histórico mantido.");
    await load();
  }

  if (loading || !profile) return <div className="mb-5 rounded-xl border border-border bg-card p-5 text-sm text-muted-foreground">Carregando fluxos operacionais...</div>;

  return <div className="grid gap-5">
    {can("casos", "view") ? <section id="casos" className="surface scroll-mt-24 overflow-hidden">
      <SectionHeader title="Central de Casos" intro="Motor único de acompanhamento: envolvidos, confidencialidade, plano de ação, prazo, reavaliação, histórico e alertas. Conteúdo restrito continua chegando primeiro ao RH." count={openCases.length} />
      <div className="grid gap-4 p-5 lg:grid-cols-[minmax(260px,.8fr)_minmax(0,1.4fr)] lg:p-6">
        <div className="grid content-start gap-2">
          {cases.length === 0 ? <Empty>Nenhum caso registrado.</Empty> : cases.map((row) => <button key={row.id} type="button" onClick={() => setSelectedCaseId(row.id)} className={`rounded-lg border p-3 text-left transition-colors ${selectedCaseId === row.id ? "border-[var(--profile-accent,var(--kt))] bg-muted" : "border-border bg-card hover:bg-muted/60"}`}><div className="flex items-start justify-between gap-2"><span className="text-xs font-bold uppercase tracking-wide text-muted-foreground">{row.tipo}</span><span className="rounded bg-muted px-2 py-0.5 text-[10px] font-bold">{row.status}</span></div><p className="mt-1 font-semibold text-foreground">{row.titulo}</p><p className="mt-1 text-xs text-muted-foreground">{filialNome(row.filial as "cristo-rei" | "champagnat")} · {row.confidencialidade}</p></button>)}
        </div>
        {selectedCase ? <div className="grid gap-4 rounded-xl border border-border bg-card p-4 sm:p-5">
          <div><div className="flex flex-wrap items-center gap-2"><h3 className="text-base font-bold">{selectedCase.titulo}</h3>{selectedCase.confidencialidade.includes("rh") ? <span className="inline-flex items-center gap-1 rounded bg-destructive/10 px-2 py-1 text-[10px] font-bold text-destructive"><ShieldCheck className="h-3 w-3" /> Restrito RH</span> : null}</div><p className="mt-2 text-sm leading-relaxed text-muted-foreground">{selectedCase.descricao || "Sem descrição adicional."}</p></div>
          <div className="grid gap-3 sm:grid-cols-2"><div><FieldSelect label="Status" value={caseStatus} onChange={setCaseStatus} disabled={!caseStatusEditable}>{STATUS_CASE.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</FieldSelect>{!caseStatusEditable ? <p className="mt-1 text-[11px] text-muted-foreground">Status controlado no módulo de origem para preservar a máquina de estados.</p> : null}</div><div className="grid gap-1.5"><Label>Responsável operacional</Label><div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">{profile.nome}</div></div></div>
          <div className="grid gap-1.5"><Label>Plano de ação</Label><Textarea rows={3} value={casePlan} onChange={(event) => setCasePlan(event.target.value)} placeholder="O que será feito, por quem e com qual resultado esperado?" /></div>
          <div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1.5"><Label>Prazo da ação</Label><Input type="datetime-local" value={caseDeadline} onChange={(event) => setCaseDeadline(event.target.value)} /></div><div className="grid gap-1.5"><Label>Data de acompanhamento</Label><Input type="datetime-local" value={caseFollowup} onChange={(event) => setCaseFollowup(event.target.value)} /></div></div>
          <div className="grid gap-1.5"><Label>Motivo de encerramento / observação final</Label><Input value={caseCloseReason} onChange={(event) => setCaseCloseReason(event.target.value)} /></div>
          {can("casos", "edit") ? <Button onClick={() => void saveCase()}><CheckCircle2 className="h-4 w-4" /> Salvar acompanhamento</Button> : null}
          <div className="grid gap-3 border-t border-border pt-4 sm:grid-cols-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Envolvidos</p><div className="mt-2 grid gap-1.5">{involved.filter((item) => item.caso_id === selectedCase.id).map((item) => <div key={item.id} className="rounded-md bg-muted/55 px-3 py-2 text-xs"><strong>{item.nome_snapshot || "Pessoa"}</strong> · {item.papel.replaceAll("_", " ")}</div>)}</div>{can("casos", "edit") ? <div className="mt-2 grid gap-2 sm:grid-cols-[1fr_140px_auto]"><select value={casePerson} onChange={(event) => setCasePerson(event.target.value)} className="h-9 min-w-0 rounded-md border border-input bg-background px-2 text-xs"><option value="">Adicionar pessoa...</option>{people.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</select><select value={caseRole} onChange={(event) => setCaseRole(event.target.value)} className="h-9 rounded-md border border-input bg-background px-2 text-xs"><option value="mencionado">Mencionado</option><option value="testemunha">Testemunha</option><option value="responsavel_acao">Resp. ação</option><option value="outro">Outro</option></select><Button size="sm" variant="outline" onClick={() => void addCaseInvolved()}>Adicionar</Button></div> : null}</div>
          <div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Alertas agendados</p><div className="mt-2 grid gap-1.5">{alerts.filter((item) => item.caso_id === selectedCase.id).map((item) => <div key={item.id} className="flex items-center justify-between gap-2 rounded-md bg-muted/55 px-3 py-2 text-xs"><span>{item.tipo.replaceAll("_", " ")}</span><span className="text-muted-foreground">{fmt(item.due_at)} · {item.status}</span></div>)}{alerts.filter((item) => item.caso_id === selectedCase.id).length === 0 ? <p className="text-xs text-muted-foreground">Sem alerta futuro configurado.</p> : null}</div></div></div>
          <div className="border-t border-border pt-4"><div className="flex items-center gap-2"><History className="h-4 w-4 text-muted-foreground" /><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Histórico / auditoria</p></div><div className="mt-2 max-h-60 space-y-2 overflow-y-auto">{history.filter((item) => item.caso_id === selectedCase.id).map((item) => <div key={item.id} className="rounded-md border border-border px-3 py-2"><div className="flex justify-between gap-2 text-[10px] text-muted-foreground"><span>{item.actor_nome_snapshot || "Sistema"} · {item.evento}</span><span>{fmt(item.created_at)}</span></div><p className="mt-1 text-xs leading-relaxed">{item.mensagem || "Atualização registrada."}</p></div>)}</div>{can("casos", "edit") ? <div className="mt-3 flex flex-col gap-2 sm:flex-row"><Input value={caseNote} onChange={(event) => setCaseNote(event.target.value)} placeholder="Registrar reunião, devolutiva ou decisão..." /><Button variant="outline" onClick={() => void addCaseNote()}>Registrar</Button></div> : null}</div>
        </div> : <Empty>Selecione um caso.</Empty>}
      </div>
    </section> : null}

    {can("offboarding", "view") ? <section id="offboarding" className="surface scroll-mt-24 overflow-hidden"><SectionHeader title="Desligamentos" intro="Fluxo estruturado com revisão do RH, checklist, histórico e inativação do cadastro somente após aprovação — sem apagar registros." count={offboardings.filter((row) => !["aprovado", "cancelado"].includes(row.status)).length} /><div className="grid gap-5 p-5 lg:grid-cols-[.8fr_1.2fr] lg:p-6">{can("offboarding", "edit") ? <div className="grid content-start gap-3 rounded-xl border border-border p-4"><FieldSelect label="Colaborador" value={offPerson} onChange={setOffPerson}><option value="">Selecione...</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{person.nome} · {person.cargo || "Sem cargo"}</option>)}</FieldSelect><FieldSelect label="Tipo" value={offType} onChange={setOffType}>{OFFBOARDING_TYPES.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</FieldSelect><div className="grid gap-1.5"><Label>Motivo</Label><Textarea value={offReason} onChange={(event) => setOffReason(event.target.value)} rows={3} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1.5"><Label>Data da comunicação</Label><Input type="date" value={offCommunicated} onChange={(event) => setOffCommunicated(event.target.value)} /></div><div className="grid gap-1.5"><Label>Último dia</Label><Input type="date" value={offLastDay} onChange={(event) => setOffLastDay(event.target.value)} /></div></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={offRehire} onChange={(event) => setOffRehire(event.target.checked)} /> Elegível para recontratação</label><Button disabled={!offPerson || offReason.trim().length < 3} onClick={() => void createOffboarding()}><UserMinus className="h-4 w-4" /> Enviar para revisão do RH</Button></div> : null}<div className="grid content-start gap-3">{offboardings.length === 0 ? <Empty>Nenhum desligamento registrado.</Empty> : offboardings.map((row) => { const items = offChecklist.filter((item) => item.offboarding_id === row.id); return <div key={row.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{personById.get(row.colaborador_id)?.nome || "Colaborador"}</p><p className="text-xs text-muted-foreground">{row.tipo.replaceAll("_", " ")} · comunicado {dateOnly(row.comunicado_em)} · último dia {dateOnly(row.ultimo_dia_em)}</p></div><span className="h-fit rounded bg-muted px-2 py-1 text-[10px] font-bold">{row.status}</span></div><p className="mt-2 text-sm">{row.motivo}</p><div className="mt-3 grid gap-1.5">{items.map((item) => <label key={item.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"><input type="checkbox" checked={item.concluido} disabled={!can("offboarding", "edit")} onChange={() => void toggleChecklist("kt_offboarding_checklist", item)} /> {item.label}</label>)}</div>{mode === "hr" && can("offboarding", "edit") && row.status === "aguardando_rh" ? <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={() => void updateOffboarding(row, "aprovado")}>Aprovar desligamento</Button><Button size="sm" variant="outline" onClick={() => void updateOffboarding(row, "cancelado")}>Cancelar processo</Button></div> : null}</div>; })}</div></div></section> : null}

    {can("vagas", "view") ? <section id="vagas" className="surface scroll-mt-24 overflow-hidden"><SectionHeader title="Solicitação de vagas" intro="A vaga nasce e é acompanhada dentro da intranet. Cada mudança de status fica registrada e vagas sem atualização geram lembrete." count={vacancies.filter((row) => !["preenchida", "cancelada"].includes(row.status)).length} /><div className="grid gap-5 p-5 lg:grid-cols-[.75fr_1.25fr] lg:p-6">{can("vagas", "edit") ? <div className="grid content-start gap-3 rounded-xl border border-border p-4"><div className="grid gap-1.5"><Label>Cargo</Label><Input value={vacancyRole} onChange={(event) => setVacancyRole(event.target.value)} /></div>{mode === "hr" ? <FieldSelect label="Filial" value={vacancyBranch} onChange={(value) => setVacancyBranch(value as "cristo-rei" | "champagnat")}><option value="cristo-rei">Cristo Rei</option><option value="champagnat">Champagnat</option></FieldSelect> : <div className="grid gap-1.5"><Label>Filial</Label><div className="flex h-10 items-center rounded-md border border-input bg-muted/40 px-3 text-sm">{filialNome(profile.filial ?? undefined)}</div></div>}<div className="grid gap-1.5"><Label>Motivo / contexto</Label><Textarea rows={3} value={vacancyReason} onChange={(event) => setVacancyReason(event.target.value)} /></div><Button disabled={!vacancyRole.trim() || !vacancyReason.trim()} onClick={() => void createVacancy()}><BriefcaseBusiness className="h-4 w-4" /> Solicitar vaga</Button></div> : null}<div className="grid content-start gap-3">{vacancies.length === 0 ? <Empty>Nenhuma vaga solicitada.</Empty> : vacancies.map((row) => <div key={row.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="font-semibold">{row.cargo}</p><p className="text-xs text-muted-foreground">{filialNome(row.filial as "cristo-rei" | "champagnat")} · criada {fmt(row.ts)}</p></div><span className="rounded bg-muted px-2 py-1 text-[10px] font-bold">{row.status}</span></div><p className="mt-2 text-sm">{row.motivo}</p><div className="mt-3 flex flex-wrap gap-2">{mode === "hr" && can("vagas", "edit") ? STATUS_VAGA.filter((status) => status !== row.status).map((status) => <Button key={status} size="sm" variant="outline" onClick={() => void updateVacancy(row, status)}>{status.replaceAll("_", " ")}</Button>) : mode === "manager" && row.status === "solicitado" ? <Button size="sm" variant="outline" onClick={() => void updateVacancy(row, "cancelada")}>Cancelar solicitação</Button> : null}</div><div className="mt-3 border-t border-border pt-2">{vacancyHistory.filter((item) => item.vaga_id === row.id).slice(0,4).map((item) => <p key={item.id} className="text-[11px] text-muted-foreground">{fmt(item.created_at)} · {item.status_anterior || "início"} → {item.status_novo}</p>)}</div></div>)}</div></div></section> : null}

    {can("reconhecimento", "view") ? <section id="reconhecimento" className="surface scroll-mt-24 overflow-hidden"><SectionHeader title="Reconhecimento" intro="Elogios viram histórico positivo do colaborador e podem ser destacados no mês, sem misturar reconhecimento com ocorrência." count={recognitions.length} /><div className="grid gap-5 p-5 lg:grid-cols-[.75fr_1.25fr] lg:p-6">{can("reconhecimento", "edit") ? <div className="grid content-start gap-3 rounded-xl border border-border p-4"><FieldSelect label="Reconhecer" value={recPerson} onChange={setRecPerson}><option value="">Selecione...</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</FieldSelect><div className="grid gap-1.5"><Label>Motivo</Label><Textarea rows={3} value={recReason} onChange={(event) => setRecReason(event.target.value)} /></div><label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={recClient} onChange={(event) => setRecClient(event.target.checked)} /> Veio de elogio de cliente</label><Button disabled={!recPerson || recReason.trim().length < 3} onClick={() => void createRecognition()}><HeartHandshake className="h-4 w-4" /> Registrar reconhecimento</Button></div> : null}<div className="grid content-start gap-2">{recognitions.length === 0 ? <Empty>Nenhum reconhecimento registrado.</Empty> : recognitions.map((row) => <div key={row.id} className="rounded-lg border border-border p-4"><div className="flex justify-between gap-2"><div><p className="font-semibold">{personById.get(row.colaborador_id)?.nome || "Colaborador"}</p><p className="text-xs text-muted-foreground">{fmt(row.created_at)}{row.elogio_cliente ? " · elogio de cliente" : ""}</p></div>{row.status === "destaque" ? <span className="h-fit rounded bg-success/10 px-2 py-1 text-[10px] font-bold text-success">Destaque</span> : null}</div><p className="mt-2 text-sm">{row.motivo}</p>{row.status === "ativo" && can("reconhecimento", "edit") ? <Button size="sm" variant="outline" className="mt-3" onClick={() => void highlightRecognition(row)}>Marcar destaque do mês</Button> : null}</div>)}</div></div></section> : null}

    {can("onboarding", "view") ? <section id="onboarding" className="surface scroll-mt-24 overflow-hidden"><SectionHeader title="Onboarding e período de experiência" intro="Integração com checklist e estados claros. O sistema agenda revisões aos 40 e 75 dias para evitar decisão de experiência em cima da hora." count={onboardings.filter((row) => !["efetivado", "cancelado"].includes(row.status)).length} /><div className="grid gap-5 p-5 lg:grid-cols-[.75fr_1.25fr] lg:p-6">{can("onboarding", "edit") ? <div className="grid content-start gap-3 rounded-xl border border-border p-4"><FieldSelect label="Colaborador" value={onPerson} onChange={setOnPerson}><option value="">Selecione...</option>{activePeople.map((person) => <option key={person.id} value={person.id}>{person.nome}</option>)}</FieldSelect><div className="grid gap-1.5"><Label>Início</Label><Input type="date" value={onStart} onChange={(event) => setOnStart(event.target.value)} /></div><div className="grid gap-1.5"><Label>Observação inicial</Label><Textarea rows={3} value={onObservation} onChange={(event) => setOnObservation(event.target.value)} /></div><Button disabled={!onPerson} onClick={() => void createOnboarding()}><UserRoundCheck className="h-4 w-4" /> Iniciar onboarding</Button></div> : null}<div className="grid content-start gap-3">{onboardings.length === 0 ? <Empty>Nenhum onboarding registrado.</Empty> : onboardings.map((row) => { const items = onChecklist.filter((item) => item.onboarding_id === row.id); return <div key={row.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{personById.get(row.colaborador_id)?.nome || "Colaborador"}</p><p className="text-xs text-muted-foreground">Início {dateOnly(row.inicio_em)} · fim previsto {dateOnly(row.experiencia_fim_em)}</p></div><select value={row.status} disabled={!can("onboarding", "edit")} onChange={(event) => void updateOnboarding(row, event.target.value)} className="h-8 rounded-md border border-input bg-background px-2 text-xs font-bold">{STATUS_ONBOARDING.map((status) => <option key={status} value={status}>{status.replaceAll("_", " ")}</option>)}</select></div><div className="mt-3 grid gap-1.5">{items.map((item) => <label key={item.id} className="flex items-center gap-2 rounded-md bg-muted/50 px-3 py-2 text-xs"><input type="checkbox" checked={item.concluido} disabled={!can("onboarding", "edit")} onChange={() => void toggleChecklist("kt_onboarding_checklist", item)} /> {item.label}</label>)}</div></div>; })}</div></div></section> : null}

    {can("pesquisas", "view") ? <section id="pesquisas-internas" className="surface scroll-mt-24 overflow-hidden"><SectionHeader title="Pesquisas internas e histórico" intro="Pesquisa respondida dentro da intranet, anônima por padrão, com resultado histórico por filial. Gestor vê agregado da própria unidade; RH mantém visão institucional." count={surveys.length} /><div className="grid gap-5 p-5 lg:grid-cols-[.8fr_1.2fr] lg:p-6">{mode === "hr" && can("pesquisas", "edit") ? <div className="grid content-start gap-3 rounded-xl border border-border p-4"><div className="grid gap-1.5"><Label>Título</Label><Input value={surveyTitle} onChange={(event) => setSurveyTitle(event.target.value)} /></div><div className="grid gap-1.5"><Label>Descrição</Label><Textarea rows={2} value={surveyDescription} onChange={(event) => setSurveyDescription(event.target.value)} /></div><div className="grid gap-3 sm:grid-cols-2"><div className="grid gap-1.5"><Label>Prazo</Label><Input type="date" value={surveyDeadline} onChange={(event) => setSurveyDeadline(event.target.value)} /></div><FieldSelect label="Filial" value={surveyBranch} onChange={setSurveyBranch}><option value="todas">Todas</option><option value="cristo-rei">Cristo Rei</option><option value="champagnat">Champagnat</option></FieldSelect></div><div className="grid gap-1.5"><Label>Perguntas · uma por linha</Label><Textarea rows={7} value={surveyQuestions} onChange={(event) => setSurveyQuestions(event.target.value)} /><p className="text-[11px] text-muted-foreground">Use “S/N:” no início para pergunta Sim/Não. As demais usam escala de 1 a 5.</p></div><Button disabled={!surveyTitle.trim() || !surveyDeadline} onClick={() => void createSurvey()}><ClipboardList className="h-4 w-4" /> Publicar pesquisa interna</Button></div> : null}<div className="grid content-start gap-3">{surveys.length === 0 ? <Empty>Nenhuma pesquisa interna criada.</Empty> : surveys.map((row) => <div key={row.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap justify-between gap-2"><div><p className="font-semibold">{row.titulo}</p><p className="text-xs text-muted-foreground">{row.filial_alvo ? filialNome(row.filial_alvo as "cristo-rei" | "champagnat") : "Todas as filiais"} · prazo {dateOnly(row.prazo)}</p></div><span className={`h-fit rounded px-2 py-1 text-[10px] font-bold ${row.ativa ? "bg-success/10 text-success" : "bg-muted text-muted-foreground"}`}>{row.ativa ? "Ativa" : "Encerrada"}</span></div><div className="mt-3 grid gap-2">{(surveySummary[row.id] ?? []).map((item) => <div key={item.pergunta_id} className="rounded-md bg-muted/50 px-3 py-2"><div className="flex flex-wrap justify-between gap-2"><p className="text-xs font-semibold">{item.pergunta}</p><span className="text-[10px] text-muted-foreground">{item.total_respostas} respostas</span></div><p className="mt-1 text-[11px] text-muted-foreground">{item.tipo === "escala_1_5" ? `Média: ${item.media ?? "—"} / 5` : `Sim: ${item.sim} · Não: ${item.nao}`}</p></div>)}</div>{row.ativa && mode === "hr" && can("pesquisas", "edit") ? <Button size="sm" variant="outline" className="mt-3" onClick={() => void closeSurvey(row)}>Encerrar pesquisa</Button> : null}</div>)}</div></div></section> : null}

    <div className="rounded-xl border border-border bg-card p-4 text-xs text-muted-foreground"><div className="flex items-center gap-2 font-semibold text-foreground"><BellRing className="h-4 w-4" /> Operação conectada</div><p className="mt-1">Os fluxos acima usam RLS por perfil/filial, histórico de banco e notificações da intranet. Alertas agendados são processados pelo scheduler já ativo no Supabase.</p></div>
  </div>;
}
