/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SELF_SCOPE?: string;
  readonly VITE_SELF_ENDPOINT?: string;
  readonly VITE_MACI_ADDRESS?: string;
  readonly VITE_POLL_ID?: string;
  readonly VITE_CHAIN_ID?: string;
  readonly VITE_MACI_START_BLOCK?: string;
  readonly VITE_WALLET_SOURCE?: string;
  readonly VITE_W1_BACKEND_URL?: string;
  readonly VITE_W1_PROBE_ADDRESS?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
