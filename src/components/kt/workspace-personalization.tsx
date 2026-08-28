import { Camera, Palette, Settings2, UserRound } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useUiPreferences, type UiPreferences } from "@/lib/admin-permissions";
import { iniciais } from "@/lib/kt-data";
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

type ProfileDraft = {
  officialName: string;
  nickname: string;
  avatarUrl: string;
  avatarPosX: number;
  avatarPosY: number;
  avatarZoom: number;
};

const EMPTY_PROFILE: ProfileDraft = {
  officialName: "",
  nickname: "",
  avatarUrl: "",
  avatarPosX: 50,
  avatarPosY: 50,
  avatarZoom: 1,
};

function applyPreferences(preferences: UiPreferences) {
  document.documentElement.style.setProperty("--profile-accent", preferences.accentColor);
  document.documentElement.dataset["profileBackground"] = preferences.backgroundStyle;
}

export function WorkspacePersonalization() {
  const { preferences, loading, save } = useUiPreferences();
  const [open, setOpen] = useState(false);
  const [profile, setProfile] = useState<ProfileDraft>(EMPTY_PROFILE);
  const [draft, setDraft] = useState<UiPreferences>(preferences);
  const [profileId, setProfileId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

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
      setProfileId(auth.user.id);
      const [{ data: account }, { data: pref }] = await Promise.all([
        supabase.from("kt_perfis").select("nome").eq("id", auth.user.id).maybeSingle(),
        supabase
          .from("kt_profile_preferences")
          .select("nickname,avatar_url,avatar_pos_x,avatar_pos_y,avatar_zoom")
          .eq("profile_id", auth.user.id)
          .maybeSingle(),
      ]);
      setProfile({
        officialName: account?.nome ?? "",
        nickname: pref?.nickname ?? "",
        avatarUrl: pref?.avatar_url ?? "",
        avatarPosX: Number(pref?.avatar_pos_x ?? 50),
        avatarPosY: Number(pref?.avatar_pos_y ?? 50),
        avatarZoom: Number(pref?.avatar_zoom ?? 1),
      });
    });
  }, [open]);

  const previewName = useMemo(
    () => profile.nickname.trim() || profile.officialName.trim() || "Seu nome",
    [profile.nickname, profile.officialName],
  );

  async function uploadAvatar(file: File) {
    if (!profileId) return;
    setUploading(true);
    try {
      if (!file.type.startsWith("image/")) throw new Error("Escolha uma imagem válida.");
      if (file.size > 8 * 1024 * 1024) throw new Error("A foto deve ter no máximo 8 MB.");
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
      const path = `perfis/${profileId}/${Date.now()}-${safeName}`;
      const { data, error } = await supabase.storage.from("kt-documentos").upload(path, file, {
        cacheControl: "86400",
        upsert: false,
      });
      if (error) throw error;
      const publicUrl = supabase.storage.from("kt-documentos").getPublicUrl(data.path).data.publicUrl;
      setProfile((current) => ({
        ...current,
        avatarUrl: publicUrl,
        avatarPosX: 50,
        avatarPosY: 50,
        avatarZoom: 1,
      }));
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível enviar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!profileId) return;
    setSaving(true);
    try {
      if (profile.officialName.trim()) {
        const { error: nameError } = await supabase.rpc("kt_update_my_profile_name", {
          p_nome: profile.officialName.trim(),
        });
        if (nameError) throw nameError;
      }

      await save(draft);
      const { error: preferenceError } = await supabase.from("kt_profile_preferences").upsert(
        {
          profile_id: profileId,
          accent_color: draft.accentColor,
          background_style: draft.backgroundStyle,
          nickname: profile.nickname.trim() || null,
          avatar_url: profile.avatarUrl || null,
          avatar_pos_x: Math.round(profile.avatarPosX),
          avatar_pos_y: Math.round(profile.avatarPosY),
          avatar_zoom: profile.avatarZoom,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "profile_id" },
      );
      if (preferenceError) throw preferenceError;

      applyPreferences(draft);
      toast.success("Seu perfil foi atualizado.");
      setOpen(false);
      window.dispatchEvent(new CustomEvent("kt-profile-updated"));
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível salvar a personalização.");
    } finally {
      setSaving(false);
    }
  }

  const avatarStyle = {
    objectPosition: `${profile.avatarPosX}% ${profile.avatarPosY}%`,
    transform: `scale(${profile.avatarZoom})`,
  };

  return (
    <>
      <div className="mb-4 flex justify-end">
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-3 py-2 text-[11px] font-semibold text-muted-foreground shadow-sm transition hover:border-[var(--profile-accent,var(--kt))]/30 hover:text-foreground"
        >
          <Settings2 className="h-3.5 w-3.5" /> Editar meu perfil
        </button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>Meu perfil</DialogTitle>
            <DialogDescription>
              Ajuste como você aparece na intranet. A identidade principal continua sendo Ken Taki.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-5">
            <div className="grid gap-4 rounded-xl border border-border bg-muted/20 p-4 sm:grid-cols-[150px_minmax(0,1fr)]">
              <div className="flex flex-col items-center">
                <div className="h-28 w-28 overflow-hidden rounded-full border-4 border-card bg-muted shadow-sm ring-1 ring-border">
                  {profile.avatarUrl ? (
                    <img src={profile.avatarUrl} alt="Prévia da foto" className="h-full w-full object-cover" style={avatarStyle} />
                  ) : (
                    <span className="grid h-full w-full place-items-center text-lg font-bold text-white" style={{ backgroundColor: draft.accentColor }}>
                      {iniciais(profile.officialName || previewName)}
                    </span>
                  )}
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={async (event) => {
                    const file = event.target.files?.[0];
                    if (file) await uploadAvatar(file);
                    event.target.value = "";
                  }}
                />
                <Button type="button" variant="outline" size="sm" className="mt-3" disabled={uploading} onClick={() => fileRef.current?.click()}>
                  <Camera className="h-3.5 w-3.5" /> {uploading ? "Enviando..." : profile.avatarUrl ? "Trocar foto" : "Adicionar foto"}
                </Button>
              </div>

              <div className="grid gap-3">
                <div className="grid gap-2">
                  <Label htmlFor="profile-name" className="inline-flex items-center gap-1.5"><UserRound className="h-3.5 w-3.5" /> Nome do cadastro</Label>
                  <Input id="profile-name" value={profile.officialName} onChange={(event) => setProfile((current) => ({ ...current, officialName: event.target.value }))} maxLength={80} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="profile-nickname">Como prefere ser chamado(a)</Label>
                  <Input id="profile-nickname" placeholder="Ex.: Pat, Dani, Felipe" value={profile.nickname} onChange={(event) => setProfile((current) => ({ ...current, nickname: event.target.value }))} maxLength={40} />
                </div>
                {profile.avatarUrl ? (
                  <div className="grid gap-2 text-xs">
                    <Label htmlFor="profile-x">Horizontal</Label>
                    <input id="profile-x" type="range" min="0" max="100" value={profile.avatarPosX} onChange={(event) => setProfile((current) => ({ ...current, avatarPosX: Number(event.target.value) }))} />
                    <Label htmlFor="profile-y">Vertical</Label>
                    <input id="profile-y" type="range" min="0" max="100" value={profile.avatarPosY} onChange={(event) => setProfile((current) => ({ ...current, avatarPosY: Number(event.target.value) }))} />
                    <Label htmlFor="profile-zoom">Zoom</Label>
                    <input id="profile-zoom" type="range" min="1" max="2.2" step="0.05" value={profile.avatarZoom} onChange={(event) => setProfile((current) => ({ ...current, avatarZoom: Number(event.target.value) }))} />
                  </div>
                ) : null}
              </div>
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
                <Input value={draft.accentColor} onChange={(event) => setDraft((current) => ({ ...current, accentColor: event.target.value }))} className="font-mono text-xs" maxLength={7} />
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
                <div><p className="text-xs font-bold">Olá, {previewName}</p><p className="text-[11px] text-muted-foreground">Seu destaque pessoal, dentro da identidade Ken Taki.</p></div>
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
