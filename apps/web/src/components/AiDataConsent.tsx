import type { AiConsentStatus } from "@rakazo/contracts";
import { AI_DATA_DISCLOSURES, AI_PRIVACY_URL } from "@rakazo/contracts";
import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@rakazo/ui-web";
import { useEffect, useState } from "react";
import type { AiConsentPrompt } from "../lib/ai-consent";
import { promptAiConsent, subscribeAiConsent } from "../lib/ai-consent";
import { rpc } from "../lib/rpc";

export function AiDataConsentDialog() {
  const [prompt, setPrompt] = useState<AiConsentPrompt | null>(null);
  useEffect(() => subscribeAiConsent(setPrompt), []);
  return (
    <Dialog
      open={Boolean(prompt)}
      onOpenChange={(open) => {
        if (!open) prompt?.resolve(false);
      }}
    >
      {prompt ? (
        <DialogContent className="max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Share data with {prompt.recipient.name}?</DialogTitle>
            <DialogDescription>{AI_DATA_DISCLOSURES[prompt.recipient.use]}</DialogDescription>
          </DialogHeader>
          {prompt.recipient.detail ? <p className="text-sm">{prompt.recipient.detail}</p> : null}
          <p className="text-sm text-muted-foreground">
            You can withdraw permission in Account → AI data sharing.
          </p>
          <div className="flex gap-4 text-sm underline">
            <a href={AI_PRIVACY_URL} target="_blank" rel="noreferrer">
              Privacy policy
            </a>
            <a href={prompt.recipient.privacyUrl} target="_blank" rel="noreferrer">
              Provider privacy policy
            </a>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => prompt.resolve(false)}>
              Not now
            </Button>
            <Button onClick={() => prompt.resolve(true)}>Allow</Button>
          </div>
        </DialogContent>
      ) : null}
    </Dialog>
  );
}

export function AiDataSharingSettings() {
  const [status, setStatus] = useState<AiConsentStatus | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const report = (cause: unknown) =>
    setError(cause instanceof Error ? cause.message : "Could not load permissions.");
  useEffect(() => {
    void rpc.aiConsent.status().then(setStatus).catch(report);
  }, []);
  return (
    <section className="space-y-3 rounded-xl border border-border p-4">
      <h3 className="font-medium">AI data sharing</h3>
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status?.recipients.map((recipient) => (
        <div key={recipient.key} className="flex items-center justify-between gap-3">
          <div>
            <p>{recipient.name}</p>
            <p className="text-sm text-muted-foreground">
              {recipient.unavailableReason ?? recipient.detail}
            </p>
          </div>
          <Button
            variant="outline"
            disabled={pending || (!recipient.allowed && Boolean(recipient.unavailableReason))}
            onClick={() => {
              setPending(true);
              setError(null);
              void (async () => {
                if (recipient.allowed)
                  setStatus(await rpc.aiConsent.revoke({ key: recipient.key }));
                else if (await promptAiConsent(recipient))
                  setStatus(
                    await rpc.aiConsent.allow({
                      scope: status.scope,
                      version: status.version,
                      keys: [recipient.key],
                    }),
                  );
              })()
                .catch(report)
                .finally(() => setPending(false));
            }}
          >
            {recipient.allowed ? "Withdraw permission" : "Allow"}
          </Button>
        </div>
      ))}
      {status?.recipients.length === 0 ? (
        <p className="text-sm text-muted-foreground">No AI services configured.</p>
      ) : null}
      <Button
        variant="outline"
        disabled={pending}
        onClick={() => {
          setPending(true);
          void rpc.aiConsent
            .revoke({ key: null })
            .then(setStatus)
            .catch(report)
            .finally(() => setPending(false));
        }}
      >
        Withdraw all permissions
      </Button>
      <a className="text-sm underline" href={AI_PRIVACY_URL} target="_blank" rel="noreferrer">
        Privacy policy
      </a>
    </section>
  );
}
