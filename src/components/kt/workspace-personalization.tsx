import { Palette, Settings2, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUiPreferences, type UiPreferences } from "@/lib/admin-permissions";
import { supabase } from "@/lib/supabase";

const ACCENTS = [
  ["#4b3142", "Ken Taki"],
  ["#31584c", "Verde profundo"],
  ["#46546d", "Azul ardósia"],
  ["#875345", "Terracota"],
  ["#4a4745", "Grafite"],
] as const;

const BACKGROUNDS: Array<[UiPreferences["backgroundStyle"], string, string]> = [
  ["ivory", "Marfim", "#f6f4f0"],
  ["paper", "Papel claro", "#fbfaf7"],
  ["plum-soft", "Ameixa suave", "#f4eef2"],
  ["graphite-soft", "Grafite suave", "#efedec"],
];

function applyPreferences(preferences: UiPreferences) {
  document.documentElement.style.setProperty("--profile-accent", preferences.accentColor);
  document.documentElement.dataset.profileBackground = preferences.backgroundStyle;
}

export function WorkspacePersonalization() {
  const { preferences, loading, save } = useUiPreferences();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [draft, setDraft] = useState<UiPreferences>(preferences);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!loading) {
      setDraft(preferences);
      applyPreferences(preferences);
    }
  }, [loading, preferences]);

  useEffect(() => {
    if (!open) return;
    supabase.auth.getUser().then(async ({ data: auth }) => {
      if (!auth.user) return;
      const { data } = await supabase.from("kt_perfis").select("nome").eq("id", auth.user.id).maybeSingle();
      if (data?.nome) setName(data.nome);
    });
  }, [open]);

  async function submit() {
    setSaving(true);
    try {
      if (name.trim()) {
        const { error: nameError } = await supabase.rpc("kt_update_my_profile_name", { p_nome: name.trim() });
        if (nameError) throw nameError;
      }
      await save(draft);
      applyPreferences(draft);
      toast.success("Seu espaço foi personalizado.");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("kt-profile-updated"));
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível salvar a personalização.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[11px] font-semibold text-muted-foreground shadow-sm transition hover:border-[var(--profile-accent,var(--kt))]/30 hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" /> Personalizar meu espaço
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Meu perfil e aparência</DialogTitle>
            <DialogDescription>
              Sua cor pessoal aparece em detalhes do workspace. A identidade principal continua sendo Ken Taki.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="grid gap-2">
              <Label htmlFor="profile-name" className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nome exibido</Label>
              <Input id="profile-name" value={name} onChange={(event) => setName(event.target.value)} maxLength={80} />
            </div>

            <div>
              <Label className="inline-flex items-center gap-1.5"><Palette className="h-3.5 w-3.5" /> Cor de destaque</Label>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                {ACCENTS.map(([color, label]) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, accentColor: color }))}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-semibold ${draft.accentColor === color ? "border-foreground bg-muted" : "border-border"}`}
                  >
                    <span className="h-6 w-6 rounded-md shadow-inner" style={{ backgroundColor: color }} />
                    {label}
                  </button>
                ))}
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="color"
                  aria-label="Escolher outra cor"
                  value={draft.accentColor}
                  onChange={(event) => setDraft((current) => ({ ...current, accentColor: event.target.value }))}
                  className="h-9 w-12 cursor-pointer rounded-md border border-border bg-card p-1"
                />
                <Input
                  value={draft.accentColor}
                  onChange={(event) => setDraft((current) => ({ ...current, accentColor: event.target.value }))}
                  className="font-mono text-xs"
                  maxLength={7}
                />
              </div>
            </div>

            <div>
              <Label>Fundo do workspace</Label>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {BACKGROUNDS.map(([value, label, color]) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => setDraft((current) => ({ ...current, backgroundStyle: value }))}
                    className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-semibold ${draft.backgroundStyle === value ? "border-foreground" : "border-border"}`}
                    style={{ backgroundColor: color }}
                  >
                    <span className="h-5 w-5 rounded border border-black/10" style={{ backgroundColor: color }} />
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="rounded-lg border border-border bg-muted/35 p-3">
              <p className="text-xs font-semibold text-foreground">Prévia</p>
              <div className="mt-2 flex items-center gap-3 rounded-lg border border-border bg-card p-3" style={{ borderLeftWidth: 4, borderLeftColor: draft.accentColor }}>
                <span className="grid h-9 w-9 place-items-center rounded-md text-white" style={{ backgroundColor: draft.accentColor }}><Palette className="h-4 w-4" /></span>
                <div><p className="text-xs font-bold">Seu destaque pessoal</p><p className="text-[11px] text-muted-foreground">Sem alterar a marca institucional Ken Taki.</p></div>
              </div>
            </div>

            <Button disabled={saving || !/^#[0-9a-fA-F]{6}$/.test(draft.accentColor)} onClick={() => void submit()}>
              {saving ? "Salvando..." : "Salvar meu perfil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
