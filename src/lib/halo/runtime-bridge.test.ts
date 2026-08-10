import { describe, expect, it } from "vitest";

import { findPrivateMarkers } from "./runtime-bridge";

describe("findPrivateMarkers", () => {
  it("detects private markers without flagging the safe credential phrase", () => {
    expect(findPrivateMarkers("api_key=private-value")).toContain("api_key");
    expect(findPrivateMarkers("credential-like files: none")).toEqual([]);
  });
});
