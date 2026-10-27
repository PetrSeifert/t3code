import { assert, it } from "@effect/vitest";
import {
  type ApplicationProjectEvent,
  EventId,
  ProjectId,
  ProviderInstanceId,
  ThreadId,
} from "@t3tools/contracts";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as SqlClient from "effect/sql/SqlClient";

import * as SqlitePersistence from "../persistence/Sqlite.ts";
import * as ProjectStore from "./ProjectStore.ts";

it.layer(ProjectStore.layer.pipe(Layer.provideMerge(SqlitePersistence.layerMemory)))(
  "ProjectStoreV2",
  (it) => {
    it.effect("stores a model selection without options as JSON without an options key", () =>
      Effect.gen(function* () {
        const projects = yield* ProjectStore.ProjectStoreV2;
        const sql = yield* SqlClient.SqlClient;
        const projectId = ProjectId.make("project-null-options");
        const modelSelection = { instanceId: ProviderInstanceId.make("codex"), model: "gpt-5.4" };
        yield* projects.apply({
          sequence: 1,
          eventId: EventId.make("event-null-options"),
          aggregateKind: "project",
          aggregateId: projectId,
          occurredAt: "2026-03-24T00:00:00.000Z",
          commandId: null,
          causationEventId: null,
          correlationId: null,
          metadata: {},
          type: "project.created",
          payload: {
            projectId,
            title: "Null options project",
            workspaceRoot: "/tmp/project-null-options",
            defaultModelSelection: modelSelection,
            scripts: [],
            createdAt: "2026-03-24T00:00:00.000Z",
            updatedAt: "2026-03-24T00:00:00.000Z",
          },
        });

        const rows = yield* sql<{ readonly defaultModelSelection: string | null }>`
          SELECT default_model_selection_json AS "defaultModelSelection"
          FROM projection_projects
          WHERE project_id = ${projectId}
        `;
        assert.strictEqual(rows[0]?.defaultModelSelection, JSON.stringify(modelSelection));
        assert.deepStrictEqual(
          Option.getOrNull(yield* projects.get(projectId))?.defaultModelSelection,
          modelSelection,
        );
      }),
    );

    it.effect("rebuilds the orchestrator thread from replayed project events", () =>
      Effect.gen(function* () {
        const projects = yield* ProjectStore.ProjectStoreV2;
        const sql = yield* SqlClient.SqlClient;
        const projectId = ProjectId.make("project-orchestrator-replay");
        const orchestratorThreadId = ThreadId.make("thread-orchestrator-replay");
        const base = {
          aggregateKind: "project",
          aggregateId: projectId,
          occurredAt: "2026-03-24T00:00:00.000Z",
          commandId: null,
          causationEventId: null,
          correlationId: null,
          metadata: {},
        } as const;
        const events: ReadonlyArray<ApplicationProjectEvent> = [
          {
            ...base,
            sequence: 1,
            eventId: EventId.make("event-orchestrator-created"),
            type: "project.created",
            payload: {
              projectId,
              title: "Orchestrated",
              workspaceRoot: "/tmp/project-orchestrator-replay",
              defaultModelSelection: null,
              scripts: [],
              createdAt: base.occurredAt,
              updatedAt: base.occurredAt,
            },
          },
          {
            ...base,
            sequence: 2,
            eventId: EventId.make("event-orchestrator-set"),
            type: "project.meta-updated",
            payload: { projectId, orchestratorThreadId, updatedAt: base.occurredAt },
          },
          {
            ...base,
            sequence: 3,
            eventId: EventId.make("event-orchestrator-renamed"),
            type: "project.meta-updated",
            payload: { projectId, title: "Renamed", updatedAt: base.occurredAt },
          },
        ];
        const replay = Effect.forEach(events, projects.apply, { discard: true });

        yield* replay;
        const before = Option.getOrThrow(yield* projects.get(projectId));
        assert.strictEqual(before.orchestratorThreadId, orchestratorThreadId);
        yield* sql`DELETE FROM projection_projects WHERE project_id = ${projectId}`;
        yield* replay;
        assert.deepStrictEqual(Option.getOrThrow(yield* projects.get(projectId)), before);
        assert.strictEqual(
          Option.getOrThrow(yield* projects.getShell(projectId)).orchestratorThreadId,
          orchestratorThreadId,
        );
      }),
    );
  },
);
