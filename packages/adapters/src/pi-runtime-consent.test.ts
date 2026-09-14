import { beforeEach, describe, expect, it, vi } from "vitest";

const fixture = vi.hoisted(() => ({
  sent: vi.fn(),
  turns: 1,
  helper: false,
  effectiveProvider: "test",
}));
type FakeOptions = {
  streamFn(model: unknown, context: unknown, options: unknown): Promise<void>;
  initialState: {
    model: unknown;
    tools: { name: string; execute(id: string, args: unknown): Promise<unknown> }[];
  };
};
vi.mock("@earendil-works/pi-agent-core", () => ({
  Agent: class {
    state = { messages: [], errorMessage: undefined };
    constructor(private options: FakeOptions) {}
    subscribe() {}
    async prompt() {
      for (let turn = 0; turn < fixture.turns; turn++)
        await this.options.streamFn(this.options.initialState.model, {}, {});
      if (fixture.helper)
        await this.options.initialState.tools
          .find((tool) => tool.name === "run_subagent")
          ?.execute("helper", { task: "help", name: "helper" });
    }
    async waitForIdle() {}
    abort() {}
  },
}));
vi.mock("@earendil-works/pi-ai/providers/all", () => ({
  builtinModels: () => ({
    getModel: () => ({
      provider: fixture.effectiveProvider,
      id: "test",
      api: "openai-completions",
      reasoning: false,
    }),
    streamSimple: async (
      _model: unknown,
      _context: unknown,
      options: { onPayload(payload: unknown): Promise<unknown> },
    ) => {
      const payload = await options.onPayload({ messages: ["synthetic private content"] });
      fixture.sent(payload);
    },
  }),
}));
vi.mock("./pi-local-provider.js", () => ({ registerLocalProvider: (models: unknown) => models }));
vi.mock("./pi-openai-compatible-provider.js", () => ({
  OPENAI_COMPATIBLE_PROVIDER_ID: "openai-compatible",
  registerOpenAiCompatibleCatalog: (models: unknown) => models,
  registerOpenAiCompatibleRuntime: (models: unknown) => models,
}));

import type { PiAgentRuntimeOptions } from "./pi-runtime.js";
import { PiAgentRuntime } from "./pi-runtime.js";

async function run(authorizeModel: PiAgentRuntimeOptions["authorizeModel"]) {
  const runtime = new PiAgentRuntime({ authorizeModel });
  for await (const _event of runtime.run(
    {
      botId: "bot",
      threadId: "thread",
      runId: "run",
      prompt: "hello",
      instructions: "",
      history: [],
      tools: [],
      model: { provider: "test", id: "test" },
    },
    { userId: "user", spaceId: "space" },
  )) {
    /* drain */
  }
}
beforeEach(() => {
  fixture.sent.mockClear();
  fixture.turns = 1;
  fixture.helper = false;
  fixture.effectiveProvider = "test";
});
describe("provider dispatch consent", () => {
  it("authorizes the effective provider for parent and helper dispatch", async () => {
    fixture.effectiveProvider = "actual-provider";
    fixture.helper = true;
    const authorize = vi.fn(async (model: { provider: string }) => {
      expect(model.provider).toBe("actual-provider");
      return {};
    });
    await run(authorize);
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(fixture.sent).toHaveBeenCalledTimes(2);
  });
  it("does not transmit when permission is absent", async () => {
    await expect(
      run(async () => {
        throw new Error("permission required");
      }),
    ).rejects.toThrow("permission required");
    expect(fixture.sent).not.toHaveBeenCalled();
  });
  it("checks again on subsequent turns after withdrawal", async () => {
    fixture.turns = 2;
    const authorize = vi
      .fn()
      .mockResolvedValueOnce({})
      .mockRejectedValueOnce(new Error("withdrawn"));
    await expect(run(authorize)).rejects.toThrow("withdrawn");
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(fixture.sent).toHaveBeenCalledOnce();
  });
  it("checks helper calls and applies authorized gateway routing to the outgoing payload", async () => {
    fixture.helper = true;
    const authorize = vi.fn(async () => ({ provider: { only: ["approved-host"] } }));
    await run(authorize);
    expect(authorize).toHaveBeenCalledTimes(2);
    expect(fixture.sent).toHaveBeenCalledTimes(2);
    expect(fixture.sent).toHaveBeenLastCalledWith({
      messages: ["synthetic private content"],
      provider: { only: ["approved-host"] },
    });
    expect(authorize).toHaveBeenCalledWith(
      expect.objectContaining({ provider: "test", id: "test" }),
      expect.objectContaining({ userId: "user", spaceId: "space" }),
    );
  });
});
