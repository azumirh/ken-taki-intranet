import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, Clock3, MessageSquareText, Send, ShieldCheck } from "lucide-react";
import { toast } from "sonner";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { SUGESTAO_CATEGORIAS } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";
import { uid } from "@/lib/kt-store";

type SuggestionRow = {
  id: string;
  categoria: string;
  mensagem: string;
  ts: string;
  status: string | null;
  status_ts: string | null;
  resposta: string | null;
};

const STATUS_LABEL: Record<string, string> = {
  "enviado-rh": "Recebida pelo RH",
  "em-analise": "Em análise",
  "encaminhado-gestor": "Em discussão com a gestão",
  "considerar-depois": "Mapeada para outro momento",
  "para-socios": "Encaminhada aos sócios",
  desconsiderado: "Não será considerada",
  descartado: "Não será considerada",
  concluido: "Concluída",
};

function statusClass(status?: string | null) {
  if (status === "concluido" || status === "para-socios") return "bg-success-soft text-success";
  if (status === "desconsiderado" || status === "descartado") return "bg-destructive/7 text-destructive";
  if (status === "em-analise" || status === "encaminhado-gestor") return "bg-warn-soft text-warn";
  return "bg-muted text-muted-foreground";
}

export function EmployeeSuggestionsCenter() {
  const [category, setCategory] = useState(SUGESTAO_CATEGORIAS[0] ?? "Geral");
  const [message, setMessage] = useState("");
  const [rows, setRows] = useState<SuggestionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [period, setPeriod] = useState<"30" | "90" | "all">("90");

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase.rpc("kt_my_suggestions");
    setLoading(false);
    if (error) {
      console.warn("[ken-taki] my suggestions", error.message);
      return;
    }
    setRows((data ?? []) as SuggestionRow[]);
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    if (period === "all") return rows;
    const min = Date.now() - Number(period) * 86400000;
    return rows.filter((row) => new Date(row.ts).getTime() >= min);
  }, [rows, period]);

  const submit = async () => {
    if (!message.trim()) return;
    setSending(true);
    const id = uid();
    const { error } = await supabase.rpc("kt_submit_employee_suggestion", {
      p_id: id,
      p_categoria: category,
      p_mensagem: message.trim(),
    });
    setSending(false);
    if (error) {
      toast.error("Não foi possível enviar sua sugestão agora.");
      return;
    }
    setMessage("");
    toast.success("Sugestão enviada anonimamente.");
    await load();
  };

  return (
    <Section
      id="sugestoes-colaborador"
      titulo="Caixinha de sugestões"
      intro="Sua identidade não é exibida para RH ou gestão. Você continua acompanhando o protocolo e a devolutiva por aqui."
      contagem={`${rows.length} protocolos`}
      collapsible
      defaultOpen
    >
      <div className="grid gap-5">
        <div className="rounded-lg border border-kt/20 bg-kt-soft/35 p-4">
          <div className="flex items-start gap-3">
            <ShieldCheck className="mt-0.5 h-5 w-5 shrink-0 text-kt" />
            <div>
              <p className="text-sm font-bold text-foreground">Anônima para quem analisa, rastreável só para você.</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                O sistema guarda um vínculo privado apenas para mostrar seu histórico neste perfil. RH e gestores recebem a sugestão sem seu nome.
              </p>
            </div>
          </div>
        </div>

        <div className="grid gap-3 rounded-lg border border-border bg-card p-4 sm:p-5">
          <div>
            <p className="text-sm font-bold text-foreground">Quero sugerir algo</p>
            <p className="mt-1 text-xs text-muted-foreground">Ideias, melhorias, reconhecimento ou observações sobre o dia a dia.</p>
          </div>

          <div className="flex flex-wrap gap-2">
            {SUGESTAO_CATEGORIAS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setCategory(item)}
                className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
                  category === item ? "border-kt bg-kt-soft text-kt" : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
              >
                {item.replace("Equipe Azumi RH", "RH")}
              </button>
            ))}
          </div>

          <Textarea
            rows={4}
            maxLength={1000}
            value={message}
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Conte sua sugestão com o máximo de contexto que achar útil..."
            className="resize-none"
          />

          <div className="flex justify-end">
            <Button disabled={!message.trim() || sending} onClick={() => void submit()}>
              <Send className="h-4 w-4" /> {sending ? "Enviando..." : "Enviar anonimamente"}
            </Button>
          </div>
        </div>

        <div>
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-sm font-bold text-foreground">Meu histórico</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Acompanhe o que aconteceu com cada sugestão.</p>
            </div>
            <div className="flex rounded-md border border-border bg-muted/30 p-0.5">
              {(["30", "90", "all"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setPeriod(value)}
                  className={`rounded px-2.5 py-1.5 text-[11px] font-semibold ${period === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"}`}
                >
                  {value === "all" ? "Todas" : `${value} dias`}
                </button>
              ))}
            </div>
          </div>

          {loading ? (
            <div className="rounded-lg border border-border px-4 py-6 text-center text-sm text-muted-foreground">Carregando histórico...</div>
          ) : filtered.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border px-4 py-7 text-center text-sm text-muted-foreground">Nenhuma sugestão neste período.</div>
          ) : (
            <div className="grid gap-3">
              {filtered.map((row) => (
                <article key={row.id} className="rounded-lg border border-border bg-card p-4">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-xs font-bold text-foreground">{row.categoria.replace("Equipe Azumi RH", "RH")}</span>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-bold ${statusClass(row.status)}`}>
                          {STATUS_LABEL[row.status ?? ""] ?? row.status ?? "Recebida"}
                        </span>
                      </div>
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {new Date(row.ts).toLocaleString("pt-BR", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                      </p>
                    </div>
                    <span className="rounded-md bg-muted px-2 py-1 font-mono text-[10px] text-muted-foreground">{row.id.slice(-8).toUpperCase()}</span>
                  </div>

                  <p className="mt-3 text-sm leading-relaxed text-foreground">{row.mensagem}</p>

                  {row.resposta ? (
                    <div className="mt-3 rounded-md border border-success/20 bg-success-soft/40 p-3">
                      <div className="flex items-center gap-2 text-xs font-bold text-success">
                        <MessageSquareText className="h-3.5 w-3.5" /> Devolutiva
                      </div>
                      <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{row.resposta}</p>
                    </div>
                  ) : (
                    <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground">
                      {row.status === "concluido" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Clock3 className="h-3.5 w-3.5" />}
                      {row.status === "concluido" ? "Processo concluído." : "Ainda não há devolutiva publicada para você."}
                    </div>
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
