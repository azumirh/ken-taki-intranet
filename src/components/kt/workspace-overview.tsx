import {
  Building2,
  CheckCircle2,
  FileCheck2,
  LifeBuoy,
  MessageSquareText,
  RefreshCw,
  ShieldCheck,
  UserRoundCheck,
  UsersRound,
} from "lucide-react";
import { useCallback, useEffect, useState, type ReactNode } from "react";
import { filialNome, iniciais } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";
import { useUserProfile, userProfileFrameStyle } from "@/lib/user-profile";

type Mode = "manager" | "hr";

type Profile = {
  id: string;
  tipo: string;
  filial: string | null;
  nome: string;
  admin_nivel?: "geral" | "parcial" | null;
};

type MetricProps = {
  label: string;
  value: number;
  detail: string;
  icon: ReactNode;
  attention?: boolean;
  tone?: "plum" | "warm" | "green" | "neutral";
};

function Metric({ label, value, detail, icon, attention = false, tone = "neutral" }: MetricProps) {
  const activeAttention = attention && value > 0;
  const toneClasses = {
    plum: "border-[#4b3142]/18 bg-[#f2eaef] text-[#4b3142]",
    warm: "border-[#9a6a21]/20 bg-[#f8f0df] text-[#8b611f]",
    green: "border-success/20 bg-success-soft text-success",
    neutral: "border-border bg-card text-muted-foreground",
  }[activeAttention ? "warm" : tone];

  return (
    <div className={`relative min-h-[126px] overflow-hidden rounded-xl border p-4 ${toneClasses}`}>
      <div className="absolute inset-x-0 top-0 h-1 bg-current opacity-40" />
      <div className="flex items-start justify-between gap-3">
        <span className="grid h-9 w-9 place-items-center rounded-lg bg-white/70 shadow-sm ring-1 ring-black/[0.04]">
          {icon}
        </span>
        <p className="text-3xl font-bold tabular-nums tracking-tight text-foreground">{value}</p>
      </div>
      <p className="mt-3 text-sm font-bold text-foreground">{label}</p>
      <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</p>
      {activeAttention ? <span className="absolute right-3 top-3 h-2 w-2 rounded-full bg-warn ring-4 ring-warn/10" /> : null}
    </div>
  );
}

export function WorkspaceOverview({ mode }: { mode: Mode }) {
  const { profile: personalProfile } = useUserProfile();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [triageCount, setTriageCount] = useState(0);
  const [escalatedCount, setEscalatedCount] = useState(0);
  const [supportCount, setSupportCount] = useState(0);
  const [documentsPending, setDocumentsPending] = useState(0);
  const [peopleCount, setPeopleCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;

      const { data: p } = await supabase
        .from("kt_perfis")
        .select("id,tipo,filial,nome,admin_nivel")
        .eq("id", auth.user.id)
        .maybeSingle();
      if (!p) return;

      const current = p as Profile;
      setProfile(current);

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
          supabase
            .from("kt_ajuda")
            .select("id", { count: "exact", head: true })
            .neq("status", "resolvido"),
          supabase
            .from("kt_colaboradores")
            .select("id", { count: "exact", head: true })
            .eq("ativo", true),
        ]);
        setTriageCount(triage.count ?? 0);
        setEscalatedCount(escalated.count ?? 0);
        setSupportCount(help.count ?? 0);
        setPeopleCount(people.count ?? 0);
        setFeedbackCount(0);
        setDocumentsPending(0);
        return;
      }

      if (!current.filial) return;
      const filial = current.filial;
      const [feedbacks, help, docs, signatures, people] = await Promise.all([
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
      ]);
      setFeedbackCount(feedbacks.count ?? 0);
      setSupportCount(help.count ?? 0);
      setPeopleCount(people.count ?? 0);
      const signed = new Set((signatures.data ?? []).map((item) => String(item.politica)));
      setDocumentsPending((docs.data ?? []).filter((item) => !signed.has(String(item.id))).length);
      setTriageCount(0);
      setEscalatedCount(0);
    } finally {
      setLoading(false);
    }
  }, [mode]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!profile) return null;

  const attentionCount =
    mode === "hr"
      ? triageCount + escalatedCount + supportCount
      : feedbackCount + supportCount + documentsPending;
  const roleLabel =
    mode === "hr"
      ? profile.admin_nivel === "parcial"
        ? "Administrador parcial"
        : "Administrador geral"
      : "Gestão da unidade";
  const displayName = personalProfile.displayName || profile.nome;
  const preferredName = personalProfile.nickname || displayName;
  const accent = personalProfile.accentColor || "#4b3142";

  return (
    <section className="mb-5 grid gap-4" aria-label="Resumo de pendências">
      <div
        className="relative overflow-hidden rounded-2xl border px-5 py-5 text-[#f8f1e9] shadow-[0_18px_50px_-34px_rgba(44,28,39,0.8)] sm:px-6 sm:py-6"
        style={{
          borderColor: `${accent}cc`,
          background: `linear-gradient(120deg,#292523 0%,${accent} 58%,#5a524d 100%)`,
        }}
      >
        <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full border border-white/10" />
        <div className="pointer-events-none absolute -right-4 -top-8 h-36 w-36 rounded-full border border-white/[0.07]" />
        <div className="relative grid gap-5 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex min-w-0 items-center gap-4">
            <span className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-[#f3ece5] text-base font-bold text-[#3a2833] shadow-lg shadow-black/15">
              {personalProfile.avatarUrl ? (
                <img
                  src={personalProfile.avatarUrl}
                  alt={displayName}
                  className="h-full w-full object-cover"
                  style={userProfileFrameStyle(personalProfile)}
                />
              ) : (
                iniciais(displayName)
              )}
            </span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-md border border-white/15 bg-white/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.13em] text-white/90">
                  {mode === "hr" ? "RH" : "Gestão"}
                </span>
                <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-white/65">
                  {mode === "hr" ? <ShieldCheck className="h-3.5 w-3.5" /> : <Building2 className="h-3.5 w-3.5" />}
                  {roleLabel}
                </span>
              </div>
              <h1 className="mt-2 truncate text-2xl font-bold tracking-tight text-white sm:text-[2rem]">
                {preferredName}
              </h1>
              {personalProfile.nickname && displayName ? (
                <p className="mt-0.5 text-xs font-semibold text-white/65">{displayName}</p>
              ) : null}
              <p className="mt-1 text-xs leading-relaxed text-white/65 sm:text-sm">
                {personalProfile.showBio && personalProfile.bio
                  ? personalProfile.bio
                  : mode === "hr"
                    ? "Visão consolidada de pessoas, casos, comunicação e governança Ken Taki."
                    : `Prioridades operacionais e acompanhamento de ${filialNome(profile.filial ?? undefined)}.`}
              </p>
              {personalProfile.showGender && personalProfile.gender ? (
                <p className="mt-2 text-[11px] font-medium text-white/55">{personalProfile.gender}</p>
              ) : null}
            </div>
          </div>

          <div className="flex items-center gap-3 border-t border-white/10 pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div>
              <p className="text-[10px] font-bold uppercase tracking-[0.14em] text-white/50">Precisa de ação</p>
              <div className="mt-1 flex items-end gap-2">
                <p className="text-3xl font-bold tabular-nums text-white">{attentionCount}</p>
                <span className="pb-1 text-[11px] text-white/55">pendência{attentionCount === 1 ? "" : "s"}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => void load()}
              disabled={loading}
              className="ml-auto grid h-10 w-10 place-items-center rounded-lg border border-white/15 bg-white/10 text-white/70 transition hover:bg-white/15 hover:text-white disabled:opacity-50 lg:ml-2"
              aria-label="Atualizar visão geral"
              title="Atualizar"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      <div>
        <div className="mb-2 flex items-end justify-between gap-3">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.17em]" style={{ color: accent }}>
              {mode === "hr" ? "Radar de pessoas" : "Radar da unidade"}
            </p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              Leitura rápida; os casos que precisam de trabalho ficam logo abaixo.
            </p>
          </div>
          {attentionCount === 0 ? (
            <span className="hidden items-center gap-1.5 rounded-md bg-success-soft px-2.5 py-1.5 text-[11px] font-bold text-success sm:inline-flex">
              <CheckCircle2 className="h-3.5 w-3.5" /> Tudo sob controle
            </span>
          ) : null}
        </div>

        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {mode === "hr" ? (
            <>
              <Metric
                label="Triagens sensíveis"
                value={triageCount}
                detail="Relatos que ainda exigem decisão de confidencialidade e encaminhamento."
                icon={<ShieldCheck className="h-4 w-4" />}
                attention
                tone="plum"
              />
              <Metric
                label="Gestores pediram RH"
                value={escalatedCount}
                detail="Casos em que a liderança solicitou participação direta do RH."
                icon={<UserRoundCheck className="h-4 w-4" />}
                attention
                tone="warm"
              />
              <Metric
                label="Pedidos de apoio"
                value={supportCount}
                detail="Conversas e atendimentos ainda em acompanhamento."
                icon={<LifeBuoy className="h-4 w-4" />}
                attention
                tone="plum"
              />
              <Metric
                label="Pessoas ativas"
                value={peopleCount}
                detail="Colaboradores ativos nas unidades cadastradas na intranet."
                icon={<UsersRound className="h-4 w-4" />}
                tone="neutral"
              />
            </>
          ) : (
            <>
              <Metric
                label="Feedbacks em acompanhamento"
                value={feedbackCount}
                detail="Casos destinados ou liberados pelo RH para sua unidade."
                icon={<MessageSquareText className="h-4 w-4" />}
                attention
                tone="plum"
              />
              <Metric
                label="Pedidos de conversa"
                value={supportCount}
                detail="Solicitações diretas ou encaminhadas para sua atuação."
                icon={<LifeBuoy className="h-4 w-4" />}
                attention
                tone="warm"
              />
              <Metric
                label="Documentos pendentes"
                value={documentsPending}
                detail="Documentos disponíveis que ainda não têm sua assinatura."
                icon={<FileCheck2 className="h-4 w-4" />}
                attention
                tone="green"
              />
              <Metric
                label="Pessoas da unidade"
                value={peopleCount}
                detail="Colaboradores ativos vinculados à sua unidade."
                icon={<UsersRound className="h-4 w-4" />}
                tone="neutral"
              />
            </>
          )}
        </div>
      </div>
    </section>
  );
}
