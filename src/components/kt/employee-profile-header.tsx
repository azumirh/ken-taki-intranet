import {
  BriefcaseBusiness,
  Camera,
  MapPin,
  Pencil,
  RotateCcw,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/kt/section";
import { EmployeeExperienceEnhancer } from "@/components/kt/employee-experience-enhancer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";
import { useColaboradores, useSession } from "@/lib/kt-store";

type PhotoFrame = { x: number; y: number; zoom: number };
type PhotoFrameRow = {
  nome: string;
  foto_pos_x: number | null;
  foto_pos_y: number | null;
  foto_zoom: number | string | null;
};

type ProfilePreferenceRow = {
  foto_pos_x: number | null;
  foto_pos_y: number | null;
  foto_zoom: number | string | null;
  nome_preferido: string | null;
  cor_perfil: string | null;
};

const DEFAULT_FRAME: PhotoFrame = { x: 50, y: 35, zoom: 1 };
const DEFAULT_ACCENT = "#5C294F";
const ACCENT_OPTIONS = ["#5C294F", "#7A3049", "#8B5E3C", "#315C52", "#425A78", "#6B4E71"];

function frameStyle(frame: PhotoFrame) {
  return {
    objectPosition: `${frame.x}% ${frame.y}%`,
    transform: `scale(${frame.zoom})`,
    transformOrigin: `${frame.x}% ${frame.y}%`,
  };
}

function toFrame(row: PhotoFrameRow): PhotoFrame {
  return {
    x: Number(row.foto_pos_x ?? DEFAULT_FRAME.x),
    y: Number(row.foto_pos_y ?? DEFAULT_FRAME.y),
    zoom: Number(row.foto_zoom ?? DEFAULT_FRAME.zoom),
  };
}

function greetingForNow() {
  const hour = new Date().getHours();
  if (hour < 12) return "Bom dia";
  if (hour < 18) return "Boa tarde";
  return "Boa noite";
}

export function EmployeeProfileHeader() {
  const [session] = useSession();
  const [colaboradores, setColaboradores] = useColaboradores();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editingFrame, setEditingFrame] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);
  const [frame, setFrame] = useState<PhotoFrame>(DEFAULT_FRAME);
  const [savedFrame, setSavedFrame] = useState<PhotoFrame>(DEFAULT_FRAME);
  const [framesByName, setFramesByName] = useState<Map<string, PhotoFrame>>(new Map());
  const [preferredName, setPreferredName] = useState("");
  const [preferredNameDraft, setPreferredNameDraft] = useState("");
  const [accent, setAccent] = useState(DEFAULT_ACCENT);
  const [accentDraft, setAccentDraft] = useState(DEFAULT_ACCENT);
  const [savingProfile, setSavingProfile] = useState(false);

  const perfil = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return null;
    return (
      colaboradores.find(
        (item) => item.nome === session.nome && item.filial === session.filial,
      ) ?? null
    );
  }, [colaboradores, session]);

  useEffect(() => {
    if (!perfil) return;
    let cancelled = false;

    void Promise.all([
      supabase
        .from("kt_colaboradores")
        .select("foto_pos_x,foto_pos_y,foto_zoom,nome_preferido,cor_perfil")
        .eq("id", perfil.id)
        .maybeSingle(),
      supabase.rpc("kt_list_employee_photo_frames"),
    ]).then(([ownResult, directoryResult]) => {
      if (cancelled) return;

      if (ownResult.data) {
        const own = ownResult.data as ProfilePreferenceRow;
        const next = {
          x: Number(own.foto_pos_x ?? DEFAULT_FRAME.x),
          y: Number(own.foto_pos_y ?? DEFAULT_FRAME.y),
          zoom: Number(own.foto_zoom ?? DEFAULT_FRAME.zoom),
        };
        setFrame(next);
        setSavedFrame(next);
        const nextName = own.nome_preferido?.trim() ?? "";
        const nextAccent = own.cor_perfil || DEFAULT_ACCENT;
        setPreferredName(nextName);
        setPreferredNameDraft(nextName);
        setAccent(nextAccent);
        setAccentDraft(nextAccent);
      }

      if (!directoryResult.error && directoryResult.data) {
        const next = new Map<string, PhotoFrame>();
        (directoryResult.data as PhotoFrameRow[]).forEach((row) => {
          next.set(String(row.nome), toFrame(row));
        });
        setFramesByName(next);
      }
    });

    return () => {
      cancelled = true;
    };
  }, [perfil?.id]);

  useEffect(() => {
    if (!perfil) return;

    const apply = () => {
      const root = document.querySelector("[data-employee-workspace]");
      if (!root) return;

      root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        const targetFrame = image.alt === perfil.nome ? frame : framesByName.get(image.alt);
        if (!targetFrame) return;

        image.style.objectPosition = `${targetFrame.x}% ${targetFrame.y}%`;
        image.style.transform = `scale(${targetFrame.zoom})`;
        image.style.transformOrigin = `${targetFrame.x}% ${targetFrame.y}%`;
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    const root = document.querySelector("[data-employee-workspace]");
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [frame, framesByName, perfil]);

  if (!session || session.tipo !== "colaborador") return null;

  async function uploadPhoto(file: File) {
    if (!perfil) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop()?.toLowerCase() || "jpg";
      const path = `fotos/${perfil.id}-${Date.now()}.${ext}`;
      const { data, error } = await supabase.storage
        .from("kt-documentos")
        .upload(path, file, { cacheControl: "86400", upsert: true });
      if (error) throw error;
      const { data: publicUrl } = supabase.storage.from("kt-documentos").getPublicUrl(data.path);
      const url = publicUrl.publicUrl;
      setColaboradores((previous) =>
        previous.map((item) => (item.id === perfil.id ? { ...item, foto: url } : item)),
      );
      setFrame(DEFAULT_FRAME);
      setSavedFrame(DEFAULT_FRAME);
      setFramesByName((previous) => {
        const next = new Map(previous);
        next.set(perfil.nome, DEFAULT_FRAME);
        return next;
      });
      await supabase.rpc("kt_update_my_photo_frame", {
        p_x: DEFAULT_FRAME.x,
        p_y: DEFAULT_FRAME.y,
        p_zoom: DEFAULT_FRAME.zoom,
      });
      toast.success("Foto atualizada. Agora você pode ajustar o enquadramento.");
      setEditingFrame(true);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível atualizar a foto.");
    } finally {
      setUploading(false);
    }
  }

  async function saveFrame() {
    if (!perfil) return;
    const { error } = await supabase.rpc("kt_update_my_photo_frame", {
      p_x: Math.round(frame.x),
      p_y: Math.round(frame.y),
      p_zoom: Number(frame.zoom.toFixed(2)),
    });
    if (error) {
      toast.error("Não foi possível salvar o enquadramento.");
      return;
    }
    setSavedFrame(frame);
    setFramesByName((previous) => {
      const next = new Map(previous);
      next.set(perfil.nome, frame);
      return next;
    });
    setEditingFrame(false);
    toast.success("Enquadramento salvo em todo o portal.");
  }

  async function saveProfilePreferences() {
    setSavingProfile(true);
    const nextName = preferredNameDraft.trim().slice(0, 40);
    const { error } = await supabase.rpc("kt_update_my_profile_preferences", {
      p_nome_preferido: nextName,
      p_cor_perfil: accentDraft,
    });
    setSavingProfile(false);
    if (error) {
      toast.error("Não foi possível salvar suas preferências agora.");
      return;
    }
    setPreferredName(nextName);
    setAccent(accentDraft);
    setEditingProfile(false);
    toast.success("Seu perfil foi personalizado.");
  }

  const officialFirstName = session.nome.trim().split(/\s+/)[0] ?? session.nome;
  const displayName = preferredName || officialFirstName;
  const softAccent = `${accent}14`;

  return (
    <section
      className="employee-profile-card mx-auto mb-5 w-full max-w-3xl text-center"
      aria-label="Meu perfil"
    >
      <div
        className="surface relative overflow-hidden px-5 py-6 sm:px-8 sm:py-7"
        style={{
          borderColor: `${accent}35`,
          background: `linear-gradient(145deg, ${softAccent}, rgba(255,255,255,0.96) 44%, rgba(255,255,255,1))`,
        }}
      >
        <button
          type="button"
          onClick={() => {
            setPreferredNameDraft(preferredName);
            setAccentDraft(accent);
            setEditingProfile((value) => !value);
          }}
          className="absolute right-4 top-4 grid h-9 w-9 place-items-center rounded-md border border-border bg-card text-muted-foreground shadow-sm transition-colors hover:text-foreground"
          aria-label="Editar meu perfil"
          title="Editar meu perfil"
        >
          <Pencil className="h-4 w-4" />
        </button>

        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
          Meu perfil
        </p>

        <div className="mx-auto mt-3 flex w-full max-w-xl flex-col items-center">
          <div className="relative">
            <div
              className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-muted ring-2 sm:h-32 sm:w-32"
              style={{ boxShadow: `0 0 0 4px ${softAccent}`, borderColor: accent }}
            >
              {perfil?.foto ? (
                <img
                  src={perfil.foto}
                  alt={perfil.nome}
                  className="h-full w-full object-cover transition-transform duration-200"
                  style={frameStyle(frame)}
                />
              ) : (
                <Avatar nome={session.nome} size={112} />
              )}
            </div>
            <button
              type="button"
              title="Trocar foto"
              aria-label="Trocar foto"
              disabled={uploading || !perfil}
              onClick={() => inputRef.current?.click()}
              className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border-2 border-card text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
              style={{ backgroundColor: accent }}
            >
              <Camera className="h-4 w-4" />
            </button>
            <input
              ref={inputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void uploadPhoto(file);
                event.target.value = "";
              }}
            />
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            {greetingForNow()}, {displayName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu espaço no Ken Taki</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
            {perfil?.cargo ? (
              <span
                className="inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold"
                style={{ borderColor: `${accent}35`, backgroundColor: softAccent, color: accent }}
              >
                <BriefcaseBusiness className="h-3.5 w-3.5" /> {perfil.cargo}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-card px-3 py-1.5 text-xs font-semibold text-muted-foreground">
              <MapPin className="h-3.5 w-3.5" /> {filialNome(session.filial)}
            </span>
          </div>

          {perfil?.foto ? (
            <button
              type="button"
              onClick={() => {
                setFrame(savedFrame);
                setEditingFrame((value) => !value);
              }}
              className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar enquadramento
            </button>
          ) : null}
        </div>

        {editingProfile ? (
          <div className="mx-auto mt-5 max-w-xl rounded-lg border border-border bg-card/95 p-4 text-left shadow-sm">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">Personalizar meu perfil</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  O nome cadastral continua protegido. Aqui você escolhe como prefere ser chamado no portal e a cor do seu cartão.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setEditingProfile(false)}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fechar edição"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <label className="mt-4 grid gap-1.5 text-xs font-semibold text-foreground">
              Como você prefere ser chamado?
              <Input
                value={preferredNameDraft}
                maxLength={40}
                placeholder={officialFirstName}
                onChange={(event) => setPreferredNameDraft(event.target.value)}
              />
            </label>

            <div className="mt-4">
              <p className="text-xs font-semibold text-foreground">Cor do meu perfil</p>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                {ACCENT_OPTIONS.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() => setAccentDraft(color)}
                    aria-label={`Usar a cor ${color}`}
                    aria-pressed={accentDraft === color}
                    className="h-8 w-8 rounded-full border-2 border-card shadow-sm ring-1 transition-transform hover:scale-105"
                    style={{
                      backgroundColor: color,
                      boxShadow: accentDraft === color ? `0 0 0 3px ${color}35` : undefined,
                    }}
                  />
                ))}
                <label className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-2 py-1 text-xs text-muted-foreground">
                  Outra
                  <input
                    type="color"
                    value={accentDraft}
                    onChange={(event) => setAccentDraft(event.target.value)}
                    className="h-7 w-8 cursor-pointer border-0 bg-transparent p-0"
                  />
                </label>
              </div>
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                type="button"
                size="sm"
                disabled={savingProfile}
                onClick={() => void saveProfilePreferences()}
              >
                {savingProfile ? "Salvando..." : "Salvar perfil"}
              </Button>
            </div>
          </div>
        ) : null}

        {editingFrame && perfil?.foto ? (
          <div className="mx-auto mt-5 max-w-xl rounded-lg border border-border bg-muted/30 p-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">Ajustar foto</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Mova o foco e o zoom até seu rosto ficar bem enquadrado. O mesmo recorte é usado em todos os lugares do portal onde sua foto aparecer.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setFrame(savedFrame);
                  setEditingFrame(false);
                }}
                className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                aria-label="Fechar ajuste"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Horizontal
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={frame.x}
                  onChange={(event) =>
                    setFrame((value) => ({ ...value, x: Number(event.target.value) }))
                  }
                  className="w-full accent-[var(--kt)]"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Vertical
                <input
                  type="range"
                  min="0"
                  max="100"
                  value={frame.y}
                  onChange={(event) =>
                    setFrame((value) => ({ ...value, y: Number(event.target.value) }))
                  }
                  className="w-full accent-[var(--kt)]"
                />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Zoom
                <input
                  type="range"
                  min="1"
                  max="1.8"
                  step="0.02"
                  value={frame.zoom}
                  onChange={(event) =>
                    setFrame((value) => ({ ...value, zoom: Number(event.target.value) }))
                  }
                  className="w-full accent-[var(--kt)]"
                />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <Button type="button" variant="ghost" size="sm" onClick={() => setFrame(DEFAULT_FRAME)}>
                <RotateCcw className="h-3.5 w-3.5" /> Centralizar
              </Button>
              <Button type="button" size="sm" onClick={() => void saveFrame()}>
                Salvar enquadramento
              </Button>
            </div>
          </div>
        ) : null}
      </div>
      <EmployeeExperienceEnhancer />
    </section>
  );
}
