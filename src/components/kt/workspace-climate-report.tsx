import { Download, FileText, SlidersHorizontal } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAdminPermissions } from "@/lib/admin-permissions";
import { FILIAIS, HUMORES, filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Mode = "manager" | "hr";
type Checkin = { id: string; nome: string; filial: string; humor: string; ts: string; recado: string | null };
type Profile = { id: string; tipo: string; filial: string | null; nome: string };

type PeriodPreset = "7d" | "30d" | "month" | "custom";

function isoDay(date: Date) {
  return date.toISOString().slice(0, 10);
}

function dateRange(preset: Exclude<PeriodPreset, "custom">) {
  const end = new Date();
  const start = new Date();
  if (preset === "7d") start.setDate(start.getDate() - 6);
  if (preset === "30d") start.setDate(start.getDate() - 29);
  if (preset === "month") start.setDate(1);
  return { start: isoDay(start), end: isoDay(end) };
}

function categoryFor(humor: string) {
  return HUMORES.find((item) => item.id === humor)?.categoria ?? "neutra";
}

function csvEscape(value: string) {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function wrapText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, maxWidth: number, lineHeight: number, maxLines = 4) {
  const words = text.split(/\s+/);
  let line = "";
  let lineIndex = 0;
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (ctx.measureText(next).width > maxWidth && line) {
      ctx.fillText(line, x, y + lineIndex * lineHeight);
      line = word;
      lineIndex += 1;
      if (lineIndex >= maxLines) return y + lineIndex * lineHeight;
    } else line = next;
  }
  if (line && lineIndex < maxLines) {
    ctx.fillText(line, x, y + lineIndex * lineHeight);
    lineIndex += 1;
  }
  return y + lineIndex * lineHeight;
}

function jpegToPdf(jpegDataUrl: string, width: number, height: number) {
  const base64 = jpegDataUrl.split(",")[1] ?? "";
  const binary = atob(base64);
  const imgBytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) imgBytes[i] = binary.charCodeAt(i);

  const pageWidth = 595.28;
  const pageHeight = 841.89;
  const header = "%PDF-1.4\n";
  const objects: Array<Uint8Array> = [];
  const enc = new TextEncoder();
  const addTextObject = (content: string) => objects.push(enc.encode(content));
  addTextObject("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  addTextObject("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  addTextObject(`3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] /Resources << /XObject << /Im0 4 0 R >> >> /Contents 5 0 R >>\nendobj\n`);
  const imageHead = enc.encode(`4 0 obj\n<< /Type /XObject /Subtype /Image /Width ${width} /Height ${height} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${imgBytes.length} >>\nstream\n`);
  const imageTail = enc.encode("\nendstream\nendobj\n");
  const imageObject = new Uint8Array(imageHead.length + imgBytes.length + imageTail.length);
  imageObject.set(imageHead, 0); imageObject.set(imgBytes, imageHead.length); imageObject.set(imageTail, imageHead.length + imgBytes.length);
  objects.push(imageObject);
  const stream = `q\n${pageWidth} 0 0 ${pageHeight} 0 0 cm\n/Im0 Do\nQ`;
  addTextObject(`5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`);

  const parts: Uint8Array[] = [enc.encode(header)];
  const offsets = [0];
  let cursor = parts[0]!.length;
  objects.forEach((object) => { offsets.push(cursor); parts.push(object); cursor += object.length; });
  const xrefOffset = cursor;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i += 1) xref += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
  xref += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  parts.push(enc.encode(xref));
  return new Blob(parts as BlobPart[], { type: "application/pdf" });
}

export function WorkspaceClimateReport({ mode }: { mode: Mode }) {
  const { can } = useAdminPermissions();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [preset, setPreset] = useState<PeriodPreset>("30d");
  const initial = dateRange("30d");
  const [start, setStart] = useState(initial.start);
  const [end, setEnd] = useState(initial.end);
  const [filial, setFilial] = useState("todas");
  const [rows, setRows] = useState<Checkin[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data: p } = await supabase.from("kt_perfis").select("id,tipo,filial,nome").eq("id", auth.user.id).maybeSingle();
      if (!p) return;
      const current = p as Profile;
      setProfile(current);
      const effectiveFilial = mode === "manager" ? current.filial : filial === "todas" ? null : filial;
      let query = supabase
        .from("kt_checkins")
        .select("id,nome,filial,humor,ts,recado")
        .gte("ts", `${start}T00:00:00`)
        .lte("ts", `${end}T23:59:59.999`)
        .order("ts", { ascending: true });
      if (effectiveFilial) query = query.eq("filial", effectiveFilial);
      const { data, error } = await query;
      if (error) throw error;
      setRows((data ?? []) as Checkin[]);
    } catch (error) { toast.error((error as Error).message || "Não foi possível carregar o clima."); }
    finally { setLoading(false); }
  }, [end, filial, mode, start]);

  useEffect(() => { void load(); }, [load]);

  if (mode === "hr" && !can("clima", "view")) return null;
  if (!profile) return null;

  function choosePreset(value: Exclude<PeriodPreset, "custom">) {
    const range = dateRange(value);
    setPreset(value); setStart(range.start); setEnd(range.end);
  }

  const summary = useMemo(() => {
    let positive = 0; let neutral = 0; let negative = 0;
    rows.forEach((row) => {
      const category = categoryFor(row.humor);
      if (category === "positiva") positive += 1;
      else if (category === "negativa") negative += 1;
      else neutral += 1;
    });
    const uniquePeople = new Set(rows.map((row) => `${row.filial}:${row.nome}`)).size;
    return { positive, neutral, negative, total: rows.length, uniquePeople };
  }, [rows]);

  const daily = useMemo(() => {
    const map = new Map<string, { date: string; Positivo: number; Neutro: number; Negativo: number }>();
    rows.forEach((row) => {
      const key = new Date(row.ts).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
      const item = map.get(key) ?? { date: key, Positivo: 0, Neutro: 0, Negativo: 0 };
      const category = categoryFor(row.humor);
      if (category === "positiva") item.Positivo += 1;
      else if (category === "negativa") item.Negativo += 1;
      else item.Neutro += 1;
      map.set(key, item);
    });
    return Array.from(map.values());
  }, [rows]);

  function exportCsv() {
    const header = ["nome", "filial", "humor", "categoria", "data_hora", "comentario"];
    const lines = [header.join(","), ...rows.map((row) => [row.nome, filialNome(row.filial), row.humor, categoryFor(row.humor), new Date(row.ts).toLocaleString("pt-BR"), row.recado ?? ""].map((value) => csvEscape(String(value))).join(","))];
    downloadBlob(new Blob(["\uFEFF" + lines.join("\n")], { type: "text/csv;charset=utf-8" }), `clima-ken-taki-${start}-${end}.csv`);
  }

  function exportPdf() {
    const canvas = document.createElement("canvas");
    canvas.width = 1240; canvas.height = 1754;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#fbf8f3"; ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "#3a2733"; ctx.fillRect(0, 0, canvas.width, 245);
    ctx.fillStyle = "#f8f1e9"; ctx.font = "700 46px Segoe UI, Arial"; ctx.fillText("Ken Taki · Relatório de clima", 72, 92);
    ctx.fillStyle = "#d9ccd4"; ctx.font = "24px Segoe UI, Arial"; ctx.fillText(`${new Date(start + "T00:00:00").toLocaleDateString("pt-BR")} a ${new Date(end + "T00:00:00").toLocaleDateString("pt-BR")}`, 72, 142);
    ctx.fillText(mode === "manager" ? filialNome(profile.filial ?? undefined) : filial === "todas" ? "Todas as unidades" : filialNome(filial), 72, 182);
    ctx.fillStyle = "#2b2729"; ctx.font = "700 28px Segoe UI, Arial"; ctx.fillText("Resumo do período", 72, 315);
    const cards = [
      ["Registros", summary.total, "#4b3142"], ["Pessoas", summary.uniquePeople, "#66505d"], ["Positivos", summary.positive, "#39715a"], ["Negativos", summary.negative, "#a65a42"],
    ] as const;
    cards.forEach(([label, value, color], index) => {
      const x = 72 + index * 274; ctx.fillStyle = "#ffffff"; ctx.fillRect(x, 350, 242, 132); ctx.strokeStyle = "#ddd6d0"; ctx.strokeRect(x, 350, 242, 132);
      ctx.fillStyle = color; ctx.fillRect(x, 350, 242, 7); ctx.fillStyle = "#2b2729"; ctx.font = "700 38px Segoe UI, Arial"; ctx.fillText(String(value), x + 22, 408);
      ctx.fillStyle = "#6f6966"; ctx.font = "20px Segoe UI, Arial"; ctx.fillText(label, x + 22, 447);
    });
    const pct = (value: number) => summary.total ? Math.round((value / summary.total) * 100) : 0;
    ctx.fillStyle = "#2b2729"; ctx.font = "700 28px Segoe UI, Arial"; ctx.fillText("Distribuição", 72, 550);
    const distributions = [["Positivo", summary.positive, "#39715a"], ["Neutro", summary.neutral, "#9d8d82"], ["Negativo", summary.negative, "#a65a42"]] as const;
    distributions.forEach(([label, value, color], index) => {
      const y = 590 + index * 66; ctx.fillStyle = "#e8e2dd"; ctx.fillRect(210, y, 800, 25); ctx.fillStyle = color; ctx.fillRect(210, y, 800 * pct(value) / 100, 25);
      ctx.fillStyle = "#403a3d"; ctx.font = "20px Segoe UI, Arial"; ctx.fillText(label, 72, y + 20); ctx.fillText(`${value} · ${pct(value)}%`, 1030, y + 20);
    });
    ctx.fillStyle = "#2b2729"; ctx.font = "700 28px Segoe UI, Arial"; ctx.fillText("Leitura executiva", 72, 825);
    ctx.fillStyle = "#5e5754"; ctx.font = "22px Segoe UI, Arial";
    const interpretation = summary.total === 0 ? "Não houve registros no período selecionado." : `Foram registrados ${summary.total} check-ins por ${summary.uniquePeople} pessoas. ${pct(summary.positive)}% foram positivos, ${pct(summary.neutral)}% neutros e ${pct(summary.negative)}% negativos. O relatório deve ser lido como sinal de clima e não como diagnóstico individual.`;
    let nextY = wrapText(ctx, interpretation, 72, 870, 1090, 34, 5) + 30;
    ctx.fillStyle = "#2b2729"; ctx.font = "700 28px Segoe UI, Arial"; ctx.fillText("Evolução diária", 72, nextY); nextY += 48;
    ctx.font = "18px Segoe UI, Arial";
    daily.slice(-18).forEach((day, index) => {
      const y = nextY + index * 38; ctx.fillStyle = index % 2 ? "#f2efeb" : "#ffffff"; ctx.fillRect(72, y - 24, 1090, 34);
      ctx.fillStyle = "#4a4441"; ctx.fillText(day.date, 92, y); ctx.fillText(`Positivos ${day.Positivo}`, 300, y); ctx.fillText(`Neutros ${day.Neutro}`, 560, y); ctx.fillText(`Negativos ${day.Negativo}`, 800, y);
    });
    ctx.fillStyle = "#8a817b"; ctx.font = "16px Segoe UI, Arial"; ctx.fillText(`Gerado em ${new Date().toLocaleString("pt-BR")} · Intranet Ken Taki`, 72, 1680);
    const jpeg = canvas.toDataURL("image/jpeg", 0.92);
    downloadBlob(jpegToPdf(jpeg, canvas.width, canvas.height), `relatorio-clima-ken-taki-${start}-${end}.pdf`);
  }

  return (
    <section id="clima" className="surface mb-5 scroll-mt-24 overflow-hidden">
      <div className="flex flex-col gap-4 border-b border-border px-5 py-5 sm:flex-row sm:items-start sm:justify-between lg:px-6">
        <div><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-kt" /><h2 className="text-lg font-bold">Clima por período</h2></div><p className="mt-1 text-sm text-muted-foreground">Filtre a leitura e gere um relatório independente do que estiver visível na tela.</p></div>
        <div className="flex flex-wrap gap-2"><Button variant="outline" size="sm" disabled={loading || rows.length === 0} onClick={exportCsv}><Download className="h-3.5 w-3.5" /> CSV</Button><Button size="sm" disabled={loading} onClick={exportPdf}><FileText className="h-3.5 w-3.5" /> Baixar relatório PDF</Button></div>
      </div>
      <div className="grid gap-5 p-5 lg:p-6">
        <div className="flex flex-wrap items-end gap-3">
          <div className="flex flex-wrap gap-1 rounded-md bg-muted p-1">{(["7d","30d","month"] as const).map((value)=><button key={value} onClick={()=>choosePreset(value)} className={`rounded px-3 py-1.5 text-xs font-semibold ${preset===value?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>{value==="7d"?"7 dias":value==="30d"?"30 dias":"Este mês"}</button>)}<button onClick={()=>setPreset("custom")} className={`rounded px-3 py-1.5 text-xs font-semibold ${preset==="custom"?"bg-card text-foreground shadow-sm":"text-muted-foreground"}`}>Período específico</button></div>
          <div><Label>De</Label><Input type="date" className="mt-1 w-40" value={start} onChange={(e)=>{setStart(e.target.value);setPreset("custom");}} /></div><div><Label>Até</Label><Input type="date" className="mt-1 w-40" value={end} onChange={(e)=>{setEnd(e.target.value);setPreset("custom");}} /></div>
          {mode==="hr"?<div><Label>Unidade</Label><select className="mt-1 h-9 rounded-md border border-border bg-card px-3 text-sm" value={filial} onChange={(e)=>setFilial(e.target.value)}><option value="todas">Todas as unidades</option>{FILIAIS.map((item)=><option key={item.id} value={item.id}>{item.nome}</option>)}</select></div>:null}
        </div>
        <div className="grid gap-2 sm:grid-cols-4">{[["Registros",summary.total],["Pessoas",summary.uniquePeople],["Positivos",summary.positive],["Negativos",summary.negative]].map(([label,value])=><div key={label} className="rounded-lg border border-border bg-background px-4 py-3"><p className="text-2xl font-bold tabular-nums">{value}</p><p className="text-xs font-semibold text-muted-foreground">{label}</p></div>)}</div>
        <div className="h-[260px] min-w-0 rounded-lg border border-border bg-card p-3"><ResponsiveContainer width="100%" height="100%"><BarChart data={daily}><CartesianGrid vertical={false} strokeDasharray="3 3" opacity={0.25}/><XAxis dataKey="date" tick={{fontSize:10}}/><YAxis allowDecimals={false} tick={{fontSize:10}}/><Tooltip/><Bar dataKey="Positivo" stackId="a" fill="#39715a" radius={[2,2,0,0]}/><Bar dataKey="Neutro" stackId="a" fill="#9d8d82"/><Bar dataKey="Negativo" stackId="a" fill="#a65a42" radius={[0,0,2,2]}/></BarChart></ResponsiveContainer></div>
      </div>
    </section>
  );
}
