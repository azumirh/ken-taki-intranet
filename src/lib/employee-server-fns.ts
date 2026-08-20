import { createHmac, timingSafeEqual } from "node:crypto";
import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://nxmwhtkygiljkbovwixk.supabase.co";
const SESSION_TTL_MS = 8 * 60 * 60 * 1000;

type EmployeeLoginInput = {
  nome: string;
  cpf3: string;
  filial: "cristo-rei" | "champagnat";
};

type EmployeeTokenPayload = {
  sub: string;
  nome: string;
  filial: "cristo-rei" | "champagnat";
  exp: number;
};

function getServiceKey() {
  const key = process.env["SUPABASE_SERVICE_ROLE_KEY"]?.trim();
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY não configurada no servidor.");
  return key.replace(/^["']|["']$/g, "");
}

function adminClient() {
  return createClient(SUPABASE_URL, getServiceKey(), {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

function encodePayload(payload: EmployeeTokenPayload) {
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
}

function sign(encodedPayload: string) {
  return createHmac("sha256", getServiceKey()).update(encodedPayload).digest("base64url");
}

function issueToken(payload: EmployeeTokenPayload) {
  const encoded = encodePayload(payload);
  return `${encoded}.${sign(encoded)}`;
}

export function verifyEmployeeToken(token: string): EmployeeTokenPayload | null {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = sign(encoded);
  const actualBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);
  if (
    actualBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(actualBuffer, expectedBuffer)
  ) {
    return null;
  }

  try {
    const payload = JSON.parse(Buffer.from(encoded, "base64url").toString("utf8")) as EmployeeTokenPayload;
    if (!payload.sub || !payload.nome || !payload.filial || payload.exp <= Date.now()) return null;
    return payload;
  } catch {
    return null;
  }
}

export const criarSessaoColaboradorFn = createServerFn({ method: "POST" })
  .validator((input: EmployeeLoginInput) => input)
  .handler(async ({ data }) => {
    const nome = data.nome.trim();
    const cpf3 = data.cpf3.trim();

    if (nome.length < 3 || !/^\d{3}$/.test(cpf3)) {
      return { ok: false as const, motivo: "dados_invalidos" as const };
    }

    const admin = adminClient();
    const { data: colaboradores, error } = await admin
      .from("kt_colaboradores")
      .select("id,nome,filial,cpf3,ativo")
      .eq("filial", data.filial)
      .eq("cpf3", cpf3)
      .eq("ativo", true)
      .limit(10);

    if (error) throw new Error(error.message);

    const nomeNorm = nome.toLocaleLowerCase("pt-BR");
    const match = (colaboradores ?? []).find((c) =>
      String(c.nome).toLocaleLowerCase("pt-BR").startsWith(nomeNorm),
    );

    if (!match) return { ok: false as const, motivo: "nao_encontrado" as const };

    const expiresAt = Date.now() + SESSION_TTL_MS;
    const filial = String(match.filial) as "cristo-rei" | "champagnat";
    const colaboradorId = String(match.id);
    const nomeCompleto = String(match.nome);
    const token = issueToken({
      sub: colaboradorId,
      nome: nomeCompleto,
      filial,
      exp: expiresAt,
    });

    return {
      ok: true as const,
      access: {
        token,
        expiresAt,
        colaboradorId,
        nome: nomeCompleto,
        filial,
      },
    };
  });
