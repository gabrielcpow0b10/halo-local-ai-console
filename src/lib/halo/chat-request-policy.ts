import type { HaloChatMessage } from "./types";

export const MAX_CHAT_MESSAGES = 50;
export const MAX_CHAT_MESSAGE_CHARS = 16_000;
export const MAX_CHAT_TOTAL_CHARS = 64_000;

export type ChatRequestLimitResult =
  | { allowed: true }
  | { allowed: false; error: string };

export function evaluateChatRequestLimits(
  rawMessages: unknown,
  messages: HaloChatMessage[]
): ChatRequestLimitResult {
  if (Array.isArray(rawMessages) && rawMessages.length > MAX_CHAT_MESSAGES) {
    return { allowed: false, error: "Chat history contains too many messages." };
  }

  let totalChars = 0;

  for (const message of messages) {
    if (message.content.length > MAX_CHAT_MESSAGE_CHARS) {
      return { allowed: false, error: "A chat message exceeds the allowed size." };
    }

    totalChars += message.content.length;
  }

  if (totalChars > MAX_CHAT_TOTAL_CHARS) {
    return { allowed: false, error: "Chat history exceeds the allowed total size." };
  }

  return { allowed: true };
}
