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

  const rules: string[] = [];
  if (hiddenSelectors.length > 0) {
    rules.push(`${hiddenSelectors.join(",\n")} { display: none !important; }`);
  }

  if (can("sugestoes", "view") && !can("sugestoes", "edit")) {
    rules.push(`
      [data-workspace-mode="hr"] #sugestoes .fixed textarea {
        pointer-events: none !important;
        opacity: 0.68;
        background: var(--muted) !important;
      }
    `);
  }

  if (rules.length === 0) return null;
  return <style>{rules.join("\n")}</style>;
}
