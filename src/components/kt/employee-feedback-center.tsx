import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  CheckCircle2,
  CircleHelp,
  Heart,
  MessageSquareText,
  Send,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { readEmployeeAccess } from "@/lib/employee-session";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";
import { uid, useSession } from "@/lib/kt-store";

type FeedbackType = "Elogio" | "Dúvida" | "Crítica" | "Reclamação" | "Denúncia" | "Situação urgente";
type RecipientType = "gestor" | "colaborador" | "rh" | "outro";

type DirectoryRow = { id: string; nome: string; cargo: string; filial: string };
type HistoryRow = {
  id: string;
  tipo: string;
  mensagem: string;
  anonimo: boolean;
  ts: string;
  status: string | null;
  destino: string | null;
  triagem_rh_status: string | null;
  gestor_liberado: boolean | null;
  comentario_gestor: string | null;
  proxima_acao: string | null;
  encerrado_motivo: string | null;
  destinatario_tipo: string | null;
  destinatario_nome: string | null;
  destinatario_filial: string | null;
  fato_em: string | null;
  testemunhas: string | null;
  protocolo: string | null;
};

const TYPES: Array<{ id: FeedbackType; emoji: string; title: string; body: string; tone: string }> = [
  {
    id: "Elogio",
    emoji: "💚",
    title: "Reconhecer algo bom",
    body: "Que bom reconhecer outra pessoa. Um elogio claro ajuda a reforçar o que funciona bem.",
    tone: "border-success/30 bg-success-soft/55 text-success",
  },
  {
    id: "Dúvida",
    emoji: "❓",
    title: "Uma pergunta ainda sem resposta",
    body: "Escolha se sua dúvida deve ir primeiro para a liderança ou para o RH.",
    tone: "border-warn/30 bg-warn-soft/60 text-warn",
  },
  {
    id: "Crítica",
    emoji: "🟠",
    title: "Algo pode melhorar",
    body: "Críticas construtivas são bem-vindas. O RH acompanha este tipo de registro para preservar contexto e continuidade.",
    tone: "border-orange-300 bg-orange-50 text-orange-700",
  },
  {
    id: "Reclamação",
    emoji: "⚠️",
    title: "Houve uma situação que precisa ser analisada",
    body: "Registre o que aconteceu, quando ocorreu e quem estava envolvido. O RH recebe primeiro para avaliar o contexto.",
    tone: "border-destructive/25 bg-destructive/5 text-destructive",
  },
  {
    id: "Denúncia",
    emoji: "🛡️",
    title: "Relato sensível",
    body: "Inclua o máximo de informações úteis: data, situação, pessoas envolvidas e testemunhas, se houver. O RH faz a triagem antes de envolver a gestão.",
    tone: "border-destructive/35 bg-destructive/7 text-destructive",
  },
  {
    id: "Situação urgente",
    emoji: "🚨",
    title: "Precisa de atenção rápida",
    body: "Descreva o que aconteceu com clareza. O RH é avisado imediatamente e decide o envolvimento da liderança conforme o caso.",
    tone: "border-destructive/40 bg-destructive/10 text-destructive",
  },
];

function isSensitive(type: FeedbackType) {
  return ["Crítica", "Reclamação", "Denúncia", "Situação urgente"].includes(type);
}

function statusLabel(row: HistoryRow) {
  if (row.encerrado_motivo) return "Concluído";
  if (row.triagem_rh_status === "aguardando") return "Em triagem do RH";
  if (row.gestor_liberado) return "Compartilhado com a gestão";
  if (row.proxima_acao) return "Em acompanhamento";
  if (row.status === "concluido") return "Concluído";
  return "Recebido";
}

export function EmployeeFeedbackCenter() {
  const [session] = useSession();
  const [type, setType] = useState<FeedbackType>("Elogio");
  const [recipientType, setRecipientType] = useState<RecipientType>("colaborador");
  const [recipientId, setRecipientId] = useState("");
  const [otherName, setOtherName] = useState("");
  const [otherBranch, setOtherBranch] = useState("cristo-rei");
  const [message, setMessage] = useState("");
  const [factDate, setFactDate] = useState("");
  const [witnesses, setWitnesses] = useState("");
  const [anonymous, setAnonymous] = useState(false);
  const [directory, setDirectory] = useState<DirectoryRow[]>([]);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [sending, setSending] = useState(false);
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<"30" | "90" | "all">("90");

  const access = readEmployeeAccess();
  const selectedType = TYPES.find((item) => item.id === type)!;
  const sensitive = isSensitive(type);

  const loadHistory = async () => {
    if (!access?.colaboradorId) return;
    setLoading(true);
    const { data, error } = await supabase
      .from("kt_feedbacks")
      .select("id,tipo,mensagem,anonimo,ts,status,destino,triagem_rh_status,gestor_liberado,comentario_gestor,proxima_acao,encerrado_motivo,destinatario_tipo,destinatario_nome,destinatario_filial,fato_em,testemunhas,protocolo")
      .eq("colaborador_id", access.colaboradorId)
      .order("ts", { ascending: false });
    setLoading(false);
    if (!error) setHistory((data ?? []) as HistoryRow[]);
  };

  useEffect(() => {
    void supabase.rpc("kt_employee_feedback_directory").then(({ data, error }) => {
      if (!error) setDirectory((data ?? []) as DirectoryRow[]);
    });
    void loadHistory();
  }, [access?.colaboradorId]);

  const filteredHistory = useMemo(() => {
    if (period === "all") return history;
    const min = Date.now() - Number(period) * 86400000;
    return history.filter((row) => new Date(row.ts).getTime() >= min);
  }, [history, period]);

  const groupedDirectory = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return { own: [] as DirectoryRow[], other: [] as DirectoryRow[] };
    return {
      own: directory.filter((item) => item.filial === session.filial),
      other: directory.filter((item) => item.filial !== session.filial),
    };
  }, [directory, session]);

  const submit = async () => {
    if (!session || session.tipo !== "colaborador") return;
    if (!message.trim()) return toast.error("Conte o que você quer registrar.");
    if (sensitive && !factDate) return toast.error("Informe a data em que a situação aconteceu.");
    if (recipientType === "colaborador" && !recipientId) return toast.error("Selecione para quem é o feedback.");
    if (recipientType === "outro" && !otherName.trim()) return toast.error("Informe o nome da pessoa ou área.");

    const target = directory.find((item) => item.id === recipientId);
    setSending(true);
    const { error } = await supabase.rpc("kt_submit_employee_feedback", {
      p_id: uid(),
      p_tipo: type,
      p_mensagem: message.trim(),
      p_anonimo: anonymous,
      p_destinatario_tipo: recipientType,
      p_destinatario_colaborador_id: recipientType === "colaborador" ? recipientId : null,
      p_destinatario_nome:
        recipientType === "gestor"
          ? "Gestor da unidade"
          : recipientType === "rh"
            ? "RH"
            : recipientType === "outro"
              ? otherName.trim()
              : target?.nome ?? null,
      p_destinatario_filial:
        recipientType === "colaborador"
          ? target?.filial ?? session.filial
          : recipientType === "outro"
            ? otherBranch
            : session.filial,
      p_fato_em: factDate ? new Date(`${factDate}T12:00:00`).toISOString() : null,
      p_testemunhas: witnesses.trim() || null,
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível registrar o feedback agora.");
      return;
    }

    setMessage("");
    setWitnesses("");
    setFactDate("");
    setRecipientId("");
    setAnonymous(false);
    toast.success(sensitive ? "Relato registrado e encaminhado para triagem do RH." : "Feedback registrado.");
    await loadHistory();
  };

  return (
    <Section
      id="feedback-colaborador"
      titulo="Feedback e ocorrências"
      intro="Registre elogios, dúvidas ou situações que precisam de acompanhamento. O RH acompanha todos os registros; relatos sensíveis passam primeiro por triagem."
      contagem={`${history.length} registros`}
      collapsible
      defaultOpen
    >
      <div className="grid gap-5">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {TYPES.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setType(item.id)}
              className={`rounded-lg border p-4 text-left transition-all ${type === item.id ? item.tone + " ring-1 ring-current/15" : "border-border bg-card hover:bg-muted/30"}`}
            >
              <span className="text-2xl" aria-hidden>{item.emoji}</span>
              <span className="mt-2 block text-sm font-bold text-foreground">{item.id}</span>
              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.title}</span>
            </button>
          ))}
        </div>

        <div className={`rounded-lg border p-4 ${selectedType.tone}`}>
          <div className="flex items-start gap-3">
            {type === "Elogio" ? <Heart className="mt-0.5 h-5 w-5 shrink-0" /> : type === "Dúvida" ? <CircleHelp className="mt-0.5 h-5 w-5 shrink-0" /> : sensitive ? <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0" /> : <MessageSquareText className="mt-0.5 h-5 w-5 shrink-0" />}
            <div>
              <p className="text-sm font-bold">{selectedType.title}</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{selectedType.body}</p>
              {sensitive ? (
                <p className="mt-2 inline-flex items-center gap-1.5 text-xs font-bold text-destructive">
                  <ShieldCheck className="h-3.5 w-3.5" /> O RH participa obrigatoriamente deste fluxo antes de qualquer liberação sensível para a gestão.
                </p>
              ) : null}
            </div>
          </div>
        </div>

        <div className="grid gap-4 rounded-lg border border-border bg-card p-4 sm:p-5">
          <div className="grid gap-2">
            <Label>Para quem é este feedback?</Label>
            <div className="flex flex-wrap gap-2">
              {([
                ["colaborador", "Um colaborador"],
                ["gestor", "Meu gestor"],
                ["rh", "RH"],
                ["outro", "Outra pessoa/unidade"],
              ] as Array<[RecipientType, string]>).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setRecipientType(value)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold ${recipientType === value ? "border-kt bg-kt-soft text-kt" : "border-border text-muted-foreground hover:bg-muted"}`}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {recipientType === "colaborador" ? (
            <label className="grid gap-1.5 text-xs font-semibold text-foreground">
              Pessoa
              <select
                value={recipientId}
                onChange={(event) => setRecipientId(event.target.value)}
                className="h-11 rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="">Selecione...</option>
                {groupedDirectory.own.length > 0 ? <optgroup label="Minha unidade">{groupedDirectory.own.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</optgroup> : null}
                {groupedDirectory.other.length > 0 ? <optgroup label="Outras unidades">{groupedDirectory.other.map((item) => <option key={item.id} value={item.id}>{item.nome} · {filialNome(item.filial as never)}</option>)}</optgroup> : null}
              </select>
            </label>
          ) : null}

          {recipientType === "outro" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Nome da pessoa ou área
                <Input value={otherName} onChange={(event) => setOtherName(event.target.value)} placeholder="Ex.: João / Financeiro" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Unidade
                <select value={otherBranch} onChange={(event) => setOtherBranch(event.target.value)} className="h-10 rounded-md border border-input bg-background px-3 text-sm">
                  <option value="cristo-rei">Cristo Rei</option>
                  <option value="champagnat">Champagnat</option>
                </select>
              </label>
            </div>
          ) : null}

          {sensitive ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Data da situação <span className="text-destructive">*</span>
                <Input type="date" value={factDate} onChange={(event) => setFactDate(event.target.value)} />
              </label>
              {(type === "Denúncia" || type === "Reclamação" || type === "Situação urgente") ? (
                <label className="grid gap-1.5 text-xs font-semibold text-foreground sm:col-span-2">
                  Testemunhas ou outras pessoas presentes (se houver)
                  <Input value={witnesses} onChange={(event) => setWitnesses(event.target.value)} placeholder="Nomes ou informações que ajudem na apuração" />
                </label>
              ) : null}
            </div>
          ) : null}

          <label className="grid gap-1.5 text-xs font-semibold text-foreground">
            Conte o que aconteceu
            <Textarea
              rows={5}
              maxLength={1800}
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              placeholder={sensitive ? "Descreva fatos, contexto, pessoas envolvidas e tudo o que considerar importante..." : "Escreva seu feedback com clareza e contexto..."}
              className="resize-none"
            />
          </label>

          <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3 text-xs leading-relaxed text-muted-foreground">
            <input type="checkbox" checked={anonymous} onChange={(event) => setAnonymous(event.target.checked)} className="mt-0.5" />
            <span>
              <strong className="text-foreground">Enviar sem meu nome para a gestão.</strong> O RH mantém o registro institucional necessário para triagem e continuidade do caso.
            </span>
          </label>

          <div className="flex justify-end">
            <Button disabled={sending || !message.trim()} onClick={() => void submit()}>
              <Send className="h-4 w-4" /> {sending ? "Registrando..." : "Registrar feedback"}
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">Meu histórico</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Acompanhe status, devolutivas e próximos passos dos seus registros.</p>
            </div>
            <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
              {(["30", "90", "all"] as const).map((value) => (
                <button key={value} type="button" onClick={() => setPeriod(value)} className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${period === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}>
                  {value === "all" ? "Todos" : `${value} dias`}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">Carregando seus registros...</div>
          ) : filteredHistory.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">Nenhum feedback neste período.</div>
          ) : (
            <div className="grid gap-3">
              {filteredHistory.map((row) => (
                <article key={row.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-bold text-foreground">{row.tipo}</span>
                        <span className="rounded-full bg-muted px-2 py-1 text-[10px] font-bold text-muted-foreground">{statusLabel(row)}</span>
                        {row.anonimo ? <span className="rounded-full bg-kt-soft px-2 py-1 text-[10px] font-bold text-kt">Anônimo para gestão</span> : null}
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(row.ts).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        {row.destinatario_nome ? ` · Para ${row.destinatario_nome}` : ""}
                      </p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.protocolo ?? row.id.slice(-8).toUpperCase()}</span>
                  </div>

                  {row.fato_em ? <p className="mt-3 text-xs font-semibold text-muted-foreground">Data do fato: {new Date(row.fato_em).toLocaleDateString("pt-BR")}</p> : null}
                  <p className="mt-2 text-sm leading-relaxed text-foreground">{row.mensagem}</p>

                  {row.proxima_acao || row.comentario_gestor || row.encerrado_motivo ? (
                    <div className="mt-3 grid gap-2 rounded-md border border-success/20 bg-success-soft/35 p-3">
                      <p className="flex items-center gap-1.5 text-xs font-bold text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Atualização do caso</p>
                      {row.proxima_acao ? <p className="text-xs text-muted-foreground"><strong>Próximo passo:</strong> {row.proxima_acao}</p> : null}
                      {row.comentario_gestor ? <p className="text-xs text-muted-foreground"><strong>Devolutiva:</strong> {row.comentario_gestor}</p> : null}
                      {row.encerrado_motivo ? <p className="text-xs text-muted-foreground"><strong>Conclusão:</strong> {row.encerrado_motivo}</p> : null}
                    </div>
                  ) : (
                    <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted-foreground"><AlertTriangle className="h-3.5 w-3.5" /> Ainda não há devolutiva publicada para você.</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </div>
      </div>
    </Section>
  );
}
