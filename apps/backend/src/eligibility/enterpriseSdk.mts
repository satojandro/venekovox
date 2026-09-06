import { SelfClient, SelfWebhooks } from "@selfxyz/enterprise-sdk";
import type { EnterpriseTransport } from "./enterprise.js";

/** Native ESM boundary for enterprise-sdk@0.4.1. Do not transpile to require(). */
export function enterpriseTransport(
  apiKey: string,
  webhookSecret: string,
  environment: "test" | "live",
): EnterpriseTransport {
  if (!apiKey.startsWith(`sk_${environment}_`) || !webhookSecret.startsWith("whsec_"))
    throw new Error("ENTERPRISE_CREDENTIAL_ENVIRONMENT");
  const client = new SelfClient({ apiKey });
  return {
    createSession: (input) => client.sessions.create(input),
    verifyWebhook: (raw, headers) => SelfWebhooks.verify(raw, headers, webhookSecret),
  };
}
