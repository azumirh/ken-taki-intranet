import { useCallback, useEffect, useMemo, useState } from "react";
import { HeartHandshake, ListChecks, MessageSquareHeart } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";

type DirectoryPerson = { id: string; nome: string; cargo: string | null; filial: string };
type Employee = { id: string; nome: string; filial: string; cargo: string | null };
type Recognition = { id: string; colaborador_id: string; motivo: string; elogio_cliente: boolean; destaque_mes: string | null; status: string; created_at: string };
type Onboarding = { id: string; inicio_em: string; status: string; experiencia_fim_em: string | null; observacao: string | null };
type Checklist = { id: string; onboarding_id: string; label: string; categoria: string; concluido: boolean };
type Survey = { id: string; titulo: string; descricao: string | null; prazo: string | null; anonima: boolean; filial_alvo: string | null };
type Question = { id: string; pesquisa_id: string; pergunta: string; tipo: string; ordem: number; obrigatoria: boolean };
type Participation = { pesquisa_id: string };

function dateOnly(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(`${value.slice(0, 10)}T12:00:00`).toLocaleDateString("pt-BR");
}

export function EmployeeJourneyCenter() {
  const [employee, setEmployee] = useState<Employee | null>(null);
  const [directory, setDirectory] = useState<DirectoryPerson[]>([]);
  const [recognitions, setRecognitions] = useState<Recognition[]>([]);
  const [onboarding, setOnboarding] = useState<Onboarding | null>(null);
  const [checklist, setChecklist] = useState<Checklist[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answered, setAnswered] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [recognizePerson, setRecognizePerson] = useState("");
  const [recognizeReason, setRecognizeReason] = useState("");
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [sendingSurvey, setSendingSurvey] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: employeeIdResult, error: employeeIdError } = await supabase.rpc("kt_current_employee_id");
      if (employeeIdError) throw employeeIdError;
      const employeeId = employeeIdResult as string | null;
      if (!employeeId) return;

      const [employeeResult, directoryResult, recognitionResult, onboardingResult, surveyResult, participationResult] = await Promise.all([
        supabase.from("kt_colaboradores").select("id,nome,filial,cargo").eq("id", employeeId).maybeSingle(),
        supabase.rpc("kt_employee_feedback_directory"),
        supabase.from("kt_reconhecimentos").select("id,colaborador_id,motivo,elogio_cliente,destaque_mes,status,created_at").eq("colaborador_id", employeeId).order("created_at", { ascending: false }).limit(40),
        supabase.from("kt_onboardings").select("id,inicio_em,status,experiencia_fim_em,observacao").eq("colaborador_id", employeeId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
        supabase.from("kt_pesquisas").select("id,titulo,descricao,prazo,anonima,filial_alvo").eq("modo", "interna").eq("ativa", true).order("ts", { ascending: false }),
        supabase.from("kt_pesquisa_participacoes").select("pesquisa_id"),
      ]);
      for (const result of [employeeResult, directoryResult, recognitionResult, onboardingResult, surveyResult, participationResult]) if (result.error) throw result.error;
      setEmployee(employeeResult.data as Employee);
      setDirectory(((directoryResult.data ?? []) as DirectoryPerson[]).filter((person) => person.id !== employeeId));
      setRecognitions((recognitionResult.data ?? []) as Recognition[]);
      const currentOnboarding = onboardingResult.data as Onboarding | null;
      setOnboarding(currentOnboarding);
      setSurveys((surveyResult.data ?? []) as Survey[]);
      setAnswered(new Set(((participationResult.data ?? []) as Participation[]).map((item) => item.pesquisa_id)));

      const [checklistResult, questionResult] = await Promise.all([
        currentOnboarding ? supabase.from("kt_onboarding_checklist").select("id,onboarding_id,label,categoria,concluido").eq("onboarding_id", currentOnboarding.id) : Promise.resolve({ data: [], error: null }),
        (surveyResult.data ?? []).length ? supabase.from("kt_pesquisa_perguntas").select("id,pesquisa_id,pergunta,tipo,ordem,obrigatoria").in("pesquisa_id", (surveyResult.data ?? []).map((survey) => survey.id)).order("ordem") : Promise.resolve({ data: [], error: null }),
      ]);
      if (checklistResult.error) throw checklistResult.error;
      if (questionResult.error) throw questionResult.error;
      setChecklist((checklistResult.data ?? []) as Checklist[]);
      setQuestions((questionResult.data ?? []) as Question[]);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível carregar sua jornada.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const directoryById = useMemo(() => new Map(directory.map((person) => [person.id, person])), [directory]);

  async function sendRecognition() {
    if (!employee || !recognizePerson || recognizeReason.trim().length < 3) return;
    const target = directoryById.get(recognizePerson);
    if (!target) return;
    const { error } = await supabase.from("kt_reconhecimentos").insert({
      colaborador_id: target.id,
      filial: target.filial,
      motivo: recognizeReason.trim(),
      elogio_cliente: false,
      registrado_por_colaborador_id: employee.id,
      status: "ativo",
    });
    if (error) { toast.error(error.message); return; }
    setRecognizePerson("");
    setRecognizeReason("");
    toast.success("Reconhecimento enviado.");
  }

  async function submitSurvey(survey: Survey) {
    const surveyQuestions = questions.filter((question) => question.pesquisa_id === survey.id);
    const missing = surveyQuestions.some((question) => question.obrigatoria && !answers[question.id]);
    if (missing) { toast.error("Responda todas as perguntas obrigatórias."); return; }
    setSendingSurvey(survey.id);
    try {
      const payload = surveyQuestions.map((question) => ({ pergunta_id: question.id, resposta: question.tipo === "escala_1_5" ? Number(answers[question.id]) : answers[question.id] }));
      const { error } = await supabase.rpc("kt_submit_internal_survey", { p_pesquisa_id: survey.id, p_respostas: payload });
      if (error) throw error;
      setAnswered((current) => new Set([...current, survey.id]));
      toast.success("Pesquisa enviada. Sua identidade não é gravada junto das respostas.");
    } catch (error) {
      toast.error((error as Error).message);
    } finally {
      setSendingSurvey(null);
    }
  }

  if (loading || !employee) return null;

  return <section id="minha-jornada" className="mt-5 scroll-mt-24">
    <div className="mb-3 flex items-center gap-2"><ListChecks className="h-4 w-4 text-kt" /><h2 className="text-base font-bold">Minha jornada</h2></div>
    <div className="grid gap-4 lg:grid-cols-2">
      {onboarding ? <div className="surface p-4 sm:p-5"><div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Onboarding / experiência</p><h3 className="mt-1 font-bold">Etapa: {onboarding.status.replaceAll("_", " ")}</h3></div><span className="rounded-md bg-muted px-2 py-1 text-[10px] font-bold">Fim previsto {dateOnly(onboarding.experiencia_fim_em)}</span></div>{onboarding.observacao ? <p className="mt-2 text-sm text-muted-foreground">{onboarding.observacao}</p> : null}<div className="mt-4 grid gap-2">{checklist.map((item) => <div key={item.id} className="flex items-center gap-2 rounded-md border border-border px-3 py-2 text-xs"><span className={`grid h-5 w-5 place-items-center rounded-full border ${item.concluido ? "border-success bg-success/10 text-success" : "border-border text-muted-foreground"}`}>{item.concluido ? "✓" : ""}</span><span className={item.concluido ? "text-muted-foreground line-through" : ""}>{item.label}</span></div>)}</div><p className="mt-3 text-[11px] text-muted-foreground">A atualização das etapas e do checklist é feita pela gestão/RH. O histórico permanece disponível durante todo o período.</p></div> : <div className="surface p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Onboarding / experiência</p><p className="mt-2 text-sm text-muted-foreground">Não há um onboarding ativo vinculado ao seu cadastro.</p></div>}

      <div className="surface p-4 sm:p-5"><div className="flex items-center gap-2"><HeartHandshake className="h-4 w-4 text-kt" /><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Reconhecimento entre colegas</p><h3 className="mt-0.5 font-bold">Valorize uma boa atitude</h3></div></div><div className="mt-4 grid gap-3"><select value={recognizePerson} onChange={(event) => setRecognizePerson(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm"><option value="">Escolha alguém da sua filial...</option>{directory.map((person) => <option key={person.id} value={person.id}>{person.nome}{person.cargo ? ` · ${person.cargo}` : ""}</option>)}</select><Textarea rows={3} value={recognizeReason} onChange={(event) => setRecognizeReason(event.target.value)} placeholder="Conte de forma objetiva o que essa pessoa fez e por que merece reconhecimento." /><Button disabled={!recognizePerson || recognizeReason.trim().length < 3} onClick={() => void sendRecognition()}><MessageSquareHeart className="h-4 w-4" /> Enviar reconhecimento</Button></div></div>
    </div>

    {recognitions.length > 0 ? <div className="surface mt-4 p-4 sm:p-5"><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Reconhecimentos que você recebeu</p><div className="mt-3 grid gap-2 sm:grid-cols-2">{recognitions.map((item) => <div key={item.id} className="rounded-lg border border-border bg-card p-3"><div className="flex justify-between gap-2"><span className="text-[10px] text-muted-foreground">{new Date(item.created_at).toLocaleDateString("pt-BR")}</span>{item.status === "destaque" ? <span className="rounded bg-success/10 px-2 py-0.5 text-[10px] font-bold text-success">Destaque</span> : null}</div><p className="mt-1 text-sm leading-relaxed">{item.motivo}</p></div>)}</div></div> : null}

    {surveys.length > 0 ? <div className="surface mt-4 p-4 sm:p-5"><div><p className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Pesquisas internas</p><h3 className="mt-1 font-bold">Sua percepção ajuda o RH a acompanhar o ambiente</h3><p className="mt-1 text-xs text-muted-foreground">Nas pesquisas marcadas como anônimas, a participação é registrada separadamente das respostas para impedir duplicidade sem ligar sua identidade ao conteúdo respondido.</p></div><div className="mt-4 grid gap-4">{surveys.map((survey) => { const surveyQuestions = questions.filter((question) => question.pesquisa_id === survey.id); const alreadyAnswered = answered.has(survey.id); return <div key={survey.id} className="rounded-xl border border-border p-4"><div className="flex flex-wrap items-start justify-between gap-2"><div><h4 className="font-semibold">{survey.titulo}</h4>{survey.descricao ? <p className="mt-1 text-sm text-muted-foreground">{survey.descricao}</p> : null}</div><span className="rounded bg-muted px-2 py-1 text-[10px] font-bold">até {dateOnly(survey.prazo)}</span></div>{alreadyAnswered ? <div className="mt-3 rounded-md bg-success/10 px-3 py-2 text-sm font-semibold text-success">Resposta registrada.</div> : <div className="mt-4 grid gap-4">{surveyQuestions.map((question) => <div key={question.id}><p className="text-sm font-medium">{question.pergunta}{question.obrigatoria ? " *" : ""}</p>{question.tipo === "sim_nao" ? <div className="mt-2 flex gap-2">{["Sim", "Não"].map((value) => <button key={value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: value }))} className={`rounded-md border px-4 py-2 text-sm font-semibold ${answers[question.id] === value ? "border-kt bg-kt-soft text-kt" : "border-border bg-card text-muted-foreground"}`}>{value}</button>)}</div> : <div className="mt-2 grid grid-cols-5 gap-2">{[1,2,3,4,5].map((value) => <button key={value} type="button" onClick={() => setAnswers((current) => ({ ...current, [question.id]: String(value) }))} className={`min-h-10 rounded-md border text-sm font-bold ${answers[question.id] === String(value) ? "border-kt bg-kt-soft text-kt" : "border-border bg-card text-muted-foreground"}`}>{value}</button>)}</div>}</div>)}<Button disabled={sendingSurvey === survey.id} onClick={() => void submitSurvey(survey)}>{sendingSurvey === survey.id ? "Enviando..." : "Enviar pesquisa"}</Button></div>}</div>; })}</div></div> : null}
  </section>;
}
