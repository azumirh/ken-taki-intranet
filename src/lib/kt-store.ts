import { useCallback, useEffect, useState } from "react";
import { MURAL_SEED, NOTICIAS_SEED, type MuralItem, type Noticia } from "./kt-data";

/**
 * Estado 100% no navegador (localStorage) — sem back-end.
 * Depois é só trocar estas funções por chamadas ao Supabase, sem mexer na UI.
 */

const PREFIX = "kentaki:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(PREFIX + key, JSON.stringify(value));
  window.dispatchEvent(new CustomEvent("kentaki:store", { detail: key }));
}

export function useStore<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(initial);

  useEffect(() => {
    setValue(read<T>(key, initial));
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) setValue(read<T>(key, initial));
    };
    window.addEventListener("kentaki:store", onChange);
    return () => window.removeEventListener("kentaki:store", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = typeof next === "function" ? (next as (p: T) => T)(prev) : next;
        write(key, resolved);
        return resolved;
      });
    },
    [key],
  );

  return [value, update] as const;
}

export type Session =
  | { tipo: "colaborador"; nome: string; cpf3: string; filial: string }
  | { tipo: "gestor"; nome: string; email: string; filial: string }
  | { tipo: "azumi"; nome: string; email: string }
  | null;

export function useSession() {
  return useStore<Session>("session", null);
}

export type CheckIn = { id: string; nome: string; filial: string; humor: string; ts: number; recado?: string };
export type Assinatura = { politica: string; nome: string; filial: string; ts: number };
export type Sugestao = { id: string; categoria: string; mensagem: string; filial: string; ts: number };
export type Feedback = {
  id: string;
  tipo: string;
  mensagem: string;
  anonimo: boolean;
  autor: string;
  filial: string;
  ts: number;
};
export type Vaga = { id: string; cargo: string; filial: string; motivo: string; ts: number };
export type Pesquisa = { id: string; titulo: string; descricao: string; link: string; ativa: boolean; ts: number } | null;
export type AjudaClick = { id: string; nome: string; filial: string; assunto: string; ts: number };

export const useMural = () => useStore<MuralItem[]>("mural", MURAL_SEED);
export const useNoticias = () => useStore<Noticia[]>("noticias", NOTICIAS_SEED);
export const useCheckins = () => useStore<CheckIn[]>("checkins", []);
export const useAssinaturas = () => useStore<Assinatura[]>("assinaturas", []);
export const useSugestoes = () => useStore<Sugestao[]>("sugestoes", []);
export const useFeedbacks = () => useStore<Feedback[]>("feedbacks", []);
export const useVagas = () => useStore<Vaga[]>("vagas", []);
export const usePesquisa = () => useStore<Pesquisa>("pesquisa", null);
export const useAjuda = () => useStore<AjudaClick[]>("ajuda", []);

export const uid = () => Math.random().toString(36).slice(2, 10);

export function fmtData(ts: number | string) {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}
