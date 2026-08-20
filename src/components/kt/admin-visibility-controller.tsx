import { useAdminPermissions, type AdminSection } from "@/lib/admin-permissions";

type VisibilityRule = {
  id: string;
  sections: AdminSection[];
  mode?: "any" | "all";
};

const RULES: VisibilityRule[] = [
  { id: "dashboard", sections: ["dashboard"] },
  { id: "feedbacks", sections: ["feedbacks"] },
  { id: "apoio", sections: ["apoio"] },
  { id: "clima", sections: ["clima"] },
  { id: "sugestoes", sections: ["sugestoes"] },
  { id: "colaboradores", sections: ["colaboradores"] },
  { id: "equipe", sections: ["colaboradores"] },
  { id: "politicas", sections: ["documentos"] },
  { id: "publicar", sections: ["noticias", "mural"], mode: "any" },
  { id: "noticias", sections: ["noticias"] },
  { id: "mural", sections: ["mural"] },
  { id: "pesquisa-clima", sections: ["pesquisas"] },
  { id: "engajamento", sections: ["noticias", "mural", "pesquisas"], mode: "any" },
  { id: "acessos", sections: ["acessos"] },
];

export function AdminVisibilityController() {
  const { loading, can } = useAdminPermissions();
  if (loading) return null;

  const hiddenSelectors = RULES.filter((rule) => {
    const visible = rule.mode === "all"
      ? rule.sections.every((section) => can(section, "view"))
      : rule.sections.some((section) => can(section, "view"));
    return !visible;
  }).map((rule) => `[data-workspace-mode="hr"] [id="${rule.id}"]`);

  if (hiddenSelectors.length === 0) return null;

  return <style>{`${hiddenSelectors.join(",\n")} { display: none !important; }`}</style>;
}
