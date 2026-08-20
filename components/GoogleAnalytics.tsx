"use client";

import Script from "next/script";
import {
  buildGtagInitScript,
  buildGtagScriptSrc,
  getGoogleAnalyticsMeasurementId,
} from "@/lib/analytics";

/**
 * The GA4 tag, or nothing at all.
 *
 * With `NEXT_PUBLIC_GA_MEASUREMENT_ID` unset this renders `null`: no script tag, no request to
 * Google, no `dataLayer`. That is the state the site ships in until the owner supplies an id,
 * and it is the same "configured or silent" shape the contact form and the WhatsApp
 * notification already use.
 *
 * `afterInteractive` rather than `beforeInteractive`: measurement must never sit in front of
 * the first paint or the pay button on a mobile connection, and analytics that loads a moment
 * late still records the pageview.
 *
 * The `config` call is an inline script, which the policy permits through the `'unsafe-inline'`
 * already required by Next's own bootstrap. See ADR-039 and ADR-034.
 */
export function GoogleAnalytics(): JSX.Element | null {
  const measurementId = getGoogleAnalyticsMeasurementId();
  if (measurementId.length === 0) return null;

  return (
    <>
      <Script
        id="google-analytics-tag"
        src={buildGtagScriptSrc(measurementId)}
        strategy="afterInteractive"
      />
      <Script
        id="google-analytics-config"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{ __html: buildGtagInitScript(measurementId) }}
      />
    </>
  );
}
