/**
 * Decision logic for `npm run dev:all` (scripts/dev-stack.mjs).
 *
 * LOCAL DEVELOPMENT ONLY. Nothing here is imported by the application, the Dockerfile or any
 * production start command — see the boundary note at the head of scripts/dev-stack.mjs.
 *
 * Every function is pure: it takes strings and already-parsed JSON and returns a plain object.
 * That is the whole reason this file is separate from the runner — the "is this database the
 * local Docker one, and which compose service is it?" decision is the part worth testing, and a
 * pure module can be exercised from lib/dev-stack-plan.test.ts without a Docker daemon, a
 * network or a remote database to point at.
 */

/**
 * Hosts that mean "a server on this machine". `0.0.0.0` is included because it is what a
 * copy-pasted bind address usually is, and connecting to it reaches the same local listener.
 */
const LOCAL_HOSTNAMES = new Set(["localhost", "127.0.0.1", "::1", "0.0.0.0"]);

const DEFAULT_POSTGRES_PORT = 5432;

/**
 * Decides whether `DATABASE_URL` points at the Postgres that docker-compose.yml manages, and so
 * whether there is anything for the runner to start and wait for at all.
 *
 * A remote database — the Coolify-hosted one this project will have one day — is not ours to
 * start, so the answer there is `remote` and the runner goes straight to migrations. A URL that
 * carries a `host=` parameter is a Unix-socket connection to a server outside Docker, which is
 * equally not ours to start.
 *
 * @param {string | undefined | null} databaseUrl
 * @returns {{ kind: "local" | "remote" | "missing" | "unparseable", host: string | null, port: number | null, reason: string }}
 */
export function describeDatabaseTarget(databaseUrl) {
  if (typeof databaseUrl !== "string" || databaseUrl.trim().length === 0) {
    return {
      kind: "missing",
      host: null,
      port: null,
      reason: "DATABASE_URL is not set in the environment, .env or .env.local",
    };
  }

  let parsed;
  try {
    parsed = new URL(databaseUrl.trim());
  } catch {
    return {
      kind: "unparseable",
      host: null,
      port: null,
      reason: "DATABASE_URL is not a URL that can be parsed",
    };
  }

  const socketDirectory = parsed.searchParams.get("host");
  if (typeof socketDirectory === "string" && socketDirectory.length > 0) {
    return {
      kind: "remote",
      host: socketDirectory,
      port: null,
      reason: `connects over the Unix socket at ${socketDirectory}, which Docker Compose does not manage`,
    };
  }

  const host = decodeURIComponent(parsed.hostname).replace(/^\[|\]$/g, "");
  const port = parsed.port.length > 0 ? Number(parsed.port) : DEFAULT_POSTGRES_PORT;

  if (!LOCAL_HOSTNAMES.has(host)) {
    return {
      kind: "remote",
      host,
      port,
      reason: `host ${host} is not this machine, so there is no local container to start`,
    };
  }

  return {
    kind: "local",
    host,
    port,
    reason: `host ${host}:${port} is this machine, where docker-compose.yml runs Postgres`,
  };
}

function readPublishedPorts(portEntry) {
  if (portEntry === null || portEntry === undefined) return [];

  if (typeof portEntry === "object") {
    return expandPublishedRange(portEntry.published);
  }

  if (typeof portEntry === "number") {
    return [portEntry];
  }

  if (typeof portEntry !== "string") return [];

  const segments = portEntry.split(":");
  if (segments.length < 2) return [];

  return expandPublishedRange(segments[segments.length - 2]);
}

function expandPublishedRange(published) {
  if (typeof published === "number") {
    return Number.isInteger(published) ? [published] : [];
  }

  if (typeof published !== "string" || published.length === 0) return [];

  const [lowText, highText] = published.split("-");
  const low = Number(lowText);
  const high = highText === undefined ? low : Number(highText);

  if (!Number.isInteger(low) || !Number.isInteger(high) || high < low) return [];

  const ports = [];
  for (let port = low; port <= high; port += 1) ports.push(port);
  return ports;
}

/**
 * Finds the compose service that publishes `port`, so the runner never has to name the service,
 * the container or the port itself — docker-compose.yml stays the only place those live.
 *
 * A compose file with exactly one service is matched even when its published port does not line
 * up, because that is far more likely to be a port that was changed in one file and not the
 * other than it is to be a second database nobody declared.
 *
 * @param {unknown} composeConfig Parsed output of `docker compose config --format json`.
 * @param {number} port The host port DATABASE_URL connects to.
 * @returns {{ ok: true, service: string, containerName: string | null, hasHealthcheck: boolean, matchedByPort: boolean } | { ok: false, reason: string }}
 */
export function chooseComposeService(composeConfig, port) {
  const services =
    composeConfig !== null && typeof composeConfig === "object" && composeConfig.services !== null && typeof composeConfig.services === "object"
      ? Object.entries(composeConfig.services)
      : [];

  if (services.length === 0) {
    return { ok: false, reason: "docker-compose.yml declares no services" };
  }

  const matches = services.filter(([, definition]) => {
    const ports = Array.isArray(definition?.ports) ? definition.ports : [];
    return ports.some((portEntry) => readPublishedPorts(portEntry).includes(port));
  });

  if (matches.length === 1) {
    return describeChosenService(matches[0], true);
  }

  if (matches.length > 1) {
    const names = matches.map(([name]) => name).join(", ");
    return {
      ok: false,
      reason: `${matches.length} compose services publish port ${port} (${names}); cannot tell which one DATABASE_URL means`,
    };
  }

  if (services.length === 1) {
    return describeChosenService(services[0], false);
  }

  const names = services.map(([name]) => name).join(", ");
  return {
    ok: false,
    reason: `no compose service publishes port ${port} (services: ${names})`,
  };
}

function describeChosenService([service, definition], matchedByPort) {
  const healthcheck = definition?.healthcheck;
  const hasHealthcheck =
    healthcheck !== null &&
    typeof healthcheck === "object" &&
    healthcheck.disable !== true &&
    Array.isArray(healthcheck.test) &&
    healthcheck.test.length > 0;

  return {
    ok: true,
    service,
    containerName: typeof definition?.container_name === "string" ? definition.container_name : null,
    hasHealthcheck,
    matchedByPort,
  };
}

/**
 * Reads one service's row out of `docker compose ps --format json`, which emits either a JSON
 * array or one JSON object per line depending on the Compose version. Both are accepted rather
 * than pinning a version, since the developer's Docker is not this repository's to choose.
 *
 * @param {string} psOutput
 * @param {string} service
 * @returns {{ present: boolean, state: string, health: string }}
 */
export function readServiceStatus(psOutput, service) {
  const absent = { present: false, state: "", health: "" };

  const rows = parseComposePsRows(psOutput);
  const row = rows.find((candidate) => candidate?.Service === service);

  if (row === undefined) return absent;

  return {
    present: true,
    state: typeof row.State === "string" ? row.State : "",
    health: typeof row.Health === "string" ? row.Health : "",
  };
}

function parseComposePsRows(psOutput) {
  if (typeof psOutput !== "string" || psOutput.trim().length === 0) return [];

  try {
    const parsed = JSON.parse(psOutput);
    if (Array.isArray(parsed)) return parsed;
    if (parsed !== null && typeof parsed === "object") return [parsed];
  } catch {
    /* falls through to the line-delimited form below */
  }

  const rows = [];
  for (const line of psOutput.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.length === 0) continue;
    try {
      rows.push(JSON.parse(trimmed));
    } catch {
      continue;
    }
  }
  return rows;
}

/**
 * Turns a container's state and health into the one thing the polling loop needs to know: keep
 * waiting, stop happily, or stop and say what is wrong.
 *
 * `healthy` here means Postgres answered its own `pg_isready` healthcheck, not merely that the
 * container process started — the two are seconds apart and migrations run in that gap fail.
 *
 * @param {{ present: boolean, state: string, health: string }} status
 * @param {{ hasHealthcheck: boolean }} service
 * @returns {{ verdict: "healthy" | "waiting" | "failed" | "unknowable", detail: string }}
 */
export function classifyServiceHealth(status, service) {
  if (!status.present) {
    return { verdict: "waiting", detail: "no container yet" };
  }

  if (status.state === "exited" || status.state === "dead" || status.state === "removing") {
    return { verdict: "failed", detail: `container ${status.state}` };
  }

  if (!service.hasHealthcheck) {
    return {
      verdict: "unknowable",
      detail: "the compose service defines no healthcheck, so readiness cannot be observed",
    };
  }

  if (status.health === "healthy") {
    return { verdict: "healthy", detail: "healthy" };
  }

  if (status.health === "unhealthy") {
    return { verdict: "failed", detail: "healthcheck reports unhealthy" };
  }

  return { verdict: "waiting", detail: status.health.length > 0 ? status.health : status.state || "starting" };
}
