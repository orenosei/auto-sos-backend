import { describe, expect, it } from "vitest";

import { toGeogPointText, toGeogText } from "../../../src/utils/geo.js";

describe("geo utilities", () => {
  it("returns null for missing or empty locations", () => {
    expect(toGeogPointText(null)).toBeNull();
    expect(toGeogPointText(undefined)).toBeNull();
    expect(toGeogPointText("   ")).toBeNull();
  });

  it("converts latitude/longitude objects into SRID point text", () => {
    expect(toGeogPointText({ lat: 21.0278, lng: 105.8342 })).toBe(
      "SRID=4326;POINT(105.8342 21.0278)"
    );
    expect(toGeogPointText({ latitude: 10.7769, longitude: 106.7009 })).toBe(
      "SRID=4326;POINT(106.7009 10.7769)"
    );
  });

  it("normalizes point strings and leaves existing SRID strings intact", () => {
    expect(toGeogPointText("POINT(105.8 21.0)")).toBe("SRID=4326;POINT(105.8 21.0)");
    expect(toGeogPointText("SRID=4326;POINT(105.8 21.0)")).toBe(
      "SRID=4326;POINT(105.8 21.0)"
    );
  });

  it("passes through non-point string locations and exposes toGeogText alias", () => {
    expect(toGeogPointText("Hanoi")).toBe("Hanoi");
    expect(toGeogText).toBe(toGeogPointText);
  });

  it("rejects objects without numeric coordinates", () => {
    expect(toGeogPointText({ lat: "21", lng: 105 })).toBeNull();
    expect(toGeogPointText({ foo: 1 })).toBeNull();
  });
});
