export type SpreadsheetCell = string | number | boolean | null;
export type SpreadsheetRow = Record<string, SpreadsheetCell>;

export type EmployeeImportRow = {
  row: number;
  nome: string;
  cpf3: string;
  cargo: string;
  filial: "cristo-rei" | "champagnat" | "";
  nascimento: string | null;
  admissao: string | null;
  ativo: boolean;
  errors: string[];
  warnings: string[];
};

const HEADER_ALIASES = {
  nome: ["nome", "nome completo", "colaborador", "funcionario", "funcionário"],
  cpf: ["cpf", "cpf3", "cpf final", "final cpf", "ultimos 3 cpf", "últimos 3 cpf", "ultimos 3 digitos cpf", "últimos 3 dígitos cpf"],
  cargo: ["cargo", "funcao", "função", "posicao", "posição"],
  filial: ["filial", "unidade", "loja"],
  nascimento: ["nascimento", "data nascimento", "data de nascimento", "aniversario", "aniversário"],
  admissao: ["admissao", "admissão", "data admissao", "data de admissão"],
  ativo: ["ativo", "status", "situacao", "situação"],
} as const;

function normalizeText(value: unknown) {
  return String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");
}

function getAliasedValue(row: SpreadsheetRow, aliases: readonly string[]) {
  const aliasSet = new Set(aliases.map(normalizeText));
  const entry = Object.entries(row).find(([key]) => aliasSet.has(normalizeText(key)));
  return entry?.[1] ?? null;
}

function normalizeFilial(value: unknown): "cristo-rei" | "champagnat" | "" {
  const normalized = normalizeText(value);
  if (["cristo rei", "cr", "cristo-rei"].includes(normalized)) return "cristo-rei";
  if (["champagnat", "ch", "champ"].includes(normalized)) return "champagnat";
  return "";
}

function excelSerialToIso(serial: number) {
  const epoch = Date.UTC(1899, 11, 30);
  const date = new Date(epoch + Math.round(serial * 86_400_000));
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

function normalizeDate(value: unknown): string | null {
  if (value == null || value === "") return null;
  if (typeof value === "number" && Number.isFinite(value)) return excelSerialToIso(value);

  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;

  const br = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (br) {
    const [, day, month, year] = br;
    const iso = `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
    const date = new Date(`${iso}T00:00:00Z`);
    return Number.isNaN(date.getTime()) ? null : iso;
  }

  return null;
}

function normalizeActive(value: unknown) {
  if (value == null || value === "") return true;
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  const normalized = normalizeText(value);
  if (["inativo", "nao", "não", "0", "false", "desligado"].includes(normalized)) return false;
  return true;
}

export function normalizeEmployeeImportRows(rows: SpreadsheetRow[]): EmployeeImportRow[] {
  const seen = new Set<string>();

  return rows.map((row, index) => {
    const nome = String(getAliasedValue(row, HEADER_ALIASES.nome) ?? "").trim();
    const cpfDigits = String(getAliasedValue(row, HEADER_ALIASES.cpf) ?? "").replace(/\D/g, "");
    const cpf3 = cpfDigits.slice(-3);
    const cargo = String(getAliasedValue(row, HEADER_ALIASES.cargo) ?? "").trim();
    const filial = normalizeFilial(getAliasedValue(row, HEADER_ALIASES.filial));
    const nascimentoRaw = getAliasedValue(row, HEADER_ALIASES.nascimento);
    const admissaoRaw = getAliasedValue(row, HEADER_ALIASES.admissao);
    const nascimento = normalizeDate(nascimentoRaw);
    const admissao = normalizeDate(admissaoRaw);
    const ativo = normalizeActive(getAliasedValue(row, HEADER_ALIASES.ativo));
    const errors: string[] = [];
    const warnings: string[] = [];

    if (nome.length < 2) errors.push("Nome ausente ou inválido");
    if (cpf3.length !== 3) errors.push("CPF precisa ter ao menos os 3 dígitos finais");
    if (cargo.length < 2) errors.push("Cargo ausente ou inválido");
    if (!filial) errors.push("Unidade deve ser Cristo Rei ou Champagnat");
    if (nascimentoRaw != null && nascimentoRaw !== "" && !nascimento) errors.push("Data de nascimento inválida");
    if (admissaoRaw != null && admissaoRaw !== "" && !admissao) errors.push("Data de admissão inválida");
    if (!nascimento) warnings.push("Sem nascimento: aniversário não poderá ser calculado");
    if (!admissao) warnings.push("Sem admissão: tempo de casa não poderá ser calculado");

    const key = `${normalizeText(nome)}|${cpf3}|${filial}`;
    if (nome && cpf3 && filial) {
      if (seen.has(key)) errors.push("Cadastro duplicado dentro do arquivo");
      seen.add(key);
    }

    return {
      row: index + 2,
      nome,
      cpf3,
      cargo,
      filial,
      nascimento,
      admissao,
      ativo,
      errors,
      warnings,
    };
  });
}

function parseCsvLine(line: string, delimiter: string) {
  const cells: string[] = [];
  let current = "";
  let quoted = false;
  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];
    if (char === '"') {
      if (quoted && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        quoted = !quoted;
      }
    } else if (char === delimiter && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }
  cells.push(current.trim());
  return cells;
}

function parseCsv(text: string): SpreadsheetRow[] {
  const lines = text.replace(/^\uFEFF/, "").split(/\r?\n/).filter((line) => line.trim());
  if (!lines.length) return [];
  const first = lines[0] ?? "";
  const delimiter = first.split(";").length >= first.split(",").length ? ";" : ",";
  const headers = parseCsvLine(first, delimiter);
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""]));
  });
}

type ZipEntry = {
  name: string;
  method: number;
  compressedSize: number;
  localOffset: number;
};

function findEndOfCentralDirectory(view: DataView) {
  const min = Math.max(0, view.byteLength - 65_557);
  for (let offset = view.byteLength - 22; offset >= min; offset -= 1) {
    if (view.getUint32(offset, true) === 0x06054b50) return offset;
  }
  throw new Error("Arquivo XLSX inválido: diretório ZIP não encontrado.");
}

function listZipEntries(buffer: ArrayBuffer) {
  const view = new DataView(buffer);
  const eocd = findEndOfCentralDirectory(view);
  const entriesCount = view.getUint16(eocd + 10, true);
  let offset = view.getUint32(eocd + 16, true);
  const decoder = new TextDecoder();
  const entries = new Map<string, ZipEntry>();

  for (let index = 0; index < entriesCount; index += 1) {
    if (view.getUint32(offset, true) !== 0x02014b50) throw new Error("Arquivo XLSX inválido.");
    const method = view.getUint16(offset + 10, true);
    const compressedSize = view.getUint32(offset + 20, true);
    const nameLength = view.getUint16(offset + 28, true);
    const extraLength = view.getUint16(offset + 30, true);
    const commentLength = view.getUint16(offset + 32, true);
    const localOffset = view.getUint32(offset + 42, true);
    const nameBytes = new Uint8Array(buffer, offset + 46, nameLength);
    const name = decoder.decode(nameBytes);
    entries.set(name, { name, method, compressedSize, localOffset });
    offset += 46 + nameLength + extraLength + commentLength;
  }
  return entries;
}

async function readZipEntry(buffer: ArrayBuffer, entry: ZipEntry) {
  const view = new DataView(buffer);
  const offset = entry.localOffset;
  if (view.getUint32(offset, true) !== 0x04034b50) throw new Error("Arquivo XLSX inválido.");
  const nameLength = view.getUint16(offset + 26, true);
  const extraLength = view.getUint16(offset + 28, true);
  const start = offset + 30 + nameLength + extraLength;
  const compressed = new Uint8Array(buffer, start, entry.compressedSize);

  if (entry.method === 0) return new TextDecoder().decode(compressed);
  if (entry.method !== 8) throw new Error("Compressão XLSX não suportada.");

  const stream = new Blob([compressed]).stream().pipeThrough(new DecompressionStream("deflate-raw" as never));
  return new TextDecoder().decode(await new Response(stream).arrayBuffer());
}

function columnIndex(cellRef: string) {
  const letters = cellRef.match(/^[A-Z]+/i)?.[0]?.toUpperCase() ?? "A";
  let index = 0;
  for (const char of letters) index = index * 26 + char.charCodeAt(0) - 64;
  return index - 1;
}

function xml(text: string) {
  const document = new DOMParser().parseFromString(text, "application/xml");
  if (document.querySelector("parsererror")) throw new Error("XML interno do XLSX inválido.");
  return document;
}

async function parseXlsx(buffer: ArrayBuffer): Promise<SpreadsheetRow[]> {
  const entries = listZipEntries(buffer);
  const sharedEntry = entries.get("xl/sharedStrings.xml");
  const sharedStrings: string[] = [];
  if (sharedEntry) {
    const sharedDoc = xml(await readZipEntry(buffer, sharedEntry));
    sharedDoc.querySelectorAll("si").forEach((node) => {
      sharedStrings.push(Array.from(node.querySelectorAll("t")).map((item) => item.textContent ?? "").join(""));
    });
  }

  const sheetEntry = entries.get("xl/worksheets/sheet1.xml") ?? Array.from(entries.values()).find((entry) => /^xl\/worksheets\/sheet\d+\.xml$/.test(entry.name));
  if (!sheetEntry) throw new Error("Nenhuma planilha encontrada no arquivo XLSX.");

  const sheetDoc = xml(await readZipEntry(buffer, sheetEntry));
  const matrix: SpreadsheetCell[][] = [];
  sheetDoc.querySelectorAll("sheetData > row").forEach((rowNode) => {
    const cells: SpreadsheetCell[] = [];
    rowNode.querySelectorAll("c").forEach((cellNode) => {
      const ref = cellNode.getAttribute("r") ?? "A1";
      const type = cellNode.getAttribute("t") ?? "n";
      const raw = cellNode.querySelector("v")?.textContent ?? cellNode.querySelector("is > t")?.textContent ?? "";
      let value: SpreadsheetCell = raw;
      if (type === "s") value = sharedStrings[Number(raw)] ?? "";
      else if (type === "b") value = raw === "1";
      else if (type === "n" && raw !== "" && Number.isFinite(Number(raw))) value = Number(raw);
      cells[columnIndex(ref)] = value;
    });
    matrix.push(cells);
  });

  const headerIndex = matrix.findIndex((row) => row.filter((cell) => String(cell ?? "").trim()).length >= 2);
  if (headerIndex < 0) return [];
  const headers = (matrix[headerIndex] ?? []).map((cell) => String(cell ?? "").trim());

  return matrix
    .slice(headerIndex + 1)
    .filter((row) => row.some((cell) => String(cell ?? "").trim()))
    .map((row) => Object.fromEntries(headers.map((header, index) => [header || `Coluna ${index + 1}`, row[index] ?? null])));
}

export async function readSpreadsheet(file: File): Promise<SpreadsheetRow[]> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension === "csv") return parseCsv(await file.text());
  if (extension === "xlsx") return parseXlsx(await file.arrayBuffer());
  throw new Error("Formato não suportado. Envie um arquivo .xlsx ou .csv.");
}
