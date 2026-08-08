import { useCallback, useEffect, useRef, useState } from "react";
import { supabase } from "./supabase";
import {
  COLABORADORES,
  DOCUMENTOS_SEED,
  MURAL_SEED,
  NOTICIAS_SEED,
  type Colaborador,
  type Documento,
  type FilialId,
  type MuralItem,
  type MuralTipo,
  type Noticia,
} from "./kt-data";

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

// ── Types ──────────────────────────────────────────────────────────────────────

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
  id: string;
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
  gestorQueMudouStatus?: string | undefined;
  comentarioGestor?: string | undefined;
  comentariosGestor?: Record<string, string> | undefined;
};
export type Vaga = { id: string; cargo: string; filial: string; motivo: string; ts: number };
export type Pesquisa = {
  id: string;
  titulo: string;
  descricao: string;
  link: string;
  ativa: boolean;
  ts: number;
  prazo?: string | undefined;
  categoria?: string | undefined;
  respondeu?: string[] | undefined;
  respondeuTs?: Record<string, number> | undefined;
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
  gestorId?: string | undefined;
  gestorNome?: string | undefined;
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
export type Leitura = {
  id: string;
  documentoId: string;
  nome: string;
  filial: string;
  ts: number;
};

// ── Helpers ────────────────────────────────────────────────────────────────────

export const uid = () => Math.random().toString(36).slice(2, 10);

export function fmtData(ts: number | string) {
  const d = typeof ts === "number" ? new Date(ts) : new Date(ts + "T00:00:00");
  return d.toLocaleDateString("pt-BR", { day: "2-digit", month: "long" });
}

function s(val: unknown): string {
  if (val == null) return "";
  return String(val);
}

function tsMs(val: unknown): number {
  if (typeof val === "number") return val;
  if (typeof val === "string") return new Date(val).getTime();
  return Date.now();
}

function diffArrays<T extends { id: string }>(prev: T[], next: T[]) {
  const prevMap = new Map(prev.map((x) => [x.id, x]));
  const nextMap = new Map(next.map((x) => [x.id, x]));
  const inserted = next.filter((x) => !prevMap.has(x.id));
  const deleted = prev.filter((x) => !nextMap.has(x.id));
  const updated = next.filter((x) => {
    const old = prevMap.get(x.id);
    return old !== undefined && JSON.stringify(old) !== JSON.stringify(x);
  });
  return { inserted, deleted, updated };
}

// ── Generic Supabase-backed list hook ─────────────────────────────────────────

type ListConfig<T extends { id: string }> = {
  key: string;
  table: string;
  initial: T[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  fromRow: (row: any) => T;
  toRow: (item: T) => Record<string, unknown>;
  orderBy?: string;
  realtime?: boolean;
};

function useSupabaseList<T extends { id: string }>(
  config: ListConfig<T>,
): readonly [T[], (next: T[] | ((prev: T[]) => T[])) => void, boolean] {
  const configRef = useRef(config);
  configRef.current = config;

  const cached = read<T[]>(config.key, config.initial);
  const [value, setValue] = useState<T[]>(cached);
  const [hidratado, setHidratado] = useState(false);
  const ref = useRef<T[]>(cached);

  useEffect(() => {
    const { key, table, orderBy, fromRow, realtime } = configRef.current;

    // Restore localStorage cache immediately
    const local = read<T[]>(key, []);
    if (local.length > 0) {
      ref.current = local;
      setValue(local);
    }

    // Fetch from Supabase
    const fetchData = () => {
      const base = supabase.from(table).select("*");
      const q = orderBy ? base.order(orderBy, { ascending: false }) : base;
      void q.then(
        ({ data, error }) => {
          if (!error && data) {
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const items = (data as any[]).map(fromRow);
            ref.current = items;
            setValue(items);
            write(key, items);
          }
          setHidratado(true);
        },
        () => setHidratado(true),
      );
    };

    fetchData();

    // Cross-tab sync
    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === key) {
        const next = read<T[]>(key, []);
        ref.current = next;
        setValue(next);
      }
    };
    window.addEventListener("kentaki:store", onChange);

    // Realtime subscription
    let channel: ReturnType<typeof supabase.channel> | null = null;
    if (realtime) {
      channel = supabase
        .channel(`rt:${table}`)
        .on("postgres_changes", { event: "*", schema: "public", table }, () => fetchData())
        .subscribe();
    }

    return () => {
      window.removeEventListener("kentaki:store", onChange);
      if (channel) void supabase.removeChannel(channel);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config.key]);

  const update = useCallback((next: T[] | ((prev: T[]) => T[])) => {
    const { key, table, toRow } = configRef.current;
    const nextVal = typeof next === "function" ? next(ref.current) : next;
    const { inserted, deleted, updated } = diffArrays(ref.current, nextVal);
    ref.current = nextVal;
    setValue(nextVal);
    write(key, nextVal);

    if (inserted.length) {
      supabase
        .from(table)
        .insert(inserted.map(toRow))
        .then(({ error }) => {
          if (error) console.warn("[kt] insert", table, error.message);
        });
    }
    if (deleted.length) {
      supabase
        .from(table)
        .delete()
        .in("id", deleted.map((x) => x.id))
        .then(({ error }) => {
          if (error) console.warn("[kt] delete", table, error.message);
        });
    }
    if (updated.length) {
      supabase
        .from(table)
        .upsert(updated.map(toRow))
        .then(({ error }) => {
          if (error) console.warn("[kt] upsert", table, error.message);
        });
    }
  }, []);

  return [value, update, hidratado] as const;
}

// ── Per-entity hooks ───────────────────────────────────────────────────────────

export const useColaboradores = () =>
  useSupabaseList<Colaborador>({
    key: "colaboradores",
    table: "kt_colaboradores",
    initial: COLABORADORES,
    fromRow: (r) => ({
      id: s(r.id),
      nome: s(r.nome),
      cpf3: s(r.cpf3),
      cargo: s(r.cargo),
      filial: s(r.filial) as FilialId,
      nascimento: s(r.nascimento),
      admissao: s(r.admissao),
      ...(r.foto != null ? { foto: s(r.foto) } : {}),
    }),
    toRow: (c) => ({
      id: c.id,
      nome: c.nome,
      cpf3: c.cpf3,
      cargo: c.cargo,
      filial: c.filial,
      nascimento: c.nascimento,
      admissao: c.admissao,
      foto: c.foto ?? null,
    }),
  });

export const useDocumentos = () =>
  useSupabaseList<Documento>({
    key: "documentos",
    table: "kt_documentos",
    initial: DOCUMENTOS_SEED,
    fromRow: (r) => ({
      id: s(r.id),
      titulo: s(r.titulo),
      filial: s(r.filial) as Documento["filial"],
      url: s(r.url),
      corTag: s(r.cor_tag),
      textoTag: s(r.texto_tag),
      data: s(r.data),
      ...(r.categoria != null ? { categoria: s(r.categoria) as Documento["categoria"] } : {}),
    }),
    toRow: (d) => ({
      id: d.id,
      titulo: d.titulo,
      filial: d.filial,
      url: d.url,
      cor_tag: d.corTag,
      texto_tag: d.textoTag,
      data: d.data,
      categoria: d.categoria ?? null,
    }),
  });

export const useMural = () =>
  useSupabaseList<MuralItem>({
    key: "mural",
    table: "kt_mural",
    initial: MURAL_SEED,
    realtime: true,
    orderBy: "data",
    fromRow: (r) => ({
      id: s(r.id),
      tipo: s(r.tipo) as MuralTipo,
      titulo: s(r.titulo),
      mensagem: s(r.mensagem),
      autor: s(r.autor),
      data: s(r.data),
      ...(r.filial != null ? { filial: s(r.filial) as MuralItem["filial"] } : {}),
      ...(r.emoji != null ? { emoji: s(r.emoji) } : {}),
      ...(r.evento_data != null ? { eventoData: s(r.evento_data) } : {}),
      ...(r.evento_link != null ? { eventoLink: s(r.evento_link) } : {}),
    }),
    toRow: (m) => ({
      id: m.id,
      tipo: m.tipo,
      titulo: m.titulo,
      mensagem: m.mensagem,
      autor: m.autor,
      data: m.data,
      filial: m.filial ?? null,
      emoji: m.emoji ?? null,
      evento_data: m.eventoData ?? null,
      evento_link: m.eventoLink ?? null,
    }),
  });

export const useNoticias = () =>
  useSupabaseList<Noticia>({
    key: "noticias",
    table: "kt_noticias",
    initial: NOTICIAS_SEED,
    orderBy: "data",
    fromRow: (r) => ({
      id: s(r.id),
      titulo: s(r.titulo),
      resumo: s(r.resumo),
      data: s(r.data),
      ...(r.video_url != null ? { videoUrl: s(r.video_url) } : {}),
      ...(r.imagem_url != null ? { imagemUrl: s(r.imagem_url) } : {}),
    }),
    toRow: (n) => ({
      id: n.id,
      titulo: n.titulo,
      resumo: n.resumo,
      data: n.data,
      video_url: n.videoUrl ?? null,
      imagem_url: n.imagemUrl ?? null,
    }),
  });

export const useCheckins = () =>
  useSupabaseList<CheckIn>({
    key: "checkins",
    table: "kt_checkins",
    initial: [],
    realtime: true,
    orderBy: "ts",
    fromRow: (r) => ({
      id: s(r.id),
      nome: s(r.nome),
      filial: s(r.filial),
      humor: s(r.humor),
      ts: tsMs(r.ts),
      ...(r.recado != null ? { recado: s(r.recado) } : {}),
    }),
    toRow: (c) => ({
      id: c.id,
      nome: c.nome,
      filial: c.filial,
      humor: c.humor,
      ts: new Date(c.ts).toISOString(),
      recado: c.recado ?? null,
    }),
  });

export const useAssinaturas = () =>
  useSupabaseList<Assinatura>({
    key: "assinaturas",
    table: "kt_assinaturas",
    initial: [],
    orderBy: "ts",
    fromRow: (r) => ({
      id: s(r.id),
      politica: s(r.politica),
      nome: s(r.nome),
      filial: s(r.filial),
      ts: tsMs(r.ts),
      ...(r.cpf_confirmado != null ? { cpfConfirmado: s(r.cpf_confirmado) } : {}),
      ...(r.protocolo != null ? { protocolo: s(r.protocolo) } : {}),
    }),
    toRow: (a) => ({
      id: a.id,
      politica: a.politica,
      nome: a.nome,
      filial: a.filial,
      ts: new Date(a.ts).toISOString(),
      cpf_confirmado: a.cpfConfirmado ?? null,
      protocolo: a.protocolo ?? null,
    }),
  });

export const useSugestoes = () =>
  useSupabaseList<Sugestao>({
    key: "sugestoes",
    table: "kt_sugestoes",
    initial: [],
    orderBy: "ts",
    fromRow: (r) => ({
      id: s(r.id),
      categoria: s(r.categoria),
      mensagem: s(r.mensagem),
      filial: s(r.filial),
      ts: tsMs(r.ts),
      ...(r.status != null ? { status: s(r.status) as Sugestao["status"] } : {}),
      ...(r.status_ts != null ? { statusTs: tsMs(r.status_ts) } : {}),
      ...(r.justificativa != null ? { justificativa: s(r.justificativa) } : {}),
      ...(r.observacao != null ? { observacao: s(r.observacao) } : {}),
    }),
    toRow: (sg) => ({
      id: sg.id,
      categoria: sg.categoria,
      mensagem: sg.mensagem,
      filial: sg.filial,
      ts: new Date(sg.ts).toISOString(),
      status: sg.status ?? null,
      status_ts: sg.statusTs != null ? new Date(sg.statusTs).toISOString() : null,
      justificativa: sg.justificativa ?? null,
      observacao: sg.observacao ?? null,
    }),
  });

export const useFeedbacks = () =>
  useSupabaseList<Feedback>({
    key: "feedbacks",
    table: "kt_feedbacks",
    initial: [],
    orderBy: "ts",
    realtime: true,
    fromRow: (r) => ({
      id: s(r.id),
      tipo: s(r.tipo),
      mensagem: s(r.mensagem),
      anonimo: Boolean(r.anonimo),
      autor: s(r.autor),
      filial: s(r.filial),
      ts: tsMs(r.ts),
      ...(r.status != null ? { status: s(r.status) as Feedback["status"] } : {}),
      ...(r.status_alterado_em != null ? { statusAlteradoEm: tsMs(r.status_alterado_em) } : {}),
      ...(r.gestor_que_mudou_status != null
        ? { gestorQueMudouStatus: s(r.gestor_que_mudou_status) }
        : {}),
      ...(r.comentario_gestor != null ? { comentarioGestor: s(r.comentario_gestor) } : {}),
      ...(r.comentarios_gestor != null
        ? { comentariosGestor: r.comentarios_gestor as Record<string, string> }
        : {}),
    }),
    toRow: (f) => ({
      id: f.id,
      tipo: f.tipo,
      mensagem: f.mensagem,
      anonimo: f.anonimo,
      autor: f.autor,
      filial: f.filial,
      ts: new Date(f.ts).toISOString(),
      status: f.status ?? null,
      status_alterado_em:
        f.statusAlteradoEm != null ? new Date(f.statusAlteradoEm).toISOString() : null,
      gestor_que_mudou_status: f.gestorQueMudouStatus ?? null,
      comentario_gestor: f.comentarioGestor ?? null,
      comentarios_gestor: f.comentariosGestor ?? null,
    }),
  });

export const useVagas = () =>
  useSupabaseList<Vaga>({
    key: "vagas",
    table: "kt_vagas",
    initial: [],
    orderBy: "ts",
    fromRow: (r) => ({
      id: s(r.id),
      cargo: s(r.cargo),
      filial: s(r.filial),
      motivo: s(r.motivo),
      ts: tsMs(r.ts),
    }),
    toRow: (v) => ({
      id: v.id,
      cargo: v.cargo,
      filial: v.filial,
      motivo: v.motivo,
      ts: new Date(v.ts).toISOString(),
    }),
  });

export const useAjuda = () =>
  useSupabaseList<AjudaClick>({
    key: "ajuda",
    table: "kt_ajuda",
    initial: [],
    orderBy: "ts",
    fromRow: (r) => ({
      id: s(r.id),
      nome: s(r.nome),
      filial: s(r.filial),
      assunto: s(r.assunto),
      ts: tsMs(r.ts),
      ...(r.status != null ? { status: s(r.status) as AjudaClick["status"] } : {}),
    }),
    toRow: (a) => ({
      id: a.id,
      nome: a.nome,
      filial: a.filial,
      assunto: a.assunto,
      ts: new Date(a.ts).toISOString(),
      status: a.status ?? null,
    }),
  });

export const useAnotacoesApoio = () =>
  useSupabaseList<AnotacaoApoio>({
    key: "anotacoes-apoio",
    table: "kt_anotacoes_apoio",
    initial: [],
    orderBy: "criado_em",
    fromRow: (r) => ({
      id: s(r.id),
      pedidoId: s(r.pedido_id),
      texto: s(r.texto),
      ...(r.canal != null ? { canal: s(r.canal) as AnotacaoApoio["canal"] } : {}),
      ...(r.consultor != null ? { consultor: s(r.consultor) } : {}),
      ...(r.gestor_id != null ? { gestorId: s(r.gestor_id) } : {}),
      ...(r.gestor_nome != null ? { gestorNome: s(r.gestor_nome) } : {}),
      ...(r.envolve_gestor != null ? { envolveGestor: Boolean(r.envolve_gestor) } : {}),
      ...(r.nome_gestor != null ? { nomeGestor: s(r.nome_gestor) } : {}),
      criadoEm: tsMs(r.criado_em),
    }),
    toRow: (a) => ({
      id: a.id,
      pedido_id: a.pedidoId,
      texto: a.texto,
      canal: a.canal ?? null,
      consultor: a.consultor ?? null,
      gestor_id: a.gestorId ?? null,
      gestor_nome: a.gestorNome ?? null,
      envolve_gestor: a.envolveGestor ?? null,
      nome_gestor: a.nomeGestor ?? null,
      criado_em: new Date(a.criadoEm).toISOString(),
    }),
  });

export const useLeituras = () =>
  useSupabaseList<Leitura>({
    key: "leituras",
    table: "kt_leituras",
    initial: [],
    fromRow: (r) => ({
      id: s(r.id),
      documentoId: s(r.documento_id),
      nome: s(r.nome),
      filial: s(r.filial),
      ts: tsMs(r.ts),
    }),
    toRow: (l) => ({
      id: l.id,
      documento_id: l.documentoId,
      nome: l.nome,
      filial: l.filial,
      ts: new Date(l.ts).toISOString(),
    }),
  });

export const useBdayMsgs = () =>
  useSupabaseList<BdayMsg>({
    key: "bday-msgs",
    table: "kt_bday_msgs",
    initial: [],
    orderBy: "ts",
    fromRow: (r) => ({
      id: s(r.id),
      paraId: s(r.para_id),
      de: s(r.de),
      emoji: s(r.emoji),
      mensagem: s(r.mensagem),
      ts: tsMs(r.ts),
    }),
    toRow: (b) => ({
      id: b.id,
      para_id: b.paraId,
      de: b.de,
      emoji: b.emoji,
      mensagem: b.mensagem,
      ts: new Date(b.ts).toISOString(),
    }),
  });

// ── Pesquisa (single active row) ───────────────────────────────────────────────

export function usePesquisa(): readonly [
  Pesquisa,
  (next: Pesquisa | ((prev: Pesquisa) => Pesquisa)) => void,
  boolean,
] {
  const [value, setValue] = useState<Pesquisa>(read<Pesquisa>("pesquisa", null));
  const [hidratado, setHidratado] = useState(false);
  const ref = useRef<Pesquisa>(null);

  useEffect(() => {
    void supabase
      .from("kt_pesquisas")
      .select("*")
      .eq("ativa", true)
      .order("ts", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ({ data, error }: { data: any; error: any }) => {
          if (!error) {
            const item: Pesquisa = data
              ? {
                  id: s(data.id),
                  titulo: s(data.titulo),
                  descricao: s(data.descricao),
                  link: s(data.link),
                  ativa: Boolean(data.ativa),
                  ts: tsMs(data.ts),
                  ...(data.prazo != null ? { prazo: s(data.prazo) } : {}),
                  ...(data.categoria != null ? { categoria: s(data.categoria) } : {}),
                  ...(data.respondeu != null ? { respondeu: data.respondeu as string[] } : {}),
                  ...(data.respondeu_ts != null
                    ? { respondeuTs: data.respondeu_ts as Record<string, number> }
                    : {}),
                }
              : null;
            ref.current = item;
            setValue(item);
            write("pesquisa", item);
          }
          setHidratado(true);
        },
        () => setHidratado(true),
      );

    const onChange = (e: Event) => {
      if ((e as CustomEvent).detail === "pesquisa") {
        const next = read<Pesquisa>("pesquisa", null);
        ref.current = next;
        setValue(next);
      }
    };
    window.addEventListener("kentaki:store", onChange);
    return () => window.removeEventListener("kentaki:store", onChange);
  }, []);

  const update = useCallback((next: Pesquisa | ((prev: Pesquisa) => Pesquisa)) => {
    const nextVal = typeof next === "function" ? next(ref.current) : next;
    ref.current = nextVal;
    setValue(nextVal);
    write("pesquisa", nextVal);

    if (nextVal === null) {
      supabase
        .from("kt_pesquisas")
        .update({ ativa: false })
        .eq("ativa", true)
        .then(({ error }) => {
          if (error) console.warn("[kt] deactivate pesquisa:", error.message);
        });
    } else {
      supabase
        .from("kt_pesquisas")
        .upsert({
          id: nextVal.id,
          titulo: nextVal.titulo,
          descricao: nextVal.descricao,
          link: nextVal.link,
          ativa: nextVal.ativa,
          ts: new Date(nextVal.ts).toISOString(),
          prazo: nextVal.prazo ?? null,
          categoria: nextVal.categoria ?? null,
          respondeu: nextVal.respondeu ?? null,
          respondeu_ts: nextVal.respondeuTs ?? null,
        })
        .then(({ error }) => {
          if (error) console.warn("[kt] upsert pesquisa:", error.message);
        });
    }
  }, []);

  return [value, update, hidratado] as const;
}
