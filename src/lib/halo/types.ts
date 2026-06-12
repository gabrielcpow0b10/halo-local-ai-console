export const HALO_MODELS = {
  quick: "qwen3:4b",
  daily: "qwen3:14b",
  heavy: "qwen3:30b-a3b",
} as const;

export type HaloModelTier = keyof typeof HALO_MODELS;

export type HaloToolId =
  | "web_search"
  | "documents"
  | "memory"
  | "agents"
  | "system_status";

export type HaloToolStatus = "available" | "disabled";

export type HaloToolDefinition = {
  id: HaloToolId;
  label: string;
  status: HaloToolStatus;
  reason: string;
};

export type HaloChatRole = "system" | "user" | "assistant";

export type HaloChatMessage = {
  role: HaloChatRole;
  content: string;
};

export type HaloRouterRequest = {
  message: string;
  manualModel: string | null;
  allowTools: boolean;
};

export type HaloRouterDecision = {
  tier: HaloModelTier;
  model: string;
  tools: HaloToolId[];
  neededTools: HaloToolId[];
  reason: string;
};

export type HaloRouterResponse = Pick<
  HaloRouterDecision,
  "tier" | "model" | "tools" | "neededTools" | "reason"
>;
