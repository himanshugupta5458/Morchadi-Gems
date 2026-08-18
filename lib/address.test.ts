import { describe, expect, it } from "vitest";
import { INDIAN_STATES, isIndianState } from "@/types/cart";
import {
  ADDRESS_FIELDS,
  EMPTY_ADDRESS_FORM,
  findFirstInvalidField,
  toAddressFormValues,
  validateAddressField,
  validateAddressForm,
  validateCity,
  validateEmail,
  validateLine1,
  validateLine2,
  validateName,
  validatePhone,
  validatePincode,
  validateState,
  type AddressFormValues,
} from "@/lib/address";

const VALID_FORM: AddressFormValues = {
  name: "Ananya Iyer",
  phone: "9876543210",
  email: "ananya@example.com",
  line1: "12 Rosewood Apartments",
  line2: "Off Turner Road",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400050",
};

function formWith(overrides: Partial<AddressFormValues>): AddressFormValues {
  return { ...VALID_FORM, ...overrides };
}

describe("the valid case", () => {
  it("accepts a well-formed address and returns no errors", () => {
    const { errors, address } = validateAddressForm(VALID_FORM);

    expect(errors).toEqual({});
    expect(address).toEqual({
      name: "Ananya Iyer",
      phone: "9876543210",
      email: "ananya@example.com",
      line1: "12 Rosewood Apartments",
      line2: "Off Turner Road",
      city: "Mumbai",
      state: "Maharashtra",
      pincode: "400050",
    });
  });

  it("accepts an address with no second line and omits the key", () => {
    const { errors, address } = validateAddressForm(formWith({ line2: "" }));

    expect(errors).toEqual({});
    expect(address).not.toBeNull();
    expect(address).not.toHaveProperty("line2");
  });

  it("accepts an address whose second line is only whitespace", () => {
    const { errors, address } = validateAddressForm(formWith({ line2: "   " }));

    expect(errors).toEqual({});
    expect(address).not.toHaveProperty("line2");
  });
});

describe("name", () => {
  it("rejects an empty name", () => {
    expect(validateName("")).toBeDefined();
  });

  it("rejects whitespace-only", () => {
    expect(validateName("   ")).toBeDefined();
  });

  it("rejects a single character", () => {
    expect(validateName("A")).toBeDefined();
  });

  it("rejects a name over the length limit", () => {
    expect(validateName("A".repeat(81))).toBeDefined();
  });

  it("accepts a two-character name and one at the limit", () => {
    expect(validateName("Jo")).toBeUndefined();
    expect(validateName("A".repeat(80))).toBeUndefined();
  });

  it("accepts names with spaces and punctuation", () => {
    expect(validateName("Mary-Anne D'Souza")).toBeUndefined();
  });
});

describe("phone", () => {
  it("rejects an empty number", () => {
    expect(validatePhone("")).toBeDefined();
  });

  it("rejects 9 digits and 11 digits", () => {
    expect(validatePhone("987654321")).toBeDefined();
    expect(validatePhone("98765432101")).toBeDefined();
  });

  it("rejects a leading digit outside 6-9", () => {
    for (const leadingDigit of ["0", "1", "2", "3", "4", "5"]) {
      expect(validatePhone(`${leadingDigit}876543210`)).toBeDefined();
    }
  });

  it("accepts every valid leading digit", () => {
    for (const leadingDigit of ["6", "7", "8", "9"]) {
      expect(validatePhone(`${leadingDigit}876543210`)).toBeUndefined();
    }
  });

  it("rejects letters and symbols", () => {
    expect(validatePhone("98765abcde")).toBeDefined();
    expect(validatePhone("+919876543210")).toBeDefined();
  });

  it("strips spaces and dashes before checking", () => {
    expect(validatePhone("98765 43210")).toBeUndefined();
    expect(validatePhone("98765-43210")).toBeUndefined();
    expect(validatePhone(" 9876543210 ")).toBeUndefined();
  });

  it("stores the stripped number, not what was typed", () => {
    const { address } = validateAddressForm(formWith({ phone: "98765 43210" }));
    expect(address?.phone).toBe("9876543210");
  });
});

describe("email", () => {
  it("rejects an empty email", () => {
    expect(validateEmail("")).toBeDefined();
  });

  it("rejects malformed shapes", () => {
    const malformed = [
      "ananya",
      "ananya@",
      "@example.com",
      "ananya@example",
      "ananya example@mail.com",
      "ananya@@example.com",
      "ananya@example.c",
      "ananya@example.",
    ];

    for (const candidate of malformed) {
      expect(validateEmail(candidate), candidate).toBeDefined();
    }
  });

  it("accepts ordinary addresses", () => {
    for (const candidate of [
      "ananya@example.com",
      "ananya.iyer+orders@mail.co.in",
      "a_b-c@sub.domain.org",
    ]) {
      expect(validateEmail(candidate), candidate).toBeUndefined();
    }
  });

  it("rejects an email past the length limit", () => {
    expect(validateEmail(`${"a".repeat(250)}@example.com`)).toBeDefined();
  });

  it("trims surrounding whitespace", () => {
    expect(validateEmail("  ananya@example.com  ")).toBeUndefined();

    const { address } = validateAddressForm(
      formWith({ email: "  ananya@example.com  " }),
    );
    expect(address?.email).toBe("ananya@example.com");
  });
});

describe("address lines and city", () => {
  it("requires line 1", () => {
    expect(validateLine1("")).toBeDefined();
    expect(validateLine1("   ")).toBeDefined();
  });

  it("accepts line 1 at the limit and rejects beyond it", () => {
    expect(validateLine1("x".repeat(120))).toBeUndefined();
    expect(validateLine1("x".repeat(121))).toBeDefined();
  });

  it("treats line 2 as optional", () => {
    expect(validateLine2("")).toBeUndefined();
    expect(validateLine2("   ")).toBeUndefined();
  });

  it("still bounds the length of line 2", () => {
    expect(validateLine2("x".repeat(121))).toBeDefined();
  });

  it("requires a city", () => {
    expect(validateCity("")).toBeDefined();
    expect(validateCity("   ")).toBeDefined();
    expect(validateCity("Mumbai")).toBeUndefined();
  });

  it("bounds the city length", () => {
    expect(validateCity("x".repeat(61))).toBeDefined();
  });

  it("trims stored lines and city", () => {
    const { address } = validateAddressForm(
      formWith({ line1: "  12 Rosewood  ", line2: "  Bandra  ", city: "  Mumbai  " }),
    );

    expect(address?.line1).toBe("12 Rosewood");
    expect(address?.line2).toBe("Bandra");
    expect(address?.city).toBe("Mumbai");
  });
});

describe("state", () => {
  it("rejects an unselected state", () => {
    expect(validateState("")).toBeDefined();
  });

  it("rejects a name that is not on the list", () => {
    expect(validateState("Atlantis")).toBeDefined();
    expect(validateState("Bombay")).toBeDefined();
  });

  it("is case- and spelling-exact", () => {
    expect(validateState("maharashtra")).toBeDefined();
    expect(validateState("MAHARASHTRA")).toBeDefined();
  });

  it("accepts every entry on the list", () => {
    for (const state of INDIAN_STATES) {
      expect(validateState(state), state).toBeUndefined();
    }
  });

  it("covers all 28 states and 8 union territories with no duplicates", () => {
    expect(INDIAN_STATES).toHaveLength(36);
    expect(new Set(INDIAN_STATES).size).toBe(36);
  });

  it("guards the type the dropdown and the validator share", () => {
    expect(isIndianState("Kerala")).toBe(true);
    expect(isIndianState("Kerela")).toBe(false);
  });
});

describe("pincode", () => {
  it("rejects an empty pincode", () => {
    expect(validatePincode("")).toBeDefined();
  });

  it("rejects 5 and 7 digits", () => {
    expect(validatePincode("40005")).toBeDefined();
    expect(validatePincode("4000501")).toBeDefined();
  });

  it("rejects one starting with 0", () => {
    expect(validatePincode("040050")).toBeDefined();
  });

  it("rejects non-digits", () => {
    expect(validatePincode("4000a0")).toBeDefined();
    expect(validatePincode("400 050")).toBeDefined();
  });

  it("accepts a valid pincode, trimmed", () => {
    expect(validatePincode("400050")).toBeUndefined();
    expect(validatePincode(" 400050 ")).toBeUndefined();
  });
});

describe("the aggregate validator", () => {
  it("returns every error at once rather than stopping at the first", () => {
    const { errors, address } = validateAddressForm(EMPTY_ADDRESS_FORM);

    expect(address).toBeNull();
    expect(Object.keys(errors).sort()).toEqual([
      "city",
      "email",
      "line1",
      "name",
      "phone",
      "pincode",
      "state",
    ]);
  });

  it("does not flag the optional line when everything else is empty", () => {
    expect(validateAddressForm(EMPTY_ADDRESS_FORM).errors.line2).toBeUndefined();
  });

  it("reports several bad fields together", () => {
    const { errors, address } = validateAddressForm(
      formWith({ phone: "12345", pincode: "040050", state: "Atlantis" }),
    );

    expect(address).toBeNull();
    expect(errors.phone).toBeDefined();
    expect(errors.pincode).toBeDefined();
    expect(errors.state).toBeDefined();
    expect(errors.name).toBeUndefined();
  });

  it("returns no address whenever there is any error", () => {
    expect(validateAddressForm(formWith({ city: "" })).address).toBeNull();
  });

  it("does not mutate the values it is given", () => {
    const values = formWith({ name: "  Ananya  " });
    validateAddressForm(values);

    expect(values.name).toBe("  Ananya  ");
  });
});

describe("field dispatch and focus order", () => {
  it("routes each field to its own validator", () => {
    expect(validateAddressField("phone", "123")).toBe(validatePhone("123"));
    expect(validateAddressField("pincode", "040050")).toBe(validatePincode("040050"));
    expect(validateAddressField("state", "Kerala")).toBeUndefined();
  });

  it("lists every form field exactly once", () => {
    expect(ADDRESS_FIELDS).toHaveLength(Object.keys(EMPTY_ADDRESS_FORM).length);
    expect(new Set(ADDRESS_FIELDS).size).toBe(ADDRESS_FIELDS.length);
  });

  it("finds the topmost invalid field, not an arbitrary one", () => {
    const { errors } = validateAddressForm(
      formWith({ pincode: "", city: "", phone: "" }),
    );

    expect(findFirstInvalidField(errors)).toBe("phone");
  });

  it("finds nothing when the form is valid", () => {
    expect(findFirstInvalidField({})).toBeUndefined();
  });
});

describe("repopulating the form", () => {
  it("round-trips a stored address back into form values", () => {
    const { address } = validateAddressForm(VALID_FORM);
    expect(address).not.toBeNull();
    if (address === null) return;

    expect(toAddressFormValues(address)).toEqual(VALID_FORM);
  });

  it("turns a missing second line back into an empty string", () => {
    const { address } = validateAddressForm(formWith({ line2: "" }));
    expect(address).not.toBeNull();
    if (address === null) return;

    expect(toAddressFormValues(address).line2).toBe("");
  });
});
