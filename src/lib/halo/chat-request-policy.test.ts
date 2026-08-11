import { describe, expect, it } from "vitest";

import {
  evaluateChatRequestLimits,
  MAX_CHAT_MESSAGES,
  MAX_CHAT_MESSAGE_CHARS,
  MAX_CHAT_TOTAL_CHARS,
} from "./chat-request-policy";
import type { HaloChatMessage } from "./types";
import { isHaloChatMessage } from "./validators";

function evaluate(rawMessages: unknown) {
  const messages = Array.isArray(rawMessages)
    ? rawMessages.filter(isHaloChatMessage)
    : [];

  return evaluateChatRequestLimits(rawMessages, messages);
}

function messagesWithLengths(...lengths: number[]): HaloChatMessage[] {
  return lengths.map((length) => ({ role: "user", content: "x".repeat(length) }));
}

describe("chat request limits", () => {
  it("allows a normal conversation", () => {
    expect(
      evaluate([
        { role: "user", content: "Hello" },
        { role: "assistant", content: "Hi there" },
      ])
    ).toEqual({ allowed: true });
  });

  it("allows exactly the maximum number of messages", () => {
    expect(evaluate(messagesWithLengths(...Array(MAX_CHAT_MESSAGES).fill(1)))).toEqual({
      allowed: true,
    });
  });

  it("rejects one message over the maximum", () => {
    expect(evaluate(messagesWithLengths(...Array(MAX_CHAT_MESSAGES + 1).fill(1)))).toEqual({
      allowed: false,
      error: "Chat history contains too many messages.",
    });
  });

  it("allows a message exactly at the per-message character limit", () => {
    expect(evaluate(messagesWithLengths(MAX_CHAT_MESSAGE_CHARS))).toEqual({ allowed: true });
  });

  it("rejects a message one character over the per-message limit", () => {
    expect(evaluate(messagesWithLengths(MAX_CHAT_MESSAGE_CHARS + 1))).toEqual({
      allowed: false,
      error: "A chat message exceeds the allowed size.",
    });
  });

  it("allows exactly the maximum total valid content length", () => {
    const messageLengths = Array(
      MAX_CHAT_TOTAL_CHARS / MAX_CHAT_MESSAGE_CHARS
    ).fill(MAX_CHAT_MESSAGE_CHARS);

    expect(evaluate(messagesWithLengths(...messageLengths))).toEqual({ allowed: true });
  });

  it("rejects one character over the total valid content limit", () => {
    const messageLengths = Array(
      MAX_CHAT_TOTAL_CHARS / MAX_CHAT_MESSAGE_CHARS
    ).fill(MAX_CHAT_MESSAGE_CHARS);

    expect(evaluate(messagesWithLengths(...messageLengths, 1))).toEqual({
      allowed: false,
      error: "Chat history exceeds the allowed total size.",
    });
  });

  it("counts raw invalid entries toward the message limit", () => {
    const rawMessages = [
      ...messagesWithLengths(1),
      ...Array(MAX_CHAT_MESSAGES).fill({ invalid: true }),
    ];

    expect(evaluate(rawMessages)).toEqual({
      allowed: false,
      error: "Chat history contains too many messages.",
    });
  });

  it("does not include user content in rejected results", () => {
    const userContent = "private-user-content";
    const result = evaluate([
      { role: "user", content: userContent.repeat(MAX_CHAT_MESSAGE_CHARS) },
    ]);

    expect(result.allowed).toBe(false);
    expect(JSON.stringify(result)).not.toContain(userContent);
  });
});
