import { routeHaloModel } from "@/lib/halo/model-router";
import { searchWeb, type SearchResponse } from "@/lib/halo/search";
import { HALO_CONSOLE_SYSTEM_PROMPT } from "@/lib/halo/system-prompts";
import { HALO_MODELS } from "@/lib/halo/types";
import type { HaloChatMessage } from "@/lib/halo/types";
import { isHaloChatMessage } from "@/lib/halo/validators";

export const runtime = "nodejs";

const OLLAMA_URL = process.env.OLLAMA_URL ?? "http://127.0.0.1:11434";
const WEB_SEARCH_NOT_CONFIGURED_RESPONSE =
  "Web Search is not configured yet, so I cannot verify current information from live sources.";

type ChatRequestBody = {
  model?: unknown;
  messages?: unknown;
  router?: unknown;
  allowTools?: unknown;
  webSearch?: unknown;
};

function logChatError(message: string, details?: unknown) {
  console.error("[HALO /api/chat]", message, details ?? "");
}

function latestUserMessage(messages: HaloChatMessage[]) {
  return [...messages].reverse().find((message) => message.role === "user")?.content ?? "";
}

function buildWebSearchContext(searchResponse: SearchResponse) {
  if (searchResponse.sources.length > 0) {
    const sourceLines = searchResponse.sources
      .slice(0, 5)
      .map(
        (source) =>
          `${source.rank}. ${source.title} (${source.url}) - ${source.snippet || "No snippet provided."}`
      )
      .join("\n");

    return [
      "Web Search was enabled for this reply.",
      "Use only these sources for current or recent claims. Cite source titles or URLs when useful.",
      "If the sources do not answer the question, say that the available sources could not verify it.",
      sourceLines,
    ].join("\n");
  }

  return [
    "Web Search was requested for this reply, but HALO Console could not verify current information.",
    searchResponse.message ?? "No web search sources were available.",
    "Tell the user that current information could not be verified. Do not invent current facts.",
  ].join(" ");
}

function createStreamingTextResponse(text: string) {
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    start(controller) {
      controller.enqueue(encoder.encode(text));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-cache",
    },
  });
}

export async function POST(req: Request) {
  try {
    const body = (await req.json()) as ChatRequestBody;

    const messages = Array.isArray(body.messages)
      ? body.messages.filter(isHaloChatMessage)
      : [];
    const shouldUseRouter = body.router === true;
    const webSearchEnabled = body.webSearch === true;
    const model = shouldUseRouter
      ? routeHaloModel({
          message: latestUserMessage(messages),
          manualModel: null,
          allowTools: body.allowTools === true,
        }).model
      : typeof body.model === "string"
        ? body.model
        : HALO_MODELS.quick;

    const systemMessage: HaloChatMessage = {
      role: "system",
      content: HALO_CONSOLE_SYSTEM_PROMPT,
    };
    const ollamaMessages = [systemMessage, ...messages];

    if (webSearchEnabled) {
      const searchResponse = await searchWeb({
        query: latestUserMessage(messages),
        maxResults: 5,
      });

      if (
        searchResponse.provider === "none" ||
        (!searchResponse.ok && searchResponse.sources.length === 0)
      ) {
        return createStreamingTextResponse(WEB_SEARCH_NOT_CONFIGURED_RESPONSE);
      }

      ollamaMessages.splice(1, 0, {
        role: "system",
        content: buildWebSearchContext(searchResponse),
      });
    }

    const ollamaRes = await fetch(`${OLLAMA_URL}/api/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: ollamaMessages,
        options: {
          temperature: 0.4,
        },
      }),
    });

    if (!ollamaRes.ok || !ollamaRes.body) {
      const text = await ollamaRes.text();
      logChatError("Ollama request failed", {
        status: ollamaRes.status,
        statusText: ollamaRes.statusText,
        body: text,
        model,
        ollamaUrl: OLLAMA_URL,
      });

      return new Response("Ollama request failed", { status: 502 });
    }

    const decoder = new TextDecoder();
    const encoder = new TextEncoder();

    function enqueueOllamaLine(controller: ReadableStreamDefaultController, line: string) {
      if (!line.trim()) return;

      try {
        const json = JSON.parse(line);
        const content = json.message?.content;

        if (typeof content === "string" && content.length > 0) {
          controller.enqueue(encoder.encode(content));
        }
      } catch (error) {
        logChatError("Malformed Ollama stream chunk", { line, error });
      }
    }

    const stream = new ReadableStream({
      async start(controller) {
        const reader = ollamaRes.body!.getReader();
        let buffer = "";

        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split("\n");
            buffer = lines.pop() ?? "";

            for (const line of lines) {
              enqueueOllamaLine(controller, line);
            }
          }

          buffer += decoder.decode();
          enqueueOllamaLine(controller, buffer);
        } catch (error) {
          logChatError("Ollama stream failed", { error, model, ollamaUrl: OLLAMA_URL });
          controller.error(error);
        } finally {
          try {
            controller.close();
          } catch {
            // The stream may already be errored or closed by the client.
          }
        }
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    logChatError("Chat route failed", error);
    return new Response("HALO Console chat route failed", { status: 500 });
  }
}
