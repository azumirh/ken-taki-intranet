import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import {
  CheckCircle2,
  Eye,
  MessageSquareReply,
  MousePointerClick,
  RefreshCw,
  ThumbsDown,
  ThumbsUp,
  UsersRound,
} from "lucide-react";
import { useAdminPermissions } from "@/lib/admin-permissions";
import { supabase } from "@/lib/supabase";

type ContentType = "noticia" | "mural" | "pesquisa";
type Filter = "all" | ContentType;

type Interaction = {
  actor_auth_id: string;
  content_type: ContentType;
  content_id: string;
  action: "view" | "click" | "like" | "dislike" | "ack" | "responded_yes" | "responded_no";
  created_at: string;
};

type Person = {
  nome: string;
  filial: string;
  auth_user_id: string | null;
};

type ContentItem = {
  type: ContentType;
  id: string;
  title: string;
  filial: string | null;
  date: string;
};

function formatDate(value: string) {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "—";
  return parsed.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function typeLabel(type: ContentType) {
  if (type === "noticia") return "Notícia / vídeo";
  if (type === "mural") return "Mural";
  return "Pesquisa";
}

function percent(value: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((value / total) * 100)}%`;
}

function Metric({ icon, label, value }: { icon: ReactNode; label: string; value: string | number }) {
  return (
    <div className="rounded-md border border-border bg-background/55 px-3 py-2.5">
      <div className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}

function PersonList({ label, people, tone = "default" }: { label: string; people: Person[]; tone?: "default" | "success" | "warn" }) {
  const labelClass = tone === "success" ? "text-success" : tone === "warn" ? "text-warn" : "text-foreground";
  return (
    <div>
      <p className={`font-bold ${labelClass}`}>{label} · {people.length}</p>
      <p className="mt-1 leading-relaxed text-muted-foreground">
        {people.length ? people.map((person) => person.nome).join(", ") : "Ninguém ainda."}
      </p>
    </div>
  );
}

export function WorkspaceContentAnalytics() {
  const { loading: permissionLoading, can } = useAdminPermissions();
  const [filter, setFilter] = useState<Filter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [people, setPeople] = useState<Person[]>([]);
  const [content, setContent] = useState<ContentItem[]>([]);

  const allowedTypes = useMemo<ContentType[]>(() => {
    const result: ContentType[] = [];
    if (can("noticias", "view")) result.push("noticia");
    if (can("mural", "view")) result.push("mural");
    if (can("pesquisas", "view")) result.push("pesquisa");
    return result;
  }, [can]);
  const allowedKey = allowedTypes.join("|");

  const load = useCallback(async () => {
    if (permissionLoading || allowedTypes.length === 0) {
      setInteractions([]);
      setPeople([]);
      setContent([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [interactionRes, peopleRes, newsRes, muralRes, surveyRes] = await Promise.all([
        supabase
          .from("kt_content_interactions")
          .select("actor_auth_id,content_type,content_id,action,created_at")
          .in("content_type", allowedTypes)
          .order("created_at", { ascending: false })
          .limit(5000),
        supabase
          .from("kt_colaboradores")
          .select("nome,filial,auth_user_id")
          .eq("ativo", true),
        allowedTypes.includes("noticia")
          ? supabase.from("kt_noticias").select("id,titulo,created_at").order("created_at", { ascending: false }).limit(40)
          : Promise.resolve({ data: [], error: null }),
        allowedTypes.includes("mural")
          ? supabase.from("kt_mural").select("id,titulo,mensagem,filial,created_at").order("created_at", { ascending: false }).limit(50)
          : Promise.resolve({ data: [], error: null }),
        allowedTypes.includes("pesquisa")
          ? supabase.from("kt_pesquisas").select("id,titulo,ts,ativa").order("ts", { ascending: false }).limit(30)
          : Promise.resolve({ data: [], error: null }),
      ]);

      const firstError = [interactionRes.error, peopleRes.error, newsRes.error, muralRes.error, surveyRes.error].find(Boolean);
      if (firstError) throw firstError;

      setInteractions((interactionRes.data ?? []) as Interaction[]);
      setPeople((peopleRes.data ?? []) as Person[]);

      const items: ContentItem[] = [
        ...(newsRes.data ?? []).map((item) => ({
          type: "noticia" as const,
          id: String(item.id),
          title: String(item.titulo || "Notícia sem título"),
          filial: null,
          date: String(item.created_at),
        })),
        ...(muralRes.data ?? []).map((item) => ({
          type: "mural" as const,
          id: String(item.id),
          title: String(item.titulo || item.mensagem || "Publicação no mural"),
          filial: item.filial ? String(item.filial) : null,
          date: String(item.created_at),
        })),
        ...(surveyRes.data ?? []).map((item) => ({
          type: "pesquisa" as const,
          id: String(item.id),
          title: `${String(item.titulo || "Pesquisa")}${item.ativa ? " · ativa" : ""}`,
          filial: null,
          date: String(item.ts),
        })),
      ].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

      setContent(items);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Não foi possível carregar o engajamento.");
    } finally {
      setLoading(false);
    }
  }, [allowedKey, permissionLoading]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (filter !== "all" && !allowedTypes.includes(filter)) setFilter("all");
  }, [allowedKey, filter]);

  const visible = useMemo(
    () => content.filter((item) => allowedTypes.includes(item.type) && (filter === "all" || item.type === filter)).slice(0, 16),
    [content, filter, allowedKey],
  );

  const filterOptions: Array<[Filter, string]> = [
    ["all", "Todos"],
    ...(allowedTypes.includes("noticia") ? [["noticia", "Notícias e vídeos"] as [Filter, string]] : []),
    ...(allowedTypes.includes("mural") ? [["mural", "Mural"] as [Filter, string]] : []),
    ...(allowedTypes.includes("pesquisa") ? [["pesquisa", "Pesquisas"] as [Filter, string]] : []),
  ];

  if (permissionLoading || allowedTypes.length === 0) return null;

  return (
    <section id="engajamento" className="mb-5 scroll-mt-24 rounded-lg border border-border bg-card shadow-sm">
      <div className="flex flex-col gap-3 border-b border-border px-4 py-4 sm:flex-row sm:items-start sm:justify-between sm:px-5 lg:px-6">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-kt">Comunicação interna</p>
          <h2 className="mt-1 text-lg font-bold text-foreground">Engajamento de conteúdo</h2>
          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-muted-foreground">
            Veja quem recebeu de fato cada conteúdo: visualizações, cliques, reações, ciência no mural e confirmação de resposta em pesquisas.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading}
          className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-muted-foreground hover:bg-muted disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} /> Atualizar
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 border-b border-border px-4 py-3 sm:px-5 lg:px-6">
        {filterOptions.map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-md border px-3 py-1.5 text-xs font-semibold transition-colors ${
              filter === value
                ? "border-kt bg-kt text-white"
                : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error ? (
        <div className="px-5 py-8 text-sm text-destructive">{error}</div>
      ) : loading ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando indicadores...</div>
      ) : visible.length === 0 ? (
        <div className="px-5 py-10 text-center text-sm text-muted-foreground">Nenhum conteúdo publicado neste filtro.</div>
      ) : (
        <div className="grid gap-3 p-4 sm:p-5 lg:p-6">
          {visible.map((item) => {
            const audience = people.filter(
              (person) => !item.filial || item.filial === "todas" || person.filial === item.filial,
            );
            const trackable = audience.filter((person) => Boolean(person.auth_user_id));
            const itemRows = interactions.filter(
              (row) => row.content_type === item.type && row.content_id === item.id,
            );
            const actorsFor = (action: Interaction["action"]) =>
              new Set(itemRows.filter((row) => row.action === action).map((row) => row.actor_auth_id));
            const peopleFor = (actors: Set<string>) =>
              trackable.filter((person) => person.auth_user_id && actors.has(person.auth_user_id));

            const viewed = actorsFor("view");
            const clicked = actorsFor("click");
            const liked = actorsFor("like");
            const disliked = actorsFor("dislike");
            const acknowledged = actorsFor("ack");
            const respondedYes = actorsFor("responded_yes");
            const respondedNo = actorsFor("responded_no");

            const viewedPeople = peopleFor(viewed);
            const notViewedPeople = trackable.filter((person) => person.auth_user_id && !viewed.has(person.auth_user_id));
            const withoutIdentity = audience.filter((person) => !person.auth_user_id);
            const clickedPeople = peopleFor(clicked);
            const likedPeople = peopleFor(liked);
            const dislikedPeople = peopleFor(disliked);
            const acknowledgedPeople = peopleFor(acknowledged);
            const respondedYesPeople = peopleFor(respondedYes);
            const respondedNoPeople = peopleFor(respondedNo);

            return (
              <article key={`${item.type}:${item.id}`} className="rounded-lg border border-border bg-background/35 p-4">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="rounded-md bg-kt-soft px-2 py-1 text-[9px] font-bold uppercase tracking-[0.1em] text-kt">
                        {typeLabel(item.type)}
                      </span>
                      {item.filial && item.filial !== "todas" ? (
                        <span className="text-[10px] font-medium text-muted-foreground">{item.filial}</span>
                      ) : (
                        <span className="text-[10px] font-medium text-muted-foreground">Todas as unidades</span>
                      )}
                    </div>
                    <h3 className="mt-2 text-sm font-bold leading-snug text-foreground">{item.title}</h3>
                    <p className="mt-1 text-[11px] text-muted-foreground">Publicado em {formatDate(item.date)}</p>
                  </div>
                  <div className="text-left sm:text-right">
                    <p className="text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground">Alcance</p>
                    <p className="mt-0.5 text-xl font-bold text-foreground">{percent(viewedPeople.length, trackable.length)}</p>
                    <p className="text-[10px] text-muted-foreground">{viewedPeople.length} de {trackable.length} rastreáveis</p>
                  </div>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <Metric icon={<Eye className="h-3 w-3" />} label="Visualizaram" value={viewedPeople.length} />
                  {item.type === "noticia" ? (
                    <>
                      <Metric icon={<MousePointerClick className="h-3 w-3" />} label="Cliques" value={clicked.size} />
                      <Metric icon={<ThumbsUp className="h-3 w-3" />} label="Gostei" value={liked.size} />
                      <Metric icon={<ThumbsDown className="h-3 w-3" />} label="Não útil" value={disliked.size} />
                    </>
                  ) : item.type === "mural" ? (
                    <>
                      <Metric icon={<CheckCircle2 className="h-3 w-3" />} label="Cientes" value={acknowledged.size} />
                      <Metric icon={<UsersRound className="h-3 w-3" />} label="Público" value={trackable.length} />
                    </>
                  ) : (
                    <>
                      <Metric icon={<MousePointerClick className="h-3 w-3" />} label="Abriram" value={clicked.size} />
                      <Metric icon={<MessageSquareReply className="h-3 w-3" />} label="Responderam" value={respondedYes.size} />
                      <Metric icon={<UsersRound className="h-3 w-3" />} label="Ainda não" value={respondedNo.size} />
                    </>
                  )}
                </div>

                <details className="mt-3 rounded-md border border-border bg-card px-3 py-2.5">
                  <summary className="cursor-pointer text-xs font-bold text-foreground">Ver pessoas e pendências</summary>
                  <div className="mt-3 grid gap-3 text-xs sm:grid-cols-3">
                    <PersonList label="Visualizaram" people={viewedPeople} tone="success" />
                    <PersonList label="Ainda não visualizaram" people={notViewedPeople} tone="warn" />
                    <div>
                      <p className="font-bold text-muted-foreground">Sem login rastreável · {withoutIdentity.length}</p>
                      <p className="mt-1 leading-relaxed text-muted-foreground">
                        {withoutIdentity.length ? withoutIdentity.map((person) => person.nome).join(", ") : "Nenhum."}
                      </p>
                    </div>
                  </div>

                  <div className="mt-4 border-t border-border pt-3 text-xs">
                    {item.type === "noticia" ? (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <PersonList label="Clicaram" people={clickedPeople} />
                        <PersonList label="Gostaram" people={likedPeople} tone="success" />
                        <PersonList label="Marcaram não útil" people={dislikedPeople} tone="warn" />
                      </div>
                    ) : item.type === "mural" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        <PersonList label="Marcaram ciente" people={acknowledgedPeople} tone="success" />
                        <PersonList
                          label="Ainda sem ciência"
                          people={trackable.filter((person) => person.auth_user_id && !acknowledged.has(person.auth_user_id))}
                          tone="warn"
                        />
                      </div>
                    ) : (
                      <div className="grid gap-3 sm:grid-cols-3">
                        <PersonList label="Abriram o formulário" people={clickedPeople} />
                        <PersonList label="Confirmaram resposta" people={respondedYesPeople} tone="success" />
                        <PersonList label="Disseram ainda não" people={respondedNoPeople} tone="warn" />
                      </div>
                    )}
                  </div>
                </details>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
