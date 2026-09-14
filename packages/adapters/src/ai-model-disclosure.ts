import { createHash } from "node:crypto";
import type { AgentRunRequest } from "@rakazo/adapter-kit";
import { readBoundedJsonResponse } from "@rakazo/core";
import { aiRecipient } from "./ai-consent.js";

type ModelHost = { name: string; tag: string };
const cache = new Map<string, { expires: number; hosts: Promise<ModelHost[]> }>();

function openRouterHosts(modelId: string): Promise<ModelHost[]> {
  const cached = cache.get(modelId);
  if (cached && cached.expires > Date.now()) return cached.hosts;
  const hosts = loadOpenRouterHosts(modelId).catch((error) => {
    if (cache.get(modelId)?.hosts === hosts) cache.delete(modelId);
    throw error;
  });
  if (cache.size >= 200) cache.clear();
  cache.set(modelId, { expires: Date.now() + 5 * 60_000, hosts });
  return hosts;
}

/** Public routing metadata only: never sends prompts, credentials, or user identifiers. */
async function loadOpenRouterHosts(modelId: string): Promise<ModelHost[]> {
  const parts = modelId.split("/");
  if (parts.length !== 2 || parts.some((part) => !/^[a-zA-Z0-9._:-]+$/.test(part))) {
    throw new Error("Choose a specific model to review its AI data recipients.");
  }
  const signal = AbortSignal.timeout(5_000);
  const response = await fetch(
    `https://openrouter.ai/api/v1/models/${parts.map(encodeURIComponent).join("/")}/endpoints`,
    { signal, redirect: "error" },
  );
  if (!response.ok) throw new Error("Could not verify the model's data recipients. Try again.");
  const result = await readBoundedJsonResponse<{
    data?: { endpoints?: { provider_name?: unknown; tag?: unknown }[] };
  }>(response, 1024 * 1024, signal);
  const hosts = [
    ...new Map(
      (result.data?.endpoints ?? []).flatMap((endpoint) =>
        typeof endpoint.provider_name === "string" &&
        endpoint.provider_name.length <= 120 &&
        typeof endpoint.tag === "string" &&
        /^[a-zA-Z0-9/_:.-]{1,160}$/.test(endpoint.tag)
          ? [[endpoint.tag, { name: endpoint.provider_name, tag: endpoint.tag }] as const]
          : [],
      ),
    ).values(),
  ].sort((a, b) => a.tag.localeCompare(b.tag));
  if (!hosts.length)
    throw new Error("Could not verify the model's data recipients. Choose another model.");
  return hosts;
}

export async function aiModelDisclosure(
  model: Pick<AgentRunRequest["model"], "provider" | "id" | "baseUrl">,
) {
  const recipient = aiRecipient({
    provider: model.provider,
    modelId: model.id,
    baseUrl: model.baseUrl,
    use: "model",
  });
  if (!recipient) return { recipient, payloadFields: {} };
  if (model.provider === "vercel-ai-gateway") {
    throw new Error(
      "Use a direct model connection until this gateway's data recipients can be verified.",
    );
  }
  if (model.provider !== "openrouter") return { recipient, payloadFields: {} };
  const hosts = await openRouterHosts(model.id);
  const names = [...new Set(hosts.map((host) => host.name))];
  return {
    recipient: {
      ...recipient,
      key: createHash("sha256")
        .update(JSON.stringify([recipient.key, hosts]))
        .digest("hex"),
      detail: `${recipient.detail}. OpenRouter forwards your data to these model hosts: ${names.join(", ")}.`,
    },
    // Do not allow automatic routing to an undisclosed host or a training-enabled route.
    payloadFields: { provider: { only: hosts.map((host) => host.tag), data_collection: "deny" } },
  };
}
