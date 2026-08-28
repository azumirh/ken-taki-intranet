import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  BellRing,
  CheckCircle2,
  ChevronRight,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  FileCheck2,
  FileText,
  HeartHandshake,
  History,
  Lightbulb,
  Megaphone,
  MessageCircle,
  MessageSquareHeart,
  MessagesSquare,
  PlayCircle,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { CheckIn } from "@/components/kt/checkin";
import { Documentos } from "@/components/kt/politicas";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  FEEDBACK_TIPOS,
  HUMORES,
  SUGESTAO_CATEGORIAS,
  filialNome,
  youtubeEmbed,
} from "@/lib/kt-data";
import {
  uid,
  useAjuda,
  useAnotacoesApoio,
  useAssinaturas,
  useCheckins,
  useColaboradores,
  useDocumentos,
  useFeedbacks,
  useLeituras,
  useMural,
  useNoticias,
  useSession,
  useSugestoes,
} from "@/lib/kt-store";
import { supabase } from "@/lib/supabase";

type Onboarding = {
  id: string;
  inicio_em: string;
  status: string;
  experiencia_fim_em: string | null;
  buddy_colaborador_id: string | null;
  observacao: string | null;
};

type Checklist = {
  id: string;
  onboarding_id: string;
  label: string;
  categoria: string;
  concluido: boolean;
};

type Recognition = {
  id: string;
  colaborador_id: string;
  motivo: string;
  elogio_cliente: boolean;
  destaque_mes: string | null;
  status: string;
  created_at: string;
};

type Survey = {
  id: string;
  titulo: string;
  descricao: string | null;
  prazo: string | null;
  categoria: string | null;
  modo: "interna" | "externa";
  anonima: boolean;
  filial_alvo: string | null;
  link: string | null;
  respondeu: string[] | null;
  respondeu_ts: Record<string, number> | null;
};

type Question = {
  id: string;
  pesquisa_id: string;
  pergunta: string;
  tipo: "escala_1_5" | "sim_nao" | string;
  ordem: number;
  obrigatoria: boolean;
};

type Participation = { pesquisa_id: string };

type ActionTone = "default" | "warning" | "success";

const ONBOARDING_LABEL: Record<string, string> = {
  pre_admissao: "Pré-admissão",
  documentacao_pendente: "Documentação pendente",
  primeira_semana: "Primeira semana",
  experiencia: "Período de experiência",
  efetivado: "Efetivado",
  cancelado: "Cancelado",
};

const FEEDBACK_SENSITIVE = new Set(["Crítica", "Reclamação", "Denúncia", "Situação urgente"]);

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("pt-BR");
}

function dateTime(value: number | string | null | undefined) {
  if (!value) return "—";
  const date = typeof value === "number" ? new Date(value) : new Date(value);
  return Number.isNaN(date.getTime())
    ? "—"
    : date.toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });
}

function SectionBlock({
  id,
  eyebrow,
  title,
  description,
  icon,
  action,
  children,
}: {
  id?: string;
  eyebrow?: string;
  title: string;
  description?: string;
  icon: ReactNode;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section id={id} className="scroll-mt-24 overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
      <header className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <div className="flex min-w-0 items-start gap-3.5">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-kt-soft text-kt">{icon}</span>
          <div className="min-w-0">
            {eyebrow ? <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{eyebrow}</p> : null}
            <h2 className="mt-0.5 text-lg font-extrabold tracking-tight text-foreground sm:text-xl">{title}</h2>
            {description ? <p className="mt-1 max-w-3xl text-sm leading-relaxed text-muted-foreground">{description}</p> : null}
          </div>
        </div>
        {action ? <div className="shrink-0">{action}</div> : null}
      </header>
      <div className="px-5 py-5 sm:px-6 sm:py-6">{children}</div>
    </section>
  );
}

function StatusPill({ children, tone = "default" }: { children: ReactNode; tone?: ActionTone }) {
  const style =
    tone === "success"
      ? "bg-success/10 text-success"
      : tone === "warning"
        ? "bg-warn-soft text-warn"
        : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{children}</span>;
}

function ActionRow({
  icon,
  title,
  description,
  status,
  tone,
  action,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  status?: string;
  tone?: ActionTone;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 rounded-xl border border-border bg-background px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-5">
      <div className="flex min-w-0 items-start gap-3">
        <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-card text-kt ring-1 ring-border">{icon}</span>
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="font-bold text-foreground">{title}</h3>
            {status ? (tone ? <StatusPill tone={tone}>{status}</StatusPill> : <StatusPill>{status}</StatusPill>) : null}
          </div>
          <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{description}</p>
        </div>
      </div>
      {action ? <div className="shrink-0 sm:pl-4">{action}</div> : null}
    </div>
  );
}

function RecordRow({ title, meta, body, badge }: { title: string; meta: string; body?: string; badge?: ReactNode }) {
  return (
    <div className="flex flex-col gap-2 border-b border-border py-3.5 last:border-b-0 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          {badge}
        </div>
        {body ? <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{body}</p> : null}
      </div>
      <span className="shrink-0 text-xs text-muted-foreground">{meta}</span>
    </div>
  );
}

export function EmployeeDashboardV2() {
  const [session] = useSession();
  const [documentos] = useDocumentos();
  const [assinaturas] = useAssinaturas();
  const [leituras] = useLeituras();
  const [mural] = useMural();
  const [noticias] = useNoticias();
  const [checkins] = useCheckins();
  const [feedbacks] = useFeedbacks();
  const [sugestoes] = useSugestoes();
  const [ajuda] = useAjuda();
  const [anotacoes] = useAnotacoesApoio();
  const [colaboradores] = useColaboradores();

  const [employeeId, setEmployeeId] = useState<string | null>(null);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [checklist, setChecklist] = useState<Checklist[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [surveyOpen, setSurveyOpen] = useState<Survey | null>(null);
  const [surveySending, setSurveySending] = useState(false);

  const [feedbackOpen, setFeedbackOpen] = useState(false);
  const [feedbackType, setFeedbackType] = useState("Elogio");
  const [feedbackMessage, setFeedbackMessage] = useState("");
  const [feedbackAnonymous, setFeedbackAnonymous] = useState(false);
  const [feedbackFactDate, setFeedbackFactDate] = useState("");
  const [feedbackSending, setFeedbackSending] = useState(false);

  const [suggestionOpen, setSuggestionOpen] = useState(false);
  const [suggestionCategory, setSuggestionCategory] = useState(SUGESTAO_CATEGORIAS[0] ?? "Geral");
  const [suggestionMessage, setSuggestionMessage] = useState("");
  const [suggestionSending, setSuggestionSending] = useState(false);

  const [supportOpen, setSupportOpen] = useState(false);
  const [supportMessage, setSupportMessage] = useState("");
  const [supportSending, setSupportSending] = useState(false);

  const [recognitionOpen, setRecognitionOpen] = useState(false);
  const [recognitionPerson, setRecognitionPerson] = useState("");
  const [recognitionReason, setRecognitionReason] = useState("");
  const [recognitionSending, setRecognitionSending] = useState(false);

  const loadJourney = useCallback(async () => {
    if (!session || session.tipo !== "colaborador") return;
    try {
      const { data: employeeIdResult, error: employeeIdError } = await supabase.rpc("kt_current_employee_id");
      if (employeeIdError) throw employeeIdError;
      const id = employeeIdResult as string | null;
      if (!id) return;
      setEmployeeId(id);

      const [onboardingResult, recognitionResult, surveyResult, participationResult] = await Promise.all([
        supabase
          .from("kt_onboardings")
          .select("id,inicio_em,status,experiencia_fim_em,buddy_colaborador_id,observacao")
          .eq("colaborador_id", id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle(),
        supabase
          .from("kt_reconhecimentos")
          .select("id,colaborador_id,motivo,elogio_cliente,destaque_mes,status,created_at")
          .eq("colaborador_id", id)
          .order("created_at", { ascending: false })
          .limit(20),
        supabase
          .from("kt_pesquisas")
          .select("id,titulo,descricao,prazo,categoria,modo,anonima,filial_alvo,link,respondeu,respondeu_ts")
          .eq("ativa", true)
          .order("ts", { ascending: false }),
        supabase.from("kt_pesquisa_participacoes").select("pesquisa_id"),
      ]);
      for (const result of [onboardingResult, recognitionResult, surveyResult, participationResult]) {
        if (result.error) throw result.error;
      }

      const currentOnboarding = onboardingResult.data as Onboarding | null;
      const surveyRows = (surveyResult.data ?? []) as Survey[];
      setOnboarding(currentOnboarding);
      setRecognitions((recognitionResult.data ?? []) as Recognition[]);
      setSurveys(surveyRows);
      setAnswered(new Set(((participationResult.data ?? []) as Participation[]).map((item) => item.pesquisa_id)));

      const [checklistResult, questionResult] = await Promise.all([
        currentOnboarding
          ? supabase
              .from("kt_onboarding_checklist")
              .select("id,onboarding_id,label,categoria,concluido")
              .eq("onboarding_id", currentOnboarding.id)
          : Promise.resolve({ data: [], error: null }),
        surveyRows.some((survey) => survey.modo === "interna")
          ? supabase
              .from("kt_pesquisa_perguntas")
              .select("id,pesquisa_id,pergunta,tipo,ordem,obrigatoria")
              .in(
                "pesquisa_id",
                surveyRows.filter((survey) => survey.modo === "interna").map((survey) => survey.id),
              )
              .order("ordem")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (checklistResult.error) throw checklistResult.error;
      if (questionResult.error) throw questionResult.error;
      setChecklist((checklistResult.data ?? []) as Checklist[]);
      setQuestions((questionResult.data ?? []) as Question[]);
    } catch (error) {
      console.warn("[employee-dashboard] journey", error);
    }
  }, [session]);

  useEffect(() => {
    void loadJourney();
  }, [loadJourney]);

  const docsVisible = useMemo(
    () =>
      documentos.filter(
        (doc) =>
          session?.tipo === "colaborador" &&
          (doc.filial === session.filial || doc.filial === "todas") &&
          doc.categoria !== "gestao",
      ),
    [documentos, session],
  );

  const signedDocIds = useMemo(
    () =>
      new Set(
        assinaturas
          .filter((item) => session?.tipo === "colaborador" && item.nome === session.nome)
          .map((item) => item.politica),
      ),
    [assinaturas, session],
  );

  const readDocIds = useMemo(
    () =>
      new Set(
        leituras
          .filter((item) => session?.tipo === "colaborador" && item.nome === session.nome)
          .map((item) => item.documentoId),
      ),
    [leituras, session],
  );

  const docsPending = docsVisible.filter((doc) => !signedDocIds.has(doc.id));
  const onboardingPending = checklist.filter((item) => !item.concluido);

  const employeeCheckins = useMemo(
    () =>
      checkins
        .filter((item) => session?.tipo === "colaborador" && item.nome === session.nome && item.filial === session.filial)
        .sort((a, b) => b.ts - a.ts),
    [checkins, session],
  );

  const employeeFeedbacks = useMemo(
    () =>
      feedbacks
        .filter((item) => session?.tipo === "colaborador" && item.autor === session.nome && item.filial === session.filial)
        .sort((a, b) => b.ts - a.ts),
    [feedbacks, session],
  );

  const employeeSupport = useMemo(
    () =>
      ajuda
        .filter((item) => session?.tipo === "colaborador" && item.nome === session.nome && item.filial === session.filial)
        .sort((a, b) => b.ts - a.ts),
    [ajuda, session],
  );

  const supportIds = useMemo(() => new Set(employeeSupport.map((item) => item.id)), [employeeSupport]);
  const employeeSupportNotes = useMemo(
    () => anotacoes.filter((item) => supportIds.has(item.pedidoId)).sort((a, b) => b.criadoEm - a.criadoEm),
    [anotacoes, supportIds],
  );

  const visibleMural = useMemo(
    () =>
      mural
        .filter(
          (item) =>
            session?.tipo === "colaborador" &&
            (!item.filial || item.filial === "todas" || item.filial === session.filial),
        )
        .slice(0, 5),
    [mural, session],
  );

  const birthdays = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return [];
    const month = new Date().getMonth();
    return colaboradores
      .filter((item) => item.filial === session.filial && item.nascimento && new Date(`${item.nascimento}T00:00:00`).getMonth() === month)
      .slice(0, 6);
  }, [colaboradores, session]);

  const availablePeers = useMemo(
    () =>
      colaboradores.filter(
        (item) =>
          session?.tipo === "colaborador" &&
          item.filial === session.filial &&
          item.id !== employeeId,
      ),
    [colaboradores, employeeId, session],
  );

  const surveyAnswered = (survey: Survey) => {
    if (!session || session.tipo !== "colaborador") return false;
    if (survey.modo === "interna") return answered.has(survey.id);
    return (survey.respondeu ?? []).includes(session.nome);
  };

  const pendingSurveys = surveys.filter((survey) => !surveyAnswered(survey));
  const completedSurveys = surveys.filter((survey) => surveyAnswered(survey));

  const checklistProgress = checklist.length
    ? Math.round((checklist.filter((item) => item.concluido).length / checklist.length) * 100)
    : 0;

  const buddy = onboarding?.buddy_colaborador_id
    ? colaboradores.find((item) => item.id === onboarding.buddy_colaborador_id)
    : null;

  const latestNews = noticias.slice(0, 3);

  const hasPending = pendingSurveys.length > 0 || docsPending.length > 0 || onboardingPending.length > 0;

  async function submitSurvey(survey: Survey) {
    if (survey.modo === "externa") return;
    const surveyQuestions = questions.filter((question) => question.pesquisa_id === survey.id);
    if (surveyQuestions.some((question) => question.obrigatoria && !answers[question.id])) {
      toast.error("Responda todas as perguntas obrigatórias.");
      return;
    }
    setSurveySending(true);
    try {
      const payload = surveyQuestions.map((question) => ({
        pergunta_id: question.id,
        resposta: question.tipo === "escala_1_5" ? Number(answers[question.id]) : answers[question.id],
      }));
      const { error } = await supabase.rpc("kt_submit_internal_survey", {
        p_pesquisa_id: survey.id,
        p_respostas: payload,
      });
      if (error) throw error;
      setAnswered((current) => new Set([...current, survey.id]));
      setSurveyOpen(null);
      setAnswers({});
      toast.success("Pesquisa enviada. Sua participação foi registrada.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar a pesquisa.");
    } finally {
      setSurveySending(false);
    }
  }

  async function markExternalAnswered(survey: Survey) {
    if (!session || session.tipo !== "colaborador") return;
    const nextNames = Array.from(new Set([...(survey.respondeu ?? []), session.nome]));
    const nextTimes = { ...(survey.respondeu_ts ?? {}), [session.nome]: Date.now() };
    const { error } = await supabase
      .from("kt_pesquisas")
      .update({ respondeu: nextNames, respondeu_ts: nextTimes })
      .eq("id", survey.id);
    if (error) {
      toast.error("Não foi possível registrar a confirmação agora.");
      return;
    }
    setSurveys((current) =>
      current.map((item) =>
        item.id === survey.id ? { ...item, respondeu: nextNames, respondeu_ts: nextTimes } : item,
      ),
    );
    toast.success("Pesquisa marcada como respondida.");
  }

  async function sendFeedback() {
    if (!session || session.tipo !== "colaborador" || feedbackMessage.trim().length < 3) return;
    const sensitive = FEEDBACK_SENSITIVE.has(feedbackType);
    if (sensitive && !feedbackFactDate) {
      toast.error("Informe a data da situação para este tipo de relato.");
      return;
    }
    setFeedbackSending(true);
    try {
      const { error } = await supabase.rpc("kt_submit_employee_feedback", {
        p_id: `fb-${uid()}-${Date.now()}`,
        p_tipo: feedbackType,
        p_mensagem: feedbackMessage.trim(),
        p_anonimo: feedbackAnonymous,
        p_destinatario_tipo: sensitive ? "rh" : "gestor",
        p_destinatario_colaborador_id: null,
        p_destinatario_nome: sensitive ? "Equipe de RH" : "Gestão da unidade",
        p_destinatario_filial: session.filial,
        p_fato_em: sensitive ? new Date(`${feedbackFactDate}T12:00:00`).toISOString() : null,
        p_testemunhas: null,
      });
      if (error) throw error;
      setFeedbackOpen(false);
      setFeedbackMessage("");
      setFeedbackFactDate("");
      setFeedbackAnonymous(false);
      setFeedbackType("Elogio");
      toast.success(sensitive ? "Relato enviado para triagem do RH." : "Feedback enviado.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar o feedback.");
    } finally {
      setFeedbackSending(false);
    }
  }

  async function sendSuggestion() {
    if (suggestionMessage.trim().length < 3) return;
    setSuggestionSending(true);
    try {
      const { error } = await supabase.rpc("kt_submit_employee_suggestion", {
        p_id: `sg-${uid()}-${Date.now()}`,
        p_categoria: suggestionCategory,
        p_mensagem: suggestionMessage.trim(),
      });
      if (error) throw error;
      setSuggestionOpen(false);
      setSuggestionMessage("");
      toast.success("Sugestão enviada para o RH.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar a sugestão.");
    } finally {
      setSuggestionSending(false);
    }
  }

  async function sendSupport() {
    if (!session || session.tipo !== "colaborador" || !employeeId || supportMessage.trim().length < 3) return;
    setSupportSending(true);
    try {
      const id = `apoio-${uid()}-${Date.now()}`;
      const { error } = await supabase.from("kt_ajuda").insert({
        id,
        nome: session.nome,
        filial: session.filial,
        assunto: supportMessage.trim(),
        ts: new Date().toISOString(),
        status: "em-andamento",
        protocolo: `KT-${Date.now().toString(36).toUpperCase().slice(-6)}`,
        colaborador_id: employeeId,
        destino_inicial: "rh",
        tipo_apoio: "Conversa e orientação",
        origem: "colaborador",
      });
      if (error) throw error;
      setSupportOpen(false);
      setSupportMessage("");
      toast.success("Pedido de apoio registrado com o RH.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível registrar o pedido.");
    } finally {
      setSupportSending(false);
    }
  }

  async function sendRecognition() {
    if (!employeeId || !recognitionPerson || recognitionReason.trim().length < 3) return;
    const target = availablePeers.find((item) => item.id === recognitionPerson);
    if (!target) return;
    setRecognitionSending(true);
    try {
      const { error } = await supabase.from("kt_reconhecimentos").insert({
        colaborador_id: target.id,
        filial: target.filial,
        motivo: recognitionReason.trim(),
        elogio_cliente: false,
        registrado_por_colaborador_id: employeeId,
        status: "ativo",
      });
      if (error) throw error;
      setRecognitionOpen(false);
      setRecognitionPerson("");
      setRecognitionReason("");
      toast.success("Reconhecimento enviado.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar o reconhecimento.");
    } finally {
      setRecognitionSending(false);
    }
  }

  if (!session || session.tipo !== "colaborador") return null;

  return (
    <div className="mx-auto grid w-full max-w-[1180px] gap-6">
      <style>{`[data-employee-workspace] > #minha-jornada{display:none!important}`}</style>

      <section className="overflow-hidden rounded-2xl border border-[#5c294f]/15 bg-[#fbf8f6] shadow-sm">
        <div className="grid gap-6 px-5 py-6 sm:px-7 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-[#7a3049]">Seu painel de hoje</p>
            <h1 className="mt-2 text-2xl font-black tracking-tight text-foreground sm:text-3xl">O que precisa da sua atenção</h1>
            <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">
              Aqui ficam somente as ações pendentes. O restante do portal está organizado por assunto logo abaixo.
            </p>
          </div>
          <div className="flex items-center gap-2 rounded-xl border border-border bg-card px-4 py-3">
            {hasPending ? <BellRing className="h-5 w-5 text-warn" /> : <CheckCircle2 className="h-5 w-5 text-success" />}
            <div>
              <p className="text-xs font-bold text-foreground">{hasPending ? "Há pendências" : "Tudo em dia"}</p>
              <p className="text-[11px] text-muted-foreground">
                {pendingSurveys.length + docsPending.length + onboardingPending.length} item(ns)
              </p>
            </div>
          </div>
        </div>
        <div className="grid gap-3 border-t border-border px-5 py-5 sm:px-7">
          {surveys.map((survey) => {
            const done = surveyAnswered(survey);
            const action = done ? (
              <span className="inline-flex items-center gap-1.5 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4" /> Respondida</span>
            ) : survey.modo === "externa" && survey.link ? (
              <a href={survey.link} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center justify-center gap-2 rounded-lg bg-[#4b1736] px-4 text-sm font-bold text-white transition-opacity hover:opacity-90">
                Responder pesquisa <ExternalLink className="h-4 w-4" />
              </a>
            ) : (
              <Button className="min-w-[170px] bg-[#4b1736] text-white hover:bg-[#351526]" onClick={() => { setAnswers({}); setSurveyOpen(survey); }}>
                Responder pesquisa <ChevronRight className="h-4 w-4" />
              </Button>
            );
            return (
              <ActionRow
                key={survey.id}
                icon={<ClipboardCheck className="h-4 w-4" />}
                title={survey.titulo}
                description={`${survey.descricao ?? "Pesquisa publicada pelo RH."}${survey.prazo ? ` Prazo: ${dateOnly(survey.prazo)}.` : ""}`}
                status={done ? "Respondida" : "Pendente"}
                tone={done ? "success" : "warning"}
                action={action}
              />
            );
          })}

          <ActionRow
            icon={<FileCheck2 className="h-4 w-4" />}
            title="Documentos e políticas"
            description={
              docsPending.length > 0
                ? `${docsPending.length} documento(s) aguardando leitura ou assinatura.`
                : `${docsVisible.length} documento(s) disponível(is). Você está em dia.`
            }
            status={docsPending.length > 0 ? `${docsPending.length} pendente(s)` : "Em dia"}
            tone={docsPending.length > 0 ? "warning" : "success"}
            action={
              <Button variant="outline" onClick={() => document.getElementById("politicas")?.scrollIntoView({ behavior: "smooth" })}>
                Ver documentos <ChevronRight className="h-4 w-4" />
              </Button>
            }
          />

          {onboarding ? (
            <ActionRow
              icon={<HeartHandshake className="h-4 w-4" />}
              title="Sua integração"
              description={`${ONBOARDING_LABEL[onboarding.status] ?? onboarding.status}. ${onboardingPending.length} item(ns) ainda pendente(s) no checklist.`}
              status={`${checklistProgress}% concluído`}
              tone={checklistProgress === 100 ? "success" : "default"}
              action={
                <Button variant="outline" onClick={() => document.getElementById("minha-jornada")?.scrollIntoView({ behavior: "smooth" })}>
                  Ver jornada <ChevronRight className="h-4 w-4" />
                </Button>
              }
            />
          ) : null}
        </div>
      </section>

      <SectionBlock
        id="checkin"
        eyebrow="Hoje"
        title="Como você está chegando para o trabalho?"
        description="Um registro rápido para acompanhar sua percepção ao longo do tempo."
        icon={<ClipboardCheck className="h-5 w-5" />}
      >
        <div className="mx-auto max-w-3xl">
          <CheckIn session={session} />
        </div>
      </SectionBlock>

      <SectionBlock
        id="comunicacao"
        eyebrow="Comunicação"
        title="O que está acontecendo por aqui"
        description="Comunicados, notícias e recados da sua unidade em uma leitura única e organizada."
        icon={<Megaphone className="h-5 w-5" />}
      >
        <div id="mural" className="grid gap-6 scroll-mt-24">
          <div>
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-foreground">Mural da equipe</h3>
                <p className="mt-1 text-xs text-muted-foreground">Últimos recados e novidades da unidade.</p>
              </div>
              <StatusPill>{visibleMural.length} publicações</StatusPill>
            </div>
            <div className="mt-3 overflow-hidden rounded-xl border border-border bg-background">
              {visibleMural.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma publicação no mural.</p>
              ) : (
                visibleMural.map((item) => (
                  <div key={item.id} className="flex gap-3 border-b border-border px-4 py-4 last:border-b-0 sm:px-5">
                    <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-card text-lg ring-1 ring-border">{item.emoji || "•"}</span>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                        <p className="font-bold text-foreground">{item.titulo}</p>
                        <span className="text-xs text-muted-foreground">{item.autor}</span>
                      </div>
                      <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.mensagem}</p>
                    </div>
                    <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{dateOnly(item.data)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div id="noticias" className="scroll-mt-24 border-t border-border pt-6">
            <div className="flex items-center justify-between gap-3">
              <div>
                <h3 className="font-bold text-foreground">Notícias e vídeos</h3>
                <p className="mt-1 text-xs text-muted-foreground">Conteúdos publicados pelo RH.</p>
              </div>
              <StatusPill>{noticias.length} publicados</StatusPill>
            </div>
            <div className="mt-3 grid gap-4">
              {latestNews.length === 0 ? (
                <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma notícia publicada.</p>
              ) : (
                latestNews.map((news) => {
                  const embed = news.videoUrl ? youtubeEmbed(news.videoUrl) : null;
                  return (
                    <article key={news.id} className="overflow-hidden rounded-xl border border-border bg-background lg:grid lg:grid-cols-[360px_minmax(0,1fr)]">
                      <div className="aspect-video bg-muted lg:aspect-auto lg:min-h-[205px]">
                        {embed ? (
                          <iframe className="h-full w-full" src={embed} title={news.titulo} allowFullScreen />
                        ) : news.imagemUrl ? (
                          <img src={news.imagemUrl} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <div className="grid h-full min-h-40 place-items-center"><PlayCircle className="h-10 w-10 text-muted-foreground/40" /></div>
                        )}
                      </div>
                      <div className="flex flex-col justify-center p-5 sm:p-6">
                        <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">{dateOnly(news.data)}</p>
                        <h4 className="mt-2 text-lg font-extrabold text-foreground">{news.titulo}</h4>
                        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{news.resumo}</p>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </div>

          {birthdays.length > 0 ? (
            <div className="border-t border-border pt-6">
              <h3 className="font-bold text-foreground">Aniversariantes do mês</h3>
              <div className="mt-3 flex flex-wrap gap-2">
                {birthdays.map((person) => (
                  <span key={person.id} className="inline-flex items-center gap-2 rounded-full border border-border bg-background px-3 py-2 text-sm">
                    <span>🎂</span><span className="font-semibold">{person.nome}</span><span className="text-xs text-muted-foreground">{dateOnly(person.nascimento)}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      </SectionBlock>

      <div id="politicas" className="scroll-mt-24">
        <Documentos session={session} defaultOpen />
      </div>

      <SectionBlock
        id="minha-jornada"
        eyebrow="Minha jornada"
        title="Integração e reconhecimento"
        description="Acompanhe sua etapa atual, o que já foi concluído e os reconhecimentos registrados no seu histórico."
        icon={<HeartHandshake className="h-5 w-5" />}
        action={
          <Button variant="outline" size="sm" onClick={() => setRecognitionOpen(true)}>
            <MessageSquareHeart className="h-4 w-4" /> Reconhecer colega
          </Button>
        }
      >
        <div className="grid gap-6">
          {onboarding ? (
            <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Onboarding / experiência</p>
                  <h3 className="mt-1 text-lg font-extrabold">{ONBOARDING_LABEL[onboarding.status] ?? onboarding.status}</h3>
                  {onboarding.observacao ? <p className="mt-1 text-sm text-muted-foreground">{onboarding.observacao}</p> : null}
                  {buddy ? <p className="mt-2 text-xs text-muted-foreground">Pessoa de apoio: <strong className="text-foreground">{buddy.nome}</strong></p> : null}
                </div>
                <div className="text-left sm:text-right">
                  <StatusPill>{checklistProgress}% concluído</StatusPill>
                  <p className="mt-2 text-xs text-muted-foreground">Fim previsto: {dateOnly(onboarding.experiencia_fim_em)}</p>
                </div>
              </div>
              <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#5a1e2d] transition-all" style={{ width: `${checklistProgress}%` }} /></div>
              <div className="mt-4 grid gap-2">
                {checklist.map((item) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-sm">
                    <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${item.concluido ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground"}`}>
                      {item.concluido ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-3.5 w-3.5" />}
                    </span>
                    <span className={item.concluido ? "text-muted-foreground" : "font-medium text-foreground"}>{item.label}</span>
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Não há onboarding ativo vinculado ao seu cadastro.</p>
          )}

          <div>
            <div className="flex items-center justify-between gap-3">
              <h3 className="font-bold text-foreground">Reconhecimentos recebidos</h3>
              <StatusPill>{recognitions.length} registro(s)</StatusPill>
            </div>
            <div className="mt-2 rounded-xl border border-border bg-background px-4 sm:px-5">
              {recognitions.length === 0 ? (
                <p className="py-7 text-center text-sm text-muted-foreground">Nenhum reconhecimento registrado ainda.</p>
              ) : (
                recognitions.map((item) => (
                  <RecordRow
                    key={item.id}
                    title={item.elogio_cliente ? "Elogio de cliente" : "Reconhecimento"}
                    body={item.motivo}
                    meta={dateOnly(item.created_at)}
                    badge={item.status === "destaque" ? <StatusPill tone="success">Destaque</StatusPill> : undefined}
                  />
                ))
              )}
            </div>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        id="feedback"
        eyebrow="Escuta e registros"
        title="Fale, acompanhe e consulte seu histórico"
        description="Feedbacks, sugestões e pedidos de apoio ficam reunidos aqui, com status e devolutivas."
        icon={<MessagesSquare className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setFeedbackOpen(true)}><MessagesSquare className="h-4 w-4" /> Novo feedback</Button>
            <Button size="sm" variant="outline" onClick={() => setSuggestionOpen(true)}><Lightbulb className="h-4 w-4" /> Sugestão</Button>
            <Button size="sm" variant="outline" onClick={() => setSupportOpen(true)}><MessageCircle className="h-4 w-4" /> Apoio RH</Button>
          </div>
        }
      >
        <div className="grid gap-6">
          <div>
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Feedbacks e ocorrências</h3><StatusPill>{employeeFeedbacks.length} registro(s)</StatusPill></div>
            <div className="mt-2 rounded-xl border border-border bg-background px-4 sm:px-5">
              {employeeFeedbacks.length === 0 ? <p className="py-7 text-center text-sm text-muted-foreground">Nenhum feedback registrado.</p> : employeeFeedbacks.slice(0, 8).map((item) => (
                <RecordRow key={item.id} title={item.tipo} body={item.mensagem} meta={dateTime(item.ts)} badge={<StatusPill tone={item.status === "concluido" ? "success" : "default"}>{item.status?.replaceAll("-", " ") ?? "em andamento"}</StatusPill>} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Pedidos de apoio</h3><StatusPill>{employeeSupport.length} pedido(s)</StatusPill></div>
            <div className="mt-2 rounded-xl border border-border bg-background px-4 sm:px-5">
              {employeeSupport.length === 0 ? <p className="py-7 text-center text-sm text-muted-foreground">Nenhum pedido de apoio registrado.</p> : employeeSupport.slice(0, 6).map((item) => {
                const latest = employeeSupportNotes.find((note) => note.pedidoId === item.id);
                return <RecordRow key={item.id} title={item.assunto} body={latest ? `Última devolutiva: ${latest.texto}` : "Aguardando devolutiva do RH."} meta={dateTime(item.ts)} badge={<StatusPill tone={item.status === "resolvido" ? "success" : "default"}>{item.status?.replaceAll("-", " ") ?? "em andamento"}</StatusPill>} />;
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Caixinha de sugestões</h3><StatusPill>{sugestoes.length} protocolo(s)</StatusPill></div>
            <div className="mt-2 rounded-xl border border-border bg-background px-4 sm:px-5">
              {sugestoes.length === 0 ? <p className="py-7 text-center text-sm text-muted-foreground">Nenhuma sugestão enviada ainda.</p> : sugestoes.slice(0, 6).map((item) => (
                <RecordRow key={item.id} title={item.categoria} body={item.mensagem} meta={dateTime(item.ts)} badge={<StatusPill>{item.status?.replaceAll("-", " ") ?? "enviado"}</StatusPill>} />
              ))}
            </div>
          </div>
        </div>
      </SectionBlock>

      <SectionBlock
        id="historico-checkins"
        eyebrow="Histórico"
        title="Seus check-ins anteriores"
        description="Uma linha do tempo simples, sem misturar com os demais módulos."
        icon={<History className="h-5 w-5" />}
      >
        <div className="overflow-hidden rounded-xl border border-border bg-background">
          {employeeCheckins.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-muted-foreground">Nenhum check-in registrado.</p>
          ) : (
            employeeCheckins.slice(0, 12).map((item) => {
              const mood = HUMORES.find((entry) => entry.id === item.humor);
              return (
                <div key={item.id} className="grid gap-2 border-b border-border px-4 py-3.5 last:border-b-0 sm:grid-cols-[150px_150px_minmax(0,1fr)] sm:items-center sm:px-5">
                  <span className="text-sm font-semibold">{mood?.emoji ?? "•"} {mood?.label ?? item.humor}</span>
                  <span className="text-xs text-muted-foreground">{dateTime(item.ts)}</span>
                  <span className="text-sm text-muted-foreground">{item.recado || "Sem comentário"}</span>
                </div>
              );
            })
          )}
        </div>
      </SectionBlock>

      {completedSurveys.length > 0 ? (
        <p className="flex items-center justify-center gap-2 pb-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Pesquisas anônimas registram participação separadamente das respostas.</p>
      ) : null}

      <Dialog open={!!surveyOpen} onOpenChange={(open) => { if (!open) { setSurveyOpen(null); setAnswers({}); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{surveyOpen?.titulo ?? "Pesquisa"}</DialogTitle>
            <DialogDescription>{surveyOpen?.descricao ?? "Responda às perguntas abaixo."}</DialogDescription>
          </DialogHeader>
          {surveyOpen ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                {surveyOpen.anonima ? <StatusPill>Pesquisa anônima</StatusPill> : null}
                {surveyOpen.prazo ? <span>Prazo: {dateOnly(surveyOpen.prazo)}</span> : null}
              </div>
              {questions.filter((question) => question.pesquisa_id === surveyOpen.id).map((question) => (
                <div key={question.id} className="grid gap-2.5">
                  <Label>{question.pergunta}{question.obrigatoria ? " *" : ""}</Label>
                  {question.tipo === "sim_nao" ? (
                    <div className="flex gap-2">
                      {["Sim", "Não"].map((value) => (
                        <button key={value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))} className={`min-h-11 rounded-lg border px-5 text-sm font-bold ${answers[question.id] === value ? "border-[#5a1e2d] bg-[#f4e9ed] text-[#5a1e2d]" : "border-border bg-card text-muted-foreground"}`}>{value}</button>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">
                      {[1, 2, 3, 4, 5].map((value) => (
                        <button key={value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: String(value) }))} className={`min-h-11 rounded-lg border text-sm font-bold ${answers[question.id] === String(value) ? "border-[#5a1e2d] bg-[#f4e9ed] text-[#5a1e2d]" : "border-border bg-card text-muted-foreground"}`}>{value}</button>
                      ))}
                    </div>
                  )}
                </div>
              ))}
              <Button size="lg" disabled={surveySending} onClick={() => void submitSurvey(surveyOpen)}>{surveySending ? "Enviando..." : "Enviar respostas"}</Button>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog open={feedbackOpen} onOpenChange={setFeedbackOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Novo feedback ou ocorrência</DialogTitle><DialogDescription>Relatos sensíveis seguem primeiro para triagem do RH.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Tipo</Label><select value={feedbackType} onChange={(event) => setFeedbackType(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-sm">{FEEDBACK_TIPOS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            {FEEDBACK_SENSITIVE.has(feedbackType) ? <div className="grid gap-2"><Label>Quando aconteceu?</Label><Input type="date" value={feedbackFactDate} onChange={(event) => setFeedbackFactDate(event.target.value)} /></div> : null}
            <div className="grid gap-2"><Label>Conte o que aconteceu</Label><Textarea rows={5} value={feedbackMessage} onChange={(event) => setFeedbackMessage(event.target.value)} placeholder="Descreva de forma objetiva." /></div>
            <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={feedbackAnonymous} onChange={(event) => setFeedbackAnonymous(event.target.checked)} /> Enviar de forma anônima</label>
            <Button disabled={feedbackSending || feedbackMessage.trim().length < 3} onClick={() => void sendFeedback()}>{feedbackSending ? "Enviando..." : "Enviar registro"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={suggestionOpen} onOpenChange={setSuggestionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Enviar sugestão</DialogTitle><DialogDescription>Sua sugestão entra no fluxo de análise do RH e pode receber devolutiva.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Categoria</Label><select value={suggestionCategory} onChange={(event) => setSuggestionCategory(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-sm">{SUGESTAO_CATEGORIAS.map((item) => <option key={item} value={item}>{item}</option>)}</select></div>
            <div className="grid gap-2"><Label>Sugestão</Label><Textarea rows={5} value={suggestionMessage} onChange={(event) => setSuggestionMessage(event.target.value)} /></div>
            <Button disabled={suggestionSending || suggestionMessage.trim().length < 3} onClick={() => void sendSuggestion()}>{suggestionSending ? "Enviando..." : "Enviar sugestão"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={supportOpen} onOpenChange={setSupportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Pedir apoio ao RH</DialogTitle><DialogDescription>Este pedido entra diretamente no fluxo confidencial do RH.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Como podemos ajudar?</Label><Textarea rows={5} value={supportMessage} onChange={(event) => setSupportMessage(event.target.value)} placeholder="Conte o necessário para o RH entender seu pedido." /></div>
            <Button disabled={supportSending || supportMessage.trim().length < 3} onClick={() => void sendSupport()}>{supportSending ? "Registrando..." : "Registrar pedido"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={recognitionOpen} onOpenChange={setRecognitionOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Reconhecer um colega</DialogTitle><DialogDescription>Registre uma atitude positiva de alguém da sua unidade.</DialogDescription></DialogHeader>
          <div className="grid gap-4">
            <div className="grid gap-2"><Label>Quem você quer reconhecer?</Label><select value={recognitionPerson} onChange={(event) => setRecognitionPerson(event.target.value)} className="h-11 rounded-md border border-input bg-background px-3 text-sm"><option value="">Selecione...</option>{availablePeers.map((person) => <option key={person.id} value={person.id}>{person.nome}{person.cargo ? ` · ${person.cargo}` : ""}</option>)}</select></div>
            <div className="grid gap-2"><Label>O que essa pessoa fez?</Label><Textarea rows={4} value={recognitionReason} onChange={(event) => setRecognitionReason(event.target.value)} /></div>
            <Button disabled={recognitionSending || !recognitionPerson || recognitionReason.trim().length < 3} onClick={() => void sendRecognition()}>{recognitionSending ? "Enviando..." : "Enviar reconhecimento"}</Button>
          </div>
        </DialogContent>
      </Dialog>

      {surveys.filter((survey) => survey.modo === "externa" && survey.link && !surveyAnswered(survey)).map((survey) => (
        <div key={`external-confirm-${survey.id}`} className="hidden">
          <button onClick={() => void markExternalAnswered(survey)}>Já respondi</button>
        </div>
      ))}
    </div>
  );
}
