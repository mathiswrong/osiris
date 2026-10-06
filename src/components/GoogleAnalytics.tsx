"use client";

import { useEffect, useRef, useSyncExternalStore } from "react";
import Script from "next/script";
import { usePathname } from "next/navigation";
import { analyticsLocation } from "@/lib/analytics";

const subscribe = () => () => {};

export default function GoogleAnalytics({ measurementId }: { measurementId?: string }) {
  const pathname = usePathname();
  const enabled = useSyncExternalStore(subscribe, () => process.env.NODE_ENV === "production"
    && !!measurementId && /^G-[A-Z0-9]+$/.test(measurementId)
    && ["knuckletat.com", "www.knuckletat.com"].includes(window.location.hostname), () => false);
  const previous = useRef<{ path: string; location: string } | null>(null);

  useEffect(() => {
    if (!enabled || !measurementId) return;
    window.dataLayer = window.dataLayer || [];
    window.gtag = function () {
      // The Google tag identifies commands by their native Arguments object.
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer!.push(arguments);
    };
    window.gtag("js", new Date());
    window.gtag("config", measurementId, {
      send_page_view: false,
      page_location: analyticsLocation(window.location.href),
      page_referrer: analyticsLocation(document.referrer),
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
    });
  }, [enabled, measurementId]);

  useEffect(() => {
    if (!enabled || !pathname || previous.current?.path === pathname) return;
    const location = analyticsLocation(window.location.origin + pathname);
    const context = {
      page_location: location,
      page_referrer: previous.current?.location || analyticsLocation(document.referrer),
      page_title: "KNUCKLETAT",
    };
    window.gtag?.("set", context);
    window.gtag?.("event", "page_view", context);
    previous.current = { path: pathname, location };
  }, [enabled, pathname]);

  return enabled ? <Script src={`https://www.googletagmanager.com/gtag/js?id=${measurementId}`} strategy="afterInteractive" /> : null;
}
