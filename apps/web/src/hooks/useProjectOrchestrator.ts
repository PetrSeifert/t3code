import { scopeThreadRef } from "@t3tools/client-runtime/environment";
import {
  isAtomCommandInterrupted,
  squashAtomCommandFailure,
  type AtomCommandResult,
} from "@t3tools/client-runtime/state/runtime";
import type { EnvironmentProject } from "@t3tools/client-runtime/state/shell";
import { DEFAULT_SERVER_SETTINGS, type ScopedProjectRef, type ThreadId } from "@t3tools/contracts";
import { resolveProjectSettings } from "@t3tools/shared/projectSettings";
import { useRouter } from "@tanstack/react-router";

import { stackedThreadToast, toastManager } from "../components/ui/toast";
import { newThreadId } from "../lib/utils";
import { resolveDefaultProviderModelSelection } from "../providerInstances";
import { appAtomRegistry } from "../rpc/atomRegistry";
import { environmentPresentations } from "../state/presentation";
import { projectEnvironment } from "../state/projects";
import { environmentServerConfigsAtom } from "../state/server";
import { threadEnvironment } from "../state/threads";
import { useOrchestrationCommand } from "../state/use-orchestration-command";
import { buildThreadRouteParams } from "../threadRoutes";

function reportFailure(title: string, result: AtomCommandResult<unknown, unknown>): boolean {
  if (result._tag === "Success") return false;
  if (!isAtomCommandInterrupted(result)) {
    const error = squashAtomCommandFailure(result);
    toastManager.add(
      stackedThreadToast({
        type: "error",
        title,
        description: error instanceof Error ? error.message : "An error occurred.",
      }),
    );
  }
  return true;
}

/** Create, assign and clear a project's orchestrator thread. */
export function useProjectOrchestrator() {
  const router = useRouter();
  const createThread = useOrchestrationCommand(threadEnvironment.create, { reportFailure: false });
  const updateProject = useOrchestrationCommand(projectEnvironment.update, {
    reportFailure: false,
  });

  const setOrchestrator = async (projectRef: ScopedProjectRef, threadId: ThreadId | null) => {
    const result = await updateProject({
      environmentId: projectRef.environmentId,
      input: { projectId: projectRef.projectId, orchestratorThreadId: threadId },
    });
    return !reportFailure(
      threadId === null ? "Failed to remove orchestrator" : "Failed to set orchestrator",
      result,
    );
  };

  // A real thread, not a draft, so the project knows its orchestrator before the first message.
  const createOrchestrator = async (project: EnvironmentProject) => {
    const settings =
      appAtomRegistry.get(environmentServerConfigsAtom).get(project.environmentId)?.settings ??
      DEFAULT_SERVER_SETTINGS;
    const projectSettings = resolveProjectSettings(settings, project.id, project).settings;
    const providers =
      appAtomRegistry
        .get(environmentPresentations.providersByEnvironmentAtom)
        .get(project.environmentId) ?? [];
    const modelSelection = resolveDefaultProviderModelSelection(
      providers,
      projectSettings.defaultModelSelection,
    );
    if (modelSelection === null) {
      toastManager.add({
        type: "error",
        title: "Could not create orchestrator",
        description: "No provider is available on this environment.",
      });
      return;
    }
    const threadId = newThreadId();
    const created = await createThread({
      environmentId: project.environmentId,
      input: {
        threadId,
        projectId: project.id,
        title: "Orchestrator",
        modelSelection,
        runtimeMode: projectSettings.defaultRuntimeMode,
        interactionMode: "default",
        branch: null,
        worktreePath: null,
        createdAt: new Date().toISOString(),
      },
    });
    if (reportFailure("Could not create orchestrator", created)) return;
    if (
      !(await setOrchestrator(
        { environmentId: project.environmentId, projectId: project.id },
        threadId,
      ))
    )
      return;
    await router.navigate({
      to: "/$environmentId/$threadId",
      params: buildThreadRouteParams(scopeThreadRef(project.environmentId, threadId)),
    });
  };

  return { createOrchestrator, setOrchestrator };
}
