// DESIGN.md §2: wires lib/jobs/scheduler.ts's register() once, only in the
// Node.js runtime (this project has no Edge routes, but proxy.ts runs in
// whatever runtime Next.js picks for it, so this guard stays defensive).
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { register: registerJobs } = await import("@/lib/jobs/scheduler");
    registerJobs();
  }
}
