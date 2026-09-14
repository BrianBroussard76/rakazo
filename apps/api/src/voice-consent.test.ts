import type { Actor } from "@rakazo/contracts";
import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";

const calls = vi.hoisted(() => ({ synthesize: vi.fn(), transcribe: vi.fn() }));
vi.mock("@rakazo/adapters", async (original) => ({
  ...(await original<typeof import("@rakazo/adapters")>()),
  createVoiceProvider: () => calls,
}));

import type { VoiceDeps } from "./voice.js";
import { synthesizeVoice, transcribeVoice } from "./voice.js";

describe("voice sharing permission", () => {
  it("blocks synthesis and transcription before permission and after withdrawal", async () => {
    const consent = vi.fn().mockResolvedValue(null);
    const deps = {
      prisma: {
        spaceVoicePreference: {
          findFirst: vi.fn(async () => ({
            credential: { provider: "openai", secretId: "secret" },
            voiceId: "voice",
          })),
        },
        secret: { findFirst: vi.fn(async () => ({ id: "secret", ciphertext: "encrypted" })) },
        aiDataConsent: { findUnique: consent },
      },
      secrets: { load: () => "fake-key" },
    } as unknown as VoiceDeps;
    const actor = { userId: "user", spaceId: "space" } as Actor;
    const speak = () => synthesizeVoice(deps, actor, { text: "Synthetic private content" });
    const transcribe = () =>
      transcribeVoice(deps, actor, { audio: new Uint8Array([1]), mimeType: "audio/webm" });
    await expect(speak()).rejects.toThrow("AI data sharing");
    await expect(transcribe()).rejects.toThrow("AI data sharing");
    expect(calls.synthesize).not.toHaveBeenCalled();
    expect(calls.transcribe).not.toHaveBeenCalled();
    consent.mockResolvedValue({ version: AI_DISCLOSURE_VERSION });
    await speak();
    await transcribe();
    consent.mockResolvedValue(null);
    await expect(speak()).rejects.toThrow();
    await expect(transcribe()).rejects.toThrow();
    expect(calls.synthesize).toHaveBeenCalledOnce();
    expect(calls.transcribe).toHaveBeenCalledOnce();
  });
});
