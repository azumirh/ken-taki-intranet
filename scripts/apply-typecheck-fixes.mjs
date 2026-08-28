import { readFileSync, writeFileSync } from "node:fs";

function edit(path, transform) {
  const before = readFileSync(path, "utf8");
  const after = transform(before);
  if (after === before) {
    console.log(`[unchanged] ${path}`);
    return;
  }
  writeFileSync(path, after);
  console.log(`[updated] ${path}`);
}

function normalizeToastReturns(source) {
  return source.replace(
    /^(\s*)if \((.+)\) return toast\.error\((.+)\);$/gm,
    "$1if ($2) { toast.error($3); return; }",
  );
}

edit("src/components/kt/employee-dashboard-v2.tsx", (source) => {
  const oldValue = `{status ? <StatusPill tone={tone}>{status}</StatusPill> : null}`;
  const newValue = `{status ? (tone ? <StatusPill tone={tone}>{status}</StatusPill> : <StatusPill>{status}</StatusPill>) : null}`;
  if (!source.includes(oldValue)) throw new Error("employee-dashboard-v2 tone pattern not found");
  return source.replace(oldValue, newValue);
});

for (const path of [
  "src/components/kt/employee-dashboard-v3.tsx",
  "src/components/kt/employee-feedback-center.tsx",
  "src/components/kt/employee-journey-center.tsx",
  "src/components/kt/workspace-operational-center.tsx",
]) {
  edit(path, normalizeToastReturns);
}

edit("src/components/kt/workspace-case-center.tsx", (source) =>
  source
    .replace("params.p_responsavel_id = value || null", 'params["p_responsavel_id"] = value || null')
    .replace("params.p_referente_colaborador_id = value || null", 'params["p_referente_colaborador_id"] = value || null'),
);

edit("src/components/kt/workspace-operational-center.tsx", (source) =>
  source
    .replace("updates.revisado_por = profile.id", 'updates["revisado_por"] = profile.id')
    .replace("updates.revisado_em = new Date().toISOString()", 'updates["revisado_em"] = new Date().toISOString()')
    .replace("updates.preenchida_em = new Date().toISOString()", 'updates["preenchida_em"] = new Date().toISOString()')
    .replace("updates.cancelada_motivo = row.cancelada_motivo || \"Cancelada pela gestão/RH\"", 'updates["cancelada_motivo"] = row.cancelada_motivo || "Cancelada pela gestão/RH"')
    .replace("return toast.error(questionResult.error.message);", "toast.error(questionResult.error.message); return;"),
);

edit("src/components/kt/workspace-personalization.tsx", (source) =>
  source.replace(
    "document.documentElement.dataset.profileBackground = preferences.backgroundStyle;",
    'document.documentElement.dataset["profileBackground"] = preferences.backgroundStyle;',
  ),
);

edit("src/components/kt/workspace-climate-report.tsx", (source) =>
  source.replace(
    "filialNome(profile.filial ?? undefined)",
    "filialNome(profile?.filial ?? undefined)",
  ),
);

edit("src/components/kt/workspace-photo-adjuster.tsx", (source) => {
  const oldStart = `    void supabase\n      .rpc("kt_list_manageable_photo_frames")`;
  const newStart = `    void Promise.resolve(supabase.rpc("kt_list_manageable_photo_frames"))`;
  if (!source.includes(oldStart)) throw new Error("workspace-photo-adjuster promise pattern not found");
  return source
    .replace(oldStart, newStart)
    .replace(
      `.catch((error) => toast.error((error as Error).message || "Não foi possível carregar as fotos."))`,
      `.catch((error: unknown) => toast.error((error as Error).message || "Não foi possível carregar as fotos."))`,
    );
});

edit("src/lib/spreadsheet-import.ts", (source) =>
  source.replace(
    "const headers = matrix[headerIndex].map((cell) => String(cell ?? \"\").trim());",
    "const headers = (matrix[headerIndex] ?? []).map((cell) => String(cell ?? \"\").trim());",
  ),
);
