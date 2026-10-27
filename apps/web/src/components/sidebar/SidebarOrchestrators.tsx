import type {
  EnvironmentProject,
  EnvironmentThreadShell,
} from "@t3tools/client-runtime/state/models";
import { PlusIcon } from "lucide-react";
import {
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
} from "react";

import { cn } from "~/lib/utils";
import { useUiStateStore } from "../../uiStateStore";
import { ProjectFavicon } from "../ProjectFavicon";
import { SidebarHeaderIconButton } from "./SidebarThreadHeader";
import { type SidebarOrchestrator, sidebarOrchestratorStatusLabel } from "./orchestrators.logic";

export type SidebarOrchestratorEntry = SidebarOrchestrator<
  EnvironmentProject,
  EnvironmentThreadShell
>;

const MIN_LIST_HEIGHT = 44;
const KEYBOARD_STEP = 16;

function maxListHeight(): number {
  return Math.max(MIN_LIST_HEIGHT, Math.round(window.innerHeight * 0.6));
}

function clampListHeight(height: number): number {
  return Math.min(maxListHeight(), Math.max(MIN_LIST_HEIGHT, Math.round(height)));
}

export function SidebarOrchestrators(props: {
  readonly orchestrators: ReadonlyArray<SidebarOrchestratorEntry>;
  readonly projectDisplayNameByKey: ReadonlyMap<string, string>;
  readonly activeKey: string | null;
  readonly canCreate: boolean;
  readonly onCreate: () => void;
  readonly onSelect: (orchestrator: SidebarOrchestratorEntry) => void;
  readonly onContextMenu: (
    orchestrator: SidebarOrchestratorEntry,
    position: { x: number; y: number },
  ) => void;
}) {
  const storedHeight = useUiStateStore((store) => store.sidebarOrchestratorsHeight);
  const setStoredHeight = useUiStateStore((store) => store.setSidebarOrchestratorsHeight);
  // The drag height stays local so a drag re-renders this section, not the sidebar.
  const [dragHeight, setDragHeight] = useState<number | null>(null);
  const listRef = useRef<HTMLUListElement | null>(null);
  const dragRef = useRef<{ pointerId: number; startY: number; startHeight: number } | null>(null);
  const height = dragHeight ?? storedHeight;

  const startDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.button !== 0 || listRef.current === null) return;
    event.preventDefault();
    event.currentTarget.setPointerCapture(event.pointerId);
    const startHeight = listRef.current.getBoundingClientRect().height;
    dragRef.current = { pointerId: event.pointerId, startY: event.clientY, startHeight };
    setDragHeight(clampListHeight(startHeight));
  };
  const moveDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    setDragHeight(clampListHeight(drag.startHeight + event.clientY - drag.startY));
  };
  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current;
    if (drag === null || drag.pointerId !== event.pointerId) return;
    dragRef.current = null;
    if (dragHeight !== null) setStoredHeight(dragHeight);
    setDragHeight(null);
  };
  const resizeWithKeyboard = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key !== "ArrowUp" && event.key !== "ArrowDown") return;
    event.preventDefault();
    const current = height ?? listRef.current?.getBoundingClientRect().height ?? MIN_LIST_HEIGHT;
    setStoredHeight(
      clampListHeight(current + (event.key === "ArrowDown" ? KEYBOARD_STEP : -KEYBOARD_STEP)),
    );
  };

  return (
    <section aria-label="Orchestrators" className="flex flex-col pt-1">
      <div className="flex h-7 items-center gap-2 ps-2 pe-0.5 text-xs font-medium text-sidebar-muted-foreground">
        <span className="min-w-0 flex-1 truncate">Orchestrators</span>
        <SidebarHeaderIconButton
          label="New orchestrator"
          disabled={!props.canCreate}
          onClick={props.onCreate}
        >
          <PlusIcon />
        </SidebarHeaderIconButton>
      </div>
      {props.orchestrators.length > 0 ? (
        <>
          <ul
            ref={listRef}
            className={cn(
              "flex flex-col gap-px overflow-y-auto",
              height === null && "max-h-[40vh]",
            )}
            style={height === null ? undefined : { height }}
          >
            {props.orchestrators.map((orchestrator) => {
              const projectKey = `${orchestrator.project.environmentId}:${orchestrator.project.id}`;
              const name =
                props.projectDisplayNameByKey.get(projectKey) ?? orchestrator.project.title;
              const isActive = props.activeKey === orchestrator.key;
              return (
                <li key={orchestrator.key} className="list-none">
                  <button
                    type="button"
                    aria-current={isActive ? "page" : undefined}
                    onClick={() => props.onSelect(orchestrator)}
                    onContextMenu={(event) => {
                      event.preventDefault();
                      props.onContextMenu(orchestrator, { x: event.clientX, y: event.clientY });
                    }}
                    className={cn(
                      "flex w-full cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring/70",
                      isActive
                        ? "bg-sidebar-row-active text-sidebar-foreground"
                        : "text-sidebar-foreground hover:bg-sidebar-row-hover",
                    )}
                  >
                    <ProjectFavicon project={orchestrator.project} className="size-4 shrink-0" />
                    <span className="flex min-w-0 flex-1 flex-col">
                      <span className="truncate text-sm">{name}</span>
                      <span
                        className={cn(
                          "truncate text-2xs",
                          orchestrator.status.kind === "needs-you"
                            ? "text-warning-foreground"
                            : "text-sidebar-muted-foreground",
                        )}
                      >
                        {sidebarOrchestratorStatusLabel(orchestrator.status)}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
          <div
            role="separator"
            aria-orientation="horizontal"
            aria-label="Resize Orchestrators"
            tabIndex={0}
            className="group flex h-3 shrink-0 cursor-row-resize touch-none items-center px-2 focus-visible:outline-none"
            onPointerDown={startDrag}
            onPointerMove={moveDrag}
            onPointerUp={endDrag}
            onPointerCancel={endDrag}
            onDoubleClick={() => setStoredHeight(null)}
            onKeyDown={resizeWithKeyboard}
          >
            <span
              aria-hidden
              className="h-px flex-1 bg-sidebar-border transition-colors group-hover:bg-sidebar-foreground/40 group-focus-visible:bg-ring group-active:bg-primary/60"
            />
          </div>
        </>
      ) : (
        <div aria-hidden className="mx-2 mb-1 h-px bg-sidebar-border" />
      )}
    </section>
  );
}
