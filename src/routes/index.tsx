import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/kt/app-shell";
import entryColaborador from "@/assets/entry-colaborador.jpg";
import entryGestor from "@/assets/entry-gestor.jpg";
import entryAzumi from "@/assets/entry-azumi.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intranet Ken Taki × Azumi RH" },
      {
        name: "description",
        content:
          "Entre na intranet do Ken Taki: colaborador, gestor ou equipe Azumi RH. Políticas, mural, clima e escuta em um só lugar.",
      },
      { property: "og:title", content: "Intranet Ken Taki × Azumi RH" },
      {
        property: "og:description",
        content: "Políticas, mural da equipe, clima e canais de escuta do Ken Taki.",
      },
    ],
  }),
  component: Index,
});

const ENTRADAS = [
  {
    to: "/colaborador" as const,
    img: entryColaborador,
    titulo: "Sou colaborador",
    desc: "Check-in do dia, políticas, mural, aniversariantes, sugestões e feedback.",
    acesso: "Entrada com nome, filial e 3 dígitos do CPF",
  },
  {
    to: "/gestor" as const,
    img: entryGestor,
    titulo: "Sou gestor",
    desc: "Clima da equipe, assinaturas, solicitação de vaga, feedbacks e cadastro do time.",
    acesso: "Login e senha",
  },
  {
    to: "/azumi" as const,
    img: entryAzumi,
    titulo: "Sou Azumi RH",
    desc: "Publicar mural, notícias em vídeo, pesquisas de clima e visão das duas unidades.",
    acesso: "Login e senha",
  },
];

function Index() {
  return (
    <AppShell>
      <section className="grid items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="min-w-0">
          <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
            Intranet · Cristo Rei e Champagnat
          </span>
          <h1 className="mt-4 text-3xl font-extrabold leading-tight sm:text-5xl">
            Tudo do time <span className="text-union">em um lugar só</span>
          </h1>
          <p className="mt-4 max-w-xl text-base text-muted-foreground">
            Políticas para ler e assinar, mural da equipe, aniversariantes, clima e canais de escuta —
            simples no celular e completo no computador.
          </p>
        </div>
        <div className="surface overflow-hidden">
          <img
            src={entryColaborador}
            alt="Colaboradora do Ken Taki sorrindo"
            width={800}
            height={600}
            className="h-56 w-full object-cover sm:h-72"
          />
        </div>
      </section>

      <div className="mt-10 grid gap-4 md:grid-cols-3">
        {ENTRADAS.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            className="surface group flex flex-col overflow-hidden transition-shadow hover:shadow-[var(--shadow-lift)]"
          >
            <img
              src={e.img}
              alt=""
              width={800}
              height={600}
              loading="lazy"
              className="h-36 w-full object-cover"
            />
            <div className="flex flex-1 flex-col p-5">
              <h2 className="text-base font-bold">{e.titulo}</h2>
              <p className="mt-1 flex-1 text-sm text-muted-foreground">{e.desc}</p>
              <p className="mt-3 text-xs text-muted-foreground">{e.acesso}</p>
              <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-semibold text-kt">
                Entrar <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
