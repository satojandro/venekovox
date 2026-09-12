import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { FieldNote, JourneySteps } from "../components/Experience";
import { ENS_CHAIN_ID, PROFILE_THEMES, type ProfileTheme } from "../ens/ensv2";
import { createInjectedNamingWallet, requestInjectedAccount } from "../ens/injectedNamingWallet";
import { NamingError, normalizeLabel } from "../ens/labels";
import { themeClassName } from "../ens/profile";
import {
  claimProfile,
  deployOwnedResolver,
  writeProfileRecords,
  type NamingConfig,
  type NamingContext,
  type NamingProvider,
} from "../ens/registration";
import { namingEnv, namingProvider, useNamedAccount } from "../ens/useNamedAccount";

const wallet = createInjectedNamingWallet();

const busyLabel: Record<string, string> = {
  connect: "Connecting wallet…",
  deployResolver: "Waiting for the resolver transaction…",
  claimProfile: "Waiting for the name registration…",
  writeRecords: "Waiting for profile records…",
};

export default function Names() {
  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState<bigint | undefined>();
  const [label, setLabel] = useState("");
  const [consent, setConsent] = useState(false);
  const [theme, setTheme] = useState<ProfileTheme>("lime");
  const [busyOp, setBusyOp] = useState("");
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
  const waiting = busyOp ? busyLabel[busyOp] || "Waiting for wallet…" : "";

  return (
    <main className="section-wrap journey-page narrow">
      <JourneySteps active={0} />
      <p className="eyebrow">01 / A PUBLIC NAME, NOT A PERSON</p>
      <h1>Name your account.</h1>
      <p>
        A name is a public label for this wallet. Anyone can link it to on-chain activity. It is not
        proof that you are a unique person, and it does not let you vote.
      </p>

      {!env.registrar ? (
        <div className="banner warn">
          Named accounts are not configured in this environment. You can still continue to eligibility.
          Voting does not require a name.
        </div>
      ) : (
        <div className="stack">
          {!account ? (
            <button
              className="action-primary"
              type="button"
              onClick={() =>
                run("connect", async () => {
                  setAccount(await requestInjectedAccount());
                })
              }
            >
              Connect wallet
            </button>
          ) : (
            <p className="mono">{account}</p>
          )}

          {wrongChain && (
            <div className="banner danger">Switch this wallet to Sepolia (chain 11155111) to continue.</div>
          )}
          {named.error && <div className="banner danger">{named.error}</div>}
          {message && <div className="banner danger">{humanNamingError(message)}</div>}
          {waiting && <p className="quiet-note">{waiting}</p>}

          {setup?.phase === "ready" && (
            <section className="ready-card">
              <p className="eyebrow">YOUR NAME</p>
              <p className={`ready-name ${themeClassName(setup.theme || theme)}`}>{setup.name}</p>
              <p>This name is ready. It still does not authorize a vote.</p>
              <label className="field" htmlFor="profile-theme">
                Profile theme
                <select
                  id="profile-theme"
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
              </label>
              <Link className="action-primary" to="/trust-ritual">
                Continue to eligibility
              </Link>
            </section>
          )}

          {setup?.phase === "incomplete" && (
            <section className="panel">
              <h2>Finish {setup.name}</h2>
              <p>
                This wallet already claimed a label. We will not register a second name. Remaining owner
                steps: {setup.nextOp === "deployResolver" ? "deploy the resolver, then write records." : "write the address and theme records."}
              </p>
              <button
                className="action-primary"
                type="button"
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
                Finish profile
              </button>
            </section>
          )}

          {setup?.phase === "none" && account && (
            <form
              className="panel stack"
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
              <label className="field" htmlFor="ens-label">
                Label
                <input
                  id="ens-label"
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  placeholder="your-label"
                  disabled={Boolean(busyOp) || wrongChain}
                  autoComplete="off"
                />
              </label>
              <p className="quiet-note">
                3–32 letters, numbers, or hyphens. This becomes{" "}
                <span className="mono">label.{named.config?.profileParent || "…"}</span>
              </p>
              <label className="consent">
                <input type="checkbox" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
                <span>I understand this name is public. Anyone can link it to this wallet’s on-chain activity.</span>
              </label>
              <button className="action-primary" type="submit" disabled={Boolean(busyOp) || !consent || wrongChain}>
                Claim this name
              </button>
            </form>
          )}
        </div>
      )}

      <FieldNote title="What happens in the wallet?">
        <p>
          Three owner steps, in order: deploy a resolver you control, register the label, then write the
          address and theme records. A prompt is not a mined receipt. If a step is rejected, we resume
          instead of registering twice.
        </p>
      </FieldNote>
      <p className="quiet-note">A name is optional. Voting contracts do not read ENS.</p>
      <Link className="text-link" to="/trust-ritual">
        Skip naming and continue to eligibility
      </Link>
    </main>
  );
}

function humanNamingError(code: string): string {
  if (code === "CONSENT_REQUIRED") return "Please confirm that you understand the name is public.";
  if (code === "WRONG_CHAIN") return "Switch this wallet to Sepolia to continue.";
  if (code === "WALLET_MISSING") return "Connect the same wallet you will use to vote.";
  if (code === "NOT_CONFIGURED") return "Named accounts are not configured here.";
  if (code === "LOOKUP_FAILED") return "We could not read the naming contracts. Check the network and try again.";
  if (code === "UNAVAILABLE") return "That label is not available. Try another.";
  if (code.includes("INVALID_LABEL")) return "Use 3–32 letters, numbers, or hyphens. Do not start or end with a hyphen.";
  return code;
}
