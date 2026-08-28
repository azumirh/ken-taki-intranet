import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  ExternalLink,
  HeartHandshake,
  History,
  Lightbulb,
  Megaphone,
  MessageCircle,
  MessageSquareHeart,
  MessagesSquare,
  PlayCircle,
  ShieldCheck,
  Star,
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
  youtubeEmbed,
} from "@/lib/kt-data";
import {
  uid,
  useAjuda,
  useAnotacoesApoio,
  useCheckins,
  useColaboradores,
  useFeedbacks,
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

const FEEDBACK_SENSITIVE = new Set(["Crítica", "Reclamação", "Denúncia", "Situação urgente"]);
const ACTIVE_ONBOARDING = new Set(["pre_admissao", "documentacao_pendente", "primeira_semana", "experiencia"]);
const ONBOARDING_LABEL: Record<string, string> = {
  pre_admissao: "Pré-admissão",
  documentacao_pendente: "Documentação pendente",
  primeira_semana: "Primeira semana",
  experiencia: "Período de experiência",
};

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

function StatusPill({ children, success = false, warning = false }: { children: ReactNode; success?: boolean; warning?: boolean }) {
  const style = success
    ? "bg-success/10 text-success"
    : warning
      ? "bg-warn-soft text-warn"
      : "bg-muted text-muted-foreground";
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-bold ${style}`}>{children}</span>;
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

export function EmployeeDashboardV3() {
  const [session] = useSession();
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
              .in("pesquisa_id", surveyRows.filter((survey) => survey.modo === "interna").map((survey) => survey.id))
              .order("ordem")
          : Promise.resolve({ data: [], error: null }),
      ]);
      if (checklistResult.error) throw checklistResult.error;
      if (questionResult.error) throw questionResult.error;
      setChecklist((checklistResult.data ?? []) as Checklist[]);
      setQuestions((questionResult.data ?? []) as Question[]);
    } catch (error) {
      console.warn("[employee-dashboard-v3] load", error);
    }
  }, [session]);

  useEffect(() => {
    void loadJourney();
  }, [loadJourney]);

  const visibleMural = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return [];
    return mural
      .filter((item) => !item.filial || item.filial === "todas" || item.filial === session.filial)
      .sort((a, b) => String(b.data).localeCompare(String(a.data)));
  }, [mural, session]);

  const employeeCheckins = useMemo(
    () =>
      checkins
        .filter((item) => session?.tipo === "colaborador" && item.nome === session.nome)
        .sort((a, b) => b.ts - a.ts),
    [checkins, session],
  );

  const employeeFeedbacks = useMemo(
    () =>
      feedbacks
        .filter((item) => session?.tipo === "colaborador" && item.autor === session.nome)
        .sort((a, b) => b.ts - a.ts),
    [feedbacks, session],
  );

  const employeeSupport = useMemo(
    () =>
      ajuda
        .filter((item) => session?.tipo === "colaborador" && item.nome === session.nome)
        .sort((a, b) => b.ts - a.ts),
    [ajuda, session],
  );

  const employeeSupportNotes = useMemo(() => {
    const ids = new Set(employeeSupport.map((item) => item.id));
    return anotacoes.filter((item) => ids.has(item.pedidoId)).sort((a, b) => b.criadoEm - a.criadoEm);
  }, [anotacoes, employeeSupport]);

  const availablePeers = useMemo(
    () =>
      colaboradores.filter(
        (item) => session?.tipo === "colaborador" && item.filial === session.filial && item.id !== employeeId,
      ),
    [colaboradores, employeeId, session],
  );

  const activeOnboarding = onboarding && ACTIVE_ONBOARDING.has(onboarding.status) ? onboarding : null;
  const checklistProgress = checklist.length
    ? Math.round((checklist.filter((item) => item.concluido).length / checklist.length) * 100)
    : 0;
  const buddy = activeOnboarding?.buddy_colaborador_id
    ? colaboradores.find((item) => item.id === activeOnboarding.buddy_colaborador_id)
    : null;

  const surveyAnswered = (survey: Survey) => {
    if (!session || session.tipo !== "colaborador") return false;
    if (survey.modo === "interna") return answered.has(survey.id);
    return (survey.respondeu ?? []).includes(session.nome);
  };

  const latestNews = noticias.slice(0, 3);

  async function submitSurvey(survey: Survey) {
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
    if (error) { toast.error("Não foi possível registrar a confirmação agora."); return; }
    setSurveys((current) => current.map((item) => item.id === survey.id ? { ...item, respondeu: nextNames, respondeu_ts: nextTimes } : item));
    toast.success("Pesquisa marcada como respondida.");
  }

  async function sendFeedback() {
    if (!session || session.tipo !== "colaborador" || feedbackMessage.trim().length < 3) return;
    const sensitive = FEEDBACK_SENSITIVE.has(feedbackType);
    if (sensitive && !feedbackFactDate) { toast.error("Informe a data da situação para este tipo de relato."); return; }
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
      <style>{`
        [data-employee-workspace] > #minha-jornada{display:none!important}
        #employee-checkin-clean .relative.pt-2 > .absolute{display:none!important}
      `}</style>

      <div id="employee-checkin-clean" className="scroll-mt-24">
        <CheckIn session={session} />
      </div>

      {activeOnboarding ? (
        <SectionBlock
          id="integracao"
          eyebrow="Para quem está chegando"
          title="Sua integração"
          description="Este bloco aparece somente enquanto houver onboarding ou período de experiência ativo."
          icon={<HeartHandshake className="h-5 w-5" />}
        >
          <div className="rounded-xl border border-border bg-background p-4 sm:p-5">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div>
                <p className="text-lg font-extrabold">{ONBOARDING_LABEL[activeOnboarding.status] ?? activeOnboarding.status}</p>
                {activeOnboarding.observacao ? <p className="mt-1 text-sm text-muted-foreground">{activeOnboarding.observacao}</p> : null}
                {buddy ? <p className="mt-2 text-xs text-muted-foreground">Pessoa de apoio: <strong className="text-foreground">{buddy.nome}</strong></p> : null}
              </div>
              <div className="text-left sm:text-right">
                <StatusPill>{checklistProgress}% concluído</StatusPill>
                <p className="mt-2 text-xs text-muted-foreground">Fim previsto: {dateOnly(activeOnboarding.experiencia_fim_em)}</p>
              </div>
            </div>
            <div className="mt-4 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-[#5a1e2d]" style={{ width: `${checklistProgress}%` }} /></div>
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {checklist.map((item) => (
                <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border bg-card px-3.5 py-3 text-sm">
                  <span className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border ${item.concluido ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground"}`}>
                    {item.concluido ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-3.5 w-3.5" />}
                  </span>
                  <span className={item.concluido ? "text-muted-foreground" : "font-medium"}>{item.label}</span>
                </div>
              ))}
            </div>
          </div>
        </SectionBlock>
      ) : null}

      <SectionBlock
        id="pesquisa-clima"
        eyebrow="Pesquisa de clima"
        title="Sua opinião sobre o ambiente de trabalho"
        description="Aqui você vê claramente se há pesquisa disponível, o prazo e se sua participação já foi registrada."
        icon={<ClipboardCheck className="h-5 w-5" />}
      >
        {surveys.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma pesquisa de clima ativa no momento.</div>
        ) : (
          <div className="grid gap-3">
            {surveys.map((survey) => {
              const done = surveyAnswered(survey);
              return (
                <article key={survey.id} className="flex flex-col gap-4 rounded-xl border border-border bg-background p-4 sm:flex-row sm:items-center sm:justify-between sm:p-5">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="font-extrabold text-foreground">{survey.titulo}</h3>
                      <StatusPill success={done} warning={!done}>{done ? "Respondida" : "Pendente"}</StatusPill>
                      {survey.anonima ? <StatusPill>Anônima</StatusPill> : null}
                    </div>
                    {survey.descricao ? <p className="mt-1.5 max-w-3xl text-sm leading-relaxed text-muted-foreground">{survey.descricao}</p> : null}
                    {survey.prazo ? <p className="mt-2 text-xs font-medium text-muted-foreground">Prazo: {dateOnly(survey.prazo)}</p> : null}
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    {done ? (
                      <span className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-success/10 px-4 text-sm font-bold text-success"><CheckCircle2 className="h-4 w-4" /> Participação registrada</span>
                    ) : survey.modo === "externa" && survey.link ? (
                      <>
                        <a href={survey.link} target="_blank" rel="noreferrer" className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[#4b1736] px-4 text-sm font-bold text-white hover:bg-[#351526]">Responder pesquisa <ExternalLink className="h-4 w-4" /></a>
                        <Button variant="outline" onClick={() => void markExternalAnswered(survey)}>Já respondi</Button>
                      </>
                    ) : (
                      <Button className="bg-[#4b1736] text-white hover:bg-[#351526]" onClick={() => { setAnswers({}); setSurveyOpen(survey); }}>
                        Responder pesquisa
                      </Button>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        id="mural"
        eyebrow="Comunicação"
        title="O que está acontecendo por aqui"
        description="A publicação mais recente fica primeiro. Arraste horizontalmente para consultar comunicados anteriores."
        icon={<Megaphone className="h-5 w-5" />}
        action={<StatusPill>{visibleMural.length} publicações</StatusPill>}
      >
        {visibleMural.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma publicação no mural.</div>
        ) : (
          <div className="-mx-1 flex snap-x snap-mandatory gap-4 overflow-x-auto overscroll-x-contain px-1 pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {visibleMural.map((item) => (
              <article key={item.id} className="w-[82vw] max-w-[360px] shrink-0 snap-start rounded-xl border border-border bg-background p-5 sm:w-[330px]">
                <div className="flex items-start gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-card text-lg ring-1 ring-border">{item.emoji || "•"}</span>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                      <p className="font-extrabold text-foreground">{item.titulo}</p>
                      <span className="text-[11px] text-muted-foreground">{item.autor}</span>
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.mensagem}</p>
                    <p className="mt-3 text-xs text-muted-foreground">{dateOnly(item.data)}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}
      </SectionBlock>

      <SectionBlock
        id="noticias"
        eyebrow="Conteúdo"
        title="Notícias e vídeos"
        description="Vídeos e comunicados publicados pelo RH em um espaço separado do mural."
        icon={<PlayCircle className="h-5 w-5" />}
        action={<StatusPill>{noticias.length} publicados</StatusPill>}
      >
        {latestNews.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border px-4 py-8 text-center text-sm text-muted-foreground">Nenhuma notícia publicada.</div>
        ) : (
          <div className="grid gap-4 lg:grid-cols-3">
            {latestNews.map((news) => {
              const embed = news.videoUrl ? youtubeEmbed(news.videoUrl) : null;
              return (
                <article key={news.id} className="flex min-w-0 flex-col overflow-hidden rounded-xl border border-border bg-background">
                  <div className="p-4 pb-3">
                    <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-muted-foreground">{dateOnly(news.data)}</p>
                    <h3 className="mt-1.5 font-extrabold leading-snug text-foreground">{news.titulo}</h3>
                    <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{news.resumo}</p>
                  </div>
                  <div className="aspect-video bg-muted">
                    {embed ? (
                      <iframe className="h-full w-full" src={embed} title={news.titulo} allowFullScreen />
                    ) : news.imagemUrl ? (
                      <img src={news.imagemUrl} alt="" className="h-full w-full object-cover" />
                    ) : (
                      <div className="grid h-full place-items-center"><PlayCircle className="h-10 w-10 text-muted-foreground/40" /></div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </SectionBlock>

      <Documentos session={session} defaultOpen />

      <SectionBlock
        id="reconhecimentos"
        eyebrow="Reconhecimento"
        title="Reconhecimentos recebidos"
        description="Elogios e reconhecimentos ficam separados da integração e entram no seu histórico positivo."
        icon={<Star className="h-5 w-5" />}
        action={<StatusPill>{recognitions.length} registro(s)</StatusPill>}
      >
        <div className="rounded-xl border border-border bg-background px-4 sm:px-5">
          {recognitions.length === 0 ? (
            <p className="py-7 text-center text-sm text-muted-foreground">Nenhum reconhecimento registrado ainda.</p>
          ) : (
            recognitions.map((item) => (
              <div key={item.id} className="flex gap-3 border-b border-border py-4 last:border-b-0">
                <Star className="mt-0.5 h-5 w-5 shrink-0 fill-current text-[#a96c19]" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-bold">{item.elogio_cliente ? "Elogio de cliente" : "Reconhecimento"}</p>
                    {item.status === "destaque" ? <StatusPill success>Destaque</StatusPill> : null}
                  </div>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{item.motivo}</p>
                </div>
                <span className="hidden shrink-0 text-xs text-muted-foreground sm:block">{dateOnly(item.created_at)}</span>
              </div>
            ))
          )}
        </div>
      </SectionBlock>

      <SectionBlock
        id="feedback"
        eyebrow="Escuta e registros"
        title="Feedbacks e ocorrências"
        description="Registre feedbacks, reconheça alguém, envie sugestões ou peça apoio ao RH; depois acompanhe tudo no histórico."
        icon={<MessagesSquare className="h-5 w-5" />}
        action={
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => setFeedbackOpen(true)}><MessagesSquare className="h-4 w-4" /> Novo feedback</Button>
            <Button size="sm" variant="outline" onClick={() => setRecognitionOpen(true)}><MessageSquareHeart className="h-4 w-4" /> Reconhecer alguém</Button>
            <Button size="sm" variant="outline" onClick={() => setSuggestionOpen(true)}><Lightbulb className="h-4 w-4" /> Sugestão</Button>
            <Button size="sm" variant="outline" onClick={() => setSupportOpen(true)}><MessageCircle className="h-4 w-4" /> Apoio RH</Button>
          </div>
        }
      >
        <div className="grid gap-6">
          <div>
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Seus feedbacks e ocorrências</h3><StatusPill>{employeeFeedbacks.length} registro(s)</StatusPill></div>
            <div className="mt-2 rounded-xl border border-border bg-background px-4 sm:px-5">
              {employeeFeedbacks.length === 0 ? <p className="py-7 text-center text-sm text-muted-foreground">Nenhum feedback registrado.</p> : employeeFeedbacks.slice(0, 8).map((item) => (
                <RecordRow key={item.id} title={item.tipo} body={item.mensagem} meta={dateTime(item.ts)} badge={<StatusPill success={item.status === "concluido"}>{item.status?.replaceAll("-", " ") ?? "em andamento"}</StatusPill>} />
              ))}
            </div>
          </div>

          <div>
            <div className="flex items-center justify-between gap-3"><h3 className="font-bold">Pedidos de apoio</h3><StatusPill>{employeeSupport.length} pedido(s)</StatusPill></div>
            <div className="mt-2 rounded-xl border border-border bg-background px-4 sm:px-5">
              {employeeSupport.length === 0 ? <p className="py-7 text-center text-sm text-muted-foreground">Nenhum pedido de apoio registrado.</p> : employeeSupport.slice(0, 6).map((item) => {
                const latest = employeeSupportNotes.find((note) => note.pedidoId === item.id);
                return <RecordRow key={item.id} title={item.assunto} body={latest ? `Última devolutiva: ${latest.texto}` : "Aguardando devolutiva do RH."} meta={dateTime(item.ts)} badge={<StatusPill success={item.status === "resolvido"}>{item.status?.replaceAll("-", " ") ?? "em andamento"}</StatusPill>} />;
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
        description="Consulte seus registros anteriores sem misturar com os demais módulos."
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

      <p className="flex items-center justify-center gap-2 pb-1 text-xs text-muted-foreground"><ShieldCheck className="h-3.5 w-3.5" /> Pesquisas anônimas registram participação separadamente das respostas.</p>

      <Dialog open={!!surveyOpen} onOpenChange={(open) => { if (!open) { setSurveyOpen(null); setAnswers({}); } }}>
        <DialogContent className="max-h-[88vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>{surveyOpen?.titulo ?? "Pesquisa de clima"}</DialogTitle><DialogDescription>{surveyOpen?.descricao ?? "Responda às perguntas abaixo."}</DialogDescription></DialogHeader>
          {surveyOpen ? (
            <div className="grid gap-5">
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">{surveyOpen.anonima ? <StatusPill>Pesquisa anônima</StatusPill> : null}{surveyOpen.prazo ? <span>Prazo: {dateOnly(surveyOpen.prazo)}</span> : null}</div>
              {questions.filter((question) => question.pesquisa_id === surveyOpen.id).map((question) => (
                <div key={question.id} className="grid gap-2.5">
                  <Label>{question.pergunta}{question.obrigatoria ? " *" : ""}</Label>
                  {question.tipo === "sim_nao" ? (
                    <div className="flex gap-2">{["Sim", "Não"].map((value) => <button key={value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))} className={`min-h-11 rounded-lg border px-5 text-sm font-bold ${answers[question.id] === value ? "border-[#5a1e2d] bg-[#f4e9ed] text-[#5a1e2d]" : "border-border bg-card text-muted-foreground"}`}>{value}</button>)}</div>
                  ) : (
                    <div className="grid grid-cols-5 gap-2">{[1, 2, 3, 4, 5].map((value) => <button key={value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: String(value) }))} className={`min-h-11 rounded-lg border text-sm font-bold ${answers[question.id] === String(value) ? "border-[#5a1e2d] bg-[#f4e9ed] text-[#5a1e2d]" : "border-border bg-card text-muted-foreground"}`}>{value}</button>)}</div>
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
    </div>
  );
}
