import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/streamableHttp.js";
import { CallToolRequestSchema, ListToolsRequestSchema } from "@modelcontextprotocol/sdk/types.js";
import { builtinAgentTools } from "./builtin-tools.js";
import { identityFromMeta } from "./bot-home-identity.js";
import {
  BOT_HOME_TOOL_NAMES,
  type BotHomeToolDeps,
  executeBotHomeTool,
} from "./bot-home-tools.js";

const TOOLS = builtinAgentTools.filter((tool) =>
  (BOT_HOME_TOOL_NAMES as readonly string[]).includes(tool.name),
);

export type BotHomeMcpHandle = {
  close(): Promise<void>;
};

export function createBotHomeMcpServer(deps: BotHomeToolDeps): Server {
  const server = new Server({ name: "rakazo-bot-home", version: "0.1.0" }, { capabilities: { tools: {} } });
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: TOOLS.map((tool) => ({
      name: tool.name,
      description: tool.description,
      inputSchema: tool.inputSchema,
    })),
  }));
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const name = request.params.name;
    const args = (request.params.arguments ?? {}) as Record<string, unknown>;
    const identity = identityFromMeta(request.params._meta as Record<string, unknown> | undefined);
    const result = await executeBotHomeTool(deps, identity, name, args);
    return {
      content: result.content,
      isError: result.isError,
    };
  });
  return server;
}

export async function listenBotHomeMcp(
  deps: BotHomeToolDeps & { port: number; authKey?: string },
): Promise<BotHomeMcpHandle> {
  const authKey = deps.authKey?.trim() ?? "";
  const http = createServer((req, res) => {
    void handleBotHomeHttp(req, res, deps, authKey);
  });
  await new Promise<void>((resolve, reject) => {
    http.once("error", reject);
    http.listen(deps.port, "0.0.0.0", () => resolve());
  });
  return {
    close: () =>
      new Promise((resolve, reject) => {
        http.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

async function handleBotHomeHttp(
  req: IncomingMessage,
  res: ServerResponse,
  deps: BotHomeToolDeps,
  authKey: string,
): Promise<void> {
  if (authKey) {
    const header = String(req.headers.authorization ?? "");
    if (header !== `Bearer ${authKey}`) {
      res.writeHead(401, { "Content-Type": "application/json" }).end(JSON.stringify({ error: "unauthorized" }));
      return;
    }
  }
  const url = new URL(req.url ?? "/", "http://rakazo-worker.internal");
  if (url.pathname !== "/mcp" && url.pathname !== "/mcp/") {
    res.writeHead(404).end();
    return;
  }
  if (req.method !== "POST") {
    res.writeHead(405, { Allow: "POST" }).end();
    return;
  }
  let body: unknown;
  try {
    body = await readJsonBody(req);
  } catch {
    res.writeHead(400).end("invalid json");
    return;
  }
  const server = createBotHomeMcpServer(deps);
  const transport = new StreamableHTTPServerTransport({ sessionIdGenerator: undefined });
  await server.connect(transport);
  try {
    await transport.handleRequest(req, res, body);
  } finally {
    await transport.close().catch(() => undefined);
    await server.close().catch(() => undefined);
  }
}

async function readJsonBody(req: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  for await (const chunk of req) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
  }
  const raw = Buffer.concat(chunks).toString("utf8").trim();
  return raw ? JSON.parse(raw) : undefined;
}
