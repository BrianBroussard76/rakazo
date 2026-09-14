import {
  AI_CONSENT_REQUIRED,
  type AiConsentStatus,
  type AiDataUse,
  type AiRecipient,
} from "@rakazo/contracts";

/** Only user actions that can start AI processing need a foreground disclosure. */
export function aiDataUsesForProcedure(procedure: string): AiDataUse[] {
  const path = procedure.replaceAll(".", "/");
  if (
    [
      "threads/send",
      "artifacts/create",
      "threads/followUp",
      "threads/react",
      "threads/answer",
      "routines/create",
      "routines/update",
      "routines/testRun",
    ].includes(path)
  )
    return ["model", "memory"];
  if (["voice/prepare", "voice/speak", "voice/transcribe"].includes(path)) return ["voice"];
  return [];
}

export async function ensureAiDataConsent(options: {
  uses: AiDataUse[];
  status(): Promise<AiConsentStatus>;
  prompt(recipient: AiRecipient): Promise<boolean>;
  allow(input: { scope: string; version: string; keys: string[] }): Promise<unknown>;
}) {
  if (options.uses.length === 0) return;
  const status = await options.status();
  for (const recipient of status.recipients) {
    if (recipient.allowed || !options.uses.includes(recipient.use)) continue;
    if (recipient.unavailableReason) throw new Error(recipient.unavailableReason);
    if (!(await options.prompt(recipient))) throw new Error(AI_CONSENT_REQUIRED);
    await options.allow({ scope: status.scope, version: status.version, keys: [recipient.key] });
  }
}

export function aiConsentTarget(input: unknown): { botId?: string; groupId?: string } {
  if (!input || typeof input !== "object") return {};
  const target = input as { botId?: unknown; groupId?: unknown };
  if (typeof target.groupId === "string") return { groupId: target.groupId };
  return typeof target.botId === "string" ? { botId: target.botId } : {};
}
