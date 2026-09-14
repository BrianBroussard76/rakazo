import { afterEach, describe, expect, it, vi } from "vitest";
import { aiRecipient } from "./ai-consent.js";
import { aiModelDisclosure } from "./ai-model-disclosure.js";

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe("AI recipient identity", () => {
  it("binds permission to endpoints without disclosing URL credentials or query strings", () => {
    const first = aiRecipient({
      provider: "openai-compatible",
      use: "model",
      baseUrl: "https://user:password@example.com/private?token=secret",
    })!;
    const next = aiRecipient({
      provider: "openai-compatible",
      use: "model",
      baseUrl: "https://example.com/other",
    })!;
    expect(first.name).toContain("https://example.com");
    expect(JSON.stringify(first)).not.toMatch(/password|private|token|secret/);
    expect(first.key).not.toBe(next.key);
  });
  it("names the actual OpenRouter hosts and restricts routing to exactly those endpoints", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      Response.json({
        data: {
          endpoints: [
            { provider_name: "Example Host", tag: "example/fp8" },
            { provider_name: "Second Host", tag: "second" },
          ],
        },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const first = await aiModelDisclosure({ provider: "openrouter", id: "test/consent-model" });
    expect(first.recipient?.detail).toContain("Example Host, Second Host");
    expect(first.payloadFields).toEqual({
      provider: { only: ["example/fp8", "second"], data_collection: "deny" },
    });
    expect(fetchMock).toHaveBeenCalledWith(
      "https://openrouter.ai/api/v1/models/test/consent-model/endpoints",
      expect.objectContaining({ redirect: "error" }),
    );
    expect(JSON.stringify(fetchMock.mock.calls)).not.toContain("Authorization");
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 6 * 60_000);
    fetchMock.mockResolvedValue(
      Response.json({ data: { endpoints: [{ provider_name: "Changed Host", tag: "changed" }] } }),
    );
    const changed = await aiModelDisclosure({ provider: "openrouter", id: "test/consent-model" });
    expect(changed.recipient?.key).not.toBe(first.recipient?.key);
  });
  it("fails closed when a gateway's recipients cannot be identified", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ data: { endpoints: [] } })));
    await expect(
      aiModelDisclosure({ provider: "openrouter", id: "test/no-hosts" }),
    ).rejects.toThrow("recipients");
    await expect(aiModelDisclosure({ provider: "vercel-ai-gateway", id: "test" })).rejects.toThrow(
      "direct model",
    );
  });
});
