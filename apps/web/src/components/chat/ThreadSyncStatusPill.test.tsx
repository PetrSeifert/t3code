import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { ThreadSyncStatusPill } from "./ThreadSyncStatusPill";

describe("ThreadSyncStatusPill", () => {
  it.each([
    ["loading", "Loading messages..."],
    ["syncing", "Syncing messages..."],
  ] as const)("renders the %s message sync phase", (phase, label) => {
    const markup = renderToStaticMarkup(<ThreadSyncStatusPill phase={phase} />);

    expect(markup).toContain('role="status"');
    expect(markup).toContain('data-thread-sync-drawer="true"');
    expect(markup).toContain("chat-composer-drawer-surface");
    expect(markup).toContain("chat-composer-drawer-attached");
    expect(markup).toContain("chat-composer-drawer-slot");
    expect(markup).toContain("pb-[calc(var(--chat-composer-attachment-overlap)_+_0.375rem)]");
    expect(markup).toContain(label);
    expect(markup).not.toContain("animate-");
  });

  it("renders as a detached status when the composer owns the attachment seam", () => {
    const markup = renderToStaticMarkup(<ThreadSyncStatusPill attached={false} phase="syncing" />);

    expect(markup).toContain("alert-glass");
    expect(markup).toContain("mb-2");
    expect(markup).toContain("border-border/60");
    expect(markup).toContain("shadow-sm");
    expect(markup).not.toContain("chat-composer-drawer-attached");
    expect(markup).not.toContain("chat-composer-drawer-slot");
  });
});
