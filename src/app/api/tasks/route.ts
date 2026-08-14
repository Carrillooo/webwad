import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { guardApi } from "@/lib/api-guard";

/** GET /api/tasks — all task lists + tasks. */
export async function GET(req: NextRequest) {
  const g = await guardApi(req);
  if (g.res) return g.res;
  const { userId, authed } = g.ctx;
  const providers = await resolveProviders(userId, authed);
  const [lists, tasks] = await Promise.all([
    providers.tasks.listTaskLists(),
    providers.tasks.listTasks(),
  ]);
  return NextResponse.json({ lists, tasks, demoMode: providers.demoMode });
}
