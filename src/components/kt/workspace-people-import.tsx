import { AlertTriangle, CheckCircle2, Download, FileSpreadsheet, Upload } from "lucide-react";
import { useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { normalizeEmployeeImportRows, readSpreadsheet, type EmployeeImportRow } from "@/lib/spreadsheet-import";
import { supabase } from "@/lib/supabase";

type ExistingPerson = { nome: string; cpf3: string; filial: string };

type ImportResult = {
  inserted: number;
  updated: number;
  processed: number;
  errors: Array<{ row: number; message: string }>;
};

function keyOf(person: ExistingPerson) {
  return `${person.nome.trim().toLocaleLowerCase("pt-BR")}|${person.cpf3}|${person.filial}`;
}

export function WorkspacePeopleImport({ existing, onImported }: { existing: ExistingPerson[]; onImported: () => Promise<void> }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [open, setOpen] = useState(false);
  const [fileName, setFileName] = useState("");
  const [rows, setRows] = useState<EmployeeImportRow[]>([]);
  const [reading, setReading] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);

  const existingKeys = useMemo(() => new Set(existing.map(keyOf)), [existing]);
  const valid = rows.filter((row) => row.errors.length === 0);
  const invalid = rows.length - valid.length;
  const newCount = valid.filter((row) => !existingKeys.has(keyOf(row))).length;
  const updateCount = valid.length - newCount;

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setReading(true);
    setResult(null);
    try {
      const raw = await readSpreadsheet(file);
      if (raw.length > 2000) throw new Error("O arquivo tem mais de 2.000 linhas. Divida a importação em partes menores.");
      const normalized = normalizeEmployeeImportRows(raw);
      if (!normalized.length) throw new Error("Nenhuma linha de dados foi encontrada na primeira aba.");
      setRows(normalized);
      setFileName(file.name);
      setOpen(true);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível ler o arquivo.");
    } finally {
      setReading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function importValidRows() {
    if (!valid.length) return;
    setImporting(true);
    try {
      const payload = valid.map(({ row, nome, cpf3, cargo, filial, nascimento, admissao, ativo }) => ({
        row,
        nome,
        cpf3,
        cargo,
        filial,
        nascimento,
        admissao,
        ativo,
      }));
      const { data, error } = await supabase.rpc("kt_admin_import_colaboradores", { p_rows: payload });
      if (error) throw error;
      const parsed = data as ImportResult;
      setResult(parsed);
      await onImported();
      toast.success(`${parsed.inserted} novo(s) e ${parsed.updated} atualizado(s).`);
    } catch (error) {
      toast.error((error as Error).message || "Não foi possível importar os colaboradores.");
    } finally {
      setImporting(false);
    }
  }

  function downloadTemplate() {
    const csv = [
      "Nome;CPF;Cargo;Filial;Nascimento;Admissão;Status",
      "Maria Silva;12345678977;Atendente;Champagnat;15/04/1995;01/08/2026;Ativo",
      "João Souza;321;Auxiliar de Cozinha;Cristo Rei;20/09/1998;10/07/2026;Ativo",
    ].join("\n");
    const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modelo-colaboradores-ken-taki.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  return (
    <>
      <input
        ref={inputRef}
        className="hidden"
        type="file"
        accept=".xlsx,.csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,text/csv"
        onChange={(event) => void chooseFile(event.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" size="sm" onClick={downloadTemplate}>
          <Download className="h-3.5 w-3.5" /> Modelo
        </Button>
        <Button size="sm" disabled={reading} onClick={() => inputRef.current?.click()}>
          <Upload className="h-3.5 w-3.5" /> {reading ? "Lendo..." : "Importar Excel"}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[88vh] overflow-hidden sm:max-w-5xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><FileSpreadsheet className="h-5 w-5" /> Importar colaboradores</DialogTitle>
            <DialogDescription>
              Revise antes de confirmar. O arquivo cadastra ou atualiza pessoas; não cria senha, acesso ou envio de e-mail.
            </DialogDescription>
          </DialogHeader>

          <div className="grid min-h-0 gap-4">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="rounded-md bg-muted px-2.5 py-1.5 font-semibold">{fileName}</span>
              <span className="rounded-md bg-success-soft px-2.5 py-1.5 font-bold text-success">{newCount} novo(s)</span>
              <span className="rounded-md bg-accent px-2.5 py-1.5 font-bold text-accent-foreground">{updateCount} atualização(ões)</span>
              {invalid ? <span className="rounded-md bg-destructive/10 px-2.5 py-1.5 font-bold text-destructive">{invalid} linha(s) bloqueada(s)</span> : null}
            </div>

            <div className="max-h-[52vh] overflow-auto rounded-lg border border-border">
              <table className="w-full min-w-[920px] text-left text-xs">
                <thead className="sticky top-0 z-10 bg-muted text-[10px] uppercase tracking-[0.08em] text-muted-foreground">
                  <tr><th className="px-3 py-2">Linha</th><th className="px-3 py-2">Ação</th><th className="px-3 py-2">Nome</th><th className="px-3 py-2">CPF</th><th className="px-3 py-2">Cargo</th><th className="px-3 py-2">Unidade</th><th className="px-3 py-2">Nascimento</th><th className="px-3 py-2">Admissão</th><th className="px-3 py-2">Validação</th></tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {rows.map((row) => {
                    const action = existingKeys.has(keyOf(row)) ? "Atualizar" : "Novo";
                    return (
                      <tr key={row.row} className={row.errors.length ? "bg-destructive/5" : "bg-card"}>
                        <td className="px-3 py-2 text-muted-foreground">{row.row}</td>
                        <td className="px-3 py-2"><span className="rounded bg-muted px-2 py-1 font-semibold">{action}</span></td>
                        <td className="px-3 py-2 font-semibold">{row.nome || "—"}</td>
                        <td className="px-3 py-2">{row.cpf3 || "—"}</td>
                        <td className="px-3 py-2">{row.cargo || "—"}</td>
                        <td className="px-3 py-2">{row.filial === "cristo-rei" ? "Cristo Rei" : row.filial === "champagnat" ? "Champagnat" : "—"}</td>
                        <td className="px-3 py-2">{row.nascimento ?? "—"}</td>
                        <td className="px-3 py-2">{row.admissao ?? "—"}</td>
                        <td className="max-w-[260px] px-3 py-2">
                          {row.errors.length ? <span className="inline-flex items-start gap-1 text-destructive"><AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {row.errors.join(" · ")}</span> : row.warnings.length ? <span className="text-amber-700">{row.warnings.join(" · ")}</span> : <span className="inline-flex items-center gap-1 text-success"><CheckCircle2 className="h-3.5 w-3.5" /> Pronto</span>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {result ? (
              <div className="rounded-lg border border-success/30 bg-success-soft p-3 text-sm text-success">
                Importação concluída: <strong>{result.inserted}</strong> novo(s), <strong>{result.updated}</strong> atualizado(s){result.errors.length ? ` e ${result.errors.length} erro(s) adicionais retornados pelo banco` : ""}.
              </div>
            ) : null}

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:items-center sm:justify-between">
              <p className="text-xs text-muted-foreground">Linhas bloqueadas não serão gravadas. Você pode corrigir o Excel e importar novamente.</p>
              <div className="flex gap-2"><Button variant="outline" onClick={() => setOpen(false)}>Fechar</Button><Button disabled={importing || valid.length === 0 || Boolean(result)} onClick={() => void importValidRows()}>{importing ? "Importando..." : `Importar ${valid.length} linha(s)`}</Button></div>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
