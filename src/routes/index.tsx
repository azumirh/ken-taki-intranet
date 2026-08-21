import { createFileRoute, Link } from "@tanstack/react-router";
import { ArrowRight } from "lucide-react";
import { AppShell } from "@/components/kt/app-shell";
import heroHome from "@/assets/hero-home.jpg";
import entryColaborador from "@/assets/entry-colaborador.jpg";
import entryGestor from "@/assets/entry-gestor.jpg";
import entryRh from "@/assets/entry-azumi.jpg";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Intranet Ken Taki" },
      {
        name: "description",
        content:
          "Entre na intranet do Ken Taki como colaborador, gestor ou RH. Políticas, mural, clima e canais de escuta em um só lugar.",
      },
      { property: "og:title", content: "Intranet Ken Taki" },
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
    img: entryRh,
    titulo: "Sou RH",
    desc: "Triagem, acompanhamento de pessoas, conteúdos e visão consolidada das unidades.",
    acesso: "Login e senha",
  },
];

function Index() {
  return (
    <AppShell>
      <section className="surface relative overflow-hidden">
        <img
          src={heroHome}
          alt="Colaboradora do Ken Taki sorrindo"
          width={1600}
          height={900}
          className="absolute inset-0 h-full w-full object-cover object-center opacity-25 lg:left-auto lg:w-[46%] lg:opacity-100"
        />
        <div
          aria-hidden
          className="absolute inset-0 bg-linear-to-r from-card via-card/95 to-card/60 lg:to-transparent"
        />
        <div className="relative grid items-center gap-8 px-6 py-12 sm:px-10 sm:py-16 lg:grid-cols-[minmax(0,1fr)_44%] lg:py-24">
          <div className="min-w-0 text-center lg:text-left">
            <span className="inline-flex rounded-full bg-accent px-3 py-1 text-xs font-semibold text-accent-foreground">
              Intranet · Cristo Rei e Champagnat
            </span>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] sm:text-5xl lg:text-6xl">
              Tudo do time <span className="text-union">em um lugar só</span>
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-base leading-relaxed text-muted-foreground sm:text-lg lg:mx-0">
              Políticas para ler e assinar, mural da equipe, aniversariantes, clima e canais de
              escuta — simples no celular e completo no computador.
            </p>
            <div className="mt-7 flex flex-wrap justify-center gap-3 lg:justify-start">
              <Link
                to="/colaborador"
                className="gradient-union inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-semibold text-primary-foreground shadow-[var(--shadow-lift)] transition-transform hover:-translate-y-0.5"
              >
                Entrar como colaborador <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                to="/gestor"
                className="inline-flex items-center gap-2 rounded-full border border-border bg-card px-6 py-3 text-sm font-semibold transition-colors hover:bg-muted"
              >
                Acesso da gestão
              </Link>
            </div>
          </div>
          <div className="hidden lg:block" />
        </div>
      </section>

      <div className="mt-8 grid gap-5 md:grid-cols-3">
        {ENTRADAS.map((e) => (
          <Link
            key={e.to}
            to={e.to}
            className="surface group flex flex-col overflow-hidden transition-all hover:-translate-y-1 hover:shadow-[var(--shadow-lift)]"
          >
            <div className="relative">
              <img
                src={e.img}
                alt=""
                width={800}
                height={600}
                loading="lazy"
                className="h-40 w-full object-cover transition-transform duration-500 group-hover:scale-105 lg:h-48"
              />
              <span
                aria-hidden
                className="absolute inset-x-0 bottom-0 h-16 bg-linear-to-t from-card to-transparent"
              />
            </div>
            <div className="flex flex-1 flex-col p-6">
              <h2 className="text-lg font-bold">{e.titulo}</h2>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{e.desc}</p>
              <p className="mt-4 rounded-full bg-muted px-3 py-1.5 text-center text-xs text-muted-foreground">
                {e.acesso}
              </p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-kt">
                Entrar{" "}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </span>
            </div>
          </Link>
        ))}
      </div>
    </AppShell>
  );
}
