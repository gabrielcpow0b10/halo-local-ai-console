import type { HaloChatMessage, HaloRouterRequest } from "./types";
import { HALO_MODELS } from "./types";

export function isHaloModel(value: unknown): value is (typeof HALO_MODELS)[keyof typeof HALO_MODELS] {
  return Object.values(HALO_MODELS).some((model) => model === value);
}

export function isHaloChatMessage(value: unknown): value is HaloChatMessage {
  if (!value || typeof value !== "object") return false;

  const message = value as Partial<HaloChatMessage>;

  return (
    (message.role === "user" || message.role === "assistant") &&
    typeof message.content === "string"
  );
}

export function parseRouterRequest(value: unknown): HaloRouterRequest | null {
  if (!value || typeof value !== "object") return null;

  const body = value as Partial<Record<keyof HaloRouterRequest, unknown>>;

  if (typeof body.message !== "string" || body.message.trim().length === 0) {
    return null;
  }

  return {
    message: body.message,
    manualModel: typeof body.manualModel === "string" ? body.manualModel : null,
    allowTools: body.allowTools === true,
  };
}
