import { validateEmail, validateName } from "@/lib/address";

export interface ContactFormValues {
  name: string;
  email: string;
  subject: string;
  message: string;
}

export type ContactField = keyof ContactFormValues;

export type ContactErrors = Partial<Record<ContactField, string>>;

export const CONTACT_FIELDS: readonly ContactField[] = [
  "name",
  "email",
  "subject",
  "message",
];

export const EMPTY_CONTACT_FORM: ContactFormValues = {
  name: "",
  email: "",
  subject: "",
  message: "",
};

const SUBJECT_MAX_LENGTH = 120;
const MESSAGE_MIN_LENGTH = 10;
const MESSAGE_MAX_LENGTH = 2000;

export function validateSubject(value: string): string | undefined {
  if (value.trim().length > SUBJECT_MAX_LENGTH) {
    return `Keep the subject under ${SUBJECT_MAX_LENGTH} characters`;
  }
  return undefined;
}

export function validateMessage(value: string): string | undefined {
  const message = value.trim();
  if (message.length === 0) return "Tell us how we can help";
  if (message.length < MESSAGE_MIN_LENGTH) {
    return `Add a little more detail, at least ${MESSAGE_MIN_LENGTH} characters`;
  }
  if (message.length > MESSAGE_MAX_LENGTH) {
    return `Keep the message under ${MESSAGE_MAX_LENGTH} characters`;
  }
  return undefined;
}

/**
 * Name and email reuse the checkout validators from `lib/address.ts`. The rules for a
 * well-formed name and a well-formed email do not change because the form is a different
 * one, and two implementations would eventually disagree.
 */
const FIELD_VALIDATORS: Record<ContactField, (value: string) => string | undefined> = {
  name: validateName,
  email: validateEmail,
  subject: validateSubject,
  message: validateMessage,
};

export function validateContactField(
  field: ContactField,
  value: string,
): string | undefined {
  return FIELD_VALIDATORS[field](value);
}

export interface ContactValidation {
  errors: ContactErrors;
  /** Non-null exactly when `errors` is empty. Trimmed, ready to send. */
  values: ContactFormValues | null;
}

export function validateContactForm(values: ContactFormValues): ContactValidation {
  const errors: ContactErrors = {};

  for (const field of CONTACT_FIELDS) {
    const errorMessage = validateContactField(field, values[field]);
    if (errorMessage !== undefined) errors[field] = errorMessage;
  }

  if (Object.keys(errors).length > 0) return { errors, values: null };

  return {
    errors,
    values: {
      name: values.name.trim(),
      email: values.email.trim(),
      subject: values.subject.trim(),
      message: values.message.trim(),
    },
  };
}

export function findFirstInvalidContactField(
  errors: ContactErrors,
): ContactField | undefined {
  return CONTACT_FIELDS.find((field) => errors[field] !== undefined);
}

export const WEB3FORMS_ENDPOINT = "https://api.web3forms.com/submit";

const DEFAULT_SUBJECT = "New enquiry from the Morchadi Gems website";

export interface Web3FormsPayload {
  access_key: string;
  name: string;
  email: string;
  subject: string;
  message: string;
}

/**
 * Web3Forms takes a flat JSON body and emails it on. The access key is a *public* submission
 * token, not a secret — it identifies the destination inbox and nothing else, which is why it
 * is safe as a `NEXT_PUBLIC_` variable.
 */
export function buildWeb3FormsPayload(
  values: ContactFormValues,
  accessKey: string,
): Web3FormsPayload {
  const subject = values.subject.trim();

  return {
    access_key: accessKey,
    name: values.name.trim(),
    email: values.email.trim(),
    subject: subject.length > 0 ? subject : DEFAULT_SUBJECT,
    message: values.message.trim(),
  };
}

/**
 * Whether this deployment can actually deliver a message. Set at build time from
 * `NEXT_PUBLIC_WEB3FORMS_KEY`; when it is absent the form validates and then says so rather
 * than claiming a delivery that never happened. See ADR-012.
 */
export function getContactAccessKey(): string {
  return process.env.NEXT_PUBLIC_WEB3FORMS_KEY ?? "";
}
