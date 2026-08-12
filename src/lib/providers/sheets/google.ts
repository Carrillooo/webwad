import ExcelJS from "exceljs";
import { SheetsProvider, SpreadsheetRef } from "./types";

const DRIVE = "https://www.googleapis.com/drive/v3";
const UPLOAD = "https://www.googleapis.com/upload/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";
const XLSX_MIME = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

/**
 * Google Sheets provider that handles BOTH native Google Sheets and .xlsx files
 * stored in Drive. Crucially, .xlsx files are edited IN PLACE (download → edit
 * → re-upload with the SAME fileId), so a spreadsheet shared/synced live with
 * other people keeps its link, permissions and online sync — collaborators see
 * the change immediately. Cell values are UNTRUSTED (see docs/SECURITY.md).
 */
export class GoogleSheetsProvider implements SheetsProvider {
  readonly kind = "google" as const;
  constructor(private accessToken: string) {}

  private headers(extra?: Record<string, string>) {
    return { Authorization: `Bearer ${this.accessToken}`, ...extra };
  }

  private async json<T>(url: string, method = "GET", body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: this.headers({ "Content-Type": "application/json" }),
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }

  private async mimeOf(fileId: string): Promise<string> {
    const data = await this.json<{ mimeType: string }>(
      `${DRIVE}/files/${encodeURIComponent(fileId)}?fields=mimeType&supportsAllDrives=true`,
    );
    return data.mimeType;
  }

  private async downloadXlsx(fileId: string): Promise<ArrayBuffer> {
    const res = await fetch(`${DRIVE}/files/${encodeURIComponent(fileId)}?alt=media&supportsAllDrives=true`, {
      headers: this.headers(),
    });
    if (!res.ok) throw new Error(`Drive download ${res.status}`);
    return res.arrayBuffer();
  }

  private async uploadXlsx(fileId: string, buf: ArrayBuffer): Promise<void> {
    // PATCH with uploadType=media keeps the SAME fileId → link/sharing/sync intact.
    const res = await fetch(`${UPLOAD}/files/${encodeURIComponent(fileId)}?uploadType=media&supportsAllDrives=true`, {
      method: "PATCH",
      headers: this.headers({ "Content-Type": XLSX_MIME }),
      body: buf,
    });
    if (!res.ok) throw new Error(`Drive update ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  private async loadWorkbook(fileId: string): Promise<ExcelJS.Workbook> {
    const wb = new ExcelJS.Workbook();
    // exceljs accepts an ArrayBuffer at runtime; its typings are stricter.
    await wb.xlsx.load((await this.downloadXlsx(fileId)) as never);
    return wb;
  }
  private worksheet(wb: ExcelJS.Workbook, name?: string): ExcelJS.Worksheet {
    const ws = name ? wb.getWorksheet(name) : undefined;
    return ws ?? wb.worksheets[0];
  }

  // -------------------------- interface --------------------------

  async findSpreadsheets(query: string): Promise<SpreadsheetRef[]> {
    const safe = query.replace(/'/g, "\\'");
    const q = `name contains '${safe}' and (mimeType = '${SHEET_MIME}' or mimeType = '${XLSX_MIME}') and trashed = false`;
    const params = new URLSearchParams({
      q,
      pageSize: "20",
      fields: "files(id,name,webViewLink)",
      supportsAllDrives: "true",
      includeItemsFromAllDrives: "true",
    });
    const data = await this.json<{ files: SpreadsheetRef[] }>(`${DRIVE}/files?${params}`);
    return data.files ?? [];
  }

  async listTabs(spreadsheetId: string): Promise<string[]> {
    if ((await this.mimeOf(spreadsheetId)) === SHEET_MIME) {
      const data = await this.json<{ sheets?: { properties?: { title?: string } }[] }>(
        `${SHEETS}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
      );
      return (data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
    }
    const wb = await this.loadWorkbook(spreadsheetId);
    return wb.worksheets.map((w) => w.name);
  }

  async readValues(spreadsheetId: string, range: string): Promise<string[][]> {
    if ((await this.mimeOf(spreadsheetId)) === SHEET_MIME) {
      const data = await this.json<{ values?: string[][] }>(
        `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
      );
      return data.values ?? [];
    }
    // .xlsx: range may be a tab name ("Hoja1") or "Hoja1!A1:D9"; read the sheet.
    const sheetName = range.includes("!") ? range.split("!")[0] : /^[A-Z]+\d/.test(range) ? undefined : range;
    const wb = await this.loadWorkbook(spreadsheetId);
    const ws = this.worksheet(wb, sheetName);
    const rows: string[][] = [];
    ws.eachRow({ includeEmpty: true }, (row) => {
      const cells: string[] = [];
      row.eachCell({ includeEmpty: true }, (cell) => cells.push(cellText(cell)));
      rows.push(cells);
    });
    return rows;
  }

  async appendRow(spreadsheetId: string, range: string, values: string[]): Promise<void> {
    if ((await this.mimeOf(spreadsheetId)) === SHEET_MIME) {
      await this.json(
        `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
        "POST",
        { values: [values] },
      );
      return;
    }
    const sheetName = range.includes("!") ? range.split("!")[0] : undefined;
    const wb = await this.loadWorkbook(spreadsheetId);
    this.worksheet(wb, sheetName).addRow(values);
    await this.uploadXlsx(spreadsheetId, await wb.xlsx.writeBuffer());
  }

  async updateRange(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    if ((await this.mimeOf(spreadsheetId)) === SHEET_MIME) {
      await this.json(
        `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
        "PUT",
        { values },
      );
      return;
    }
    // .xlsx: write starting at the given top-left cell (e.g. "Hoja1!D7").
    const [sheetPart, cellPart] = range.includes("!") ? range.split("!") : [undefined, range];
    const wb = await this.loadWorkbook(spreadsheetId);
    const ws = this.worksheet(wb, sheetPart);
    const start = ws.getCell(cellPart || "A1");
    const startRow = Number(start.row);
    const startCol = Number(start.col);
    values.forEach((rowVals, r) =>
      rowVals.forEach((v, c) => {
        ws.getRow(startRow + r).getCell(startCol + c).value = v;
      }),
    );
    await this.uploadXlsx(spreadsheetId, await wb.xlsx.writeBuffer());
  }
}

function cellText(cell: ExcelJS.Cell): string {
  const v = cell.value as unknown;
  if (v == null) return "";
  if (typeof v === "object" && v !== null && "text" in (v as Record<string, unknown>)) {
    return String((v as { text: unknown }).text);
  }
  if (typeof v === "object" && v !== null && "result" in (v as Record<string, unknown>)) {
    return String((v as { result: unknown }).result);
  }
  return String(v);
}
