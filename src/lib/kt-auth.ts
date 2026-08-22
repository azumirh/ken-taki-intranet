import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type KtPerfil = {
  id: string;
  tipo: "gestor" | "azumi" | "rh";
  filial: "cristo-rei" | "champagnat" | null;
  nome: string;
  precisa_trocar_senha: boolean;
  ativo?: boolean;
};

export type KtAuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "autenticado"; perfil: KtPerfil; email: string };

export function useKtAuth() {
  const [state, setState] = useState<KtAuthState>({ status: "loading" });

  const loadPerfil = useCallback(async (userId: string, email: string) => {
    const { data, error } = await supabase.from("kt_perfis").select("*").eq("id", userId).single();

    if (error || !data || data.ativo === false) {
      await supabase.auth.signOut().catch(() => undefined);
      setState({ status: "anon" });
      return;
    }

    // Compatibility bridge: the legacy /azumi route still gates on tipo="azumi".
    // New RH accounts are stored as tipo="rh" in the database so permissions can
    // evolve independently. Expose them as the legacy RH role only to the old route
    // shell until that route is fully retired; permission hooks still read the real
    // database profile and keep general/partial authorization intact.
    const raw = data as KtPerfil;
    const perfil: KtPerfil = raw.tipo === "rh" ? { ...raw, tipo: "azumi" } : raw;
    setState({ status: "autenticado", perfil, email });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState({ status: "anon" });
        return;
      }
      void loadPerfil(session.user.id, session.user.email ?? "");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState({ status: "anon" });
        return;
      }
      void loadPerfil(session.user.id, session.user.email ?? "");
    });

    return () => subscription.unsubscribe();
  }, [loadPerfil]);

  async function login(email: string, senha: string) {
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password: senha,
    });
    if (error) throw error;
  }

  async function logout() {
    await supabase.auth.signOut();
  }

  async function esqueceuSenha(email: string) {
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth` : "";
    const { error } = await supabase.auth.resetPasswordForEmail(
      email.trim(),
      redirectTo ? { redirectTo } : {},
    );
    if (error) throw error;
  }

  async function trocarSenha(novaSenha: string) {
    const { error } = await supabase.auth.updateUser({ password: novaSenha });
    if (error) throw error;
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase
        .from("kt_perfis")
        .update({ precisa_trocar_senha: false, updated_at: new Date().toISOString() })
        .eq("id", user.id);
      void loadPerfil(user.id, user.email ?? "");
    }
  }

  return { state, login, logout, esqueceuSenha, trocarSenha };
}
