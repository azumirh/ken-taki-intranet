import { Filter, MessageSquareText, UsersRound } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useAdminPermissions } from "@/lib/admin-permissions";
import { FILIAIS, filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Suggestion = {
  id: string;
  categoria: string;
  mensagem: string;
  filial: string;
  ts: number | string;
  status: string | null;
  status_ts: number | string | null;
  justificativa: string | null;
  observacao: string | null;
  responsavel_id: string | null;
  gestor_compartilhado: boolean | null;
};

type RhProfile = { id: string; nome: string };

type Period = "30d" | "90d" | "all" | "custom";

const STATUS_OPTIONS = [
  ["", "Sem status"],
  ["em-analise", "Em análise"],
  ["enviado-rh", "Tratamento interno RH"],
  ["para-socios", "Levado aos sócios"],
  ["considerar-depois", "Considerar depois"],
  ["desconsiderado", "Não será considerado"],
  ["concluido", "Concluído"],
] as const;

function toDate(value: number | string) {
  if (typeof value === "number") return new Date(value);
  const numeric = Number(value);
  if (Number.isFinite(numeric) && String(value).length >= 10) return new Date(numeric);
  return new Date(value);
}

function statusLabel(value: string | null) {
  return STATUS_OPTIONS.find(([status]) => status === (value ?? ""))?.[1] ?? value ?? "Sem status";
}

export function WorkspaceSuggestions() {
  const { can } = useAdminPermissions();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [rhProfiles, setRhProfiles] = useState<RhProfile[]>([]);
  const [period, setPeriod] = useState<Period>("90d");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [filial, setFilial] = useState("todas");
  const [status, setStatus] = useState("todos");
  const [selected, setSelected] = useState<Suggestion | null>(null);
  const [draftStatus, setDraftStatus] = useState("");
  const [justification, setJustification] = useState("");
  const [observation, setObservation] = useState("");
  const [responsible, setResponsible] = useState("");
  const [working, setWorking] = useState(false);

  const load = useCallback(async () => {
    const [suggestions, rh] = await Promise.all([
      supabase.from("kt_sugestoes").select("id,categoria,mensagem,filial,ts,status,status_ts,justificativa,observacao,responsavel_id,gestor_compartilhado").order("ts", { ascending: false }),
      supabase.from("kt_perfis").select("id,nome").in("tipo", ["azumi", "rh"]).eq("ativo", true).order("nome"),
    ]);
    if (suggestions.error) throw suggestions.error;
    setItems((suggestions.data ?? []) as Suggestion[]);
    setRhProfiles((rh.data ?? []) as RhProfile[]);
  }, []);

  useEffect(() => { if (can("sugestoes", "view")) void load().catch((error) => toast.error((error as Error).message)); }, [can, load]);

  const filtered = useMemo(() => {
    const now = Date.now();
    return items.filter((item) => {
      const date = toDate(item.ts);
      let periodOk = true;
      if (period === "30d") periodOk = date.getTime() >= now - 30 * 86400000;
      if (period === "90d") periodOk = date.getTime() >= now - 90 * 86400000;
      if (period === "custom") {
        if (start) periodOk = periodOk && date >= new Date(`${start}T00:00:00`);
        if (end) periodOk = periodOk && date <= new Date(`${end}T23:59:59`);
      }
      const filialOk = filial === "todas" || item.filial === filial;
      const statusOk = status === "todos" || (status === "sem-status" ? !item.status : item.status === status);
      return periodOk && filialOk && statusOk;
    });
  }, [end, filial, items, period, start, status]);

  const counters = useMemo(() => ({
    total: filtered.length,
    analysis: filtered.filter((item) => !item.status || item.status === "em-analise" || item.status === "enviado-rh").length,
    owners: filtered.filter((item) => item.status === "para-socios").length,
    discarded: filtered.filter((item) => item.status === "desconsiderado").length,
  }), [filtered]);

  if (!can("sugestoes", "view")) return null;

  function openItem(item: Suggestion) {
    setSelected(item);
    setDraftStatus(item.status ?? "");
    setJustification(item.justificativa ?? "");
    setObservation(item.observacao ?? "");
    setResponsible(item.responsavel_id ?? "");
  }

  async function saveItem(shareOverride?: boolean) {
    if (!selected || !can("sugestoes", "edit")) return;
    if (draftStatus === "desconsiderado" && justification.trim().length < 3) {
      toast.error("Explique por que a sugestão não será considerada.");
      return;
    }
    setWorking(true);
    try {
      const { error } = await supabase.rpc("kt_update_suggestion_case", {
        p_sugestao_id: selected.id,
        p_status: draftStatus || null,
        p_justificativa: justification.trim() || null,
        p_observacao: observation.trim() || null,
        p_responsavel_id: responsible || null,
        p_compartilhar_gestor: shareOverride ?? null,
      });
      if (error) throw error;
      toast.success(shareOverride === true ? "Sugestão compartilhada com a gestão da unidade." : "Tratamento da sugestão atualizado.");
      await load();
      setSelected(null);
    } catch (error) { toast.error((error as Error).message); }
    finally { setWorking(false); }
  }

  return (
    <section id="sugestoes" className="surface mb-5 scroll-mt-24 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between lg:px-6">
        <div><div className="flex items-center gap-2"><MessageSquareText className="h-4 w-4 text-kt" /><h2 className="text-lg font-bold">Caixinha de sugestões</h2></div><p className="mt-1 text-sm text-muted-foreground">Analise por período, registre decisão e justificativa e, quando fizer sentido, leve a discussão para a gestão.</p></div>
        <div className="flex items-center gap-2 text-[11px] text-muted-foreground"><Filter className="h-3.5 w-3.5" /> {filtered.length} no filtro atual</div>
      </div>
      <div className="grid gap-4 p-5 lg:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div><Label>Período</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm" value={period} onChange={(e)=>setPeriod(e.target.value as Period)}><option value="30d">Últimos 30 dias</option><option value="90d">Últimos 90 dias</option><option value="all">Todo o histórico</option><option value="custom">Período específico</option></select></div>
          {period==="custom"?<><div><Label>De</Label><Input type="date" className="mt-1 w-40" value={start} onChange={(e)=>setStart(e.target.value)}/></div><div><Label>Até</Label><Input type="date" className="mt-1 w-40" value={end} onChange={(e)=>setEnd(e.target.value)}/></div></>:null}
          <div><Label>Unidade</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm" value={filial} onChange={(e)=>setFilial(e.target.value)}><option value="todas">Todas</option>{FILIAIS.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>
          <div><Label>Status</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm" value={status} onChange={(e)=>setStatus(e.target.value)}><option value="todos">Todos</option><option value="sem-status">Sem status</option>{STATUS_OPTIONS.filter(([value])=>value).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div>
        </div>
        <div className="grid gap-2 sm:grid-cols-4">{[["Recebidas",counters.total],["Em análise",counters.analysis],["Levadas aos sócios",counters.owners],["Não consideradas",counters.discarded]].map(([label,value])=><div key={label} className="rounded-lg border border-border bg-background px-4 py-3"><p className="text-2xl font-bold tabular-nums">{value}</p><p className="mt-0.5 text-xs font-semibold text-muted-foreground">{label}</p></div>)}</div>
        <div className="grid gap-2">{filtered.length===0?<p className="rounded-lg border border-dashed border-border p-6 text-center text-sm text-muted-foreground">Nenhuma sugestão neste filtro.</p>:filtered.map((item)=><button key={item.id} onClick={()=>openItem(item)} className="grid gap-3 rounded-lg border border-border bg-card px-4 py-3.5 text-left transition hover:border-kt/25 hover:bg-muted/25 lg:grid-cols-[150px_minmax(0,1fr)_170px_120px] lg:items-center"><div><span className="rounded-md bg-az-soft px-2 py-1 text-[10px] font-bold text-az">{item.categoria}</span><p className="mt-2 text-[10px] text-muted-foreground">{toDate(item.ts).toLocaleDateString("pt-BR")}</p></div><p className="line-clamp-2 text-sm leading-relaxed">{item.mensagem}</p><div><p className="text-xs font-semibold">{statusLabel(item.status)}</p>{item.justificativa?<p className="mt-1 line-clamp-1 text-[10px] text-muted-foreground">{item.justificativa}</p>:null}</div><div className="text-xs text-muted-foreground">{filialNome(item.filial)}{item.gestor_compartilhado?<p className="mt-1 font-semibold text-success">Gestão envolvida</p>:null}</div></button>)}</div>
      </div>

      {selected ? <div className="fixed inset-0 z-[80] grid place-items-end bg-black/30 p-0 sm:place-items-center sm:p-4" onMouseDown={(e)=>{if(e.target===e.currentTarget)setSelected(null);}}><div className="max-h-[92vh] w-full overflow-y-auto rounded-t-2xl border border-border bg-card p-5 shadow-2xl sm:max-w-xl sm:rounded-xl sm:p-6"><div className="flex items-start justify-between gap-3"><div><p className="text-[10px] font-bold uppercase tracking-[0.13em] text-muted-foreground">Sugestão anônima · {filialNome(selected.filial)}</p><h3 className="mt-1 text-lg font-bold">Tratamento da sugestão</h3></div><button onClick={()=>setSelected(null)} className="text-sm text-muted-foreground">Fechar</button></div><p className="mt-4 rounded-lg border border-border bg-background p-3 text-sm leading-relaxed">{selected.mensagem}</p><div className="mt-4 grid gap-4"><div className="grid gap-2 sm:grid-cols-2"><div><Label>Status</Label><select disabled={!can("sugestoes","edit")} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm" value={draftStatus} onChange={(e)=>setDraftStatus(e.target.value)}>{STATUS_OPTIONS.map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></div><div><Label>Responsável RH</Label><select disabled={!can("sugestoes","edit")} className="mt-1 h-9 w-full rounded-md border border-border bg-card px-3 text-sm" value={responsible} onChange={(e)=>setResponsible(e.target.value)}><option value="">Não atribuído</option>{rhProfiles.map((profile)=><option key={profile.id} value={profile.id}>{profile.nome}</option>)}</select></div></div><div><Label>Observação interna / encaminhamento</Label><Textarea rows={3} value={observation} onChange={(e)=>setObservation(e.target.value)} placeholder="O que foi avaliado, com quem será discutido, próximo passo..." /></div><div><Label>{draftStatus==="desconsiderado"?"Justificativa obrigatória":"Justificativa / devolutiva"}</Label><Textarea rows={3} value={justification} onChange={(e)=>setJustification(e.target.value)} placeholder="Por que será ou não será considerada? Qual decisão foi tomada?" /></div>{can("sugestoes","edit")?<div className="flex flex-col gap-2 sm:flex-row"><Button variant="outline" className="flex-1" disabled={working} onClick={()=>void saveItem(true)}><UsersRound className="h-4 w-4"/> Discutir com gestor</Button><Button className="flex-1" disabled={working} onClick={()=>void saveItem()}>{working?"Salvando...":"Salvar tratamento"}</Button></div>:null}</div></div></div> : null}
    </section>
  );
}
