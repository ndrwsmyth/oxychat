import { act, createElement } from "react";
import { createRoot, type Root } from "react-dom/client";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthTokenBridge } from "@/components/auth/AuthTokenBridge";
import { setAuthTokenGetter } from "@/lib/api";

const useAuthMock = vi.fn();

vi.mock("@clerk/nextjs", () => ({
  useAuth: () => useAuthMock(),
}));

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    setAuthTokenGetter: vi.fn(),
  };
});

// React 19 act() warning suppression in jsdom tests.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
(globalThis as any).IS_REACT_ACT_ENVIRONMENT = true;

describe("AuthTokenBridge direct-entry wiring", () => {
  let container: HTMLDivElement;
  let root: Root;

  beforeEach(() => {
    vi.clearAllMocks();
    container = document.createElement("div");
    document.body.appendChild(container);
    root = createRoot(container);
  });

  it("wires token getter when rendered at root without HomeContent mount", async () => {
    const getToken = vi.fn(async () => "token");
    useAuthMock.mockReturnValue({
      getToken,
      isLoaded: true,
    });

    await act(async () => {
      root.render(createElement(AuthTokenBridge));
    });

    expect(vi.mocked(setAuthTokenGetter)).toHaveBeenCalledWith(getToken);
  });
});
