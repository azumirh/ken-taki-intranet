import { ExternalLink, Check } from "lucide-react";
import { Section } from "@/components/kt/section";
import { Button } from "@/components/ui/button";
import capaPadrao from "@/assets/capa-padrao-politicas.jpg";
import { useAssinaturas, useDocumentos, useLeituras, type Session } from "@/lib/kt-store";

type ColabSession = Extract<Session, { tipo: "colaborador" }>;

export function Documentos({
  session,
  collapsible,
  defaultOpen,
}: {
  session: ColabSession;
  collapsible?: boolean | undefined;
  defaultOpen?: boolean | undefined;
}) {
  const [documentos] = useDocumentos();
  const [assinaturas, setAssinaturas] = useAssinaturas();
  const [leituras, setLeituras] = useLeituras();

  const docs = documentos.filter(
    (d) => (d.filial === session.filial || d.filial === "todas") && d.categoria !== "gestao",
  );
  const leu = (id: string) => leituras.some((l) => l.documentoId === id && l.nome === session.nome);
  const assinou = (id: string) =>
    assinaturas.some((a) => a.politica === id && a.nome === session.nome);
  const totalAssinados = docs.filter((d) => assinou(d.id)).length;

  const abrirDoc = (doc: (typeof docs)[number]) => {
    window.open(doc.url, "_blank", "noreferrer");
    if (!leu(doc.id)) {
      setLeituras((prev) => [
        { documentoId: doc.id, nome: session.nome, filial: session.filial, ts: Date.now() },
        ...prev,
      ]);
    }
  };

  const assinarDoc = (doc: (typeof docs)[number]) => {
    setAssinaturas((prev) => [
      ...prev,
      { politica: doc.id, nome: session.nome, filial: session.filial, ts: Date.now() },
    ]);
  };

  if (docs.length === 0) return null;

  return (
    <Section
      id="politicas"
      titulo="Documentos e políticas"
      intro="Leia cada documento e assine para confirmar que recebeu."
      contagem={`${totalAssinados} de ${docs.length} assinados`}
      collapsible={collapsible}
      defaultOpen={defaultOpen}
    >
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {docs.map((doc) => {
          const jaLeu = leu(doc.id);
          const jaAssinou = assinou(doc.id);
          return (
            <article
              key={doc.id}
              className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card"
            >
              <div className="relative">
                <img
                  src={capaPadrao}
                  alt=""
                  width={1024}
                  height={512}
                  loading="lazy"
                  className="h-28 w-full object-cover"
                />
                <span
                  className="absolute left-3 top-3 rounded-full px-2.5 py-1 text-[11px] font-bold text-white"
                  style={{ backgroundColor: doc.corTag }}
                >
                  {doc.textoTag}
                </span>
                {jaAssinou && (
                  <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-success px-2.5 py-1 text-[11px] font-semibold text-primary-foreground">
                    <Check className="h-3 w-3" /> Assinado
                  </span>
                )}
              </div>
              <div className="flex flex-1 flex-col p-4">
                <h3 className="text-sm font-bold">{doc.titulo}</h3>
                <p className="mt-1 flex-1 text-xs text-muted-foreground">
                  Publicado em {new Date(doc.data + "T00:00:00").toLocaleDateString("pt-BR")}
                </p>
                <div className="mt-3 grid gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full rounded-full"
                    onClick={() => abrirDoc(doc)}
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                    {jaLeu ? "Ler novamente" : "Abrir documento"}
                  </Button>
                  {!jaAssinou && (
                    <Button
                      size="sm"
                      className="w-full rounded-full"
                      disabled={!jaLeu}
                      onClick={() => assinarDoc(doc)}
                      title={!jaLeu ? "Abra o documento primeiro" : undefined}
                    >
                      {jaLeu ? "Assinar" : "Abra para assinar"}
                    </Button>
                  )}
                </div>
              </div>
            </article>
          );
        })}
      </div>
    </Section>
  );
}
