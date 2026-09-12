import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ENS_CHAIN_ID, PROFILE_THEMES, type ProfileTheme } from "../ens/ensv2";
import { themeClassName } from "../ens/profile";
import {
  claimProfile,
  deployOwnedResolver,
  writeProfileRecords,
  type NamingConfig,
  type NamingContext,
  type NamingProvider,
} from "../ens/registration";
import { NamingError, normalizeLabel } from "../ens/labels";
import { createInjectedNamingWallet, requestInjectedAccount } from "../ens/injectedNamingWallet";
import { namingEnv, namingProvider, useNamedAccount } from "../ens/useNamedAccount";

const wallet = createInjectedNamingWallet();

const copy = {
  title: "Name your account",
  intro:
    "A name is a public label for this wallet. It is not proof that you are a unique person, and it does not let you vote. Eligibility still uses ZKPassport.",
  consent: "I understand this name is public. Anyone can link it to this wallet’s on-chain activity.",
  connect: "Connect wallet",
  placeholder: "your-label",
  claim: "Claim this name",
  finish: "Finish profile",
  ready: "This name is ready. It still does not authorize a vote.",
  eligibility: "Prove eligibility (separate step)",
  polls: "Back to polls",
  wrongChain: "Switch this wallet to Sepolia (chain 11155111) to continue.",
  unconfigured: "Named accounts are not configured in this environment. Voting still works without a name.",
  theme: "Profile theme",
  linkage: "Public linkage",
};

export default function Names() {
  const [account, setAccount] = useState<string>("");
  const [chainId, setChainId] = useState<bigint | undefined>();
  const [label, setLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [theme, setTheme] = useState<ProfileTheme>("lime");
  const [busyOp, setBusyOp] = useState<string>("");
  const [message, setMessage] = useState("");
  const named = useNamedAccount(account);
  const env = namingEnv();

  useEffect(() => {
    const sync = async () => {
      const peek = await wallet.peek();
      setAccount(peek.account || "");
      setChainId(peek.chainId);
    };
    sync();
    return wallet.subscribe(() => {
      void sync();
    });
  }, []);

  const context: NamingContext | null = useMemo(() => {
    if (!account || chainId === undefined) return null;
    return { account, chainId };
  }, [account, chainId]);

  async function run(op: string, fn: () => Promise<unknown>) {
    if (busyOp) return;
    setBusyOp(op);
    setMessage("");
    try {
      await fn();
      named.reload();
    } catch (err) {
      setMessage(err instanceof NamingError || err instanceof Error ? err.message : "LOOKUP_FAILED");
    } finally {
      setBusyOp("");
    }
  }

  async function withProvider(
    fn: (provider: NamingProvider, config: NamingConfig, ctx: NamingContext) => Promise<unknown>,
  ) {
    if (!context) throw new NamingError("WALLET_MISSING");
    if (context.chainId !== ENS_CHAIN_ID) throw new NamingError("WRONG_CHAIN");
    if (!named.config) throw new NamingError("NOT_CONFIGURED");
    const provider = namingProvider();
    if (!provider) throw new NamingError("LOOKUP_FAILED");
    await fn(provider, named.config, context);
  }

  const setup = named.setup;
  const wrongChain = Boolean(account && chainId !== undefined && chainId !== ENS_CHAIN_ID);

  return (
    <div className="min-h-screen bg-gray-900 text-gray-200 px-4 py-8">
      <div className="max-w-xl mx-auto">
        <Link to="/polls" className="text-lime-300 underline text-sm">
          {copy.polls}
        </Link>
        <h1 className="text-3xl font-bold text-white mt-4 mb-3">{copy.title}</h1>
        <p className="text-sm text-gray-400 mb-6">{copy.intro}</p>

        {!env.registrar ? (
          <p className="text-amber-200">{copy.unconfigured}</p>
        ) : (
          <>
            {!account ? (
              <button
                className="bg-blue-600 hover:bg-blue-500 text-white font-semibold py-2 px-4 rounded-lg"
                onClick={() =>
                  run("connect", async () => {
                    setAccount(await requestInjectedAccount());
                  })
                }
              >
                {copy.connect}
              </button>
            ) : (
              <p className="font-mono text-sm text-blue-300 mb-4">{account}</p>
            )}

            {wrongChain && <p className="text-rose-300 mb-4">{copy.wrongChain}</p>}
            {named.error && <p className="text-rose-300 mb-4">{named.error}</p>}
            {message && <p className="text-rose-300 mb-4">{message}</p>}

            {setup?.phase === "ready" && (
              <div className="border border-lime-700 rounded-lg p-4 mb-4">
                <p className={`text-xl font-semibold ${themeClassName(setup.theme || theme)}`}>{setup.name}</p>
                <p className="text-sm text-gray-400 mt-2">{copy.ready}</p>
                <label className="block text-sm mt-4 mb-1">{copy.theme}</label>
                <select
                  className="bg-gray-800 border border-gray-600 rounded px-3 py-2"
                  value={(setup.theme || theme) as ProfileTheme}
                  disabled={Boolean(busyOp)}
                  onChange={(e) => {
                    const next = e.target.value as ProfileTheme;
                    setTheme(next);
                    void run("writeRecords", () =>
                      withProvider((provider, config, ctx) => writeProfileRecords(wallet, provider, config, ctx, next)),
                    );
                  }}
                >
                  {PROFILE_THEMES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {setup?.phase === "incomplete" && (
              <div className="border border-amber-700 rounded-lg p-4 mb-4">
                <p className="text-amber-200 font-semibold">Finish {setup.name}</p>
                <p className="text-sm text-gray-400 mt-2">
                  This wallet already claimed a label. We will not register a second name. Remaining owner steps: deploy
                  the resolver if needed, then write the address and theme records.
                </p>
                <button
                  className="mt-4 bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg"
                  disabled={Boolean(busyOp) || wrongChain}
                  onClick={() =>
                    run(setup.nextOp || "writeRecords", async () => {
                      await withProvider(async (provider, config, ctx) => {
                        if (setup.nextOp === "deployResolver") {
                          await deployOwnedResolver(wallet, provider, config, ctx);
                        }
                        await writeProfileRecords(wallet, provider, config, ctx, theme);
                      });
                    })
                  }
                >
                  {busyOp ? "Waiting for wallet…" : copy.finish}
                </button>
              </div>
            )}

            {setup?.phase === "none" && account && (
              <form
                className="border border-gray-700 rounded-lg p-4"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!consent) {
                    setMessage("CONSENT_REQUIRED");
                    return;
                  }
                  try {
                    normalizeLabel(label);
                  } catch (err) {
                    setMessage(err instanceof Error ? err.message : "INVALID_LABEL");
                    return;
                  }
                  void run("claimProfile", () =>
                    withProvider((provider, config, ctx) => claimProfile(wallet, provider, config, ctx, label)),
                  );
                }}
              >
                <label className="block text-sm mb-1">Label</label>
                <input
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder={copy.placeholder}
                  className="w-full bg-gray-800 border border-gray-600 rounded px-3 py-2 mb-3"
                  disabled={Boolean(busyOp) || wrongChain}
                />
                <p className="text-xs text-gray-500 mb-3">
                  3–32 letters, numbers, or hyphens. This becomes{" "}
                  <span className="font-mono">label.{named.config?.profileParent || "…"}</span>
                </p>
                <label className="flex items-start gap-2 text-sm mb-4">
                  <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                  <span>{copy.consent}</span>
                </label>
                <button
                  type="submit"
                  className="bg-blue-600 hover:bg-blue-500 disabled:opacity-50 text-white font-semibold py-2 px-4 rounded-lg"
                  disabled={Boolean(busyOp) || !consent || wrongChain}
                >
                  {busyOp ? "Waiting for wallet…" : copy.claim}
                </button>
              </form>
            )}

            <p className="text-xs text-gray-500 mt-6">
              {copy.linkage}: a name is optional. Voting contracts do not read ENS.
            </p>
          </>
        )}
        <Link to="/trust-ritual" className="inline-block mt-6 text-lime-300 underline">
          {copy.eligibility}
        </Link>
      </div>
    </div>
  );
}
