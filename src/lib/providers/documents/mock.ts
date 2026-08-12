import { DocumentsProvider, DriveFile, DocContent } from "../types";
import { demoStore } from "../../demo/store";

let counter = 3000;
function nextId() {
  counter += 1;
  return `doc-${counter}`;
}

export class MockDocumentsProvider implements DocumentsProvider {
  readonly kind = "mock" as const;

  async searchFiles(query: string): Promise<DriveFile[]> {
    const q = query.trim().toLowerCase();
    return demoStore().files.filter((f) => f.name.toLowerCase().includes(q));
  }

  async recentFiles(limit = 10): Promise<DriveFile[]> {
    return [...demoStore().files]
      .sort((a, b) => (b.modifiedTime ?? "").localeCompare(a.modifiedTime ?? ""))
      .slice(0, limit);
  }

  async getDocument(id: string): Promise<DocContent | null> {
    return demoStore().docs[id] ?? null;
  }

  async createDocument(title: string, text = ""): Promise<DriveFile> {
    const store = demoStore();
    const id = nextId();
    const file: DriveFile = {
      id,
      name: title,
      mimeType: "application/vnd.google-apps.document",
      modifiedTime: new Date().toISOString(),
      webViewLink: "#",
    };
    store.files.unshift(file);
    store.docs[id] = { id, title, text };
    return file;
  }

  async appendDocument(id: string, text: string): Promise<void> {
    const doc = demoStore().docs[id];
    if (!doc) throw new Error("Documento no encontrado");
    doc.text = `${doc.text}\n${text}`.trim();
  }

  async updateDocument(id: string, text: string, confirmOverwrite: boolean): Promise<void> {
    const doc = demoStore().docs[id];
    if (!doc) throw new Error("Documento no encontrado");
    if (!confirmOverwrite && doc.text.length > 200) {
      throw new Error("Sobrescritura de documento extenso requiere confirmación explícita");
    }
    doc.text = text;
  }
}
