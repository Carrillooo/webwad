import { NextResponse } from "next/server";
import { getProviders } from "@/lib/providers";

/** GET /api/tasks — all task lists + tasks. */
export async function GET() {
  const providers = getProviders();
  const [lists, tasks] = await Promise.all([
    providers.tasks.listTaskLists(),
    providers.tasks.listTasks(),
  ]);
  return NextResponse.json({ lists, tasks, demoMode: providers.demoMode });
}
