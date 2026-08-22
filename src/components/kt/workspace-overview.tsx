import {
  AlertTriangle,
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  FileCheck2,
  HeartHandshake,
  LifeBuoy,
  MessageSquarePlus,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { filialNome, HUMORES, iniciais } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";

type Mode = "manager" | "hr";

type Profile = {
  id: string;
  tipo: string;
  filial: string | null;
  nome: string;
  admin_nivel?: "geral" | "parcial" | null;
};

type ProfilePreferences = {
  nickname: string | null;
  avatar_url: string | null;
  avatar_pos_x: number | null;
  avatar_pos_y: number | null;
  avatar_zoom: number | string | null;
};

type MetricProps = {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  attention?: boolean;
};

type ClimateAttention = { name: string; negative: number; total: number };

function Metric({ label, value, detail, icon, attention = false }: MetricProps) {
  const activeAttention = attention && value > 0;
  return (
    <div
      className={`relative min-h-[124px] overflow-hidden rounded-xl border p-4 transition-colors ${
        activeAttention
          ? "border-[#d89b57]/45 bg-[#fff8ef]"
          : "border-border bg-card"
      }`}
    >
      {activeAttention ? <div className="absolute inset-x-0 top-0 h-1 bg-[#d28a3f]" /> : null}
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-9 w-9 place-items-center rounded-lg border ${
            activeAttention
              ? "border-[#d89b57]/30 bg-[#fff1df] text-[#a45e20]"
              : "border-border bg-muted/45 text-muted-foreground"
          }`}
        >
          {icon}
        </span>
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      </div>
      <p className="mt-3 text-sm font-bold text-foreground">{label}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      {activeAttention ? (
        <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-[#d28a3f] ring-4 ring-[#d28a3f]/10" />
      ) : null}
    </div>
  );
}

function greeting() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

function goTo(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

export function WorkspaceOverview({ mode }: { mode: Mode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [prefs, setPrefs] = useState<ProfilePreferences | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [triageCount, setTriageCount] = useState(0);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const [supportCount, setSupportCount] = useState(0);
  const [documentsPending, setDocumentsPending] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [climateAttention, setClimateAttention] = useState<ClimateAttention[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const [{ data: p }, { data: pref }] = await Promise.all([
        supabase
          .from("kt_perfis")
          .select("id,tipo,filial,nome,admin_nivel")
          .eq("id", auth.user.id)
          .maybeSingle(),
        supabase
          .from("kt_profile_preferences")
          .select("nickname,avatar_url,avatar_pos_x,avatar_pos_y,avatar_zoom")
          .eq("profile_id", auth.user.id)
          .maybeSingle(),
      ]);
      if (!p) return;

      const current = p as Profile;
      setProfile(current);
      setPrefs((pref as ProfilePreferences | null) ?? null);

      if (mode === "hr") {
        const [triage, escalated, help, people] = await Promise.all([
          supabase
            .from("kt_feedbacks")
            .select("id", { count: "exact", head: true })
            .in("triagem_rh_status", ["pendente", "em_analise"]),
          supabase
            .from("kt_feedbacks")
            .select("id", { count: "exact", head: true })
            .eq("escalado_rh", true)
            .not("status", "in", '("concluido","cancelado")'),
          supabase.from("kt_ajuda").select("id", { count: "exact", head: true }).neq("status", "resolvido"),
          supabase.from("kt_colaboradores").select("id", { count: "exact", head: true }).eq("ativo", true),
        ]);
        setTriageCount(triage.count ?? 0);
        setEscalatedCount(escalated.count ?? 0);
        setSupportCount(help.count ?? 0);
        setPeopleCount(people.count ?? 0);
        setFeedbackCount(0);
        setDocumentsPending(0);
        setClimateAttention([]);
        return;
      }

      if (!current.filial) return;
      const filial = current.filial;
      const since = new Date();
      since.setDate(since.getDate() - 6);
      since.setHours(0, 0, 0, 0);
      const [feedbacks, help, docs, signatures, people, checkins] = await Promise.all([
        supabase
          .from("kt_feedbacks")
          .select("id", { count: "exact", head: true })
          .eq("filial", filial)
          .or("destino.eq.gestor,gestor_liberado.eq.true")
          .not("status", "in", '("concluido","cancelado")'),
        supabase
          .from("kt_ajuda")
          .select("id", { count: "exact", head: true })
          .eq("filial", filial)
          .or(`destino_inicial.eq.gestor,gestor_id.eq.${current.id}`)
          .neq("status", "resolvido"),
        supabase.from("kt_documentos").select("id").or(`filial.eq.${filial},filial.eq.todas`),
        supabase.from("kt_assinaturas").select("politica").eq("nome", current.nome),
        supabase
          .from("kt_colaboradores")
          .select("id", { count: "exact", head: true })
          .eq("filial", filial)
          .eq("ativo", true),
        supabase
          .from("kt_checkins")
          .select("nome,humor,ts")
          .eq("filial", filial)
          .gte("ts", since.toISOString()),
      ]);
      setFeedbackCount(feedbacks.count ?? 0);
      setSupportCount(help.count ?? 0);
      setPeopleCount(people.count ?? 0);
      const signed = new Set((signatures.data ?? []).map((item) => String(item.politica)));
      setDocumentsPending((docs.data ?? []).filter((item) => !signed.has(String(item.id))).length);
      setTriageCount(0);
      setEscalatedCount(0);

      const perPerson = new Map<string, ClimateAttention>();
      for (const row of checkins.data ?? []) {
        const name = String(row.nome);
        const category = HUMORES.find((item) => item.id === row.humor)?.categoria;
        const currentRow = perPerson.get(name) ?? { name, negative: 0, total: 0 };
        currentRow.total += 1;
        if (category === "negativa") currentRow.negative += 1;
        perPerson.set(name, currentRow);
      }
      setClimateAttention(
        Array.from(perPerson.values())
          .filter((item) => item.negative >= 2)
          .sort((a, b) => b.negative - a.negative),
      );
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
    const update = () => void load();
    window.addEventListener("kt-profile-updated", update);
    return () => window.removeEventListener("kt-profile-updated", update);
  }, [load]);

  const attentionCount = useMemo(
    () =>
      mode === "hr"
        ? triageCount + escalatedCount + supportCount
        : feedbackCount + supportCount + documentsPending,
    [documentsPending, escalatedCount, feedbackCount, mode, supportCount, triageCount],
  );

  if (!profile) return null;

  const preferredName = prefs?.nickname?.trim() || profile.nome.split(" ")[0] || profile.nome;
  const avatarZoom = Number(prefs?.avatar_zoom ?? 1);
  const avatarStyle = {
    objectPosition: `${prefs?.avatar_pos_x ?? 50}% ${prefs?.avatar_pos_y ?? 50}%`,
    transform: `scale(${Number.isFinite(avatarZoom) ? avatarZoom : 1})`,
  };

  if (mode === "manager") {
    return (
      <section className="mb-5 grid gap-4" aria-label="Perfil e radar da gestão">
        <div className="relative overflow-hidden rounded-2xl border border-border bg-card px-5 py-6 shadow-sm sm:px-7 sm:py-7">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-[var(--profile-accent,var(--kt))]" />
          <div className="mx-auto flex max-w-3xl flex-col items-center text-center">
            <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Meu perfil</p>
            <div className="mt-3 h-24 w-24 overflow-hidden rounded-full border-4 border-background bg-muted shadow-md ring-1 ring-border">
              {prefs?.avatar_url ? (
                <img src={prefs.avatar_url} alt="Foto do gestor" className="h-full w-full object-cover" style={avatarStyle} />
              ) : (
                <span className="grid h-full w-full place-items-center bg-[var(--profile-accent,var(--kt))] text-xl font-bold text-white">
                  {iniciais(profile.nome)}
                </span>
              )}
            </div>
            <h1 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
              {greeting()}, {preferredName}
            </h1>
            <p className="mt-1 text-sm text-muted-foreground">Gestor · {filialNome(profile.filial ?? undefined)}</p>
            <p className="mt-2 max-w-xl text-xs leading-relaxed text-muted-foreground">
              Acompanhe sua equipe, registre decisões e use os atalhos abaixo para as ações mais frequentes.
            </p>

            <div className="mt-5 flex flex-wrap justify-center gap-2">
              <button
                type="button"
                onClick={() => goTo("manager-new-feedback")}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-[var(--profile-accent,var(--kt))] px-4 text-xs font-bold text-white shadow-sm transition-opacity hover:opacity-90"
              >
                <MessageSquarePlus className="h-4 w-4" /> Registrar feedback
              </button>
              <button
                type="button"
                onClick={() => goTo("manager-new-support")}
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted"
              >
                <HeartHandshake className="h-4 w-4" /> Falar com RH
              </button>
              <a
                href="https://portal.azumirh.com.br/vaga"
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-10 items-center gap-2 rounded-lg border border-border bg-card px-4 text-xs font-bold text-foreground hover:bg-muted"
              >
                <BriefcaseBusiness className="h-4 w-4" /> Solicitar vaga
              </a>
            </div>
          </div>
        </div>

        {climateAttention.length > 0 ? (
          <button
            type="button"
            onClick={() => goTo("clima")}
            className="flex w-full items-start gap-3 rounded-xl border border-[#d89146]/40 bg-[#fff7ec] p-4 text-left transition hover:border-[#d89146]/65"
          >
            <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#ffead0] text-[#a45e20]">
              <AlertTriangle className="h-4 w-4" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground">Atenção ao clima da equipe</p>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                {climateAttention.slice(0, 3).map((item) => `${item.name} (${item.negative} registros negativos)`).join(" · ")}
                {climateAttention.length > 3 ? ` · +${climateAttention.length - 3} pessoa(s)` : ""}. Vale buscar contexto e acompanhar.
              </p>
            </div>
          </button>
        ) : null}

        <div>
          <div className="mb-2 flex items-end justify-between gap-3">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.17em] text-muted-foreground">Radar da unidade</p>
              <p className="mt-0.5 text-xs text-muted-foreground">Só ganha cor quando existe algo que pede sua ação.</p>
            </div>
            {attentionCount === 0 ? (
              <span className="hidden items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-[11px] font-bold text-muted-foreground sm:inline-flex">
                <CheckCircle2 className="h-3.5 w-3.5" /> Tudo sob controle
              </span>
            ) : null}
          </div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
            <Metric
              label="Feedbacks em acompanhamento"
              value={feedbackCount}
              detail="Casos destinados ou liberados para sua atuação."
              icon={<MessageSquareText className="h-4 w-4" />}
              attention
            />
            <Metric
              label="Pedidos de conversa"
              value={supportCount}
              detail="Solicitações diretas ou encaminhadas para você."
              icon={<LifeBuoy className="h-4 w-4" />}
              attention
            />
            <Metric
              label="Documentos pendentes"
              value={documentsPending}
              detail="Documentos que ainda exigem sua própria assinatura."
              icon={<FileCheck2 className="h-4 w-4" />}
              attention
            />
            <Metric
              label="Pessoas da unidade"
              value={peopleCount}
              detail="Colaboradores ativos vinculados à sua unidade."
              icon={<UsersRound className="h-4 w-4" />}
            />
          </div>
        </div>
      </section>
    );
  }

  const roleLabel = profile.admin_nivel === "parcial" ? "Administrador parcial" : "Administrador geral";
  return (
    <section className="mb-5 grid gap-4" aria-label="Resumo de pendências">
      <div className="relative overflow-hidden rounded-2xl border border-[#4a3642] bg-[linear-gradient(120deg,#2f202a_0%,#4b3142_55%,#66505d_100%)] px-5 py-5 text-[#f8f1e9] shadow-[0_18px_50px_-34px_rgba(44,28,39,0.8)] sm:px-6 sm:py-6">
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-xl bg-[#f3ece5] text-base font-bold text-[#3a2833] shadow-lg shadow-black/15">
              {iniciais(profile.nome)}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white/90">RH</span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/65">
                  <ShieldCheck className="h-3.5 w-3.5" /> {roleLabel}
                </span>
              </div>
              <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-white sm:text-[2rem]">{profile.nome}</h1>
              <p className="mt-1 text-xs leading-relaxed text-white/65 sm:text-sm">Visão consolidada de pessoas, casos, comunicação e governança Ken Taki.</p>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void load()}
            disabled={loading}
            className="grid h-10 w-10 place-items-center rounded-lg border border-white/15 bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white disabled:opacity-50"
            aria-label="Atualizar visão geral"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </button>
        </div>
      </div>
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
        <Metric label="Triagens sensíveis" value={triageCount} detail="Relatos que ainda exigem decisão de confidencialidade e encaminhamento." icon={<ShieldCheck className="h-4 w-4" />} attention />
        <Metric label="Gestores pediram RH" value={escalatedCount} detail="Casos em que a liderança solicitou participação direta do RH." icon={<UserRoundCheck className="h-4 w-4" />} attention />
        <Metric label="Pedidos de apoio" value={supportCount} detail="Conversas e atendimentos ainda em acompanhamento." icon={<LifeBuoy className="h-4 w-4" />} attention />
        <Metric label="Pessoas ativas" value={peopleCount} detail="Colaboradores ativos nas unidades cadastradas." icon={<UsersRound className="h-4 w-4" />} />
      </div>
    </section>
  );
}
