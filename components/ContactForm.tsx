"use client";

import { useState, type FormEvent } from "react";
import { CONTACT_CONFIG } from "@/lib/config";
import {
  EMPTY_CONTACT_FORM,
  WEB3FORMS_ENDPOINT,
  buildWeb3FormsPayload,
  findFirstInvalidContactField,
  getContactAccessKey,
  validateContactField,
  validateContactForm,
  type ContactErrors,
  type ContactField,
  type ContactFormValues,
} from "@/lib/contact";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/Button";
import { TextAreaField } from "@/components/TextAreaField";
import { TextField } from "@/components/TextField";

type SubmissionState = "idle" | "sending" | "delivered" | "unconfigured" | "failed";

function contactFieldId(field: ContactField): string {
  return `contact-${field}`;
}

/**
 * One submit handler with one branch, decided by whether `NEXT_PUBLIC_WEB3FORMS_KEY` was set
 * at build time.
 *
 * With a key, the validated message is POSTed to Web3Forms and the outcome — delivered or
 * failed — is what the shopper is told. Without one, the form still validates and still gives
 * feedback, but it says plainly that delivery is not connected and points at the email address
 * and WhatsApp instead. It never reports a message as sent when nothing was sent. See ADR-012.
 */
export function ContactForm(): JSX.Element {
  const [values, setValues] = useState<ContactFormValues>(EMPTY_CONTACT_FORM);
  const [errors, setErrors] = useState<ContactErrors>({});
  const [submissionState, setSubmissionState] = useState<SubmissionState>("idle");
  const { showToast } = useToast();

  function handleChange(field: ContactField, value: string): void {
    setValues((currentValues) => ({ ...currentValues, [field]: value }));

    if (errors[field] !== undefined) {
      setErrors((currentErrors) => ({
        ...currentErrors,
        [field]: validateContactField(field, value),
      }));
    }
  }

  function handleBlur(field: ContactField): void {
    setErrors((currentErrors) => ({
      ...currentErrors,
      [field]: validateContactField(field, values[field]),
    }));
  }

  async function deliverMessage(
    submittedValues: ContactFormValues,
    accessKey: string,
  ): Promise<void> {
    setSubmissionState("sending");

    try {
      const response = await fetch(WEB3FORMS_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", Accept: "application/json" },
        body: JSON.stringify(buildWeb3FormsPayload(submittedValues, accessKey)),
      });

      if (!response.ok) {
        setSubmissionState("failed");
        return;
      }

      setValues(EMPTY_CONTACT_FORM);
      setSubmissionState("delivered");
      showToast("Message sent");
    } catch {
      setSubmissionState("failed");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>): void {
    event.preventDefault();

    const { errors: submitErrors, values: submittedValues } =
      validateContactForm(values);
    setErrors(submitErrors);

    if (submittedValues === null) {
      const firstInvalidField = findFirstInvalidContactField(submitErrors);
      if (firstInvalidField !== undefined) {
        document.getElementById(contactFieldId(firstInvalidField))?.focus();
      }
      return;
    }

    const accessKey = getContactAccessKey();

    if (accessKey.length === 0) {
      setSubmissionState("unconfigured");
      showToast("Message checked");
      return;
    }

    void deliverMessage(submittedValues, accessKey);
  }

  if (submissionState === "delivered") {
    return (
      <div className="border border-line bg-ivory px-6 py-10 text-center">
        <h3 className="font-display text-heading-sm text-ink">Message sent</h3>
        <p className="mx-auto mt-3 max-w-prose text-body text-muted">
          Thank you, we have it. We reply within {CONTACT_CONFIG.replyWindow}.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => setSubmissionState("idle")}>
            Send another message
          </Button>
        </div>
      </div>
    );
  }

  if (submissionState === "unconfigured") {
    return (
      <div className="border border-gold/40 bg-gold/5 px-6 py-10 text-center">
        <h3 className="font-display text-heading-sm text-ink">
          Message delivery is not connected yet
        </h3>
        <p className="mx-auto mt-3 max-w-prose text-body text-muted">
          Your message is complete and valid, but this deployment has no form endpoint
          configured, so <strong className="font-medium text-ink">it has not been sent</strong>.
          Please email us at{" "}
          <a
            href={`mailto:${CONTACT_CONFIG.supportEmail}`}
            className="text-ink underline decoration-gold underline-offset-4"
          >
            {CONTACT_CONFIG.supportEmail}
          </a>{" "}
          or use the WhatsApp button in the corner of the screen.
        </p>
        <div className="mt-6">
          <Button variant="secondary" onClick={() => setSubmissionState("idle")}>
            Back to the form
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
        <TextField
          id={contactFieldId("name")}
          label="Your name"
          value={values.name}
          autoComplete="name"
          error={errors.name}
          onChange={(value) => handleChange("name", value)}
          onBlur={() => handleBlur("name")}
        />

        <TextField
          id={contactFieldId("email")}
          label="Email"
          value={values.email}
          type="email"
          inputMode="email"
          autoComplete="email"
          error={errors.email}
          onChange={(value) => handleChange("email", value)}
          onBlur={() => handleBlur("email")}
        />
      </div>

      <TextField
        id={contactFieldId("subject")}
        label="Subject"
        value={values.subject}
        autoComplete="off"
        isOptional
        placeholder="Order enquiry, sizing, something else"
        error={errors.subject}
        onChange={(value) => handleChange("subject", value)}
        onBlur={() => handleBlur("subject")}
      />

      <TextAreaField
        id={contactFieldId("message")}
        label="Message"
        value={values.message}
        rows={6}
        error={errors.message}
        onChange={(value) => handleChange("message", value)}
        onBlur={() => handleBlur("message")}
      />

      {submissionState === "failed" ? (
        <p role="alert" className="border border-sale/30 bg-sale/5 px-4 py-3 text-body-sm text-sale">
          That did not go through. Please try again, or email us directly at{" "}
          {CONTACT_CONFIG.supportEmail}.
        </p>
      ) : null}

      <div className="pt-2 sm:max-w-[16rem]">
        <Button type="submit" fullWidth disabled={submissionState === "sending"}>
          {submissionState === "sending" ? "Sending…" : "Send message"}
        </Button>
      </div>
    </form>
  );
}
