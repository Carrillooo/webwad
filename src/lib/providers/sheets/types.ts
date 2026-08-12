/** Google Sheets abstraction (for tasks/data kept in a spreadsheet). */
export interface SpreadsheetRef {
  id: string;
  name: string;
  webViewLink?: string;
}

export interface SheetsProvider {
  readonly kind: "google";
  /** Find spreadsheets in Drive by name (Google Sheets only — not .xlsx). */
  findSpreadsheets(query: string): Promise<SpreadsheetRef[]>;
  /** Read a rectangular range, e.g. "A1:E50" or a whole sheet "Hoja1". */
  readValues(spreadsheetId: string, range: string): Promise<string[][]>;
  /** Append a row to the first table in a range/sheet. */
  appendRow(spreadsheetId: string, range: string, values: string[]): Promise<void>;
}
