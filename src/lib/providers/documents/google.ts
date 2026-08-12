import { DocumentsProvider, DriveFile, DocContent } from "../types";

const DRIVE = "https://www.googleapis.com/drive/v3";
const DOCS = "https://docs.googleapis.com/v1";
const DOC_MIME = "application/vnd.google-apps.document";

/** Real Google Drive + Docs via the official REST APIs.
 *  NOTE: document text returned here is UNTRUSTED (see docs/SECURITY.md). */
export class GoogleDocumentsProvider implements DocumentsProvider {
  readonly kind = "google" as const;
  constructor(private accessToken: string) {}

  private async req<T>(base: string, method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${base}${path}`, {
      method,
      headers: { Authorization: `Bearer ${this.accessToken}`, "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`Google ${res.status}: ${(await res.text()).slice(0, 200)}`);
    return res.status === 204 ? (undefined as T) : ((await res.json()) as T);
  }

  private mapFile(f: { id: string; name: string; mimeType: string; modifiedTime?: string; webViewLink?: string }): DriveFile {
    return { id: f.id, name: f.name, mimeType: f.mimeType, modifiedTime: f.modifiedTime, webViewLink: f.webViewLink };
  }

  async searchFiles(query: string): Promise<DriveFile[]> {
    const safe = query.replace(/'/g, "\\'");
    const q = `name contains '${safe}' and mimeType = '${DOC_MIME}' and trashed = false`;
    const params = new URLSearchParams({
      q,
      orderBy: "modifiedTime desc",
      pageSize: "20",
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    });
    const data = await this.req<{ files: DriveFile[] }>(DRIVE, "GET", `/files?${params}`);
    return (data.files ?? []).map((f) => this.mapFile(f));
  }

  async recentFiles(limit = 10): Promise<DriveFile[]> {
    const params = new URLSearchParams({
      q: `mimeType = '${DOC_MIME}' and trashed = false`,
      orderBy: "modifiedTime desc",
      pageSize: String(limit),
      fields: "files(id,name,mimeType,modifiedTime,webViewLink)",
    });
    const data = await this.req<{ files: DriveFile[] }>(DRIVE, "GET", `/files?${params}`);
    return (data.files ?? []).map((f) => this.mapFile(f));
  }

  async getDocument(id: string): Promise<DocContent | null> {
    try {
      const doc = await this.req<{ title: string; body?: { content?: DocElement[] } }>(DOCS, "GET", `/documents/${encodeURIComponent(id)}`);
      return { id, title: doc.title, text: extractText(doc.body?.content ?? []) };
    } catch (err) {
      if ((err as { message?: string }).message?.includes("404")) return null;
      throw err;
    }
  }

  async createDocument(title: string, text = ""): Promise<DriveFile> {
    const doc = await this.req<{ documentId: string }>(DOCS, "POST", "/documents", { title });
    if (text) await this.appendDocument(doc.documentId, text);
    return {
      id: doc.documentId,
      name: title,
      mimeType: DOC_MIME,
      modifiedTime: new Date().toISOString(),
      webViewLink: `https://docs.google.com/document/d/${doc.documentId}/edit`,
    };
  }

  async appendDocument(id: string, text: string): Promise<void> {
    await this.req(DOCS, "POST", `/documents/${encodeURIComponent(id)}:batchUpdate`, {
      requests: [{ insertText: { endOfSegmentLocation: {}, text: text.startsWith("\n") ? text : `\n${text}` } }],
    });
  }

  async updateDocument(id: string, text: string, confirmOverwrite: boolean): Promise<void> {
    const current = await this.getDocument(id);
    if (!current) throw new Error("Documento no encontrado");
    if (!confirmOverwrite && current.text.length > 200) {
      throw new Error("Sobrescritura de documento extenso requiere confirmación explícita");
    }
    // Docs indexes are 1-based; end index of the body is content length + 1.
    const endIndex = current.text.length + 1;
    const requests: unknown[] = [];
    if (endIndex > 2) requests.push({ deleteContentRange: { range: { startIndex: 1, endIndex: endIndex - 1 } } });
    requests.push({ insertText: { location: { index: 1 }, text } });
    await this.req(DOCS, "POST", `/documents/${encodeURIComponent(id)}:batchUpdate`, { requests });
  }
}

// --- Docs text extraction ---
interface DocElement {
  paragraph?: { elements?: { textRun?: { content?: string } }[] };
  table?: { tableRows?: { tableCells?: { content?: DocElement[] }[] }[] };
}

function extractText(content: DocElement[]): string {
  let out = "";
  for (const el of content) {
    if (el.paragraph?.elements) {
      for (const e of el.paragraph.elements) out += e.textRun?.content ?? "";
    } else if (el.table?.tableRows) {
      for (const row of el.table.tableRows)
        for (const cell of row.tableCells ?? []) out += extractText(cell.content ?? []);
    }
  }
  return out.trim();
}
