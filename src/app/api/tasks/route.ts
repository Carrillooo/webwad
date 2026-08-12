import { NextRequest, NextResponse } from "next/server";
import { resolveProviders } from "@/lib/providers";
import { resolveUser } from "@/lib/auth";

/** GET /api/tasks — all task lists + tasks. */
export async function GET(req: NextRequest) {
  const { userId, authed } = await resolveUser(req);
  const providers = await resolveProviders(userId, authed);
  const [lists, tasks] = await Promise.all([
    providers.tasks.listTaskLists(),
    providers.tasks.listTasks(),
  ]);
  return NextResponse.json({ lists, tasks, demoMode: providers.demoMode });
}
