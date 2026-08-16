import { LoaderCircleIcon } from "lucide-react";

import { threadSyncLabel, type ThreadSyncPhase } from "../../threadSync";
import { cn } from "~/lib/utils";

export function ThreadSyncStatusPill({
  attached = true,
  phase,
}: {
  readonly attached?: boolean;
  readonly phase: ThreadSyncPhase;
}) {
  const label = threadSyncLabel(phase);

  return (
    <div
      aria-label={label}
      className={cn(
        "pointer-events-none flex max-w-[calc(48rem-2.75rem)] items-center gap-2 px-3 text-foreground text-xs font-medium",
        attached
          ? "chat-composer-drawer-surface chat-composer-drawer-attached chat-composer-drawer-slot pt-2 pb-[calc(var(--chat-composer-attachment-overlap)_+_0.375rem)]"
          : "alert-glass mx-auto mb-2 w-[calc(100%-2.75rem)] rounded-[22px] border border-border/60 py-2 shadow-sm",
      )}
      data-thread-sync-drawer="true"
      role="status"
    >
      <LoaderCircleIcon aria-hidden className="size-3.5 shrink-0 text-muted-foreground" />
      <span className="truncate">{label}</span>
    </div>
  );
}
