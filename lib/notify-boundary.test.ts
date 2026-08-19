import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * `lib/notify.ts` is the only module that reads `CALLMEBOT_APIKEY`. Neither of its variables
 * carries the `NEXT_PUBLIC_` prefix, so Next would replace them with `undefined` in a browser
 * bundle rather than inline the key — but that is a property of the build, not a decision
 * anybody made, and it would stop protecting us the moment somebody renamed a variable.
 *
 * This asserts the boundary directly instead: no file that declares `"use client"` may reach
 * the module that reads the secret, however indirectly. `lib/notify-client.ts` is the browser
 * half and deliberately knows nothing except the path of our own route.
 */
const SCANNED_ROOTS = ["app", "components", "lib"];
const SECRET_READING_MODULE = "@/lib/notify";

function collectSourceFiles(root: string): string[] {
  return readdirSync(root).flatMap((entry) => {
    const path = join(root, entry);
    if (statSync(path).isDirectory()) return collectSourceFiles(path);
    if (path.includes(".test.")) return [];
    return path.endsWith(".ts") || path.endsWith(".tsx") ? [path] : [];
  });
}

function importsOf(source: string): string[] {
  const specifiers: string[] = [];
  const importPattern = /from\s+"([^"]+)"/g;

  let match = importPattern.exec(source);
  while (match !== null) {
    specifiers.push(match[1]);
    match = importPattern.exec(source);
  }

  return specifiers;
}

function isClientModule(source: string): boolean {
  return /^\s*["']use client["']/m.test(source);
}

function resolveLocalImport(specifier: string): string | null {
  if (!specifier.startsWith("@/")) return null;

  const base = specifier.slice(2);
  for (const extension of [".ts", ".tsx"]) {
    const candidate = `${base}${extension}`;
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {
      continue;
    }
  }
  return null;
}

/** Every local module reachable from `entry`, following `@/` imports. */
function collectReachable(entry: string): Set<string> {
  const seen = new Set<string>();
  const queue = [entry];

  while (queue.length > 0) {
    const current = queue.pop();
    if (current === undefined || seen.has(current)) continue;
    seen.add(current);

    for (const specifier of importsOf(readFileSync(current, "utf8"))) {
      const resolved = resolveLocalImport(specifier);
      if (resolved !== null) queue.push(resolved);
    }
  }

  return seen;
}

describe("the CallMeBot key never crosses into the browser", () => {
  const sourceFiles = SCANNED_ROOTS.flatMap(collectSourceFiles);
  const clientFiles = sourceFiles.filter((path) =>
    isClientModule(readFileSync(path, "utf8")),
  );

  it("finds the client modules it is meant to be checking", () => {
    expect(clientFiles.length).toBeGreaterThan(0);
    expect(clientFiles).toContain("components/OrderConfirmation.tsx");
  });

  it("is read from the environment by exactly one module", () => {
    const readers = sourceFiles.filter((path) =>
      readFileSync(path, "utf8").includes("process.env.CALLMEBOT_APIKEY"),
    );

    expect(readers).toEqual(["lib/notify.ts"]);
    expect(isClientModule(readFileSync("lib/notify.ts", "utf8"))).toBe(false);
  });

  it("is not so much as named in a client module", () => {
    const offenders = clientFiles.filter((path) =>
      readFileSync(path, "utf8").includes("CALLMEBOT"),
    );

    expect(offenders).toEqual([]);
  });

  it("is unreachable from every client module, at any import depth", () => {
    const secretModule = resolveLocalImport(SECRET_READING_MODULE);
    expect(secretModule).toBe("lib/notify.ts");

    const offenders = clientFiles.filter((path) =>
      collectReachable(path).has("lib/notify.ts"),
    );

    expect(offenders).toEqual([]);
  });

  it("keeps the browser half knowing nothing but our own route", () => {
    const browserHalf = readFileSync("lib/notify-client.ts", "utf8");

    expect(browserHalf).not.toContain("callmebot");
    expect(browserHalf).not.toContain("CALLMEBOT");
    expect(browserHalf).toContain("NOTIFY_ADMIN_API_PATH");
  });
});
