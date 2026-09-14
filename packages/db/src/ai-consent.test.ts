import { AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import { describe, expect, it, vi } from "vitest";
import { requireAiConsent } from "./ai-consent.js";

describe("AI consent enforcement", () => {
  it("rejects absent, outdated, and revoked permission before a provider call", async () => {
    const findUnique = vi
      .fn()
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ version: "old" })
      .mockResolvedValueOnce({ version: AI_DISCLOSURE_VERSION })
      .mockResolvedValueOnce(null);
    const prisma = { aiDataConsent: { findUnique } } as never;
    const scope = { userId: "user-1", spaceId: "space-1" };
    const send = vi.fn();
    const request = async () => {
      await requireAiConsent(prisma, scope, { key: "recipient-1" });
      send();
    };
    await expect(request()).rejects.toThrow("AI data sharing");
    await expect(request()).rejects.toThrow("AI data sharing");
    expect(send).not.toHaveBeenCalled();
    await request();
    expect(send).toHaveBeenCalledOnce();
    await expect(request()).rejects.toThrow("AI data sharing");
    expect(send).toHaveBeenCalledOnce();
    expect(findUnique).toHaveBeenLastCalledWith({
      where: { userId_spaceId_recipientKey: { ...scope, recipientKey: "recipient-1" } },
    });
  });
  it("fails closed without an actor, while offline emulators need no provider permission", async () => {
    const findUnique = vi.fn();
    const prisma = { aiDataConsent: { findUnique } } as never;
    await expect(requireAiConsent(prisma, {}, { key: "recipient" })).rejects.toThrow();
    await expect(requireAiConsent(prisma, {}, null)).resolves.toBeUndefined();
    expect(findUnique).not.toHaveBeenCalled();
  });
});
