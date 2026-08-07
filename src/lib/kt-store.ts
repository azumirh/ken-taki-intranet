import { useCallback, useEffect, useRef, useState } from "react";
import {
  COLABORADORES,
  DOCUMENTOS_SEED,
  MURAL_SEED,
  NOTICIAS_SEED,
  type Colaborador,
  type Documento,
  type MuralItem,
  type Noticia,
} from "./kt-data";

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
  const [hidratado, setHidratado] = useState(false);
  const ref = useRef<T>(initial);

  useEffect(() => {
    const current = read<T>(key, initial);
    ref.current = current;
    setValue(current);
    setHidratado(true);
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) {
        const next = read<T>(key, initial);
        ref.current = next;
        setValue(next);
      }
    };
    window.addEventListener("kentaki:store", onChange);
    return () => window.removeEventListener("kentaki:store", onChange);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  const update = useCallback(
    (next: T | ((prev: T) => T)) => {
      const resolved = typeof next === "function" ? (next as (p: T) => T)(ref.current) : next;
      ref.current = resolved;
      setValue(resolved);
      write(key, resolved);
    },
    [key],
  );

  return [value, update, hidratado] as const;
}

export type Session =
  | { tipo: "colaborador"; nome: string; cpf3: string; filial: string }
  | { tipo: "gestor"; nome: string; email: string; filial: string }
  | { tipo: "azumi"; nome: string; email: string }
  | null;

export function useSession() {
  return useStore<Session>("session", null);
}

export type CheckIn = {
  id: string;
  nome: string;
  filial: string;
  humor: string;
  ts: number;
  recado?: string | undefined;
};
export type Assinatura = {
  politica: string;
  nome: string;
  filial: string;
  ts: number;
  cpfConfirmado?: string | undefined;
  protocolo?: string | undefined;
};
export type Sugestao = {
  id: string;
  categoria: string;
  mensagem: string;
  filial: string;
  ts: number;
  status?: "enviado-rh" | "desconsiderado" | "considerar-depois" | "para-socios" | undefined;
  statusTs?: number | undefined;
  justificativa?: string | undefined;
  observacao?: string | undefined;
};
export type Feedback = {
  id: string;
  tipo: string;
  mensagem: string;
  anonimo: boolean;
  autor: string;
  filial: string;
  ts: number;
  status?: "em-andamento" | "concluido" | "cancelado" | undefined;
  statusAlteradoEm?: number | undefined;
  gestorQueMudouStatus?: string | undefined; // gestorId de quem alterou o status por último
  comentarioGestor?: string | undefined; // legado — mantido pra não quebrar dados existentes
  comentariosGestor?: Record<string, string> | undefined; // gestorId → comentário individual
};
export type Vaga = { id: string; cargo: string; filial: string; motivo: string; ts: number };
export type Pesquisa = {
  id: string;
  titulo: string;
  descricao: string;
  link: string;
  ativa: boolean;
  ts: number;
  prazo?: string | undefined; // yyyy-mm-dd
  categoria?: string | undefined;
  respondeu?: string[] | undefined; // names of people who responded
  respondeuTs?: Record<string, number> | undefined; // name → timestamp of confirmation
} | null;
export type AjudaClick = {
  id: string;
  nome: string;
  filial: string;
  assunto: string;
  ts: number;
  status?: "em-andamento" | "resolvido" | undefined;
};
export type AnotacaoApoio = {
  id: string;
  pedidoId: string;
  texto: string;
  canal?: "WhatsApp" | "E-mail" | "Presencial" | undefined;
  consultor?: string | undefined;
  gestorId?: string | undefined; // ID do perfil Supabase de quem registrou
  gestorNome?: string | undefined; // nome do consultor/gestor que registrou
  envolveGestor?: boolean | undefined;
  nomeGestor?: string | undefined;
  criadoEm: number;
};

export type BdayMsg = {
  id: string;
  paraId: string;
  de: string;
  emoji: string;
  mensagem: string;
  ts: number;
};
export type Leitura = { documentoId: string; nome: string; filial: string; ts: number };

export const useColaboradores = () => useStore<Colaborador[]>("colaboradores", COLABORADORES);
export const useDocumentos = () => useStore<Documento[]>("documentos", DOCUMENTOS_SEED);
export const useMural = () => useStore<MuralItem[]>("mural", MURAL_SEED);
export const useNoticias = () => useStore<Noticia[]>("noticias", NOTICIAS_SEED);
export const useCheckins = () => useStore<CheckIn[]>("checkins", []);
export const useAssinaturas = () => useStore<Assinatura[]>("assinaturas", []);
export const useSugestoes = () => useStore<Sugestao[]>("sugestoes", []);
export const useFeedbacks = () => useStore<Feedback[]>("feedbacks", []);
export const useVagas = () => useStore<Vaga[]>("vagas", []);
export const usePesquisa = () => useStore<Pesquisa>("pesquisa", null);
export const useAjuda = () => useStore<AjudaClick[]>("ajuda", []);
export const useAnotacoesApoio = () => useStore<AnotacaoApoio[]>("anotacoes-apoio", []);
export const useLeituras = () => useStore<Leitura[]>("leituras", []);
export const useBdayMsgs = () => useStore<BdayMsg[]>("bday-msgs", []);

export const uid = () => Math.random().toString(36).slice(2, 10);

export function fmtData(ts: number | string) {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}
