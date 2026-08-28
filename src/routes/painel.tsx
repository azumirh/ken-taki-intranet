import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/kt/app-shell";
import { EmployeeDashboardV3 } from "@/components/kt/employee-dashboard-v3";
import { useSession } from "@/lib/kt-store";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Meu perfil · Intranet Ken Taki" },
      {
        name: "description",
        content: "Check-in, pesquisa de clima, comunicação, documentos, reconhecimentos e registros do colaborador.",
      },
    ],
  }),
  component: Painel,
});

function Painel() {
  const navigate = useNavigate();
  const [session, , sessaoPronta] = useSession();

  useEffect(() => {
    if (sessaoPronta && session === null) navigate({ to: "/colaborador" });
  }, [sessaoPronta, session, navigate]);

  if (!session || session.tipo !== "colaborador") return null;

  return (
    <AppShell>
      <EmployeeDashboardV3 />
    </AppShell>
  );
}
