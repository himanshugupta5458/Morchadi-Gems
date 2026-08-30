import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, sep } from "node:path";
import { describe, expect, it } from "vitest";
import { BUSINESS } from "@/config/business";
import {
  ADMIN_CONFIG,
  CONTACT_CONFIG,
  FLAT_SHIPPING_RATE,
  FREE_SHIPPING_THRESHOLD,
  RETURN_WINDOW_DAYS,
  SITE_CONFIG,
} from "@/lib/config";

/**
 * The test that makes "one source of truth for who this business is" real rather than a
 * convention a reviewer has to notice.
 *
 * `config/business.ts` and `config/site-facts.mjs` hold every brand, contact and policy value
 * the site states, and `lib/config.ts` derives everything else from them. That property is
 * worth exactly as much as the guarantee that nothing else writes the same value down a second
 * time — and writing it down again is easier than importing it and looks identical in the
 * rendered page, right up until the owner changes the number in one place. It is the same
 * method the catalogue's `pricing.cost` is held to, where "margin data never reaches the
 * browser" is a grep over build output rather than a reading of the module that narrows it.
 *
 * The two config files are the only files exempt. Test files are not exempt from the contact
 * details — a test asserting a literal phone number is a second copy that a rename leaves
 * behind, and the four that legitimately need one are listed by name below.
 */

const REPOSITORY_ROOT = process.cwd();

/** Where source lives. `docs/` is prose about the business and is deliberately not scanned. */
const SCANNED_DIRECTORIES: readonly string[] = ["app", "components", "lib", "types", "config", "scripts"];

const SCANNED_ROOT_FILES: readonly string[] = ["middleware.ts", "next.config.mjs", "tailwind.config.ts"];

const SCANNED_EXTENSIONS: readonly string[] = [".ts", ".tsx", ".mjs", ".js", ".jsx"];

/** The two files the values are allowed to be written down in, and nowhere else. */
const CONFIG_FILES: readonly string[] = [
  join("config", "business.ts"),
  join("config", "site-facts.mjs"),
];

/**
 * The two files that assert a literal because the literal is the thing under test: this one
 * proves the config values themselves, and `lib/admin-routing.test.ts` proves the middleware's
 * host classification, which needs a real host string written out — including a mixed-case one,
 * since normalising case is part of what it checks. Every other admin test builds its request
 * URLs from `DEFAULT_ADMIN_HOSTNAME`.
 *
 * Named rather than pattern-matched, so a new exemption has to be argued for in a diff.
 */
const EXEMPT_FILES: readonly string[] = [
  join("lib", "site-identity.test.ts"),
  join("lib", "admin-routing.test.ts"),
];

function sourceFilesUnder(directory: string): string[] {
  const absolute = join(REPOSITORY_ROOT, directory);

  return readdirSync(absolute).flatMap((entry) => {
    const relative = join(directory, entry);
    if (statSync(join(REPOSITORY_ROOT, relative)).isDirectory()) return sourceFilesUnder(relative);
    return SCANNED_EXTENSIONS.includes(extname(entry)) ? [relative] : [];
  });
}

const scannedSources: readonly { path: string; code: string }[] = [
  ...SCANNED_DIRECTORIES.flatMap(sourceFilesUnder),
  ...SCANNED_ROOT_FILES,
]
  .filter((path) => !CONFIG_FILES.includes(path) && !EXEMPT_FILES.includes(path))
  .map((path) => ({
    path,
    code: stripComments(readFileSync(join(REPOSITORY_ROOT, path), "utf8")),
  }));

/**
 * Comments are stripped before anything is matched. Dozens of doc comments in this repository
 * name the business, its support inbox and its admin hostname — `middleware.ts` explains the
 * host rewrite by naming the host it rewrites, and it should. Documentation *about* a value is
 * not a second copy *of* it: nothing renders it, and a rename that leaves a stale comment
 * behind is a wrong sentence, not a wrong page. What this file forbids is the value appearing
 * where code can read it.
 *
 * Only whole-line `//` comments are stripped, so the `//` in a `https://` inside a string
 * literal survives and the string is still searched.
 */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
}

function filesContaining(literal: string): string[] {
  return scannedSources
    .filter(({ code }) => code.includes(literal))
    .map(({ path }) => path);
}

/**
 * The contact details, as the exact strings a second copy would be written as — plus the bare
 * digit runs, which is how a `tel:` href or a wa.me link would smuggle the same number past a
 * search for its formatted form.
 */
const SINGLE_SOURCE_LITERALS: readonly { what: string; literal: string }[] = [
  { what: "the support inbox", literal: BUSINESS.supportEmail },
  { what: "the transactional sending mailbox", literal: BUSINESS.transactionalEmailFrom },
  { what: "the phone number as it displays", literal: BUSINESS.phoneDisplay },
  { what: "the phone number as bare digits", literal: BUSINESS.phoneDisplay.replace(/\D/g, "") },
  { what: "the WhatsApp number", literal: BUSINESS.whatsappNumber },
  { what: "the admin hostname", literal: BUSINESS.adminHostname },
  { what: "the registered street address", literal: BUSINESS.address.streetLine1 },
];

describe("the source tree this test reads", () => {
  it("found the files it is meant to be scanning", () => {
    expect(scannedSources.length).toBeGreaterThan(150);
    expect(scannedSources.map(({ path }) => path)).toContain(join("lib", "config.ts"));
    expect(scannedSources.map(({ path }) => path)).toContain(
      join("components", "WhatsAppButton.tsx"),
    );
  });

  it("strips comments but keeps the code around them", () => {
    const config = scannedSources.find(({ path }) => path === join("lib", "config.ts"));

    expect(config?.code).toContain("export const SITE_CONFIG");
    expect(config?.code).not.toContain("ADR-018");
  });

  it("scans with real path separators, so a nested file is reached", () => {
    const nested = scannedSources.map(({ path }) => path).filter((path) => path.includes(sep));
    expect(nested.length).toBeGreaterThan(50);
  });
});

describe("no contact detail is written down outside config/", () => {
  it.each(SINGLE_SOURCE_LITERALS.map(({ what, literal }) => [what, literal]))(
    "%s appears nowhere else in the source tree",
    (what, literal) => {
      const offenders = filesContaining(literal);

      expect(
        offenders,
        `${what} (${literal}) is hardcoded in ${offenders.join(", ")} — import it from lib/config.ts instead`,
      ).toEqual([]);
    },
  );
});

describe("the brand name is not written down outside config/", () => {
  it.each([BUSINESS.brandName, BUSINESS.legalEntityName])(
    "%s appears in no source file's code",
    (brandLiteral) => {
      const offenders = filesContaining(brandLiteral);

      expect(
        offenders,
        `the brand name is hardcoded in ${offenders.join(", ")} — read SITE_CONFIG.brandName instead`,
      ).toEqual([]);
    },
  );
});

describe("the config values the site derives everything from", () => {
  it("splits the brand name into two halves that rejoin exactly", () => {
    expect(`${SITE_CONFIG.brandNameLead} ${SITE_CONFIG.brandNameAccent}`).toBe(
      SITE_CONFIG.brandName,
    );
  });

  it("puts the brand name in front of the verified sending mailbox", () => {
    expect(CONTACT_CONFIG.transactionalFromAddress).toBe(
      `${BUSINESS.brandName} <${BUSINESS.transactionalEmailFrom}>`,
    );
  });

  it("derives the tel: href from the displayed phone number's digits", () => {
    expect(CONTACT_CONFIG.phoneHref).toBe(`tel:+${BUSINESS.phoneDisplay.replace(/\D/g, "")}`);
  });

  it("names the panel and its hostname from the same brand facts", () => {
    expect(ADMIN_CONFIG.hostname).toBe(BUSINESS.adminHostname);
    expect(ADMIN_CONFIG.title).toContain(BUSINESS.brandName);
    expect(ADMIN_CONFIG.titleTemplate).toContain(BUSINESS.brandName);
  });

  it("keeps the policy numbers as the numbers the shop actually promises", () => {
    expect(FREE_SHIPPING_THRESHOLD).toBe(799);
    expect(FLAT_SHIPPING_RATE).toBe(99);
    expect(RETURN_WINDOW_DAYS).toBe(7);
  });
});
