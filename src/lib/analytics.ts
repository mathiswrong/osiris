type KeyEvent = "view_region" | "follow_region" | "save_investigation" | "share";
type EventParameters = { region_id?: string; method?: "copy_link"; content_type?: "map" };

declare global {
  interface Window {
    dataLayer?: unknown[];
    gtag?: (command: string, name: string | Date | Record<string, unknown>, parameters?: Record<string, unknown>) => void;
  }
}

// Queries and fragments can contain investigation targets or precise map coordinates.
export function analyticsLocation(url: string): string {
  try {
    const parsed = new URL(url);
    const path = /^\/regions\/[a-z0-9-]+\/?$/.test(parsed.pathname)
      ? "/regions/[region]"
      : ["/", "/regions", "/explore", "/signals", "/docs", "/privacy"].includes(parsed.pathname) ? parsed.pathname : "/other";
    return parsed.origin + path;
  } catch { return ""; }
}

export function trackKeyEvent(name: KeyEvent, parameters: EventParameters = {}) {
  if (typeof window === "undefined" || !window.gtag) return;
  window.gtag("event", name, {
    ...parameters,
    page_location: analyticsLocation(window.location.href),
  });
}
