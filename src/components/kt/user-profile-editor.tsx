import {
  Camera,
  Globe2,
  ImageIcon,
  Instagram,
  Linkedin,
  Palette,
  RotateCcw,
  UserRound,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  type ProfileBackground,
  type UserProfile,
  useUserProfile,
  userProfileFrameStyle,
} from "@/lib/user-profile";

const ACCENTS = [
  ["#4b3142", "Ameixa Ken Taki"],
  ["#31584c", "Verde profundo"],
  ["#46546d", "Azul ardósia"],
  ["#875345", "Terracota"],
  ["#5d4437", "Café"],
  ["#3f3d3b", "Grafite"],
] as const;

const BACKGROUNDS: Array<[ProfileBackground, string, string]> = [
  ["ivory", "Marfim", "#f6f4f0"],
  ["paper", "Papel claro", "#fbfaf7"],
  ["plum-soft", "Ameixa suave", "#f4eef2"],
  ["graphite-soft", "Grafite suave", "#efedec"],
];

const GENDERS = ["", "Feminino", "Masculino", "Não binário", "Outro"];

function backgroundColor(style: ProfileBackground) {
  return BACKGROUNDS.find(([value]) => value === style)?.[2] ?? "#f6f4f0";
}

function safeInitials(name: string) {
  const pieces = name.trim().split(/\s+/).filter(Boolean);
  if (!pieces.length) return "KT";
  return `${pieces[0]?.[0] ?? ""}${pieces.length > 1 ? pieces.at(-1)?.[0] ?? "" : ""}`.toUpperCase();
}

function ToggleRow({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  description: string;
}) {
  return (
    <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-border bg-card p-3">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
        className="mt-0.5 h-4 w-4 accent-[var(--profile-accent,var(--kt))]"
      />
      <span>
        <span className="block text-xs font-bold text-foreground">{label}</span>
        <span className="mt-0.5 block text-[11px] leading-relaxed text-muted-foreground">{description}</span>
      </span>
    </label>
  );
}

export function UserProfileEditor({ buttonLabel = "Editar meu perfil" }: { buttonLabel?: string }) {
  const { profile, loading, save, uploadAvatar } = useUserProfile();
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<UserProfile>(profile);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) setDraft(profile);
  }, [open, profile]);

  useEffect(() => {
    if (open) setDraft(profile);
  }, [open, profile.authUserId]);

  async function selectPhoto(file: File) {
    setUploading(true);
    try {
      const url = await uploadAvatar(file);
      setDraft((current) => ({
        ...current,
        avatarUrl: url,
        avatarPosX: 50,
        avatarPosY: 35,
        avatarZoom: 1,
      }));
      toast.success("Foto carregada. Ajuste o enquadramento antes de salvar.");
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível carregar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function submit() {
    if (!draft.displayName.trim()) {
      toast.error("Informe como seu nome deve aparecer no perfil.");
      return;
    }
    if (!/^#[0-9a-fA-F]{6}$/.test(draft.accentColor)) {
      toast.error("Escolha uma cor válida para o perfil.");
      return;
    }

    setSaving(true);
    try {
      await save({ ...draft, displayName: draft.displayName.trim() });
      toast.success("Perfil atualizado.");
      setOpen(false);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível atualizar seu perfil.");
    } finally {
      setSaving(false);
    }
  }

  const previewName = draft.nickname.trim() || draft.displayName.trim() || draft.officialName || "Seu nome";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        disabled={loading}
        className="inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-muted-foreground shadow-sm transition hover:border-[var(--profile-accent,var(--kt))]/30 hover:text-foreground disabled:opacity-50"
      >
        <UserRound className="h-3.5 w-3.5" /> {buttonLabel}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-3xl">
          <DialogHeader>
            <DialogTitle>Meu perfil</DialogTitle>
            <DialogDescription>
              Personalize como você aparece na intranet. Cargo, unidade e permissões continuam sendo definidos pela empresa.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_280px]">
            <div className="grid gap-6">
              <section className="grid gap-4">
                <div className="flex items-center gap-2">
                  <Camera className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold">Foto e enquadramento</h3>
                </div>

                <div className="grid gap-4 sm:grid-cols-[130px_minmax(0,1fr)] sm:items-center">
                  <div className="mx-auto grid h-28 w-28 place-items-center overflow-hidden rounded-full border-4 border-white bg-muted shadow-md ring-1 ring-border">
                    {draft.avatarUrl ? (
                      <img
                        src={draft.avatarUrl}
                        alt={previewName}
                        className="h-full w-full object-cover"
                        style={userProfileFrameStyle(draft)}
                      />
                    ) : (
                      <span className="text-xl font-bold" style={{ color: draft.accentColor }}>
                        {safeInitials(previewName)}
                      </span>
                    )}
                  </div>

                  <div className="grid gap-3">
                    <div className="flex flex-wrap gap-2">
                      <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
                        <ImageIcon className="h-3.5 w-3.5" /> {uploading ? "Carregando..." : "Trocar foto"}
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setDraft((current) => ({ ...current, avatarPosX: 50, avatarPosY: 35, avatarZoom: 1 }))}
                      >
                        <RotateCcw className="h-3.5 w-3.5" /> Centralizar
                      </Button>
                    </div>
                    <input
                      ref={fileRef}
                      type="file"
                      accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                      className="hidden"
                      onChange={(event) => {
                        const file = event.target.files?.[0];
                        if (file) void selectPhoto(file);
                        event.target.value = "";
                      }}
                    />
                    <div className="grid gap-2 sm:grid-cols-3">
                      <label className="grid gap-1 text-[11px] font-semibold">
                        Horizontal
                        <input type="range" min="0" max="100" value={draft.avatarPosX} onChange={(event) => setDraft((current) => ({ ...current, avatarPosX: Number(event.target.value) }))} />
                      </label>
                      <label className="grid gap-1 text-[11px] font-semibold">
                        Vertical
                        <input type="range" min="0" max="100" value={draft.avatarPosY} onChange={(event) => setDraft((current) => ({ ...current, avatarPosY: Number(event.target.value) }))} />
                      </label>
                      <label className="grid gap-1 text-[11px] font-semibold">
                        Zoom
                        <input type="range" min="1" max="2" step="0.02" value={draft.avatarZoom} onChange={(event) => setDraft((current) => ({ ...current, avatarZoom: Number(event.target.value) }))} />
                      </label>
                    </div>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <UserRound className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold">Como quero aparecer</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="profile-display-name">Nome exibido</Label>
                    <Input id="profile-display-name" value={draft.displayName} onChange={(event) => setDraft((current) => ({ ...current, displayName: event.target.value }))} maxLength={80} />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="profile-nickname">Apelido</Label>
                    <Input id="profile-nickname" value={draft.nickname} onChange={(event) => setDraft((current) => ({ ...current, nickname: event.target.value }))} maxLength={40} placeholder="Como prefere ser chamado(a)" />
                  </div>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="profile-gender">Gênero <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                    <select
                      id="profile-gender"
                      value={draft.gender}
                      onChange={(event) => setDraft((current) => ({ ...current, gender: event.target.value }))}
                      className="h-10 rounded-md border border-input bg-background px-3 text-sm outline-none focus:ring-2 focus:ring-ring"
                    >
                      {GENDERS.map((item) => <option key={item || "none"} value={item}>{item || "Prefiro não informar"}</option>)}
                    </select>
                  </div>
                  <ToggleRow
                    checked={draft.showGender}
                    onChange={(showGender) => setDraft((current) => ({ ...current, showGender }))}
                    label="Mostrar gênero no perfil"
                    description="Se desligado, essa informação fica salva apenas para você."
                  />
                </div>
                <div className="grid gap-1.5">
                  <Label htmlFor="profile-bio">Sobre mim <span className="font-normal text-muted-foreground">(opcional)</span></Label>
                  <Textarea id="profile-bio" value={draft.bio} onChange={(event) => setDraft((current) => ({ ...current, bio: event.target.value }))} maxLength={280} rows={3} placeholder="Uma apresentação curta para o seu perfil." />
                  <div className="flex items-center justify-between gap-3">
                    <span className="text-[10px] text-muted-foreground">{draft.bio.length}/280</span>
                    <label className="inline-flex items-center gap-2 text-[11px] font-semibold text-muted-foreground">
                      <input type="checkbox" checked={draft.showBio} onChange={(event) => setDraft((current) => ({ ...current, showBio: event.target.checked }))} /> Exibir no perfil
                    </label>
                  </div>
                </div>
              </section>

              <section className="grid gap-4 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <Globe2 className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold">Redes e links</h3>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="grid gap-1.5">
                    <Label htmlFor="profile-instagram" className="inline-flex items-center gap-1.5"><Instagram className="h-3.5 w-3.5" /> Instagram</Label>
                    <Input id="profile-instagram" type="url" value={draft.instagramUrl} onChange={(event) => setDraft((current) => ({ ...current, instagramUrl: event.target.value }))} placeholder="https://instagram.com/..." />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="profile-linkedin" className="inline-flex items-center gap-1.5"><Linkedin className="h-3.5 w-3.5" /> LinkedIn</Label>
                    <Input id="profile-linkedin" type="url" value={draft.linkedinUrl} onChange={(event) => setDraft((current) => ({ ...current, linkedinUrl: event.target.value }))} placeholder="https://linkedin.com/in/..." />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="profile-tiktok">TikTok</Label>
                    <Input id="profile-tiktok" type="url" value={draft.tiktokUrl} onChange={(event) => setDraft((current) => ({ ...current, tiktokUrl: event.target.value }))} placeholder="https://tiktok.com/@..." />
                  </div>
                  <div className="grid gap-1.5">
                    <Label htmlFor="profile-website">Site / outro link</Label>
                    <Input id="profile-website" type="url" value={draft.websiteUrl} onChange={(event) => setDraft((current) => ({ ...current, websiteUrl: event.target.value }))} placeholder="https://..." />
                  </div>
                </div>
                <ToggleRow
                  checked={draft.showSocials}
                  onChange={(showSocials) => setDraft((current) => ({ ...current, showSocials }))}
                  label="Mostrar meus links no perfil"
                  description="Você pode manter os links cadastrados e escondê-los quando quiser."
                />
              </section>

              <section className="grid gap-4 border-t border-border pt-5">
                <div className="flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  <h3 className="text-sm font-bold">Aparência do meu perfil</h3>
                </div>
                <div>
                  <Label>Cor principal</Label>
                  <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {ACCENTS.map(([color, label]) => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setDraft((current) => ({ ...current, accentColor: color }))}
                        className={`flex items-center gap-2 rounded-lg border p-2.5 text-left text-xs font-semibold ${draft.accentColor === color ? "border-foreground bg-muted" : "border-border bg-card"}`}
                      >
                        <span className="h-6 w-6 rounded-md shadow-inner" style={{ backgroundColor: color }} />
                        {label}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <Label>Fundo do card</Label>
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
              </section>
            </div>

            <aside className="lg:sticky lg:top-0 lg:self-start">
              <p className="mb-2 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground">Prévia do perfil</p>
              <div
                className="overflow-hidden rounded-2xl border shadow-sm"
                style={{ backgroundColor: backgroundColor(draft.backgroundStyle), borderColor: `${draft.accentColor}55` }}
              >
                <div className="h-2" style={{ backgroundColor: draft.accentColor }} />
                <div className="p-5 text-center">
                  <div className="mx-auto grid h-20 w-20 place-items-center overflow-hidden rounded-full border-4 border-white bg-white shadow-md">
                    {draft.avatarUrl ? (
                      <img src={draft.avatarUrl} alt={previewName} className="h-full w-full object-cover" style={userProfileFrameStyle(draft)} />
                    ) : (
                      <span className="font-bold" style={{ color: draft.accentColor }}>{safeInitials(previewName)}</span>
                    )}
                  </div>
                  <h4 className="mt-3 text-lg font-bold text-foreground">{previewName}</h4>
                  {draft.nickname && draft.displayName ? <p className="text-xs text-muted-foreground">{draft.displayName}</p> : null}
                  {draft.showGender && draft.gender ? <p className="mt-2 text-[11px] text-muted-foreground">{draft.gender}</p> : null}
                  {draft.showBio && draft.bio ? <p className="mt-3 text-xs leading-relaxed text-muted-foreground">{draft.bio}</p> : null}
                  {draft.showSocials && (draft.instagramUrl || draft.linkedinUrl || draft.tiktokUrl || draft.websiteUrl) ? (
                    <div className="mt-4 flex flex-wrap justify-center gap-2 text-[10px] font-bold" style={{ color: draft.accentColor }}>
                      {draft.instagramUrl ? <span>Instagram</span> : null}
                      {draft.linkedinUrl ? <span>LinkedIn</span> : null}
                      {draft.tiktokUrl ? <span>TikTok</span> : null}
                      {draft.websiteUrl ? <span>Link</span> : null}
                    </div>
                  ) : null}
                </div>
              </div>
            </aside>
          </div>

          <div className="mt-2 flex flex-col-reverse gap-2 border-t border-border pt-4 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={saving}>Cancelar</Button>
            <Button type="button" onClick={() => void submit()} disabled={saving || uploading}>
              {saving ? "Salvando..." : "Salvar perfil"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
