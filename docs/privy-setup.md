# Privy setup for the frontend round

Reviewed against official Privy documentation on 2026-09-08. Dashboard labels may
vary by app configuration. This checklist is preparation, not evidence that our SDK,
smart-account execution or gas sponsorship is connected.

## Alejandro: dashboard preparation

1. Select the VenekoVox development app in the [Privy dashboard](https://dashboard.privy.io/).
   Keep the public app ID available for local configuration. Keep the app secret private;
   never paste it into chat or a `VITE_*` variable. Our main branch currently has no
   mounted provider or consumed Privy env variable; a public ID alone will not activate it.
2. Under **UI components → Branding**, set the display name to **VenekoVox** and provide
   a publicly hosted PNG logo URL. Privy recommends 180 × 90 pixels, aspect ratio 2:1;
   SVG is not supported for dashboard logos. This branding also appears in login email.
   [Official appearance guide](https://docs.privy.io/basics/get-started/dashboard/configuring-appearance).
3. Under **Login Methods / Authentication**, enable the desired methods. Proposed first
   round: email plus external Ethereum wallet; optionally Google for convenience. At
   least one method is required. Enable only methods the UI exposes. If using custom
   OAuth credentials, configure them privately with the provider; we do not need OAuth
   access/refresh tokens or extra scopes for polling.
   [Official login-method guide](https://docs.privy.io/basics/get-started/dashboard/configure-login-methods).
4. For production, use **Configuration → App settings → Domains → Web & mobile web**
   and list exact HTTPS origins, without paths. Include both www/apex only if both are
   served. Keep local development separate; localhost entries require explicit ports
   (our Vite default is `http://localhost:3000`, current preview `http://127.0.0.1:3000`).
   Do not allow a generic hosting wildcard. Remove temporary local origins from the
   production app after testing.
   [Official allowed-URL guide](https://docs.privy.io/recipes/dashboard/allowed-domains).
5. Wallet creation, smart-account choice and sponsorship need a coordinated SDK/backend
   setup. Do not enable a broad gas policy to make the button work. We must first pin
   the actual account model and verify MACI signup/join/publish compatibility. Prepare
   Sepolia-only sponsorship with explicit contract/method/spend/rate limits when that
   adapter is ready; credentials stay server-side. The exact dashboard/provider settings
   depend on that choice and remain a W1 handoff, not a settled product default.
   [Official smart-wallet setup](https://docs.privy.io/wallets/using-wallets/evm-smart-wallets/setup/configuring-sdk).
6. Before the real round, privately test login email delivery and a returning session.
   Choose an additional recovery method / MFA as appropriate. Neither wallet recovery
   nor a second login method restores an independent lost MACI voting key.
   [Official login-method guidance](https://docs.privy.io/basics/get-started/dashboard/configure-login-methods).

## Astra / implementation: customization in code

These are provider settings, not additional dashboard tasks:

- Dark theme and lime accent to match ENS pages.
- Suggested modal header: `Welcome to VenekoVox`.
- Suggested message: `Log in to prepare your account. Identity verification is a separate step.`
- Email/social methods before external wallet where supported by the pinned SDK.
- Configure logo override only if modal branding should differ from email branding.
- Pin/review the SDK and use its supported appearance, wallet-creation and chain APIs;
  restore intended poll after login, show provider loading/cancel/error/expired states.

Privy documents header/message/theme/login-order overrides on the provider; the
[appearance reference](https://docs.privy.io/basics/get-started/dashboard/configuring-appearance)
separates these from dashboard name/logo fields.

Admin permissions are a VenekoVox backend/contract concern. A Privy login is not an
admin role, ENS ownership, verified-human status or permission to issue eligibility.
No dashboard setting replaces those checks. No Privy dashboard was changed this turn.
