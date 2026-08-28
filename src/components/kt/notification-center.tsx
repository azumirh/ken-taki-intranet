import "./workspace-admin.css";
import {
  Bell,
  CheckCheck,
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  LifeBuoy,
  MessageSquareText,
  ShieldAlert,
  Star,
  UserRoundCheck,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { useNotifications } from "@/lib/notifications";

type Filter = "all" | "unread" | "attention";
type NotificationMeta = {
  label: string;
  tone: "neutral" | "attention" | "critical" | "success";
  icon: ReactNode;
};

const ATTENTION_TYPES = new Set([
  "feedback_received",
  "feedback_triage_required",
  "feedback_released_by_hr",
  "support_requested",
  "manager_escalated_to_hr",
  "manager_escalated_support_to_hr",
  "hr_involved",
  "employee_record_updated",
  "survey_pending",
  "document_pending",
  "document_signature_pending",
  "case_followup",
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
  if (type === "survey_pending" || type.includes("survey")) {
    return { label: "Pesquisa de clima", tone: "attention", icon: <ClipboardCheck className="h-4 w-4" /> };
  }
  if (type === "document_pending" || type === "document_signature_pending") {
    return { label: "Documento", tone: "attention", icon: <FileCheck2 className="h-4 w-4" /> };
  }
  if (type === "document_signed") {
    return { label: "Documento", tone: "success", icon: <FileCheck2 className="h-4 w-4" /> };
  }
  if (type === "recognition") {
    return { label: "Reconhecimento", tone: "success", icon: <Star className="h-4 w-4" /> };
  }
  if (type === "feedback_triage_required" || type === "confidential_case") {
    return { label: "Triagem", tone: "critical", icon: <ShieldAlert className="h-4 w-4" /> };
  }
  if (type === "manager_escalated_to_hr" || type === "manager_escalated_support_to_hr") {
    return { label: "Escalonamento", tone: "critical", icon: <ShieldAlert className="h-4 w-4" /> };
  }
  if (type === "support_requested") {
    return { label: "Apoio", tone: "attention", icon: <LifeBuoy className="h-4 w-4" /> };
  }
  if (type === "employee_record_updated") {
    return { label: "Cadastro", tone: "attention", icon: <UserRoundCheck className="h-4 w-4" /> };
  }
  if (type === "feedback_released_by_hr" || type.includes("manager") || title.toLowerCase().includes("gestor")) {
    return { label: "Gestão", tone: "attention", icon: <UserRoundCheck className="h-4 w-4" /> };
  }
  return {
    label: "Atividade",
    tone: ATTENTION_TYPES.has(type) ? "attention" : "neutral",
    icon: <MessageSquareText className="h-4 w-4" />,
  };
}

function toneClasses(tone: NotificationMeta["tone"], read: boolean) {
  if (read) return "border-border bg-muted text-muted-foreground";
  if (tone === "critical") return "border-destructive/25 bg-destructive/10 text-destructive";
  if (tone === "attention") return "border-warn/25 bg-warn-soft text-warn";
  if (tone === "success") return "border-success/25 bg-success-soft text-success";
  return "border-kt/20 bg-kt-soft text-kt";
}

function actionLabel(actionUrl?: string | null) {
  if (!actionUrl) return "Abrir";
  if (actionUrl.includes("pesquisa") || actionUrl.includes("clima")) return "Ver pesquisa";
  if (actionUrl.includes("feedback")) return "Ver feedback";
  if (actionUrl.includes("apoio")) return "Abrir atendimento";
  if (actionUrl.includes("equipe")) return "Ver equipe";
  if (actionUrl.includes("document") || actionUrl.includes("politicas")) return "Ver documentos";
  if (actionUrl.includes("reconhec")) return "Ver reconhecimento";
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

  useEffect(() => {
    if (!open || typeof document === "undefined") return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const overlay = open && typeof document !== "undefined"
    ? createPortal(
        <div data-notification-overlay className="fixed inset-0 z-[9999] bg-[rgba(33,26,31,0.58)]">
          <button
            type="button"
            aria-label="Fechar notificações"
            className="absolute inset-0 h-full w-full cursor-default bg-transparent"
            onClick={() => setOpen(false)}
          />

          <aside
            data-notification-panel
            aria-label="Painel de notificações"
            className="absolute inset-0 z-10 flex min-h-0 w-full min-w-0 flex-col overflow-hidden bg-[#fffdf9] text-[#262321] shadow-[-18px_0_55px_-28px_rgba(28,19,25,0.55)] sm:inset-y-0 sm:left-auto sm:right-0 sm:max-w-[500px] sm:border-l sm:border-[#ddd5d9]"
          >
            <header className="shrink-0 border-b border-[#e1dbd6] bg-[#fffdf9] px-4 pb-4 pt-[max(1rem,env(safe-area-inset-top))] sm:px-5 sm:pt-4">
              <div className="flex min-w-0 items-start justify-between gap-3">
                <div className="min-w-0 flex-1">
                  <p className="text-base font-bold text-[#262321]">Notificações</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-[#6d6761]">
                    Pendências, devolutivas e atividades que precisam da sua atenção.
                  </p>
                </div>
                <button
                  type="button"
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-[#ded9d2] bg-[#fffdf9] text-[#6d6761] hover:bg-[#efede9]"
                  onClick={() => setOpen(false)}
                  aria-label="Fechar"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-1.5 sm:gap-2">
                <div className="min-w-0 rounded-md border border-[#ded9d2] bg-[#f5f1ed] px-2.5 py-2 sm:px-3">
                  <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#6d6761] sm:text-[10px]">Não lidas</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#262321]">{unreadCount}</p>
                </div>
                <div className="min-w-0 rounded-md border border-[#d9bd8a] bg-[#faf2e2] px-2.5 py-2 sm:px-3">
                  <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#9a6a21] sm:text-[10px]">Atenção</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#9a6a21]">{attentionCount}</p>
                </div>
                <div className="min-w-0 rounded-md border border-[#ded9d2] bg-[#f5f1ed] px-2.5 py-2 sm:px-3">
                  <p className="truncate text-[9px] font-bold uppercase tracking-[0.1em] text-[#6d6761] sm:text-[10px]">Total</p>
                  <p className="mt-0.5 text-lg font-bold tabular-nums text-[#262321]">{items.length}</p>
                </div>
              </div>
            </header>

            <div className="grid shrink-0 gap-2 border-b border-[#e1dbd6] bg-[#fffdf9] px-4 py-2.5 sm:flex sm:items-center sm:justify-between sm:px-5">
              <div className="grid grid-cols-3 gap-1 rounded-md bg-[#f1ede9] p-1 sm:flex">
                {([ ["all", "Todas"], ["unread", "Não lidas"], ["attention", "Atenção"] ] as const).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setFilter(value)}
                    className={`min-w-0 rounded px-2 py-1.5 text-[11px] font-semibold ${filter === value ? "bg-[#fffdf9] text-[#262321] shadow-sm" : "text-[#6d6761] hover:text-[#262321]"}`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              {unreadCount > 0 ? (
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex min-h-9 w-full items-center justify-center gap-1.5 rounded-md px-2 text-[11px] font-semibold text-[#4b3142] hover:bg-[#efe7ed] sm:w-auto"
                >
                  <CheckCheck className="h-3.5 w-3.5" /> Marcar tudo como lido
                </button>
              ) : null}
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain bg-[#fffdf9] pb-[env(safe-area-inset-bottom)]">
              {loading ? (
                <p className="px-5 py-10 text-center text-sm text-[#6d6761]">Carregando notificações...</p>
              ) : visibleItems.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[#efede9] text-[#6d6761]"><Bell className="h-5 w-5" /></div>
                  <p className="mt-4 text-sm font-semibold text-[#262321]">Nada por aqui</p>
                  <p className="mt-1 text-xs text-[#6d6761]">Não há notificações que correspondam a este filtro.</p>
                </div>
              ) : (
                <div className="divide-y divide-[#e5dfda] bg-[#fffdf9]">
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
                        className={`block w-full min-w-0 px-4 py-4 text-left transition-colors hover:bg-[#f5f1ed] sm:px-5 ${item.readAt ? "bg-[#fffdf9]" : "bg-[#f1e9ee]"}`}
                      >
                        <div className="flex min-w-0 items-start gap-3">
                          <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border sm:h-10 sm:w-10 ${toneClasses(meta.tone, Boolean(item.readAt))}`}>{meta.icon}</span>
                          <span className="min-w-0 flex-1">
                            <span className="flex min-w-0 flex-wrap items-center gap-1.5">
                              <span className="max-w-full rounded-md bg-[#efede9] px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.08em] text-[#6d6761]">{meta.label}</span>
                              {!item.readAt ? <span className="h-1.5 w-1.5 shrink-0 rounded-full bg-[#4b3142]" /> : null}
                              <span className="w-full text-[10px] font-medium text-[#6d6761] sm:ml-auto sm:w-auto">{formatWhen(item.createdAt)}</span>
                            </span>
                            <span className="mt-1.5 block break-words text-sm font-semibold leading-snug text-[#262321]">{item.title}</span>
                            {item.body ? <span className="mt-1 block break-words text-xs leading-relaxed text-[#6d6761]">{item.body}</span> : null}
                            <span className="mt-2.5 inline-flex items-center gap-1 text-[11px] font-bold text-[#4b3142]">{actionLabel(item.actionUrl)} <ChevronRight className="h-3.5 w-3.5" /></span>
                          </span>
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          </aside>
        </div>,
        document.body,
      )
    : null;

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
      {overlay}
    </>
  );
}
