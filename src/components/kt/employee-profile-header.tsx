import {
  BriefcaseBusiness,
  ExternalLink,
  Globe2,
  Instagram,
  Linkedin,
  MapPin,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Avatar } from "@/components/kt/section";
import { UserProfileEditor } from "@/components/kt/user-profile-editor";
import { filialNome } from "@/lib/kt-data";
import { supabase } from "@/lib/supabase";
import { useColaboradores, useSession } from "@/lib/kt-store";
import { useUserProfile, userProfileFrameStyle } from "@/lib/user-profile";

type PhotoFrame = { x: number; y: number; zoom: number };
type PhotoFrameRow = {
  nome: string;
  foto_pos_x: number | null;
  foto_pos_y: number | null;
  foto_zoom: number | string | null;
};

const DEFAULT_FRAME: PhotoFrame = { x: 50, y: 35, zoom: 1 };

function toFrame(row: PhotoFrameRow): PhotoFrame {
  return {
    x: Number(row.foto_pos_x ?? DEFAULT_FRAME.x),
    y: Number(row.foto_pos_y ?? DEFAULT_FRAME.y),
    zoom: Number(row.foto_zoom ?? DEFAULT_FRAME.zoom),
  };
}

function backgroundColor(style: string) {
  if (style === "paper") return "#fbfaf7";
  if (style === "plum-soft") return "#f4eef2";
  if (style === "graphite-soft") return "#efedec";
  return "#f6f4f0";
}

function safeHref(value: string) {
  if (!value) return null;
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:" ? url.toString() : null;
  } catch {
    return null;
  }
}

export function EmployeeProfileHeader() {
  const [session] = useSession();
  const [colaboradores] = useColaboradores();
  const { profile } = useUserProfile();
  const [framesByName, setFramesByName] = useState<Map<string, PhotoFrame>>(new Map());

  const perfil = useMemo(() => {
    if (!session || session.tipo !== "colaborador") return null;
    return (
      colaboradores.find(
        (item) => item.nome === session.nome && item.filial === session.filial,
      ) ?? null
    );
  }, [colaboradores, session]);

  const loadDirectory = useCallback(async () => {
    if (!perfil) return;
    const { data, error } = await supabase.rpc("kt_list_employee_photo_frames");
    if (error || !data) return;
    const next = new Map<string, PhotoFrame>();
    (data as PhotoFrameRow[]).forEach((row) => next.set(String(row.nome), toFrame(row)));
    setFramesByName(next);
  }, [perfil]);

  useEffect(() => {
    void loadDirectory();
    const refresh = () => void loadDirectory();
    window.addEventListener("kt-profile-updated", refresh);
    return () => window.removeEventListener("kt-profile-updated", refresh);
  }, [loadDirectory]);

  useEffect(() => {
    if (!perfil) return;

    const ownFrame: PhotoFrame = {
      x: profile.avatarPosX,
      y: profile.avatarPosY,
      zoom: profile.avatarZoom,
    };

    const apply = () => {
      const root = document.querySelector("[data-employee-workspace]");
      if (!root) return;

      root.querySelectorAll<HTMLImageElement>("img").forEach((image) => {
        if (image.closest(".employee-profile-card")) return;
        const targetFrame = image.alt === perfil.nome ? ownFrame : framesByName.get(image.alt);
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
  }, [framesByName, perfil, profile.avatarPosX, profile.avatarPosY, profile.avatarZoom]);

  if (!session || session.tipo !== "colaborador") return null;

  const displayName = profile.displayName || session.nome;
  const greetingName = profile.nickname.trim() || displayName.trim().split(/\s+/)[0] || session.nome;
  const instagram = safeHref(profile.instagramUrl);
  const linkedin = safeHref(profile.linkedinUrl);
  const tiktok = safeHref(profile.tiktokUrl);
  const website = safeHref(profile.websiteUrl);
  const socialsVisible = profile.showSocials && (instagram || linkedin || tiktok || website);

  return (
    <section className="employee-profile-card mx-auto mb-5 w-full max-w-3xl text-center" aria-label="Meu perfil">
      <div
        className="relative overflow-hidden rounded-2xl border px-5 py-6 shadow-sm sm:px-8 sm:py-7"
        style={{
          backgroundColor: backgroundColor(profile.backgroundStyle),
          borderColor: `${profile.accentColor}38`,
        }}
      >
        <span className="absolute inset-x-0 top-0 h-1.5" style={{ backgroundColor: profile.accentColor }} aria-hidden />
        <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Meu perfil</p>

        <div className="mx-auto mt-3 flex w-full max-w-xl flex-col items-center">
          <div
            className="grid h-28 w-28 place-items-center overflow-hidden rounded-full bg-white shadow-md ring-4 ring-white sm:h-32 sm:w-32"
            style={{ boxShadow: `0 0 0 1px ${profile.accentColor}35, 0 10px 25px -18px ${profile.accentColor}` }}
          >
            {profile.avatarUrl || perfil?.foto ? (
              <img
                src={profile.avatarUrl || perfil?.foto || ""}
                alt={perfil?.nome || session.nome}
                className="h-full w-full object-cover transition-transform duration-200"
                style={userProfileFrameStyle(profile)}
              />
            ) : (
              <Avatar nome={displayName} size={112} />
            )}
          </div>

          <h1 className="mt-4 text-2xl font-bold leading-tight text-foreground sm:text-3xl">
            Olá, {greetingName}
          </h1>
          {profile.nickname && displayName ? (
            <p className="mt-1 text-sm font-semibold" style={{ color: profile.accentColor }}>{displayName}</p>
          ) : (
            <p className="mt-1 text-sm text-muted-foreground">Seu espaço no Ken Taki</p>
          )}

          <div className="mt-3 flex flex-wrap items-center justify-center gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {perfil?.cargo ? (
              <span className="inline-flex items-center gap-1.5">
                <BriefcaseBusiness className="h-3.5 w-3.5" /> {perfil.cargo}
              </span>
            ) : null}
            <span className="inline-flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" /> {filialNome(session.filial)}
            </span>
            {profile.showGender && profile.gender ? <span>{profile.gender}</span> : null}
          </div>

          {profile.showBio && profile.bio ? (
            <p className="mt-4 max-w-lg text-sm leading-relaxed text-muted-foreground">{profile.bio}</p>
          ) : null}

          {socialsVisible ? (
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {instagram ? <a href={instagram} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-white/70 px-2.5 text-xs font-semibold transition hover:bg-white" style={{ color: profile.accentColor }}><Instagram className="h-3.5 w-3.5" /> Instagram</a> : null}
              {linkedin ? <a href={linkedin} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-white/70 px-2.5 text-xs font-semibold transition hover:bg-white" style={{ color: profile.accentColor }}><Linkedin className="h-3.5 w-3.5" /> LinkedIn</a> : null}
              {tiktok ? <a href={tiktok} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-white/70 px-2.5 text-xs font-semibold transition hover:bg-white" style={{ color: profile.accentColor }}><ExternalLink className="h-3.5 w-3.5" /> TikTok</a> : null}
              {website ? <a href={website} target="_blank" rel="noreferrer" className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-border bg-white/70 px-2.5 text-xs font-semibold transition hover:bg-white" style={{ color: profile.accentColor }}><Globe2 className="h-3.5 w-3.5" /> Link</a> : null}
            </div>
          ) : null}

          <div className="mt-5">
            <UserProfileEditor buttonLabel="Editar meu perfil" />
          </div>
        </div>
      </div>
    </section>
  );
}
