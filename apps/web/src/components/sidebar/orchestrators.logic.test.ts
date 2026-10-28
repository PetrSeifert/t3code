import { ProjectId, ProviderInstanceId, ThreadId } from "@t3tools/contracts";
import { describe, expect, it } from "vite-plus/test";

import {
  orderNewOrchestratorProjects,
  resolveSidebarOrchestrators,
  sidebarOrchestratorStatusLabel,
} from "./orchestrators.logic";

const running = {
  status: "running" as const,
  activeRunId: null,
  providerInstanceId: ProviderInstanceId.make("codex"),
  providerName: "Codex",
  lastError: null,
  updatedAt: "2026-10-27T10:00:00.000Z",
};

function makeThread(
  id: string,
  overrides: {
    projectId?: string;
    environmentId?: string;
    parentThreadId?: string;
    archivedAt?: string;
    runtime?: typeof running | null;
    hasPendingApprovals?: boolean;
    pendingGuestMessageCount?: number;
  } = {},
) {
  return {
    environmentId: overrides.environmentId ?? "env-a",
    id: ThreadId.make(id),
    projectId: ProjectId.make(overrides.projectId ?? "project-a"),
    archivedAt: overrides.archivedAt ?? null,
    lineage: {
      parentThreadId:
        overrides.parentThreadId === undefined ? null : ThreadId.make(overrides.parentThreadId),
      relationshipToParent: overrides.parentThreadId === undefined ? null : ("subagent" as const),
      rootThreadId: ThreadId.make(overrides.parentThreadId ?? id),
    },
    hasPendingApprovals: overrides.hasPendingApprovals ?? false,
    hasPendingUserInput: false,
    pendingGuestMessageCount: overrides.pendingGuestMessageCount ?? 0,
    runtime: overrides.runtime ?? null,
  };
}

function makeProject(id: string, orchestratorThreadId: string | null, environmentId = "env-a") {
  return {
    environmentId,
    id: ProjectId.make(id),
    orchestratorThreadId:
      orchestratorThreadId === null ? null : ThreadId.make(orchestratorThreadId),
  };
}

describe("resolveSidebarOrchestrators", () => {
  it("lists only projects whose orchestrator is live", () => {
    const projects = [
      makeProject("project-a", "orch-a"),
      makeProject("project-b", null),
      makeProject("project-c", "orch-c"),
      makeProject("project-d", "missing"),
      makeProject("project-e", "orch-a"),
    ];
    const threads = [
      makeThread("orch-a"),
      makeThread("orch-c", { projectId: "project-c", archivedAt: "2026-10-27T10:00:00.000Z" }),
    ];

    expect(resolveSidebarOrchestrators(projects, threads).map((entry) => entry.key)).toEqual([
      "env-a:orch-a",
    ]);
  });

  it("keeps environments apart when thread ids collide", () => {
    const projects = [
      makeProject("project-a", "orch", "env-a"),
      makeProject("project-a", "orch", "env-b"),
    ];
    const threads = [makeThread("orch", { environmentId: "env-b" })];

    expect(resolveSidebarOrchestrators(projects, threads).map((entry) => entry.key)).toEqual([
      "env-b:orch",
    ]);
  });

  it("counts running workers, not idle or archived ones", () => {
    const projects = [makeProject("project-a", "orch")];
    const threads = [
      makeThread("orch"),
      makeThread("worker-1", { parentThreadId: "orch", runtime: running }),
      makeThread("worker-2", { parentThreadId: "orch", runtime: running }),
      makeThread("worker-3", { parentThreadId: "orch" }),
      makeThread("worker-4", {
        parentThreadId: "orch",
        runtime: running,
        archivedAt: "2026-10-27T10:00:00.000Z",
      }),
      makeThread("worker-5", { parentThreadId: "orch", runtime: running, environmentId: "env-b" }),
    ];

    expect(resolveSidebarOrchestrators(projects, threads)[0]?.status).toEqual({
      kind: "workers",
      count: 2,
    });
  });

  it("puts a waiting approval or guest request ahead of running workers", () => {
    const projects = [makeProject("project-a", "orch-a"), makeProject("project-b", "orch-b")];
    const threads = [
      makeThread("orch-a", { hasPendingApprovals: true }),
      makeThread("orch-b", { projectId: "project-b", pendingGuestMessageCount: 1 }),
      makeThread("worker", { parentThreadId: "orch-a", runtime: running }),
    ];

    expect(resolveSidebarOrchestrators(projects, threads).map((entry) => entry.status)).toEqual([
      { kind: "needs-you" },
      { kind: "needs-you" },
    ]);
  });

  it("reads as idle with no running workers, even while the orchestrator runs", () => {
    const projects = [makeProject("project-a", "orch")];
    const threads = [makeThread("orch", { runtime: running })];

    expect(resolveSidebarOrchestrators(projects, threads)[0]?.status).toEqual({ kind: "idle" });
  });
});

describe("sidebarOrchestratorStatusLabel", () => {
  it("labels each status", () => {
    expect(sidebarOrchestratorStatusLabel({ kind: "needs-you" })).toBe("Needs you");
    expect(sidebarOrchestratorStatusLabel({ kind: "workers", count: 1 })).toBe("1 worker running");
    expect(sidebarOrchestratorStatusLabel({ kind: "workers", count: 3 })).toBe("3 workers running");
    expect(sidebarOrchestratorStatusLabel({ kind: "idle" })).toBe("Idle");
  });
});

describe("orderNewOrchestratorProjects", () => {
  it("moves projects with a live orchestrator to the bottom and keeps order otherwise", () => {
    const projects = [
      makeProject("project-a", "orch-a"),
      makeProject("project-b", null),
      makeProject("project-c", "stale"),
      makeProject("project-d", null),
    ];
    const orchestrators = resolveSidebarOrchestrators(projects, [makeThread("orch-a")]);

    expect(
      orderNewOrchestratorProjects(projects, orchestrators).map((entry) => [
        entry.project.id,
        entry.hasOrchestrator,
      ]),
    ).toEqual([
      ["project-b", false],
      ["project-c", false],
      ["project-d", false],
      ["project-a", true],
    ]);
  });

  it("keeps another environment's copy of a project available", () => {
    const laptop = makeProject("project-a", "orch-a", "env-a");
    const server = makeProject("project-a", null, "env-b");
    const orchestrators = resolveSidebarOrchestrators([laptop, server], [makeThread("orch-a")]);

    expect(
      orderNewOrchestratorProjects([laptop, server], orchestrators).map((entry) => [
        entry.project.environmentId,
        entry.hasOrchestrator,
      ]),
    ).toEqual([
      ["env-b", false],
      ["env-a", true],
    ]);
  });
});
