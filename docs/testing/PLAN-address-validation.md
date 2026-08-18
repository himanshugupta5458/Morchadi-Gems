# Test Plan: Address validation and the checkout bridge

- **Scope:** the pure validators in `lib/address.ts`, the checkout bundle in `lib/checkout.ts`,
  and the behaviour of `/address` — the empty-cart guard, blur and submit validation, focus
  management, the `sessionStorage` handoff, and repopulation on return.

  Explicitly **not** covered: server-side price validation and Cashfree order creation, which
  do not exist yet and get their own plan. `/payment`'s handling of a missing bundle is a
  requirement stated here and tested in prompt 11. Visual appearance is not covered — no
  browser is available in this environment.
- **Prerequisites:** none. No env vars, no credentials, no network. The validators import no
  product data; the page cases run under jsdom with `next/navigation` and `next/link` mocked.

## Cases

### The valid case

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-01 | Well-formed address | Validate a complete form | No errors; a trimmed, normalised `Address` returned | Automated |
| TC-02 | No second line | Submit with `line2` empty | Valid, and the `line2` key is **omitted**, not empty | Automated |
| TC-03 | Whitespace-only second line | `line2` is `"   "` | Valid, `line2` omitted | Automated |

### Name

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-04 | Empty | `""` | Error | Automated |
| TC-05 | Whitespace only | `"   "` | Error — trimmed before checking | Automated |
| TC-06 | One character | `"A"` | Error | Automated |
| TC-07 | Over the limit | 81 characters | Error | Automated |
| TC-08 | Boundaries | 2 and 80 characters | Both accepted | Automated |
| TC-09 | Real names | `"Mary-Anne D'Souza"` | Accepted — no alphabetic-only rule | Automated |

### Phone

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-10 | Empty | `""` | Error | Automated |
| TC-11 | Wrong length | 9 digits, 11 digits | Error in both cases | Automated |
| TC-12 | Bad leading digit | Leading 0,1,2,3,4,5 | Error for each | Automated |
| TC-13 | Good leading digit | Leading 6,7,8,9 | Accepted for each | Automated |
| TC-14 | Non-digits | letters; `+91` prefix | Error in both cases | Automated |
| TC-15 | Formatting stripped | `"98765 43210"`, `"98765-43210"`, padded | All accepted | Automated |
| TC-16 | Stored normalised | Submit `"98765 43210"` | Stored as `"9876543210"` | Automated |

### Email

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-17 | Empty | `""` | Error | Automated |
| TC-18 | Malformed shapes | 8 variants incl. no `@`, no TLD, single-char TLD, trailing dot, internal space, double `@` | Error for each | Automated |
| TC-19 | Ordinary addresses | plus-tags, subdomains, underscores | Accepted | Automated |
| TC-20 | Over the limit | 254+ characters | Error | Automated |
| TC-21 | Trimmed | Padded email | Accepted and stored trimmed | Automated |

### Address lines and city

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-22 | Line 1 required | empty, whitespace | Error in both cases | Automated |
| TC-23 | Line 1 boundary | 120 and 121 characters | Accepted, then error | Automated |
| TC-24 | Line 2 optional | empty, whitespace | Accepted | Automated |
| TC-25 | Line 2 still bounded | 121 characters | Error | Automated |
| TC-26 | City required | empty, whitespace, valid | Error, error, accepted | Automated |
| TC-27 | City bounded | 61 characters | Error | Automated |
| TC-28 | Stored trimmed | Padded line1/line2/city | All three stored trimmed | Automated |

### State

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-29 | Unselected | `""` | Error | Automated |
| TC-30 | Not on the list | `"Atlantis"`, `"Bombay"` | Error | Automated |
| TC-31 | Case and spelling exact | `"maharashtra"`, `"MAHARASHTRA"` | Error | Automated |
| TC-32 | Every listed entry | All 36 | Accepted | Automated |
| TC-33 | List integrity | `INDIAN_STATES` | Exactly 36 entries, no duplicates | Automated |
| TC-34 | Type guard | `isIndianState` on a real and a misspelt state | `true`, `false` | Automated |

### Pincode

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-35 | Empty | `""` | Error | Automated |
| TC-36 | Wrong length | 5 digits, 7 digits | Error in both cases | Automated |
| TC-37 | Leading zero | `"040050"` | Error | Automated |
| TC-38 | Non-digits | `"4000a0"`, `"400 050"` | Error in both cases | Automated |
| TC-39 | Valid, padded | `"400050"`, `" 400050 "` | Accepted | Automated |

### The aggregate validator

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-40 | All errors at once | Validate an entirely empty form | Exactly 7 errors — every field except the optional one | Automated |
| TC-41 | Optional field not flagged | Empty form | No `line2` error | Automated |
| TC-42 | Several bad fields together | Bad phone + pincode + state, good name | Three errors, name untouched | Automated |
| TC-43 | No address when invalid | Any single bad field | `address` is `null` | Automated |
| TC-44 | Purity | Validate a padded form | Input values unmodified | Automated |
| TC-45 | Field dispatch | `validateAddressField` per field | Matches the individual validator | Automated |
| TC-46 | Field list integrity | `ADDRESS_FIELDS` | Every form key exactly once | Automated |
| TC-47 | First invalid is topmost | phone, city and pincode all bad | Returns `phone`, not an arbitrary key | Automated |
| TC-48 | Nothing invalid | Empty error object | `undefined` | Automated |
| TC-49 | Repopulation round-trip | `Address` → form values | Equals the original form | Automated |
| TC-50 | Missing line 2 round-trip | `Address` without `line2` | Form value is `""` | Automated |

### The checkout bundle

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-51 | Bundle shape | Build from one line | cart, address, subtotal, shipping, total | Automated |
| TC-52 | Shipping once | Two lines | Flat rate charged once | Automated |
| TC-53 | Catalogue pricing | Line built from a tampered snapshot | Bundle carries the catalogue price | Automated |
| TC-54 | `mrp` excluded | Any bundle | The mrp value appears nowhere in the serialised bundle | Automated |
| TC-55 | Unavailable line dropped | One payable + one sold-out | Only the payable line is bundled | Automated |
| TC-56 | Nothing payable | Only a sold-out line | Empty cart, all amounts 0 | Automated |
| TC-57 | Round-trip | Write then parse | Equal to the original | Automated |
| TC-58 | Nothing stored | `null` | `null` | Automated |
| TC-59 | Unparseable JSON | `"{not json"` | `null`, no throw | Automated |
| TC-60 | Not an object | array, string, `null` | `null` for each | Automated |
| TC-61 | Empty or missing cart | `[]`, `undefined` | `null` for both | Automated |
| TC-62 | Malformed cart item | missing fields; `qty` as a string | `null` for both | Automated |
| TC-63 | Address missing a field | `phone` removed | `null` | Automated |
| TC-64 | Unknown state stored | `"Atlantis"` | `null` | Automated |
| TC-65 | Address without line 2 | `line2` removed | Accepted | Automated |
| TC-66 | Non-numeric amount | `total` as a string; `shipping` missing | `null` for both | Automated |
| TC-67 | **Tampered amount passes** | `total: 1` | **Accepted** — the parser validates shape, never truth. Asserting this pins ADR-011's claim that no client-side layer is an authority on money | Automated |

### The page

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-68 | Server render shows neither guard nor form | `renderToString` `/address` | Loading notice only; zero occurrences of guard text or "Delivery details" | Automated |
| TC-69 | Empty cart hydrates to the guard | Hydrate with no stored cart | No `console.error`; guard shown; no form; "Back to cart" → `/cart` | Automated |
| TC-70 | Full cart hydrates straight to the form | Seed a cart, hydrate | No `console.error`; no guard text at any point; form and ₹2,099 total shown | Automated |
| TC-71 | Sold-out line blocks | One payable + one sold-out | Unavailable guard; no form | Automated |
| TC-72 | Wholly sold-out cart blocks | Only a sold-out line | Unavailable guard | Automated |
| TC-73 | Every field is labelled | Hydrate | All 8 fields resolvable by accessible name | Automated |
| TC-74 | State dropdown is the constant | Hydrate | 37 options — 36 states plus the placeholder, whose value is `""` | Automated |
| TC-75 | Blur validates, typing clears | Blur a bad phone, then fix it | Error appears with `aria-invalid=true` and `aria-describedby` pointing at the message; both clear on fix | Automated |
| TC-76 | Untouched fields stay quiet | Type one character into email | No error while typing | Automated |
| TC-77 | Submit reports everything and focuses first | Submit an empty form | Four representative errors shown; focus on Full name | Automated |
| TC-78 | Failed submit does not proceed | Valid form with a bad pincode | Error shown, no navigation, nothing written to `sessionStorage` | Automated |
| TC-79 | Focus goes to the topmost error | Bad email and bad pincode | Focus on email, not the last edited field | Automated |
| TC-80 | Valid submit writes and navigates | Complete the form, submit | `router.push("/payment")`; bundle stored with the exact expected shape | Automated |
| TC-81 | Storage failure does not block | `setItem` throws | Still navigates to `/payment` | Automated |
| TC-82 | Repopulation | Seed a bundle, hydrate | Name, state and optional line all prefilled | Automated |
| TC-83 | Corrupt bundle ignored | Seed `"{not json"` | Form starts empty | Automated |

### Adversarial harness check

| ID | Scenario | Steps | Expected result | Type |
| --- | --- | --- | --- | --- |
| TC-84 | The no-flash assertion can fail | Remove the `isHydrated` wait so the guard renders before the cart is read | TC-68 and TC-70 fail | Manual (injected fault) |
