import {
  Bell,
  CheckCheck,
  FileCheck2,
  LifeBuoy,
  MessageSquareText,
  X,
} from "lucide-react";
import { useState } from "react";
import { useNotifications } from "@/lib/notifications";

function formatWhen(value: string) {
  const date = new Date(value);
  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function NotificationIcon({ type }: { type: string }) {
  if (type === "document_signed") return <FileCheck2 className="h-4 w-4" />;
  if (type === "support_requested") return <LifeBuoy className="h-4 w-4" />;
  return <MessageSquareText className="h-4 w-4" />;
}

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();

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

          <aside className="absolute inset-y-0 right-0 flex w-full max-w-[460px] flex-col border-l border-border bg-card shadow-2xl sm:w-[min(92vw,460px)]">
            <header className="flex items-start justify-between gap-4 border-b border-border px-4 py-4 sm:px-5">
              <div>
                <p className="text-base font-bold text-foreground">Central de notificações</p>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  {unreadCount ? `${unreadCount} pendente${unreadCount === 1 ? "" : "s"} de leitura` : "Nenhuma pendência de leitura"}
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
            </header>

            {unreadCount > 0 ? (
              <div className="border-b border-border px-4 py-2.5 sm:px-5">
                <button
                  type="button"
                  onClick={() => void markAllRead()}
                  className="inline-flex min-h-9 items-center gap-2 rounded-md px-2 text-xs font-semibold text-kt hover:bg-kt-soft"
                >
                  <CheckCheck className="h-4 w-4" />
                  Marcar tudo como lido
                </button>
              </div>
            ) : null}

            <div className="min-h-0 flex-1 overflow-y-auto">
              {loading ? (
                <p className="px-5 py-10 text-center text-sm text-muted-foreground">Carregando notificações...</p>
              ) : items.length === 0 ? (
                <div className="px-6 py-14 text-center">
                  <div className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-muted text-muted-foreground">
                    <Bell className="h-5 w-5" />
                  </div>
                  <p className="mt-4 text-sm font-semibold text-foreground">Tudo em dia</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">
                    Novas ações que precisam da sua atenção aparecerão aqui.
                  </p>
                </div>
              ) : (
                <div className="divide-y divide-border">
                  {items.map((item) => (
                    <button
                      type="button"
                      key={item.id}
                      onClick={() => {
                        if (!item.readAt) void markRead(item.id);
                        if (item.actionUrl) window.location.href = item.actionUrl;
                        setOpen(false);
                      }}
                      className={`block w-full px-4 py-4 text-left transition-colors hover:bg-muted/55 sm:px-5 ${
                        item.readAt ? "bg-card" : "bg-kt-soft/45"
                      }`}
                    >
                      <div className="flex items-start gap-3.5">
                        <span
                          className={`grid h-9 w-9 shrink-0 place-items-center rounded-md border ${
                            item.readAt
                              ? "border-border bg-muted text-muted-foreground"
                              : "border-kt/20 bg-card text-kt"
                          }`}
                        >
                          <NotificationIcon type={item.type} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-start justify-between gap-3">
                            <span className="block text-sm font-semibold leading-snug text-foreground">{item.title}</span>
                            {!item.readAt ? <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-kt" /> : null}
                          </span>
                          {item.body ? (
                            <span className="mt-1 block text-xs leading-relaxed text-muted-foreground">
                              {item.body}
                            </span>
                          ) : null}
                          <span className="mt-2 block text-[11px] font-medium text-muted-foreground">
                            {formatWhen(item.createdAt)}
                          </span>
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
