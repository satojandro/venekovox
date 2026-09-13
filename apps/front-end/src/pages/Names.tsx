import { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { FetchRequest, JsonRpcProvider } from "ethers";
import type { Eip1193Provider } from "ethers";
import { ENS_CHAIN_ID } from "../ens/pollName";
import { injectedNamingWallet } from "../ens/injectedNamingWallet";
import {
  NamingError,
  readNamingConfig,
  recoverProfile,
  registerName,
  type NamingConfig,
  type NamingWallet,
} from "../ens/registration";

const messages: Record<string, string> = {
  INVALID_LABEL: "Use 3–32 letters a–z, numbers or hyphens. Start and end with a letter or number.",
  INVALID_POLL_ID: "Enter the deployed poll’s numeric ID.",
  CONNECT_SEPOLIA: "Connect your wallet on Sepolia, then check again.",
  WRONG_CHAIN: "The connection must use Sepolia.",
  NAME_UNAVAILABLE: "That name is unavailable. Choose another name.",
  CONTEXT_CHANGED: "Your account or network changed. Check your original transaction before trying again.",
  OPERATOR_ONLY: "Only the configured administrator can publish poll names.",
  EXPIRED: "This naming deployment has expired. Contact the project administrator.",
  REGISTRATION_FAILED:
    "The transaction was rejected or could not be prepared. Check your account, name availability and gas balance.",
  TRANSACTION_REVERTED: "The transaction reverted. No name was registered by this transaction.",
  RECHECK_TRANSACTION: "We could not confirm the result. Check the transaction and use Check again before retrying.",
  CONFIRMATION_PENDING: "Confirmation is still pending. Check the transaction before retrying.",
};
function explain(error: unknown) {
  return (
    (error instanceof NamingError && messages[error.code]) ||
    "Naming could not be verified. Check the deployment configuration and connection, then try again."
  );
}

/** W1 can supply its actual account/execution adapter here without changing naming logic. */
export default function Names({ wallet: suppliedWallet }: { wallet?: NamingWallet & { connect?(): Promise<void> } }) {
  const wallet = useMemo(() => {
    if (suppliedWallet) return suppliedWallet;
    const ethereum = (window as unknown as { ethereum?: Eip1193Provider }).ethereum;
    return ethereum ? injectedNamingWallet(ethereum) : undefined;
  }, [suppliedWallet]);
  const [refresh, setRefresh] = useState(0),
    [config, setConfig] = useState<NamingConfig>();
  const [account, setAccount] = useState(""),
    [profile, setProfile] = useState<string | null>(null);
  const [label, setLabel] = useState(""),
    [pollLabel, setPollLabel] = useState(""),
    [pollId, setPollId] = useState("");
  const [consent, setConsent] = useState(false),
    [busy, setBusy] = useState(false),
    [loading, setLoading] = useState(true);
  const [error, setError] = useState(""),
    [published, setPublished] = useState("");
  const [broadcast, setBroadcast] = useState<{ hash: string; account: string }>();
  const generation = useRef(0),
    providerRef = useRef<JsonRpcProvider>();
  const active = useRef<AbortController>();
  const submitting = useRef(false);
  const registrar = import.meta.env.VITE_ENS_REGISTRAR as string | undefined;
  const maci = import.meta.env.VITE_MACI_ADDRESS as string | undefined;
  const rpc = import.meta.env.VITE_ENS_RPC_URL as string | undefined;

  useEffect(() => {
    if (!rpc) return;
    try {
      if (!["http:", "https:"].includes(new URL(rpc).protocol)) return;
      const request = new FetchRequest(rpc);
      request.timeout = 15000;
      const provider = new JsonRpcProvider(request);
      providerRef.current = provider;
      return () => {
        generation.current++;
        active.current?.abort();
        providerRef.current = undefined;
        provider.destroy();
      };
    } catch {
      return;
    }
  }, [rpc]);
  useEffect(
    () =>
      wallet?.subscribe(() => {
        generation.current++;
        active.current?.abort();
        setAccount("");
        setProfile(null);
        setConsent(false);
        setPublished("");
        setRefresh((x) => x + 1);
      }),
    [wallet],
  );
  useEffect(() => {
    const revision = ++generation.current;
    setConfig(undefined);
    setAccount("");
    setProfile(null);
    setError("");
    setLoading(true);
    const provider = providerRef.current;
    if (!provider || !registrar || !maci) {
      setLoading(false);
      return;
    }
    (async () => {
      const configuration = await readNamingConfig(provider, registrar, maci);
      const current = await wallet?.peek();
      const address = current?.kind === "found" && current.chainId === ENS_CHAIN_ID ? (current.account ?? "") : "";
      const restored = address ? await recoverProfile(provider, configuration, address) : null;
      if (revision !== generation.current) return;
      setConfig(configuration);
      setAccount(address);
      setProfile(restored);
      setLoading(false);
    })().catch((e) => {
      if (revision === generation.current) {
        setError(explain(e));
        setLoading(false);
      }
    });
    return () => {
      generation.current++;
    };
  }, [refresh, rpc, registrar, maci, wallet]);

  async function submit(isPoll: boolean) {
    if (!wallet || !providerRef.current || !registrar || !maci || submitting.current || (!isPoll && !consent)) return;
    submitting.current = true;
    const controller = new AbortController();
    active.current = controller;
    const revision = generation.current,
      originalAccount = account;
    setBusy(true);
    setError("");
    setPublished("");
    setBroadcast(undefined);
    try {
      const result = await registerName({
        provider: providerRef.current,
        wallet,
        registrar,
        allowedMaci: maci,
        label: isPoll ? pollLabel : label,
        pollId: isPoll ? pollId : undefined,
        signal: controller.signal,
        onBroadcast: (hash) => setBroadcast({ hash, account: originalAccount }),
      });
      if (revision === generation.current) {
        if (isPoll) setPublished(result.name);
        else setProfile(result.name);
      }
    } catch (e) {
      if (revision === generation.current) setError(explain(e));
    } finally {
      submitting.current = false;
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-black text-white px-6 py-12">
      <div className="max-w-3xl mx-auto space-y-8">
        <Link className="text-lime-300" to="/discover">
          ← Find a poll
        </Link>
        <header>
          <p className="text-lime-300">VENEKOVOX / SEPOLIA</p>
          <h1 className="text-4xl font-bold mt-4">Your name in VenekoVox</h1>
        </header>
        <p>
          Choose an optional public name for your account. You can participate without one; names do not grant voting
          eligibility.
        </p>
        {loading && <p role="status">Checking naming configuration and your account…</p>}
        {!loading && !config && !error && (
          <p>Naming registration is awaiting deployment configuration. Poll discovery is still available.</p>
        )}
        {config && (
          <>
            <p className="text-gray-300">
              Names link publicly to wallet addresses and their transaction history. Names in this deployment expire at
              Unix time {config.expiry.toString()}; parent names can expire sooner. Parent administrators retain
              control. Transfers, renaming and lost-wallet recovery are not provided here.
            </p>
            <p className="text-gray-300">
              {suppliedWallet
                ? "Transactions use the connected wallet adapter."
                : "This connection uses an injected wallet. You pay Sepolia gas; sponsored Privy claims are awaiting W1 integration."}
            </p>
            {!account ? (
              <button
                disabled={!wallet?.connect || busy}
                className="bg-lime-300 text-black rounded-lg px-5 py-3 disabled:opacity-50"
                onClick={async () => {
                  try {
                    await wallet?.connect?.();
                    setRefresh((x) => x + 1);
                  } catch (e) {
                    setError(explain(e));
                  }
                }}
              >
                {wallet ? "Connect on Sepolia" : "Open with an Ethereum wallet"}
              </button>
            ) : (
              <>
                <p className="break-all">Account: {account}</p>
                {profile ? (
                  <section className="border border-lime-300 rounded-xl p-6">
                    <h2 className="text-2xl break-all">{profile}</h2>
                    <p>Ownership and address resolution checked on Sepolia.</p>
                  </section>
                ) : (
                  <form
                    className="space-y-4 border border-gray-700 rounded-xl p-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit(false);
                    }}
                  >
                    <label className="block" htmlFor="profile-label">
                      Choose a name
                    </label>
                    <div className="flex flex-wrap gap-2 items-center">
                      <input
                        id="profile-label"
                        required
                        maxLength={32}
                        autoCapitalize="none"
                        spellCheck={false}
                        className="bg-gray-900 border border-gray-600 rounded-lg p-3"
                        disabled={busy}
                        value={label}
                        onChange={(e) => setLabel(e.target.value)}
                      />
                      <span>.{config.profileParent}</span>
                    </div>
                    <label className="flex gap-3">
                      <input
                        type="checkbox"
                        checked={consent}
                        disabled={busy}
                        onChange={(e) => setConsent(e.target.checked)}
                      />
                      I want this name publicly linked to my account.
                    </label>
                    <button
                      className="bg-lime-300 text-black rounded-lg px-5 py-3 disabled:opacity-50"
                      disabled={busy || !consent}
                    >
                      Claim name
                    </button>
                  </form>
                )}
                {account.toLowerCase() === config.operator.toLowerCase() && (
                  <form
                    className="space-y-4 border border-gray-700 rounded-xl p-6"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void submit(true);
                    }}
                  >
                    <h2 className="text-2xl">Name an existing poll</h2>
                    <p>
                      The registered MACI deployment supplies the poll address. Publishing a name does not create a
                      poll.
                    </p>
                    <label className="block" htmlFor="naming-poll-id">
                      Deployed poll ID
                    </label>
                    <input
                      id="naming-poll-id"
                      required
                      inputMode="numeric"
                      disabled={busy}
                      className="bg-gray-900 border border-gray-600 rounded-lg p-3"
                      value={pollId}
                      onChange={(e) => setPollId(e.target.value)}
                    />
                    <label className="block" htmlFor="naming-poll-label">
                      Poll name
                    </label>
                    <input
                      id="naming-poll-label"
                      required
                      maxLength={32}
                      autoCapitalize="none"
                      spellCheck={false}
                      disabled={busy}
                      className="bg-gray-900 border border-gray-600 rounded-lg p-3"
                      value={pollLabel}
                      onChange={(e) => setPollLabel(e.target.value)}
                    />
                    <span>.{config.pollParent}</span>
                    <button
                      className="block bg-lime-300 text-black rounded-lg px-5 py-3 disabled:opacity-50"
                      disabled={busy}
                    >
                      Publish poll name
                    </button>
                  </form>
                )}
              </>
            )}
          </>
        )}
        <div aria-live="polite">
          {busy && <p>Preparing or confirming your transaction. Keep this page open.</p>}
          {error && <p role="alert">{error}</p>}
        </div>
        {broadcast && (
          <p className="break-all">
            Transaction for {broadcast.account}:{" "}
            <a
              className="underline text-lime-300"
              href={"https://sepolia.etherscan.io/tx/" + broadcast.hash}
              target="_blank"
              rel="noreferrer"
            >
              {broadcast.hash}
            </a>
            . A transaction link alone does not confirm registration.
          </p>
        )}
        {published && (
          <Link className="text-lime-300 underline" to={"/p/" + encodeURIComponent(published)}>
            Open {published}
          </Link>
        )}
        <button
          disabled={busy || loading}
          className="underline disabled:opacity-50"
          onClick={() => setRefresh((x) => x + 1)}
        >
          Check again
        </button>
      </div>
    </main>
  );
}
