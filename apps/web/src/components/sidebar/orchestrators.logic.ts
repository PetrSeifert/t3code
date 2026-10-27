import { isLiveProjectOrchestrator, type ProjectId, type ThreadId } from "@t3tools/contracts";

import type { SidebarThreadSummary } from "../../types";
import { resolveSidebarThreadStatus } from "../Sidebar.logic";

type OrchestratorProject = {
  readonly environmentId: string;
  readonly id: ProjectId;
  readonly orchestratorThreadId?: ThreadId | null | undefined;
};

type OrchestratorThread = Pick<
  SidebarThreadSummary,
  | "id"
  | "projectId"
  | "archivedAt"
  | "lineage"
  | "hasPendingApprovals"
  | "hasPendingUserInput"
  | "pendingSubagentRequest"
  | "pendingGuestMessageCount"
  | "runtime"
  | "blockedOnThreadWait"
> & { readonly environmentId: string };

export type SidebarOrchestratorStatus =
  | { readonly kind: "needs-you" }
  | { readonly kind: "workers"; readonly count: number }
  | { readonly kind: "idle" };

export interface SidebarOrchestrator<P, T> {
  readonly key: string;
  readonly project: P;
  readonly thread: T;
  readonly status: SidebarOrchestratorStatus;
}

const threadKey = (environmentId: string, threadId: string) => `${environmentId}:${threadId}`;

/** Each project whose orchestrator is live, in project order, with its status line. */
export function resolveSidebarOrchestrators<
  P extends OrchestratorProject,
  T extends OrchestratorThread,
>(projects: ReadonlyArray<P>, threads: ReadonlyArray<T>): SidebarOrchestrator<P, T>[] {
  if (!projects.some((project) => project.orchestratorThreadId != null)) return [];
  const threadByKey = new Map(
    threads.map((thread) => [threadKey(thread.environmentId, thread.id), thread]),
  );
  const orchestrators = projects.flatMap((project) => {
    if (project.orchestratorThreadId == null) return [];
    const key = threadKey(project.environmentId, project.orchestratorThreadId);
    const thread = threadByKey.get(key);
    return thread !== undefined && isLiveProjectOrchestrator(project, thread)
      ? [{ key, project, thread }]
      : [];
  });
  const runningWorkers = new Map<string, number>();
  for (const thread of threads) {
    const parentThreadId = thread.lineage.parentThreadId;
    if (
      thread.lineage.relationshipToParent !== "subagent" ||
      parentThreadId === null ||
      thread.archivedAt !== null
    ) {
      continue;
    }
    const status = resolveSidebarThreadStatus(thread);
    if (status !== "working" && status !== "waiting") continue;
    const parentKey = threadKey(thread.environmentId, parentThreadId);
    runningWorkers.set(parentKey, (runningWorkers.get(parentKey) ?? 0) + 1);
  }
  return orchestrators.map((orchestrator) => ({
    ...orchestrator,
    status: resolveSidebarOrchestratorStatus(
      orchestrator.thread,
      runningWorkers.get(orchestrator.key) ?? 0,
    ),
  }));
}

export function resolveSidebarOrchestratorStatus(
  thread: OrchestratorThread,
  runningWorkerCount: number,
): SidebarOrchestratorStatus {
  const status = resolveSidebarThreadStatus(thread);
  if (status === "approval" || status === "input" || status === "request") {
    return { kind: "needs-you" };
  }
  return runningWorkerCount > 0 ? { kind: "workers", count: runningWorkerCount } : { kind: "idle" };
}

export function sidebarOrchestratorStatusLabel(status: SidebarOrchestratorStatus): string {
  switch (status.kind) {
    case "needs-you":
      return "Needs you";
    case "workers":
      return `${status.count} ${status.count === 1 ? "worker" : "workers"} running`;
    case "idle":
      return "Idle";
  }
}

/** Projects that can take a new orchestrator first, in their order; the rest after, disabled. */
export function orderNewOrchestratorProjects<P extends OrchestratorProject>(
  projects: ReadonlyArray<P>,
  liveOrchestratorKeys: ReadonlySet<string>,
): { readonly project: P; readonly hasOrchestrator: boolean }[] {
  const entries = projects.map((project) => ({
    project,
    hasOrchestrator:
      project.orchestratorThreadId != null &&
      liveOrchestratorKeys.has(threadKey(project.environmentId, project.orchestratorThreadId)),
  }));
  return [
    ...entries.filter((entry) => !entry.hasOrchestrator),
    ...entries.filter((entry) => entry.hasOrchestrator),
  ];
}
