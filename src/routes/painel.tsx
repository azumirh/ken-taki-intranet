import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { AppShell } from "@/components/kt/app-shell";
import { EmployeeDashboardV2 } from "@/components/kt/employee-dashboard-v2";
import { useSession } from "@/lib/kt-store";

export const Route = createFileRoute("/painel")({
  head: () => ({
    meta: [
      { title: "Meu painel · Portal Azumi RH" },
      {
        name: "description",
        content: "Pendências, comunicação, documentos, jornada e histórico do colaborador em um painel organizado.",
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
      <EmployeeDashboardV2 />
    </AppShell>
  );
}
