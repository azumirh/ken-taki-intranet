import { createClient } from "@supabase/supabase-js";

// Connect Hub — ref nxmwhtkygiljkbovwixk
const url =
  (import.meta.env.VITE_SUPABASE_URL as string) ||
  "https://nxmwhtkygiljkbovwixk.supabase.co";
const key =
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string) ||
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bXdodGt5Z2lsamtib3Z3aXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzU0MTcsImV4cCI6MjA5MjgxMTQxN30.vhFqRbCoArHrzsC65Pw6Ht9oPykvE3_lijn4unowKs8";

export const supabase = createClient(url, key);
