import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vite-plus/test";

import { HeaderFilterMenu } from "./HeaderFilterMenu";

describe("HeaderFilterMenu", () => {
  it("uses the shared button contract for its trigger", () => {
    const markup = renderToStaticMarkup(
      <HeaderFilterMenu
        label="Usage metric"
        value="cost"
        options={[
          { value: "cost", label: "Cost" },
          { value: "tokens", label: "Tokens" },
        ]}
        onChange={() => {}}
      />,
    );

    expect(markup).toContain('data-slot="menu-trigger"');
    expect(markup).toContain("focus-visible:ring-2");
    expect(markup).toContain('aria-label="Usage metric"');
    expect(markup).toContain("Cost");
  });

  it("renders nothing when there are no options", () => {
    const markup = renderToStaticMarkup(
      <HeaderFilterMenu label="Empty filter" value="none" options={[]} onChange={() => {}} />,
    );

    expect(markup).toBe("");
  });
});
