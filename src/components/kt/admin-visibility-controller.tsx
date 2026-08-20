import { useEffect } from "react";
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

  useEffect(() => {
    if (loading) return;

    const restore: Array<() => void> = [];

    RULES.forEach((rule) => {
      const visible = rule.mode === "all"
        ? rule.sections.every((section) => can(section, "view"))
        : rule.sections.some((section) => can(section, "view"));
      const editable = rule.sections.some((section) => can(section, "edit"));
      const deletable = rule.sections.some((section) => can(section, "delete"));

      document.querySelectorAll<HTMLElement>(`[id="${rule.id}"]`).forEach((node) => {
        const previousHidden = node.hidden;
        const previousReadOnly = node.dataset["adminReadonly"];
        const previousDelete = node.dataset["adminCanDelete"];

        node.hidden = !visible;
        node.dataset["adminReadonly"] = visible && !editable ? "true" : "false";
        node.dataset["adminCanDelete"] = deletable ? "true" : "false";

        restore.push(() => {
          node.hidden = previousHidden;
          if (previousReadOnly === undefined) delete node.dataset["adminReadonly"];
          else node.dataset["adminReadonly"] = previousReadOnly;
          if (previousDelete === undefined) delete node.dataset["adminCanDelete"];
          else node.dataset["adminCanDelete"] = previousDelete;
        });
      });
    });

    return () => restore.forEach((fn) => fn());
  }, [loading, can]);

  return null;
}
