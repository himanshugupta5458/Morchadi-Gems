import { isIndianState, type Address } from "@/types/cart";

export interface AddressFormValues {
  name: string;
  phone: string;
  email: string;
  line1: string;
  line2: string;
  city: string;
  state: string;
  pincode: string;
}

export type AddressField = keyof AddressFormValues;

export type AddressErrors = Partial<Record<AddressField, string>>;

/**
 * Tab order, and the order the first invalid field is looked for on a failed submit — so
 * focus lands on the topmost problem rather than on whichever key the errors object happens
 * to enumerate first.
 */
export const ADDRESS_FIELDS: readonly AddressField[] = [
  "name",
  "phone",
  "email",
  "line1",
  "line2",
  "city",
  "state",
  "pincode",
];

export const EMPTY_ADDRESS_FORM: AddressFormValues = {
  name: "",
  phone: "",
  email: "",
  line1: "",
  line2: "",
  city: "",
  state: "",
  pincode: "",
};

const NAME_MAX_LENGTH = 80;
const LINE_MAX_LENGTH = 120;
const CITY_MAX_LENGTH = 60;
const EMAIL_MAX_LENGTH = 254;

const INDIAN_MOBILE_PATTERN = /^[6-9][0-9]{9}$/;
const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@.]{2,}$/;

/** Digits typed with spaces or dashes are the same number, so both are removed before checking. */
function stripPhoneFormatting(value: string): string {
  return value.replace(/[\s-]/g, "");
}

/**
 * Shared with the contact form, so the messages stay neutral about *why* the value is
 * wanted. The field's own label already supplies that context, and copy that says "for
 * delivery" is wrong the moment the same rule is reused somewhere without a delivery.
 */
export function validateName(value: string): string | undefined {
  const name = value.trim();
  if (name.length === 0) return "Enter a name";
  if (name.length < 2) return "Enter a name of at least 2 characters";
  if (name.length > NAME_MAX_LENGTH) {
    return `Keep the name under ${NAME_MAX_LENGTH} characters`;
  }
  return undefined;
}

export function validatePhone(value: string): string | undefined {
  const phone = stripPhoneFormatting(value);
  if (phone.length === 0) return "Enter a mobile number";
  if (!/^[0-9]+$/.test(phone)) return "Use digits only";
  if (phone.length !== 10) return "Enter a 10-digit mobile number";
  if (!INDIAN_MOBILE_PATTERN.test(phone)) {
    return "An Indian mobile number starts with 6, 7, 8 or 9";
  }
  return undefined;
}

export function validateEmail(value: string): string | undefined {
  const email = value.trim();
  if (email.length === 0) return "Enter an email address";
  if (email.length > EMAIL_MAX_LENGTH) return "That email is too long";
  if (!EMAIL_PATTERN.test(email)) return "Enter a valid email address";
  return undefined;
}

export function validateLine1(value: string): string | undefined {
  const line1 = value.trim();
  if (line1.length === 0) return "Enter the flat, house or building";
  if (line1.length > LINE_MAX_LENGTH) {
    return `Keep this line under ${LINE_MAX_LENGTH} characters`;
  }
  return undefined;
}

export function validateLine2(value: string): string | undefined {
  const line2 = value.trim();
  if (line2.length > LINE_MAX_LENGTH) {
    return `Keep this line under ${LINE_MAX_LENGTH} characters`;
  }
  return undefined;
}

export function validateCity(value: string): string | undefined {
  const city = value.trim();
  if (city.length === 0) return "Enter a city or town";
  if (city.length > CITY_MAX_LENGTH) {
    return `Keep the city under ${CITY_MAX_LENGTH} characters`;
  }
  return undefined;
}

/**
 * Unselected and unrecognised share one message: for a dropdown they are the same mistake,
 * and a message that reads back the placeholder verbatim tells the shopper nothing.
 */
export function validateState(value: string): string | undefined {
  if (!isIndianState(value.trim())) return "Select a state from the list";
  return undefined;
}

export function validatePincode(value: string): string | undefined {
  const pincode = value.trim();
  if (pincode.length === 0) return "Enter a 6-digit PIN code";
  if (!/^[0-9]+$/.test(pincode)) return "Use digits only";
  if (pincode.length !== 6) return "A PIN code is exactly 6 digits";
  if (!PINCODE_PATTERN.test(pincode)) return "A PIN code does not start with 0";
  return undefined;
}

const FIELD_VALIDATORS: Record<AddressField, (value: string) => string | undefined> = {
  name: validateName,
  phone: validatePhone,
  email: validateEmail,
  line1: validateLine1,
  line2: validateLine2,
  city: validateCity,
  state: validateState,
  pincode: validatePincode,
};

export function validateAddressField(
  field: AddressField,
  value: string,
): string | undefined {
  return FIELD_VALIDATORS[field](value);
}

export interface AddressValidation {
  errors: AddressErrors;
  /** Non-null exactly when `errors` is empty. Trimmed and normalised, ready to store. */
  address: Address | null;
}

/**
 * Validates every field rather than stopping at the first failure, so one submit reports
 * every problem at once instead of making the shopper discover them one at a time.
 */
export function validateAddressForm(values: AddressFormValues): AddressValidation {
  const errors: AddressErrors = {};

  for (const field of ADDRESS_FIELDS) {
    const message = validateAddressField(field, values[field]);
    if (message !== undefined) errors[field] = message;
  }

  const state = values.state.trim();
  if (Object.keys(errors).length > 0 || !isIndianState(state)) {
    return { errors, address: null };
  }

  const line2 = values.line2.trim();
  return {
    errors,
    address: {
      name: values.name.trim(),
      phone: stripPhoneFormatting(values.phone),
      email: values.email.trim(),
      line1: values.line1.trim(),
      ...(line2.length > 0 ? { line2 } : {}),
      city: values.city.trim(),
      state,
      pincode: values.pincode.trim(),
    },
  };
}

export function findFirstInvalidField(
  errors: AddressErrors,
): AddressField | undefined {
  return ADDRESS_FIELDS.find((field) => errors[field] !== undefined);
}

/** Repopulates the form when a shopper returns from `/payment` to edit their details. */
export function toAddressFormValues(address: Address): AddressFormValues {
  return {
    name: address.name,
    phone: address.phone,
    email: address.email,
    line1: address.line1,
    line2: address.line2 ?? "",
    city: address.city,
    state: address.state,
    pincode: address.pincode,
  };
}

/**
 * `203, Sunpro Kedarnath, Jaipur 302020` — the delivery address as one line.
 *
 * The state is left out and the omission is deliberate: a pincode identifies a state uniquely
 * in India, so printing both spends a third of the line restating something the six digits
 * beside it already say. The full address, state included, is still rendered in full on the
 * confirmation screen and in the receipt — this is the recap on the payment step, where the
 * shopper is confirming something they typed two screens ago rather than reading it for the
 * first time. See [ADR-073](/docs/decisions/ADR-073-universal-add-to-cart-modal.md).
 */
export function formatAddressOneLine(address: Address): string {
  const streetLines = [address.line1, address.line2].filter(
    (line): line is string => line !== undefined && line.trim().length > 0,
  );

  return [...streetLines, `${address.city} ${address.pincode}`].join(", ");
}
