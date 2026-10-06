import { expect, it, vi } from "vitest";
import { analyticsLocation, trackKeyEvent } from "./analytics";

it("strips investigation data from analytics and tolerates absent tracking", () => {
  expect(analyticsLocation("https://knuckletat.com/explore?lat=49.123&email=private@example.com#target")).toBe("https://knuckletat.com/explore");
  expect(analyticsLocation("https://knuckletat.com/regions/russia?query=private")).toBe("https://knuckletat.com/regions/[region]");
  expect(analyticsLocation("https://knuckletat.com/private@example.com")).toBe("https://knuckletat.com/other");
  expect(analyticsLocation("")).toBe("");
  expect(() => trackKeyEvent("share")).not.toThrow();
  const gtag = vi.fn();
  vi.stubGlobal("window", { gtag, location: { href: "https://knuckletat.com/explore?lat=49.123" } });
  try {
    trackKeyEvent("share", { method: "copy_link", content_type: "map" });
    expect(gtag).toHaveBeenCalledTimes(1);
    expect(gtag).toHaveBeenCalledWith("event", "share", { method: "copy_link", content_type: "map", page_location: "https://knuckletat.com/explore" });
  } finally { vi.unstubAllGlobals(); }
});
