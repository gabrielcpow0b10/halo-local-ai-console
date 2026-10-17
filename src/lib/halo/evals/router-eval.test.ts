import { expect, it } from "vitest";

import { routeHaloModel } from "../model-router";
import type { HaloModelTier } from "../types";

// Synthetic policy examples: heavy routing requires an explicit request.
const cases: { message: string; expectedTier: HaloModelTier }[] = [
  { message: "Hi there!", expectedTier: "quick" },
  { message: "Thanks for your help.", expectedTier: "quick" },
  { message: "What is the capital of France?", expectedTier: "quick" },
  { message: "Suggest a name for a blue bicycle.", expectedTier: "quick" },
  { message: "Translate good morning into Spanish.", expectedTier: "quick" },
  { message: "Write a short birthday greeting.", expectedTier: "quick" },
  { message: "How many minutes are in two hours?", expectedTier: "quick" },
  { message: "Summarize this note: the picnic starts at noon.", expectedTier: "quick" },
  { message: "This is a complex question about probability.", expectedTier: "quick" },
  { message: "I am organizing a fictional community picnic next month. Please suggest a cheerful welcome message for the guests and a friendly reminder to bring water.", expectedTier: "quick" },
  { message: "Debug a loop that skips the final item.", expectedTier: "daily" },
  { message: "Write TypeScript for sorting a list.", expectedTier: "daily" },
  { message: "Explain why the sky appears blue.", expectedTier: "daily" },
  { message: "Design a small library catalog.", expectedTier: "daily" },
  { message: "Refactor this function into smaller helpers.", expectedTier: "daily" },
  { message: "Implement a queue in JavaScript.", expectedTier: "daily" },
  { message: "Review the architecture of a toy weather station.", expectedTier: "daily" },
  { message: "Draft documentation for a fictional board game.", expectedTier: "daily" },
  { message: "Analyze these synthetic temperature readings.", expectedTier: "daily" },
  { message: "Create a React component for a counter.", expectedTier: "daily" },
  { message: "Use heavy reasoning for a fictional transit plan.", expectedTier: "heavy" },
  { message: "Route to heavy for this scheduling puzzle.", expectedTier: "heavy" },
  { message: "Select the heavy model for a proof.", expectedTier: "heavy" },
  { message: "Choose heavy for the next response.", expectedTier: "heavy" },
  { message: "Use the heavy model to compare design alternatives.", expectedTier: "heavy" },
  { message: "Explicitly use complex reasoning for this puzzle.", expectedTier: "heavy" },
  { message: "Use deep architecture reasoning for a toy compiler.", expectedTier: "heavy" },
  { message: "Use long planning for a fictional expedition.", expectedTier: "heavy" },
  { message: "Choose qwen3:30b-a3b for this analysis.", expectedTier: "heavy" },
  { message: "  USE THE HEAVY MODEL for this code review.  ", expectedTier: "heavy" },
];

it("evaluates offline router tier accuracy (minimum 90%)", () => {
  const results = cases.map((fixture) => ({
    ...fixture,
    actualTier: routeHaloModel({ message: fixture.message, allowTools: false }).tier,
  }));
  const correct = results.filter((result) => result.actualTier === result.expectedTier).length;
  const accuracy = correct / cases.length;
  const tiers = (["quick", "daily", "heavy"] as const).map((tier) => {
    const subset = results.filter((result) => result.expectedTier === tier);
    return `${tier}=${subset.filter((result) => result.actualTier === tier).length}/${subset.length}`;
  });
  process.stdout.write(`[router quality] total=${cases.length} correct=${correct} accuracy=${(accuracy * 100).toFixed(1)}% ${tiers.join(" ")}\n`);
  const failures = results.filter((result) => result.actualTier !== result.expectedTier);
  expect(accuracy, JSON.stringify(failures)).toBeGreaterThanOrEqual(0.9);
});
