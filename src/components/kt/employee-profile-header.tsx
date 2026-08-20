import { BriefcaseBusiness, Camera, MapPin, RotateCcw, SlidersHorizontal, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";
import { useColaboradores, useSession } from "@/lib/kt-store";

type PhotoFrame = { x: number; y: number; zoom: number };

const DEFAULT_FRAME: PhotoFrame = { x: 50, y: 35, zoom: 1 };

function frameStyle(frame: PhotoFrame) {
  return {
    objectPosition: `${frame.x}% ${frame.y}%`,
    transform: `scale(${frame.zoom})`,
    transformOrigin: `${frame.x}% ${frame.y}%`,
  };
}

export function EmployeeProfileHeader() {
  const [session] = useSession();
  const [colaboradores, setColaboradores] = useColaboradores();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [editing, setEditing] = useState(false);
  const [frame, setFrame] = useState<PhotoFrame>(DEFAULT_FRAME);
  const [savedFrame, setSavedFrame] = useState<PhotoFrame>(DEFAULT_FRAME);

  const perfil = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return null;
    return colaboradores.find(
      (item) => item.nome === session.nome && item.filial === session.filial,
    ) ?? null;
  }, [colaboradores, session]);

  useEffect(() => {
    if (!perfil) return;
    let cancelled = false;
    void supabase
      .from("kt_colaboradores")
      .select("foto_pos_x,foto_pos_y,foto_zoom")
      .eq("id", perfil.id)
      .maybeSingle()
      .then(({ data }) => {
        if (cancelled || !data) return;
        const next = {
          x: Number(data.foto_pos_x ?? DEFAULT_FRAME.x),
          y: Number(data.foto_pos_y ?? DEFAULT_FRAME.y),
          zoom: Number(data.foto_zoom ?? DEFAULT_FRAME.zoom),
        };
        setFrame(next);
        setSavedFrame(next);
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
        if (image.alt !== perfil.nome) return;
        image.style.objectPosition = `${frame.x}% ${frame.y}%`;
        image.style.transform = `scale(${frame.zoom})`;
        image.style.transformOrigin = `${frame.x}% ${frame.y}%`;
      });
    };
    apply();
    const observer = new MutationObserver(apply);
    const root = document.querySelector("[data-employee-workspace]");
    if (root) observer.observe(root, { childList: true, subtree: true });
    return () => observer.disconnect();
  }, [frame, perfil]);

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
      await supabase.rpc("kt_update_my_photo_frame", {
        p_x: DEFAULT_FRAME.x,
        p_y: DEFAULT_FRAME.y,
        p_zoom: DEFAULT_FRAME.zoom,
      });
      toast.success("Foto atualizada. Agora você pode ajustar o enquadramento.");
      setEditing(true);
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
    setEditing(false);
    toast.success("Enquadramento salvo.");
  }

  const firstName = session.nome.trim().split(/\s+/)[0] ?? session.nome;

  return (
    <section className="employee-profile-card mx-auto mb-5 w-full max-w-3xl text-center" aria-label="Meu perfil">
      <div className="surface relative overflow-hidden px-5 py-6 sm:px-8 sm:py-7">
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Meu perfil</p>

        <div className="mx-auto mt-3 flex w-full max-w-xl flex-col items-center">
          <div className="relative">
            <div className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-muted ring-2 ring-kt/15 sm:h-32 sm:w-32">
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
              className="absolute bottom-0 right-0 grid h-9 w-9 place-items-center rounded-full border-2 border-card bg-kt text-white shadow-sm transition-transform hover:scale-105 disabled:opacity-50"
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
            Olá, {firstName}
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">Seu espaço no Ken Taki</p>

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {perfil?.cargo ? (
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> {perfil.cargo}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {filialNome(session.filial)}
            </span>
          </div>

          {perfil?.foto ? (
            <button
              type="button"
              onClick={() => {
                setFrame(savedFrame);
                setEditing((value) => !value);
              }}
              className="mt-4 inline-flex min-h-9 items-center gap-2 rounded-md border border-border bg-card px-3 text-xs font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <SlidersHorizontal className="h-3.5 w-3.5" /> Ajustar enquadramento
            </button>
          ) : null}
        </div>

        {editing && perfil?.foto ? (
          <div className="mx-auto mt-5 max-w-xl rounded-lg border border-border bg-muted/30 p-4 text-left">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-sm font-bold text-foreground">Ajustar foto</p>
                <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">
                  Mova o foco e o zoom até seu rosto ficar bem enquadrado. O mesmo recorte é usado onde sua foto aparecer no portal.
                </p>
              </div>
              <button type="button" onClick={() => { setFrame(savedFrame); setEditing(false); }} className="grid h-8 w-8 place-items-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground" aria-label="Fechar ajuste">
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-4 grid gap-3 sm:grid-cols-3">
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Horizontal
                <input type="range" min="0" max="100" value={frame.x} onChange={(event) => setFrame((value) => ({ ...value, x: Number(event.target.value) }))} className="w-full accent-[var(--kt)]" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Vertical
                <input type="range" min="0" max="100" value={frame.y} onChange={(event) => setFrame((value) => ({ ...value, y: Number(event.target.value) }))} className="w-full accent-[var(--kt)]" />
              </label>
              <label className="grid gap-1.5 text-xs font-semibold text-foreground">
                Zoom
                <input type="range" min="1" max="1.8" step="0.02" value={frame.zoom} onChange={(event) => setFrame((value) => ({ ...value, zoom: Number(event.target.value) }))} className="w-full accent-[var(--kt)]" />
              </label>
            </div>

            <div className="mt-4 flex flex-wrap items-center justify-center gap-2 sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setFrame(DEFAULT_FRAME)}
              >
                <RotateCcw className="h-3.5 w-3.5" /> Centralizar
              </Button>
              <Button type="button" size="sm" onClick={() => void saveFrame()}>
                Salvar enquadramento
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
