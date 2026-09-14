import type { AiRecipient } from "@rakazo/contracts";
import { AI_CONSENT_REQUIRED, AI_DISCLOSURE_VERSION } from "@rakazo/contracts";
import type { PrismaClient } from "./client.js";

export class AiConsentRequired extends Error {
  constructor() {
    super(AI_CONSENT_REQUIRED);
  }
}

export async function requireAiConsent(
  prisma: Pick<PrismaClient, "aiDataConsent">,
  scope: { userId?: string; spaceId?: string },
  recipient: Pick<AiRecipient, "key"> | null,
) {
  if (!recipient) return;
  if (!scope.userId || !scope.spaceId) throw new AiConsentRequired();
  const consent = await prisma.aiDataConsent.findUnique({
    where: {
      userId_spaceId_recipientKey: {
        userId: scope.userId,
        spaceId: scope.spaceId,
        recipientKey: recipient.key,
      },
    },
  });
  if (consent?.version !== AI_DISCLOSURE_VERSION) throw new AiConsentRequired();
}
