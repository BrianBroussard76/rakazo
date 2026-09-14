import type { AiRecipient } from "@rakazo/contracts";

export type AiConsentPrompt = { recipient: AiRecipient; resolve(allowed: boolean): void };
const listeners = new Set<(prompt: AiConsentPrompt | null) => void>();
let current: AiConsentPrompt | null = null;
let queue = Promise.resolve();
export function subscribeAiConsent(listener: (prompt: AiConsentPrompt | null) => void) {
  listeners.add(listener);
  listener(current);
  return () => {
    listeners.delete(listener);
  };
}
export function promptAiConsent(recipient: AiRecipient): Promise<boolean> {
  const task = queue.then(
    () =>
      new Promise<boolean>((resolve) => {
        current = {
          recipient,
          resolve: (allowed) => {
            current = null;
            for (const listener of listeners) listener(null);
            resolve(allowed);
          },
        };
        for (const listener of listeners) listener(current);
      }),
  );
  queue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
