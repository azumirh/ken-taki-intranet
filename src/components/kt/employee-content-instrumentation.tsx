import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { CheckCircle2, ExternalLink, ThumbsDown, ThumbsUp } from "lucide-react";
import {
  fetchOwnContentInteractions,
  recordContentAction,
  setExclusiveContentAction,
  type ContentAction,
  type ContentType,
} from "@/lib/content-interactions";
import { useMural, useNoticias, usePesquisa, useSession } from "@/lib/kt-store";

type PortalTarget = {
  key: string;
  type: "noticia" | "mural";
  id: string;
  element: HTMLDivElement;
  videoUrl?: string | undefined;
};

type ActionMap = Record<string, ContentAction[]>;

function mapKey(type: ContentType, id: string) {
  return `${type}:${id}`;
}

function addLocalAction(
  current: ActionMap,
  type: ContentType,
  id: string,
  action: ContentAction,
): ActionMap {
  const key = mapKey(type, id);
  const values = new Set(current[key] ?? []);
  values.add(action);
  return { ...current, [key]: [...values] };
}

function setLocalExclusive(
  current: ActionMap,
  type: ContentType,
  id: string,
  group: ContentAction[],
  action: ContentAction | null,
): ActionMap {
  const key = mapKey(type, id);
  const values = new Set(current[key] ?? []);
  group.forEach((value) => values.delete(value));
  if (action) values.add(action);
  return { ...current, [key]: [...values] };
}

export function EmployeeContentInstrumentation() {
  const [session] = useSession();
  const [mural] = useMural();
  const [noticias] = useNoticias();
  const [pesquisa] = usePesquisa();
  const [targets, setTargets] = useState<PortalTarget[]>([]);
  const [actions, setActions] = useState<ActionMap>({});

  const muralFiltrado = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return [];
    return mural.filter(
      (item) =>
        !item.filial || item.filial === "todas" || item.filial === session.filial,
    );
  }, [mural, session]);

  const newsKey = noticias.map((item) => item.id).join("|");
  const muralKey = muralFiltrado.map((item) => item.id).join("|");
  const surveyKey = pesquisa?.id ?? "";
  const surveyActionKey = pesquisa
    ? [...(actions[mapKey("pesquisa", pesquisa.id)] ?? [])].sort().join("|")
    : "";

  useEffect(() => {
    let cancelled = false;
    void fetchOwnContentInteractions().then((rows) => {
      if (cancelled) return;
      const next: ActionMap = {};
      rows.forEach((row) => {
        const key = mapKey(row.content_type, row.content_id);
        next[key] = [...(next[key] ?? []), row.action];
      });
      setActions(next);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!session || session.tipo !== "colaborador") return;

    let active = true;
    const cleanups: Array<() => void> = [];
    const nextTargets: PortalTarget[] = [];
    const viewTimers = new Map<Element, number>();

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const node = entry.target as HTMLElement;
          const type = node.dataset["ktContentType"] as ContentType | undefined;
          const id = node.dataset["ktContentId"];
          if (!type || !id) return;

          if (entry.isIntersecting && entry.intersectionRatio >= 0.5) {
            if (viewTimers.has(node)) return;
            const timer = window.setTimeout(() => {
              void recordContentAction(type, id, "view");
              viewTimers.delete(node);
              observer.unobserve(node);
            }, 700);
            viewTimers.set(node, timer);
          } else {
            const timer = viewTimers.get(node);
            if (timer) window.clearTimeout(timer);
            viewTimers.delete(node);
          }
        });
      },
      { threshold: [0.5] },
    );

    const install = () => {
      if (!active) return;

      const newsCards = Array.from(
        document.querySelectorAll<HTMLElement>("#noticias article"),
      );
      newsCards.forEach((card, index) => {
        const item = noticias[index];
        if (!item) return;
        card.dataset["ktContentType"] = "noticia";
        card.dataset["ktContentId"] = item.id;
        observer.observe(card);

        const host = document.createElement("div");
        host.className = "kt-content-actions-host";
        card.appendChild(host);
        nextTargets.push({
          key: `noticia:${item.id}`,
          type: "noticia",
          id: item.id,
          element: host,
          videoUrl: item.videoUrl,
        });
        cleanups.push(() => host.remove());
      });

      const muralCards = Array.from(
        document.querySelectorAll<HTMLElement>("#mural article"),
      );
      muralCards.forEach((card, index) => {
        const item = muralFiltrado[index];
        if (!item) return;
        card.dataset["ktContentType"] = "mural";
        card.dataset["ktContentId"] = item.id;
        observer.observe(card);

        const host = document.createElement("div");
        host.className = "kt-content-actions-host kt-content-actions-host-mural";
        card.appendChild(host);
        nextTargets.push({
          key: `mural:${item.id}`,
          type: "mural",
          id: item.id,
          element: host,
        });
        cleanups.push(() => host.remove());
      });

      if (pesquisa?.ativa) {
        const surveySection = document.getElementById("clima");
        if (surveySection) {
          surveySection.dataset["ktContentType"] = "pesquisa";
          surveySection.dataset["ktContentId"] = pesquisa.id;
          observer.observe(surveySection);

          const buttons = Array.from(surveySection.querySelectorAll<HTMLButtonElement>("button"));
          const yesButton = buttons.find((button) => button.textContent?.includes("Já respondi"));
          const noButton = buttons.find((button) => button.textContent?.includes("Ainda não respondi"));
          const responseRow = yesButton?.parentElement ?? noButton?.parentElement ?? null;
          const surveyActions = actions[mapKey("pesquisa", pesquisa.id)] ?? [];
          const shouldShowResponse =
            surveyActions.includes("click") ||
            surveyActions.includes("responded_yes") ||
            surveyActions.includes("responded_no");

          if (responseRow && !shouldShowResponse) {
            responseRow.classList.add("hidden");
            cleanups.push(() => responseRow.classList.remove("hidden"));
          }

          const revealResponse = () => {
            if (!responseRow) return;
            responseRow.classList.remove("hidden");
            responseRow.scrollIntoView({ behavior: "smooth", block: "nearest" });
          };

          const surveyAnchor = Array.from(
            surveySection.querySelectorAll<HTMLAnchorElement>("a[href]"),
          ).find((anchor) => anchor.href === pesquisa.link || anchor.getAttribute("href") === pesquisa.link);
          if (surveyAnchor) {
            const onClick = () => {
              void recordContentAction("pesquisa", pesquisa.id, "click").then((result) => {
                if (result.ok) {
                  setActions((current) => addLocalAction(current, "pesquisa", pesquisa.id, "click"));
                }
              });
              window.setTimeout(revealResponse, 250);
            };
            surveyAnchor.addEventListener("click", onClick);
            cleanups.push(() => surveyAnchor.removeEventListener("click", onClick));
          }

          if (yesButton) {
            const onYes = () => {
              void setExclusiveContentAction("pesquisa", pesquisa.id, "responded_yes").then((result) => {
                if (result.ok) {
                  setActions((current) =>
                    setLocalExclusive(
                      current,
                      "pesquisa",
                      pesquisa.id,
                      ["responded_yes", "responded_no"],
                      "responded_yes",
                    ),
                  );
                }
              });
            };
            yesButton.addEventListener("click", onYes);
            cleanups.push(() => yesButton.removeEventListener("click", onYes));
          }

          if (noButton) {
            const onNo = () => {
              void setExclusiveContentAction("pesquisa", pesquisa.id, "responded_no").then((result) => {
                if (result.ok) {
                  setActions((current) =>
                    setLocalExclusive(
                      current,
                      "pesquisa",
                      pesquisa.id,
                      ["responded_yes", "responded_no"],
                      "responded_no",
                    ),
                  );
                }
              });
            };
            noButton.addEventListener("click", onNo);
            cleanups.push(() => noButton.removeEventListener("click", onNo));
          }
        }
      }

      setTargets(nextTargets);
    };

    const frame = window.requestAnimationFrame(install);

    return () => {
      active = false;
      window.cancelAnimationFrame(frame);
      viewTimers.forEach((timer) => window.clearTimeout(timer));
      observer.disconnect();
      cleanups.forEach((cleanup) => cleanup());
    };
  }, [session, newsKey, muralKey, surveyKey, surveyActionKey, pesquisa?.ativa, pesquisa?.link]);

  const hasAction = (type: ContentType, id: string, action: ContentAction) =>
    (actions[mapKey(type, id)] ?? []).includes(action);

  const toggleReaction = async (id: string, action: "like" | "dislike") => {
    const selected = hasAction("noticia", id, action);
    const next = selected ? null : action;
    const result = await setExclusiveContentAction("noticia", id, next);
    if (!result.ok) return;
    setActions((current) =>
      setLocalExclusive(current, "noticia", id, ["like", "dislike"], next),
    );
  };

  const acknowledge = async (id: string) => {
    if (hasAction("mural", id, "ack")) return;
    const result = await recordContentAction("mural", id, "ack");
    if (!result.ok) return;
    setActions((current) => addLocalAction(current, "mural", id, "ack"));
  };

  return (
    <>
      {targets.map((target) =>
        createPortal(
          target.type === "noticia" ? (
            <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-4 py-3">
              <span className="mr-auto text-[11px] font-semibold text-muted-foreground">
                Este conteúdo foi útil?
              </span>
              <button
                type="button"
                onClick={() => void toggleReaction(target.id, "like")}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
                  hasAction("noticia", target.id, "like")
                    ? "border-success/30 bg-success-soft text-success"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
                aria-pressed={hasAction("noticia", target.id, "like")}
              >
                <ThumbsUp className="h-3.5 w-3.5" /> Gostei
              </button>
              <button
                type="button"
                onClick={() => void toggleReaction(target.id, "dislike")}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-semibold transition-colors ${
                  hasAction("noticia", target.id, "dislike")
                    ? "border-destructive/25 bg-destructive/5 text-destructive"
                    : "border-border bg-card text-muted-foreground hover:bg-muted"
                }`}
                aria-pressed={hasAction("noticia", target.id, "dislike")}
              >
                <ThumbsDown className="h-3.5 w-3.5" /> Não foi útil
              </button>
              {target.videoUrl ? (
                <a
                  href={target.videoUrl}
                  target="_blank"
                  rel="noreferrer"
                  onClick={() => void recordContentAction("noticia", target.id, "click")}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-xs font-bold text-kt hover:bg-kt-soft"
                >
                  Abrir vídeo <ExternalLink className="h-3.5 w-3.5" />
                </a>
              ) : null}
            </div>
          ) : (
            <div className="mt-3 border-t border-current/10 pt-3">
              <button
                type="button"
                onClick={() => void acknowledge(target.id)}
                disabled={hasAction("mural", target.id, "ack")}
                className={`inline-flex min-h-8 items-center gap-1.5 rounded-md border px-3 text-xs font-bold transition-colors ${
                  hasAction("mural", target.id, "ack")
                    ? "border-success/25 bg-success-soft text-success"
                    : "border-current/15 bg-white/55 text-foreground hover:bg-white/80"
                }`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {hasAction("mural", target.id, "ack") ? "Ciente ✓" : "Marcar como ciente"}
              </button>
            </div>
          ),
          target.element,
          target.key,
        ),
      )}
    </>
  );
}
