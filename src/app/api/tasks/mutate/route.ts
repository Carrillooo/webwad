import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getProviders } from "@/lib/providers";

const Schema = z.object({
  action: z.enum(["complete", "reopen", "create", "delete", "update"]),
  id: z.string().optional(),
  title: z.string().max(500).optional(),
  notes: z.string().max(2000).optional(),
  due: z.string().optional(),
});

/** POST /api/tasks/mutate — direct task mutations from the UI (non-voice). */
export async function POST(req: NextRequest) {
  const parsed = Schema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "inválido" }, { status: 400 });
  const { action, id, title, notes, due } = parsed.data;
  const tasks = getProviders().tasks;
  try {
    switch (action) {
      case "complete":
        if (!id) throw new Error("id requerido");
        return NextResponse.json({ task: await tasks.completeTask(id) });
      case "reopen":
        if (!id) throw new Error("id requerido");
        return NextResponse.json({ task: await tasks.reopenTask(id) });
      case "create":
        if (!title) throw new Error("title requerido");
        return NextResponse.json({ task: await tasks.createTask({ title, notes, due }) });
      case "delete":
        if (!id) throw new Error("id requerido");
        await tasks.deleteTask(id);
        return NextResponse.json({ ok: true });
      case "update":
        if (!id) throw new Error("id requerido");
        return NextResponse.json({ task: await tasks.updateTask(id, { title, notes, due }) });
    }
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 400 });
  }
}
