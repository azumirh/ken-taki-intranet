const KEY = "kentaki:employee-access";

export type EmployeeAccessSession = {
  token: string;
  colaboradorId: string;
  nome: string;
  filial: "cristo-rei" | "champagnat";
  expiresAt: number;
};

export function saveEmployeeAccess(session: EmployeeAccessSession) {
  if (typeof window === "undefined") return;
  window.sessionStorage.setItem(KEY, JSON.stringify(session));
}

export function readEmployeeAccess(): EmployeeAccessSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as EmployeeAccessSession;
    if (!parsed.token || parsed.expiresAt <= Date.now()) {
      window.sessionStorage.removeItem(KEY);
      return null;
    }
    return parsed;
  } catch {
    window.sessionStorage.removeItem(KEY);
    return null;
  }
}

export function clearEmployeeAccess() {
  if (typeof window === "undefined") return;
  window.sessionStorage.removeItem(KEY);
}
