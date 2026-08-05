import { useCallback, useEffect, useState } from "react";
import { supabase } from "./supabase";

export type KtPerfil = {
  id: string;
  tipo: "gestor" | "azumi";
  filial: "cristo-rei" | "champagnat" | null;
  nome: string;
  precisa_trocar_senha: boolean;
};

export type KtAuthState =
  | { status: "loading" }
  | { status: "anon" }
  | { status: "autenticado"; perfil: KtPerfil; email: string };

export function useKtAuth() {
  const [state, setState] = useState<KtAuthState>({ status: "loading" });

  const loadPerfil = useCallback(async (userId: string, email: string) => {
    const { data } = await supabase.from("kt_perfis").select("*").eq("id", userId).single();
    if (!data) {
      setState({ status: "anon" });
      return;
    }
    setState({ status: "autenticado", perfil: data as KtPerfil, email });
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState({ status: "anon" });
        return;
      }
      loadPerfil(session.user.id, session.user.email ?? "");
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session) {
        setState({ status: "anon" });
        return;
      }
      loadPerfil(session.user.id, session.user.email ?? "");
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
    const redirectTo = typeof window !== "undefined" ? `${window.location.origin}/auth` : undefined;
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo });
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
      loadPerfil(user.id, user.email ?? "");
    }
  }

  return { state, login, logout, esqueceuSenha, trocarSenha };
}
