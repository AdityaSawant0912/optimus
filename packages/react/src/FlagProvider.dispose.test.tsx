import { render } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { FlagProvider } from "./FlagProvider";
import { boolFlag, createTestClient } from "./test-utils/setup";

describe("FlagProvider — client lifecycle is caller-owned", () => {
  it("never calls dispose() on unmount", async () => {
    const client = createTestClient([boolFlag({ key: "f" })]);
    await client.init();
    const disposeSpy = vi.spyOn(client, "dispose");

    const { unmount } = render(
      <FlagProvider client={client}>
        <div />
      </FlagProvider>,
    );
    unmount();

    expect(disposeSpy).not.toHaveBeenCalled();
  });
});
