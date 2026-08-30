import { describe, expect, it } from "vitest";
import { validateEmail, validateName } from "@/lib/address";
import { CONTACT_CONFIG } from "@/lib/config";
import {
  CONTACT_FIELDS,
  EMPTY_CONTACT_FORM,
  buildWeb3FormsPayload,
  findFirstInvalidContactField,
  validateContactField,
  validateContactForm,
  validateMessage,
  validateSubject,
  type ContactFormValues,
} from "@/lib/contact";

const VALID_FORM: ContactFormValues = {
  name: "Ananya Iyer",
  email: "ananya@example.com",
  subject: "Order enquiry",
  message: "Could you tell me the exact drop length of the Kundan Rani Haar?",
};

function formWith(overrides: Partial<ContactFormValues>): ContactFormValues {
  return { ...VALID_FORM, ...overrides };
}

describe("the valid case", () => {
  it("accepts a complete message and returns trimmed values", () => {
    const { errors, values } = validateContactForm(
      formWith({ name: "  Ananya Iyer  ", message: `  ${VALID_FORM.message}  ` }),
    );

    expect(errors).toEqual({});
    expect(values).toEqual(VALID_FORM);
  });

  it("accepts a message with no subject", () => {
    const { errors, values } = validateContactForm(formWith({ subject: "" }));

    expect(errors).toEqual({});
    expect(values?.subject).toBe("");
  });
});

describe("reused checkout validators", () => {
  it("validates the name with the same rule as the address form", () => {
    expect(validateContactField("name", "A")).toBe(validateName("A"));
    expect(validateContactField("name", "")).toBe(validateName(""));
  });

  it("validates the email with the same rule as the address form", () => {
    expect(validateContactField("email", "nope")).toBe(validateEmail("nope"));
    expect(validateContactField("email", "a@b.com")).toBeUndefined();
  });
});

describe("subject", () => {
  it("is optional", () => {
    expect(validateSubject("")).toBeUndefined();
    expect(validateSubject("   ")).toBeUndefined();
  });

  it("is still bounded", () => {
    expect(validateSubject("x".repeat(120))).toBeUndefined();
    expect(validateSubject("x".repeat(121))).toBeDefined();
  });
});

describe("message", () => {
  it("rejects an empty message", () => {
    expect(validateMessage("")).toBeDefined();
    expect(validateMessage("   ")).toBeDefined();
  });

  it("rejects one too short to act on", () => {
    expect(validateMessage("hi")).toBeDefined();
    expect(validateMessage("x".repeat(9))).toBeDefined();
  });

  it("accepts one at the minimum and at the maximum", () => {
    expect(validateMessage("x".repeat(10))).toBeUndefined();
    expect(validateMessage("x".repeat(2000))).toBeUndefined();
  });

  it("rejects one past the maximum", () => {
    expect(validateMessage("x".repeat(2001))).toBeDefined();
  });
});

describe("the aggregate validator", () => {
  it("returns every error at once, leaving the optional subject alone", () => {
    const { errors, values } = validateContactForm(EMPTY_CONTACT_FORM);

    expect(values).toBeNull();
    expect(Object.keys(errors).sort()).toEqual(["email", "message", "name"]);
  });

  it("returns no values whenever there is any error", () => {
    expect(validateContactForm(formWith({ email: "nope" })).values).toBeNull();
  });

  it("does not mutate the values it is given", () => {
    const values = formWith({ name: "  Ananya  " });
    validateContactForm(values);

    expect(values.name).toBe("  Ananya  ");
  });

  it("lists every form field exactly once", () => {
    expect(CONTACT_FIELDS).toHaveLength(Object.keys(EMPTY_CONTACT_FORM).length);
    expect(new Set(CONTACT_FIELDS).size).toBe(CONTACT_FIELDS.length);
  });

  it("finds the topmost invalid field, not an arbitrary one", () => {
    const { errors } = validateContactForm(formWith({ message: "", email: "nope" }));

    expect(findFirstInvalidContactField(errors)).toBe("email");
  });

  it("finds nothing when the form is valid", () => {
    expect(findFirstInvalidContactField({})).toBeUndefined();
  });
});

describe("the Web3Forms payload", () => {
  it("carries the access key and the trimmed values", () => {
    expect(buildWeb3FormsPayload(VALID_FORM, "test-key")).toEqual({
      access_key: "test-key",
      name: "Ananya Iyer",
      email: "ananya@example.com",
      subject: "Order enquiry",
      message: VALID_FORM.message,
    });
  });

  it("substitutes a default subject when none was given", () => {
    const payload = buildWeb3FormsPayload(formWith({ subject: "  " }), "test-key");

    expect(payload.subject).toBe(CONTACT_CONFIG.defaultEnquirySubject);
  });

  it("carries no field the form did not collect", () => {
    expect(Object.keys(buildWeb3FormsPayload(VALID_FORM, "k")).sort()).toEqual([
      "access_key",
      "email",
      "message",
      "name",
      "subject",
    ]);
  });
});
