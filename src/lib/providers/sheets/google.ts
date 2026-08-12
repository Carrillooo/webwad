import { SheetsProvider, SpreadsheetRef } from "./types";

const DRIVE = "https://www.googleapis.com/drive/v3";
const SHEETS = "https://sheets.googleapis.com/v4/spreadsheets";
const SHEET_MIME = "application/vnd.google-apps.spreadsheet";

/** Real Google Sheets via the official REST API. Sheet cell values are
 *  UNTRUSTED (see docs/SECURITY.md). Only edits Google Sheets, not raw .xlsx. */
export class GoogleSheetsProvider implements SheetsProvider {
  readonly kind = "google" as const;
  constructor(private accessToken: string) {}

  private async req<T>(url: string, method = "GET", body?: unknown): Promise<T> {
    const res = await fetch(url, {
      method,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Google Sheets ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return (await res.json()) as T;
  }

  async findSpreadsheets(query: string): Promise<SpreadsheetRef[]> {
    const safe = query.replace(/'/g, "\\'");
    const q = `name contains '${safe}' and mimeType = '${SHEET_MIME}' and trashed = false`;
    const params = new URLSearchParams({ q, pageSize: "20", fields: "files(id,name,webViewLink)" });
    const data = await this.req<{ files: SpreadsheetRef[] }>(`${DRIVE}/files?${params}`);
    return data.files ?? [];
  }

  async readValues(spreadsheetId: string, range: string): Promise<string[][]> {
    const data = await this.req<{ values?: string[][] }>(
      `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}`,
    );
    return data.values ?? [];
  }

  async appendRow(spreadsheetId: string, range: string, values: string[]): Promise<void> {
    await this.req(
      `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}:append?valueInputOption=USER_ENTERED&insertDataOption=INSERT_ROWS`,
      "POST",
      { values: [values] },
    );
  }

  async updateRange(spreadsheetId: string, range: string, values: string[][]): Promise<void> {
    await this.req(
      `${SHEETS}/${encodeURIComponent(spreadsheetId)}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
      "PUT",
      { values },
    );
  }

  async listTabs(spreadsheetId: string): Promise<string[]> {
    const data = await this.req<{ sheets?: { properties?: { title?: string } }[] }>(
      `${SHEETS}/${encodeURIComponent(spreadsheetId)}?fields=sheets.properties.title`,
    );
    return (data.sheets ?? []).map((s) => s.properties?.title ?? "").filter(Boolean);
  }
}
