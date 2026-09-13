// @vitest-environment jsdom
import React from "react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createRoot, type Root } from "react-dom/client";
import { act } from "react-dom/test-utils";
import { MemoryRouter } from "react-router-dom";
import Names from "../../src/pages/Names";
import { readNamingConfig, recoverProfile, registerName } from "../../src/ens/registration";

vi.mock("../../src/ens/registration", async () => {
  const actual = await vi.importActual<object>("../../src/ens/registration");
  return { ...actual, readNamingConfig: vi.fn(), recoverProfile: vi.fn(), registerName: vi.fn() };
});

const accountA = "0x1111111111111111111111111111111111111111";
const accountB = "0x2222222222222222222222222222222222222222";
const config = {
  registrar: accountB,
  profileParent: "people.example.eth",
  pollParent: "polls.example.eth",
  operator: accountB,
  maci: accountB,
  expiry: 2000000000n,
};
let host: HTMLDivElement, root: Root;
beforeEach(() => {
  vi.stubEnv("VITE_ENS_RPC_URL", "http://localhost:8545");
  vi.stubEnv("VITE_ENS_REGISTRAR", accountB);
  vi.stubEnv("VITE_MACI_ADDRESS", accountB);
  vi.mocked(readNamingConfig).mockResolvedValue(config);
  vi.mocked(recoverProfile).mockResolvedValue(null);
  host = document.createElement("div");
  document.body.append(host);
  root = createRoot(host);
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
});
afterEach(async () => {
  await act(async () => root.unmount());
  host.remove();
  vi.resetAllMocks();
  vi.unstubAllEnvs();
});
function wallet() {
  let account = accountA;
  const listeners = new Set<() => void>();
  return {
    peek: vi.fn(async () => ({ kind: "found", account, chainId: 11155111n })),
    send: vi.fn(),
    connect: vi.fn(),
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
    switchAccount: () => {
      account = accountB;
      for (const listener of listeners) listener();
    },
  };
}
async function render(w: ReturnType<typeof wallet>) {
  await act(async () =>
    root.render(
      <MemoryRouter>
        <Names wallet={w} />
      </MemoryRouter>,
    ),
  );
}
describe("Naming UI context and submission guards", () => {
  it("discards an old account's delayed recovery after switching wallets", async () => {
    let resolveOld!: (value: string) => void;
    vi.mocked(recoverProfile).mockImplementation(async (_provider, _config, account) =>
      account === accountA
        ? new Promise((resolve) => {
            resolveOld = resolve;
          })
        : null,
    );
    const w = wallet();
    await render(w);
    await act(async () => w.switchAccount());
    await act(async () => resolveOld("alice.people.example.eth"));
    expect(host.textContent).toContain(accountB);
    expect(host.textContent).not.toContain("alice.people.example.eth");
    expect(w.send).not.toHaveBeenCalled();
  });
  it("requires public-link consent and blocks same-tick duplicate submissions", async () => {
    let finish!: (result: { name: string; transactionHash: string; account: string }) => void;
    vi.mocked(registerName).mockImplementation(
      () =>
        new Promise((resolve) => {
          finish = resolve;
        }),
    );
    const w = wallet();
    await render(w);
    const form = host.querySelector("form")!;
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(registerName).not.toHaveBeenCalled();
    await act(async () => (host.querySelector('input[type="checkbox"]') as HTMLInputElement).click());
    await act(async () => {
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
      form.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));
    });
    expect(registerName).toHaveBeenCalledTimes(1);
    const signal = vi.mocked(registerName).mock.calls[0][0].signal!;
    await act(async () => w.switchAccount());
    expect(signal.aborted).toBe(true);
    await act(async () => finish({ name: "alice.people.example.eth", transactionHash: "0x123", account: accountA }));
    expect(host.textContent).not.toContain("alice.people.example.eth");
  });
  it("missing deployment leaves discovery usable without prompting a wallet", async () => {
    vi.stubEnv("VITE_ENS_REGISTRAR", "");
    const w = wallet();
    await render(w);
    expect(host.textContent).toContain("awaiting deployment configuration");
    expect(host.querySelector('a[href="/discover"]')).not.toBeNull();
    expect(w.connect).not.toHaveBeenCalled();
    expect(registerName).not.toHaveBeenCalled();
  });
});
