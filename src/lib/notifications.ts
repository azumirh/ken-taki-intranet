import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

export type AppNotification = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  actionUrl: string | null;
  readAt: string | null;
  createdAt: string;
};

export function useNotifications() {
  const [items, setItems] = useState<AppNotification[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchItems = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const { data, error } = await supabase
      .from("app_notifications")
      .select("id,type,title,body,action_url,read_at,created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(30);

    if (!error && data) {
      setItems(
        data.map((row) => ({
          id: String(row.id),
          type: String(row.type),
          title: String(row.title),
          body: row.body == null ? null : String(row.body),
          actionUrl: row.action_url == null ? null : String(row.action_url),
          readAt: row.read_at == null ? null : String(row.read_at),
          createdAt: String(row.created_at),
        })),
      );
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void fetchItems();

    let channel: ReturnType<typeof supabase.channel> | null = null;

    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return;
      channel = supabase
        .channel(`notifications:${user.id}`)
        .on(
          "postgres_changes",
          {
            event: "*",
            schema: "public",
            table: "app_notifications",
            filter: `user_id=eq.${user.id}`,
          },
          () => void fetchItems(),
        )
        .subscribe();
    });

    return () => {
      if (channel) void supabase.removeChannel(channel);
    };
  }, [fetchItems]);

  const unreadCount = useMemo(() => items.filter((item) => !item.readAt).length, [items]);

  const markRead = useCallback(async (id: string) => {
    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, readAt: now } : item)));
    const { error } = await supabase
      .from("app_notifications")
      .update({ read_at: now })
      .eq("id", id);
    if (error) void fetchItems();
  }, [fetchItems]);

  const markAllRead = useCallback(async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;

    const now = new Date().toISOString();
    setItems((prev) => prev.map((item) => ({ ...item, readAt: item.readAt ?? now })));
    const { error } = await supabase
      .from("app_notifications")
      .update({ read_at: now })
      .eq("user_id", user.id)
      .is("read_at", null);
    if (error) void fetchItems();
  }, [fetchItems]);

  return { items, unreadCount, loading, markRead, markAllRead, refresh: fetchItems };
}
