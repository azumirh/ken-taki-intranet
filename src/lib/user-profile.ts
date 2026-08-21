import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type ProfileBackground = "ivory" | "paper" | "plum-soft" | "graphite-soft";

export type UserProfile = {
  authUserId: string | null;
  officialName: string;
  displayName: string;
  nickname: string;
  gender: string;
  bio: string;
  instagramUrl: string;
  linkedinUrl: string;
  tiktokUrl: string;
  websiteUrl: string;
  avatarUrl: string;
  avatarPosX: number;
  avatarPosY: number;
  avatarZoom: number;
  showGender: boolean;
  showBio: boolean;
  showSocials: boolean;
  accentColor: string;
  backgroundStyle: ProfileBackground;
};

const DEFAULT_PROFILE: UserProfile = {
  authUserId: null,
  officialName: "",
  displayName: "",
  nickname: "",
  gender: "",
  bio: "",
  instagramUrl: "",
  linkedinUrl: "",
  tiktokUrl: "",
  websiteUrl: "",
  avatarUrl: "",
  avatarPosX: 50,
  avatarPosY: 35,
  avatarZoom: 1,
  showGender: false,
  showBio: true,
  showSocials: true,
  accentColor: "#4b3142",
  backgroundStyle: "ivory",
};

type PreferencesRow = {
  display_name: string | null;
  nickname: string | null;
  gender: string | null;
  bio: string | null;
  instagram_url: string | null;
  linkedin_url: string | null;
  tiktok_url: string | null;
  website_url: string | null;
  avatar_url: string | null;
  avatar_pos_x: number | null;
  avatar_pos_y: number | null;
  avatar_zoom: number | string | null;
  show_gender: boolean | null;
  show_bio: boolean | null;
  show_socials: boolean | null;
  accent_color: string | null;
  background_style: string | null;
};

function clean(value: string) {
  const next = value.trim();
  return next.length ? next : null;
}

export function applyUserProfileTheme(profile: Pick<UserProfile, "accentColor" | "backgroundStyle">) {
  document.documentElement.style.setProperty("--profile-accent", profile.accentColor);
  document.documentElement.dataset.profileBackground = profile.backgroundStyle;
}

export function userProfileFrameStyle(profile: Pick<UserProfile, "avatarPosX" | "avatarPosY" | "avatarZoom">) {
  return {
    objectPosition: `${profile.avatarPosX}% ${profile.avatarPosY}%`,
    transform: `scale(${profile.avatarZoom})`,
    transformOrigin: `${profile.avatarPosX}% ${profile.avatarPosY}%`,
  };
}

export function useUserProfile() {
  const [profile, setProfile] = useState<UserProfile>(DEFAULT_PROFILE);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: auth, error: authError } = await supabase.auth.getUser();
      if (authError) throw authError;
      if (!auth.user) {
        setProfile(DEFAULT_PROFILE);
        return;
      }

      const [preferencesResult, adminResult, employeeResult] = await Promise.all([
        supabase
          .from("kt_profile_preferences")
          .select(
            "display_name,nickname,gender,bio,instagram_url,linkedin_url,tiktok_url,website_url,avatar_url,avatar_pos_x,avatar_pos_y,avatar_zoom,show_gender,show_bio,show_socials,accent_color,background_style",
          )
          .eq("profile_id", auth.user.id)
          .maybeSingle(),
        supabase.from("kt_perfis").select("nome").eq("id", auth.user.id).maybeSingle(),
        supabase
          .from("kt_colaboradores")
          .select("nome,foto,foto_pos_x,foto_pos_y,foto_zoom")
          .eq("auth_user_id", auth.user.id)
          .maybeSingle(),
      ]);

      if (preferencesResult.error) throw preferencesResult.error;
      const row = (preferencesResult.data ?? null) as PreferencesRow | null;
      const officialName = employeeResult.data?.nome || adminResult.data?.nome || auth.user.email || "Usuário";
      const fallbackAvatar = employeeResult.data?.foto || "";

      const next: UserProfile = {
        authUserId: auth.user.id,
        officialName,
        displayName: row?.display_name || officialName,
        nickname: row?.nickname || "",
        gender: row?.gender || "",
        bio: row?.bio || "",
        instagramUrl: row?.instagram_url || "",
        linkedinUrl: row?.linkedin_url || "",
        tiktokUrl: row?.tiktok_url || "",
        websiteUrl: row?.website_url || "",
        avatarUrl: row?.avatar_url || fallbackAvatar,
        avatarPosX: Number(row?.avatar_pos_x ?? employeeResult.data?.foto_pos_x ?? DEFAULT_PROFILE.avatarPosX),
        avatarPosY: Number(row?.avatar_pos_y ?? employeeResult.data?.foto_pos_y ?? DEFAULT_PROFILE.avatarPosY),
        avatarZoom: Number(row?.avatar_zoom ?? employeeResult.data?.foto_zoom ?? DEFAULT_PROFILE.avatarZoom),
        showGender: Boolean(row?.show_gender ?? DEFAULT_PROFILE.showGender),
        showBio: Boolean(row?.show_bio ?? DEFAULT_PROFILE.showBio),
        showSocials: Boolean(row?.show_socials ?? DEFAULT_PROFILE.showSocials),
        accentColor: row?.accent_color || DEFAULT_PROFILE.accentColor,
        backgroundStyle: (row?.background_style || DEFAULT_PROFILE.backgroundStyle) as ProfileBackground,
      };

      setProfile(next);
      applyUserProfileTheme(next);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
    const refresh = () => void load();
    window.addEventListener("kt-profile-updated", refresh);
    return () => window.removeEventListener("kt-profile-updated", refresh);
  }, [load]);

  const save = useCallback(async (next: UserProfile) => {
    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("Sessão não encontrada.");

    const { error } = await supabase.from("kt_profile_preferences").upsert({
      profile_id: auth.user.id,
      display_name: clean(next.displayName) || next.officialName,
      nickname: clean(next.nickname),
      gender: clean(next.gender),
      bio: clean(next.bio),
      instagram_url: clean(next.instagramUrl),
      linkedin_url: clean(next.linkedinUrl),
      tiktok_url: clean(next.tiktokUrl),
      website_url: clean(next.websiteUrl),
      avatar_url: clean(next.avatarUrl),
      avatar_pos_x: Math.round(next.avatarPosX),
      avatar_pos_y: Math.round(next.avatarPosY),
      avatar_zoom: Number(next.avatarZoom.toFixed(2)),
      show_gender: next.showGender,
      show_bio: next.showBio,
      show_socials: next.showSocials,
      accent_color: next.accentColor.toLowerCase(),
      background_style: next.backgroundStyle,
      updated_at: new Date().toISOString(),
    });
    if (error) throw error;

    setProfile(next);
    applyUserProfileTheme(next);
    window.dispatchEvent(new CustomEvent("kt-profile-updated"));
  }, []);

  const uploadAvatar = useCallback(async (file: File) => {
    if (!file.type.startsWith("image/")) throw new Error("Selecione uma imagem válida.");
    if (file.size > 5 * 1024 * 1024) throw new Error("A foto deve ter no máximo 5 MB.");

    const { data: auth, error: authError } = await supabase.auth.getUser();
    if (authError) throw authError;
    if (!auth.user) throw new Error("Sessão não encontrada.");

    const extension = file.name.split(".").pop()?.toLowerCase() || "jpg";
    const path = `${auth.user.id}/profile-${Date.now()}.${extension}`;
    const { data, error } = await supabase.storage.from("kt-profile-photos").upload(path, file, {
      cacheControl: "86400",
      upsert: false,
    });
    if (error) throw error;

    return supabase.storage.from("kt-profile-photos").getPublicUrl(data.path).data.publicUrl;
  }, []);

  return { profile, loading, save, uploadAvatar, refresh: load };
}
