import { createClient } from "@supabase/supabase-js";

// Connect Hub — ref nxmwhtkygiljkbovwixk
const url = (import.meta.env.VITE_SUPABASE_URL as string) || "";
const key = (import.meta.env.VITE_SUPABASE_ANON_KEY as string) || "";

export const supabase = createClient(url, key);
