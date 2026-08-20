"use client";

import { useState } from "react";
import { Button } from "@/components/Button";

export interface AdminSignOutButtonProps {
  logoutApiHref: string;
  signedOutHref: string;
}

/**
 * Signing out is a POST, not a link.
 *
 * A `GET /logout` href is followed by anything that walks the page — a prefetcher, a link
 * scanner, an image tag on somebody else's site — and each of those would end the owner's
 * session for them. A button that posts cannot be triggered that way.
 *
 * The navigation afterwards is a full page load, so the browser re-enters through middleware
 * without the cookie it has just been told to discard.
 */
export function AdminSignOutButton({
  logoutApiHref,
  signedOutHref,
}: AdminSignOutButtonProps): JSX.Element {
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function signOut(): Promise<void> {
    setIsSigningOut(true);

    try {
      await fetch(logoutApiHref, { method: "POST" });
    } finally {
      window.location.assign(signedOutHref);
    }
  }

  return (
    <div className="mx-auto w-full sm:max-w-[14rem]">
      <Button
        variant="secondary"
        fullWidth
        disabled={isSigningOut}
        onClick={() => void signOut()}
      >
        {isSigningOut ? "Signing out…" : "Sign out"}
      </Button>
    </div>
  );
}
