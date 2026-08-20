import { Bell, CheckCheck } from "lucide-react";
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

export function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const { items, unreadCount, loading, markRead, markAllRead } = useNotifications();

  return (
    <div className="relative">
      <button
        type="button"
        aria-label={`Notificações${unreadCount ? `, ${unreadCount} não lidas` : ""}`}
        title="Notificações"
        onClick={() => setOpen((value) => !value)}
        className="relative grid h-9 w-9 place-items-center rounded-full border border-border bg-card text-muted-foreground transition-colors hover:text-foreground"
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 ? (
          <span className="absolute -right-1 -top-1 min-w-5 rounded-full bg-kt px-1.5 py-0.5 text-center text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>
        ) : null}
      </button>

      {open ? (
        <div className="absolute right-0 top-11 z-50 w-[min(92vw,380px)] overflow-hidden rounded-2xl border border-border bg-card shadow-xl">
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <div>
              <p className="font-bold text-foreground">Notificações</p>
              <p className="text-xs text-muted-foreground">
                {unreadCount ? `${unreadCount} não lida${unreadCount === 1 ? "" : "s"}` : "Tudo em dia"}
              </p>
            </div>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={() => void markAllRead()}
                className="inline-flex items-center gap-1 text-xs font-semibold text-kt hover:underline"
              >
                <CheckCheck className="h-3.5 w-3.5" />
                Marcar todas como lidas
              </button>
            ) : null}
          </div>

          <div className="max-h-[420px] overflow-y-auto">
            {loading ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">Carregando...</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-8 text-center text-sm text-muted-foreground">
                Nenhuma notificação por enquanto.
              </p>
            ) : (
              items.map((item) => (
                <button
                  type="button"
                  key={item.id}
                  onClick={() => {
                    if (!item.readAt) void markRead(item.id);
                    if (item.actionUrl) window.location.href = item.actionUrl;
                  }}
                  className={`block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted/50 ${
                    item.readAt ? "bg-card" : "bg-kt-soft/40"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <span
                      className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.readAt ? "bg-border" : "bg-kt"}`}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm font-semibold text-foreground">{item.title}</span>
                      {item.body ? (
                        <span className="mt-0.5 block text-xs leading-relaxed text-muted-foreground">
                          {item.body}
                        </span>
                      ) : null}
                      <span className="mt-1.5 block text-[11px] text-muted-foreground">
                        {formatWhen(item.createdAt)}
                      </span>
                    </span>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
