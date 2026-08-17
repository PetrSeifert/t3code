import {
  WS_METHODS,
  type EnvironmentId,
  type SourceControlPublishRepositoryInput,
  type SourceControlPublishRepositoryResult,
  type SourceControlSshPasswordPromptRequest,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import { Atom } from "effect/unstable/reactivity";

import {
  createAtomCommandScheduler,
  createEnvironmentRpcCommand,
  createEnvironmentRpcQueryAtomFamily,
  createRuntimeCommand,
  runInEnvironment,
} from "./runtime.ts";
import type { EnvironmentRegistry } from "../connection/registry.ts";
import { EnvironmentCacheStore } from "../platform/persistence.ts";
import {
  config as environmentConfig,
  EnvironmentRpcUnavailableError,
  request,
  runStream,
} from "../rpc/client.ts";
import { vcsCommandConcurrency, vcsCommandScheduler } from "./vcsCommandScheduler.ts";
import { invalidateCachedVcsRefs } from "./vcsRefInvalidation.ts";

export function createSourceControlEnvironmentAtoms<R, E>(
  runtime: Atom.AtomRuntime<EnvironmentRegistry | EnvironmentCacheStore | R, E>,
) {
  const commandScheduler = createAtomCommandScheduler();
  return {
    discovery: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:server:source-control-discovery",
      tag: WS_METHODS.serverDiscoverSourceControl,
    }),
    repository: createEnvironmentRpcQueryAtomFamily(runtime, {
      label: "environment-data:source-control:repository",
      tag: WS_METHODS.sourceControlLookupRepository,
    }),
    cloneRepository: createEnvironmentRpcCommand(runtime, {
      label: "environment-data:source-control:clone-repository",
      tag: WS_METHODS.sourceControlCloneRepository,
      scheduler: commandScheduler,
      concurrency: {
        mode: "serial",
        key: ({ environmentId }) => environmentId,
      },
    }),
    publishRepository: createRuntimeCommand(runtime, {
      label: "environment-data:source-control:publish-repository",
      scheduler: vcsCommandScheduler,
      concurrency: vcsCommandConcurrency,
      execute: (
        target: {
          readonly environmentId: EnvironmentId;
          readonly input: SourceControlPublishRepositoryInput;
          readonly onSshPasswordPrompt?: (
            request: SourceControlSshPasswordPromptRequest,
          ) => Promise<string | null>;
        },
        registry,
      ) =>
        runInEnvironment(
          target.environmentId,
          Effect.gen(function* () {
            const onSshPasswordPrompt = target.onSshPasswordPrompt;
            if (onSshPasswordPrompt === undefined) {
              return yield* request(WS_METHODS.sourceControlPublishRepository, target.input);
            }

            const serverConfig = yield* environmentConfig;
            if (serverConfig.environment.capabilities.sourceControlSshPasswordPrompts !== true) {
              return yield* request(WS_METHODS.sourceControlPublishRepository, target.input);
            }

            const result = yield* runStream(
              WS_METHODS.sourceControlPublishRepositoryWithPrompts,
              target.input,
            ).pipe(
              Stream.mapEffect((event) => {
                if (event._tag === "complete") {
                  return Effect.succeed(event.result);
                }
                return Effect.tryPromise({
                  try: () => onSshPasswordPrompt(event.request),
                  catch: () => null,
                }).pipe(
                  Effect.orElseSucceed(() => null),
                  Effect.flatMap((password) =>
                    request(WS_METHODS.sourceControlResolveSshPasswordPrompt, {
                      requestId: event.request.requestId,
                      password,
                    }),
                  ),
                  Effect.forkChild({ startImmediately: true }),
                  Effect.as(null),
                );
              }),
              Stream.runFold(
                () => null as SourceControlPublishRepositoryResult | null,
                (current, next) => next ?? current,
              ),
            );
            if (result === null) {
              return yield* new EnvironmentRpcUnavailableError({
                environmentId: target.environmentId,
                message: "Repository publishing ended before the server returned a result.",
              });
            }
            return result;
          }),
        ).pipe(
          Effect.ensuring(
            invalidateCachedVcsRefs(registry, {
              environmentId: target.environmentId,
              cwd: target.input.cwd,
            }),
          ),
        ),
    }),
  };
}
