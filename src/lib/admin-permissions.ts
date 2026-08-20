import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "./supabase";

export type AdminSection =
  | "dashboard"
  | "feedbacks"
  | "apoio"
  | "clima"
  | "noticias"
  | "pesquisas"
  | "mural"
  | "sugestoes"
  | "colaboradores"
  | "documentos"
  | "acessos";

export type AdminPermission = {
  section: AdminSection;
  canView: boolean;
  canEdit: boolean;
  canDelete: boolean;
};

export type UiPreferences = {
  accentColor: string;
  backgroundStyle: "ivory" | "paper" | "plum-soft" | "graphite-soft";
};

const DEFAULT_PREFS: UiPreferences = {
  accentColor: "#4b3142",
  backgroundStyle: "ivory",
};

export function useAdminPermissions() {
  const [level, setLevel] = useState<"geral" | "parcial" | null>(null);
  const [permissions, setPermissions] = useState<AdminPermission[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const [{ data: profile }, { data: rows }] = await Promise.all([
        supabase.from("kt_perfis").select("admin_nivel").eq("id", auth.user.id).maybeSingle(),
        supabase.rpc("kt_list_my_admin_permissions"),
      ]);
      setLevel((profile?.admin_nivel as "geral" | "parcial" | null) ?? null);
      setPermissions(
        ((rows ?? []) as Array<{
          section: AdminSection;
          can_view: boolean;
          can_edit: boolean;
          can_delete: boolean;
        }>).map((row) => ({
          section: row.section,
          canView: Boolean(row.can_view),
          canEdit: Boolean(row.can_edit),
          canDelete: Boolean(row.can_delete),
        })),
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const map = useMemo(() => new Map(permissions.map((item) => [item.section, item])), [permissions]);
  const can = useCallback(
    (section: AdminSection, action: "view" | "edit" | "delete" = "view") => {
      if (level === "geral") return true;
      const permission = map.get(section);
      if (!permission) return false;
      if (action === "edit") return permission.canEdit;
      if (action === "delete") return permission.canDelete;
      return permission.canView;
    },
    [level, map],
  );

  return { level, permissions, loading, can, refresh: load };
}

export function useUiPreferences() {
  const [preferences, setPreferences] = useState<UiPreferences>(DEFAULT_PREFS);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth } = await supabase.auth.getUser();
      if (!auth.user) return;
      const { data } = await supabase
        .from("kt_profile_preferences")
        .select("accent_color,background_style")
        .eq("profile_id", auth.user.id)
        .maybeSingle();
      if (data) {
        setPreferences({
          accentColor: data.accent_color || DEFAULT_PREFS.accentColor,
          backgroundStyle: (data.background_style || DEFAULT_PREFS.backgroundStyle) as UiPreferences["backgroundStyle"],
        });
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(async (next: UiPreferences) => {
    const { error } = await supabase.rpc("kt_update_my_ui_preferences", {
      p_accent_color: next.accentColor,
      p_background_style: next.backgroundStyle,
    });
    if (error) throw error;
    setPreferences(next);
  }, []);

  return { preferences, loading, save, refresh: load };
}
