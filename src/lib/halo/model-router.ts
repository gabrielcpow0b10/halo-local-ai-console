import { getEnabledTools } from "./tool-registry";
import { shouldUseWebSearch } from "./search";
import { HALO_MODELS, type HaloModelTier, type HaloRouterDecision, type HaloToolId } from "./types";

const MODEL_TO_TIER: Record<string, HaloModelTier> = {
  [HALO_MODELS.quick]: "quick",
  [HALO_MODELS.daily]: "daily",
  [HALO_MODELS.heavy]: "heavy",
};

function includesAny(value: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(value));
}

function tierForManualModel(model: string): HaloModelTier {
  return MODEL_TO_TIER[model] ?? "quick";
}

function uniqueTools(toolIds: HaloToolId[]) {
  return Array.from(new Set(toolIds));
}

function toolAwareReason(reason: string, input: { allowTools?: boolean }, neededTools: HaloToolId[], tools: HaloToolId[]) {
  if (!neededTools.includes("web_search")) return reason;

  if (input.allowTools !== true) {
    return `${reason}; web_search would be useful for current information but tools are not enabled`;
  }

  if (!tools.includes("web_search")) {
    return `${reason}; web_search would be useful but no server-side search provider is configured`;
  }

  return `${reason}; web_search enabled for current information`;
}

function buildDecision(params: {
  tier: HaloModelTier;
  model: string;
  neededTools: HaloToolId[];
  reason: string;
  allowTools?: boolean;
}): HaloRouterDecision {
  const uniqueNeededTools = uniqueTools(params.neededTools);
  const tools = params.allowTools ? getEnabledTools(uniqueNeededTools) : [];

  return {
    tier: params.tier,
    model: params.model,
    tools,
    neededTools: uniqueNeededTools,
    reason: toolAwareReason(params.reason, params, uniqueNeededTools, tools),
  };
}

export function routeHaloModel(input: {
  message: string;
  manualModel?: string | null;
  allowTools?: boolean;
}): HaloRouterDecision {
  const message = input.message.trim();
  const normalized = message.toLowerCase();
  const neededTools: HaloToolId[] = [];

  if (shouldUseWebSearch(normalized)) {
    neededTools.push("web_search");
  }

  if (input.manualModel) {
    const tier = tierForManualModel(input.manualModel);

    return buildDecision({
      tier,
      model: input.manualModel,
      reason: "manual model selected",
      neededTools,
      allowTools: input.allowTools,
    });
  }

  if (
    includesAny(normalized, [
      /\b(document|documents|doc|docs|pdf|rag|file|files|upload|uploaded|knowledge base)\b/,
    ])
  ) {
    neededTools.push("documents");
  }

  if (
    includesAny(normalized, [
      /\b(local node|local system|system status|ollama status|agent|agents)\b/,
    ])
  ) {
    neededTools.push(normalized.includes("agent") ? "agents" : "system_status");
  }

  const explicitlyHeavy =
    includesAny(normalized, [
      /\b(use|route to|select|choose)\s+(the\s+)?heavy\b/,
      /\bheavy model\b/,
      /\bqwen3:30b-a3b\b/,
      /\bdeep architecture\b/,
      /\bcomplex reasoning\b/,
      /\blong planning\b/,
    ]) && includesAny(normalized, [/\b(explicit|explicitly|use|route|select|choose|heavy|qwen3:30b-a3b)\b/]);

  if (explicitlyHeavy) {
    return buildDecision({
      tier: "heavy",
      model: HALO_MODELS.heavy,
      neededTools,
      reason: "explicit heavy reasoning request",
      allowTools: input.allowTools,
    });
  }

  if (
    includesAny(normalized, [
      /\b(code|coding|debug|bug|typescript|javascript|react|next\.js|api route|readme|documentation|docs|architecture|analysis|analyze|explain|design|refactor|implement)\b/,
    ])
  ) {
    return buildDecision({
      tier: "daily",
      model: HALO_MODELS.daily,
      neededTools,
      reason: normalized.includes("architecture")
        ? "documentation/architecture task"
        : "code/documentation/analysis task",
      allowTools: input.allowTools,
    });
  }

  return buildDecision({
    tier: "quick",
    model: HALO_MODELS.quick,
    neededTools,
    reason:
      message.length <= 120
        ? "greeting, quick note, or simple question"
        : "general chat default",
    allowTools: input.allowTools,
  });
}

export function toRouterResponse(decision: HaloRouterDecision) {
  return {
    tier: decision.tier,
    model: decision.model,
    tools: decision.tools,
    neededTools: decision.neededTools,
    reason: decision.reason,
  };
}
