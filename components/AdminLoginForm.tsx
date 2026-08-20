"use client";

import { useState, type FormEvent } from "react";
import { Button } from "@/components/Button";
import { TextField } from "@/components/TextField";

export interface AdminLoginFormProps {
  /** Where to POST. It differs between the admin subdomain and local development, so the
   * server computes it from the request hostname and hands it down rather than the browser
   * guessing from its own path. */
  loginApiHref: string;
  /** Where a successful sign-in lands. */
  signedInHref: string;
}

type SubmissionState = "idle" | "submitting" | "rejected" | "unreachable";

const UNREACHABLE_MESSAGE = "Sign in could not be completed. Please try again.";

/**
 * The sign-in form. It knows nothing about why a login failed, and there is nothing for it to
 * know: the endpoint answers every rejection with one message, so the field that was wrong
 * cannot be inferred from what is rendered here.
 *
 * On success the browser is sent to the panel by a full navigation rather than a client-side
 * push, so the request that renders the next page carries the freshly set cookie through
 * middleware.
 */
export function AdminLoginForm({
  loginApiHref,
  signedInHref,
}: AdminLoginFormProps): JSX.Element {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [failureMessage, setFailureMessage] = useState<string | null>(null);
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");

  async function submitCredentials(): Promise<void> {
    setSubmissionState("submitting");
    setFailureMessage(null);

    try {
      const response = await fetch(loginApiHref, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });

      if (response.ok) {
        window.location.assign(signedInHref);
        return;
      }

      const body: unknown = await response.json().catch(() => null);
      const message =
        typeof (body as { error?: unknown } | null)?.error === "string"
          ? (body as { error: string }).error
          : UNREACHABLE_MESSAGE;

      setPassword("");
      setFailureMessage(message);
      setSubmissionState("rejected");
    } catch {
      setPassword("");
      setFailureMessage(UNREACHABLE_MESSAGE);
      setSubmissionState("unreachable");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();
    if (submissionState === "submitting") return;
    void submitCredentials();
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <TextField
        id="admin-username"
        label="Username"
        value={username}
        autoComplete="username"
        onChange={setUsername}
        onBlur={() => undefined}
      />

      <TextField
        id="admin-password"
        label="Password"
        value={password}
        type="password"
        autoComplete="current-password"
        onChange={setPassword}
        onBlur={() => undefined}
      />

      {failureMessage === null ? null : (
        <p
          role="alert"
          className="border border-sale/30 bg-sale/5 px-4 py-3 text-body-sm text-sale"
        >
          {failureMessage}
        </p>
      )}

      <Button type="submit" fullWidth disabled={submissionState === "submitting"}>
        {submissionState === "submitting" ? "Signing in…" : "Sign in"}
      </Button>
    </form>
  );
}
