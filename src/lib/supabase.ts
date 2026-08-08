import { createClient } from "@supabase/supabase-js";

// Connect Hub — ref nxmwhtkygiljkbovwixk
// Hardcoded: @lovable.dev/vite-tanstack-config injects env vars as "KEY=value" strings
// which are truthy but not valid JWTs, so import.meta.env cannot be relied upon here.
const url = "https://nxmwhtkygiljkbovwixk.supabase.co";
const key =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im54bXdodGt5Z2lsamtib3Z3aXhrIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzcyMzU0MTcsImV4cCI6MjA5MjgxMTQxN30.vhFqRbCoArHrzsC65Pw6Ht9oPykvE3_lijn4unowKs8";

export const supabase = createClient(url, key, {
  auth: { flowType: "pkce" },
});
