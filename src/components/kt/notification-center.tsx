import {
  Bell,
  CheckCheck,
  ChevronRight,
  FileCheck2,
  LifeBuoy,
  MessageSquareText,
  ShieldAlert,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";
import { useNotifications } from "@/lib/notifications";

type Filter = "all" | "unread" | "attention";

type NotificationMeta = {
  label: string;
  tone: "neutral" | "attention" | "critical" | "success";
  icon: ReactNode;
};

const ATTENTION_TYPES = new Set([
  "feedback_received",
  "support_requested",
  "manager_escalated_support_to_hr",
  "feedback_released_to_manager",
  "hr_involved",
]);

function formatWhen(value: string) {
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function metaFor(type: string, title: string): NotificationMeta {
  if (type === "document_signed") {
    return {
      label: "Documento",
      tone: "success",
      icon: <FileCheck2 className="h-4 w-4" />,
    };
  }
  if (type === "manager_escalated_support_to_hr") {
    return {
      label: "Escalonamento",
      tone: "critical",
      icon: <ShieldAlert className="h-4 w-4" />,
    };
  }
  if (type === "support_requested") {
    return {
      label: "Apoio",
      tone: "attention",
      icon: <LifeBuoy className="h-4 w-4" />,
    };
  }
  if (type.includes("manager") || title.toLowerCase().includes("gestor")) {
    return {
      label: "Gestão",
      tone: "attention",
      icon: <UserRoundCheck className="h-4 w-4" />,
    };
  }
  return {
    label: "Feedback",
    tone: ATTENTION_TYPES.has(type) ? "attention" : "neutral",
    icon: <MessageSquareText className="h-4 w-4" />,
  };
}

function toneClasses(tone: NotificationMeta["tone"], read: boolean) {
  if (read) return "border-border bg-muted text-muted-foreground";
  if (tone === "critical") return "border-destructive/25 bg-destructive/8 text-destructive";
  if (tone === "attention") return "border-warn/25 bg-warn-soft text-warn";
  if (tone === "success") return "border-success/25 bg-success-soft text-success";
  return "border-kt/20 bg-kt-soft text-kt";
}

function actionLabel(actionUrl?: string | null) {
  if (!actionUrl) return "Abrir";
  if (actionUrl.includes("feedback")) return "Ver feedback";
  if (actionUrl.includes("apoio")) return "Abrir atendimento";
  if (actionUrl.includes("document")) return "Ver documentos";
  return "Abrir item";
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();

  const attentionCount = useMemo(
    () => items.filter((item) => ATTENTION_TYPES.has(item.type) && !item.readAt).length,
    [items],
  );

  const visibleItems = useMemo(() => {
    if (filter === "unread") return items.filter((item) => !item.readAt);
    if (filter === "attention") return items.filter((item) => ATTENTION_TYPES.has(item.type));
    return items;
  }, [filter, items]);

  return (
    <>
      <button
        type="button"
        aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ""}`}
        title="Notificações"
        onClick={() => setOpen(true)}
        className="relative grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-md bg-kt px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white shadow-sm">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="fixed inset-0 z-[70]">
          <button
            type="button"
            aria-label="Fechar notificações"
            className="absolute inset-0 bg-black/25 backdrop-blur-[1px]"
            onClick={() => setOpen(false)}
          />

          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[500px] flex-col border-l border-border bg-card shadow-2xl sm:w-[min(94vw,500px)]">
            <header className="border-b border-border px-4 py-4 sm:px-5">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-base font-bold text-foreground">Central de atividades</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                    Acompanhe o que aconteceu e o que ainda precisa de ação.
                  </p>
                </div>
                <button
                  type="button"
                  className="grid h-9 w-9 place-items-center rounded-md border border-border text-muted-foreground hover:bg-muted hover:text-foreground"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2">
                <div className="rounded-md border border-border bg-muted/35 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Não lidas</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{unreadCount}</p>
                </div>
                <div className="rounded-md border border-warn/20 bg-warn-soft/45 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-warn">Atenção</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-warn">{attentionCount}</p>
                </div>
                <div className="rounded-md border border-border bg-muted/35 px-3 py-2">
                  <p className="text-[10px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Total</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-foreground">{items.length}</p>
                </div>
              </div>
            </header>

            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-2.5 sm:px-5">
              <div className="flex gap-1 rounded-md bg-muted p-1">
                {([
                  ["all", "Todas"],
                  ["unread", "Não lidas"],
                  ["attention", "Atenção"],
                ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`rounded px-2.5 py-1.5 text-[11px] font-semibold transition-colors ${
                      filter === value ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex min-h-8 items-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-kt hover:bg-kt-soft"
                >
                  <CheckCheck className="h-3.5 w-3.5" />
                  Marcar tudo como lido
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando atividades...</p>
              ) : visibleItems.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">Nada por aqui</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Não há atividades que correspondam a este filtro.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {visibleItems.map((item) => {
                    const meta = metaFor(item.type, item.title);
                    return (
                      <button
                        type="button"
                        key={item.id}
                        onClick={() => {
                          if (!item.readAt) void markRead(item.id);
                          if (item.actionUrl) window.location.href = item.actionUrl;
                          setOpen(false);
                        }}
                        className={`block w-full px-4 py-4 text-left transition-colors hover:bg-muted/45 sm:px-5 ${
                          item.readAt ? "bg-card" : "bg-background/55"
                        }`}
                      >
                        <div className="flex items-start gap-3.5">
                          <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-md border ${toneClasses(meta.tone, Boolean(item.readAt))}`}>
                            {meta.icon}
                          </span>
                          <span className="min-w-0 flex-1">
                            <span className="flex flex-wrap items-center gap-2">
                              <span className="rounded-md bg-muted px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.1em] text-muted-foreground">
                                {meta.label}
                              </span>
                              {!item.readAt ? <span className="h-1.5 w-1.5 rounded-full bg-kt" /> : null}
                              <span className="ml-auto text-[10px] font-medium text-muted-foreground">{formatWhen(item.createdAt)}</span>
                            </span>
                            <span className="mt-1.5 block text-sm font-semibold leading-snug text-foreground">{item.title}</span>
                            {item.body ? (
                              <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">{item.body}</span>
                            ) : null}
                            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-kt">
                              {actionLabel(item.actionUrl)} <ChevronRight className="h-3.5 w-3.5" />
                            </span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
