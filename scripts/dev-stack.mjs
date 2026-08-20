/**
 * `npm run dev:all` — start the local Postgres container, wait for it to report healthy, apply
 * pending migrations, then start the Next.js dev server. One command in place of three.
 *
 * ─────────────────────────────────────────────────────────────────────────────────────────
 * LOCAL DEVELOPMENT ONLY. THIS SCRIPT MUST NEVER BE WIRED INTO DEPLOYMENT.
 *
 * It is not referenced by the Dockerfile, by any production start command, or by
 * `npm run build`, and it must stay that way. Production is started by Coolify's own process
 * manager (ADR-032), and production migrations are a deliberate, separate release step — not
 * something an ad-hoc developer convenience runs on the way past. Two of the things this
 * script does are actively wrong in production: `docker compose up -d` refers to a compose
 * file that describes a throwaway database with committed credentials, and `next dev` is not
 * a production server. See docs/DEV-DATABASE.md.
 * ─────────────────────────────────────────────────────────────────────────────────────────
 *
 * Nothing about the container, the port or the credentials is written down here. The database
 * host and port come from DATABASE_URL; the service and container name come from
 * docker-compose.yml, read through `docker compose config`. Both stay the single source of
 * truth they already were, and neither can drift out of step with a copy kept in this file.
 */

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

import {
  chooseComposeService,
  classifyServiceHealth,
  describeDatabaseTarget,
  readServiceStatus,
} from "./dev-stack-plan.mjs";

const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), "..");

const HEALTH_POLL_INTERVAL_MS = 1000;

/**
 * Long enough for a cold `postgres:16-alpine` to initialise a brand new volume, which is the
 * slowest honest start there is; short enough that a container which is never going to come up
 * says so rather than hanging the terminal.
 */
const HEALTH_TIMEOUT_MS = 60000;

const npmExecutable = process.platform === "win32" ? "npm.cmd" : "npm";
const npxExecutable = process.platform === "win32" ? "npx.cmd" : "npx";

/**
 * `DATABASE_URL` lives in .env for the Prisma CLI and in .env.local for the Next app
 * (docs/DEV-DATABASE.md). A plain node script loads neither by itself, so both are tried, and
 * an already-set variable wins over both — which is how a one-off run against a different
 * database is done without editing a file. Same order as scripts/seed-admin.mjs.
 */
function loadEnvironment() {
  if (typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0) {
    return;
  }

  for (const filename of [".env", ".env.local"]) {
    try {
      process.loadEnvFile(join(REPO_ROOT, filename));
    } catch {
      continue;
    }

    if (typeof process.env.DATABASE_URL === "string" && process.env.DATABASE_URL.length > 0) {
      return;
    }
  }
}

function announce(message) {
  process.stdout.write(`\n▸ ${message}\n`);
}

function note(message) {
  process.stdout.write(`  ${message}\n`);
}

function fail(message, remedies = []) {
  process.stderr.write(`\n✖ ${message}\n`);
  for (const remedy of remedies) {
    process.stderr.write(`  → ${remedy}\n`);
  }
  process.stderr.write("\n");
  process.exit(1);
}

function runStreaming(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: "inherit" });
    child.on("error", () => resolve({ code: null, spawnFailed: true }));
    child.on("close", (code) => resolve({ code, spawnFailed: false }));
  });
}

function runCapturing(command, args) {
  return new Promise((resolve) => {
    const child = spawn(command, args, { cwd: REPO_ROOT, stdio: ["ignore", "pipe", "pipe"] });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (chunk) => {
      stdout += chunk;
    });
    child.stderr.on("data", (chunk) => {
      stderr += chunk;
    });

    child.on("error", () => resolve({ code: null, stdout, stderr, spawnFailed: true }));
    child.on("close", (code) => resolve({ code, stdout, stderr, spawnFailed: false }));
  });
}

function wait(milliseconds) {
  return new Promise((resolve) => {
    setTimeout(resolve, milliseconds);
  });
}

async function readComposeService(port) {
  const config = await runCapturing("docker", ["compose", "config", "--format", "json"]);

  if (config.spawnFailed) {
    fail("Docker is not installed, or `docker` is not on PATH.", [
      "Install Docker, or point DATABASE_URL at a database you start yourself.",
      "Every step can also be run by hand — see docs/DEV-DATABASE.md.",
    ]);
  }

  if (config.code !== 0) {
    fail("`docker compose config` failed, so docker-compose.yml could not be read.", [
      config.stderr.trim() || "Run `docker compose config` to see the error in full.",
    ]);
  }

  let parsed;
  try {
    parsed = JSON.parse(config.stdout);
  } catch {
    return fail("`docker compose config --format json` did not return JSON.", [
      "Docker Compose v2 is required. Check with `docker compose version`.",
    ]);
  }

  const chosen = chooseComposeService(parsed, port);

  if (!chosen.ok) {
    fail(`Could not tell which compose service DATABASE_URL points at: ${chosen.reason}.`, [
      "Check that the port in DATABASE_URL matches the published port in docker-compose.yml.",
      "docs/DEV-DATABASE.md lists every place that port appears.",
    ]);
  }

  if (!chosen.matchedByPort) {
    note(
      `docker-compose.yml publishes no service on port ${port}; using its only service "${chosen.service}".`,
    );
  }

  return chosen;
}

async function startLocalPostgres(service) {
  announce(`Starting Postgres (compose service "${service.service}")`);

  const started = await runStreaming("docker", ["compose", "up", "-d", service.service]);

  if (started.spawnFailed || started.code !== 0) {
    fail("`docker compose up -d` failed.", [
      "Is the Docker daemon running?",
      "If port 5432 is already taken, `docker ps -a` usually finds the culprit.",
      "docs/DEV-DATABASE.md has the troubleshooting list.",
    ]);
  }
}

async function waitForHealthyPostgres(service) {
  announce(`Waiting for "${service.service}" to report healthy`);

  const deadline = Date.now() + HEALTH_TIMEOUT_MS;
  let lastDetail = "";

  while (Date.now() < deadline) {
    const ps = await runCapturing("docker", ["compose", "ps", "--all", "--format", "json"]);
    const status = readServiceStatus(ps.stdout, service.service);
    const classified = classifyServiceHealth(status, service);

    if (classified.verdict === "healthy") {
      note("healthy — accepting connections");
      return;
    }

    if (classified.verdict === "failed") {
      fail(`Postgres will not start: ${classified.detail}.`, [
        `docker compose logs ${service.service}`,
        "A volume created with different credentials is the usual cause — docs/DEV-DATABASE.md.",
      ]);
    }

    if (classified.verdict === "unknowable") {
      fail(`Cannot confirm Postgres is ready: ${classified.detail}.`, [
        "Restore the healthcheck in docker-compose.yml, or run the three steps by hand.",
        "docs/DEV-DATABASE.md documents both.",
      ]);
    }

    if (classified.detail !== lastDetail) {
      note(`${classified.detail}…`);
      lastDetail = classified.detail;
    }

    await wait(HEALTH_POLL_INTERVAL_MS);
  }

  fail(
    `Postgres did not report healthy within ${HEALTH_TIMEOUT_MS / 1000} seconds (last seen: ${lastDetail || "no container"}).`,
    [
      "docker compose ps",
      `docker compose logs ${service.service}`,
      "Nothing was run against the database — it is not ready, so migrations were not attempted.",
    ],
  );
}

async function applyPendingMigrations() {
  announce("Applying pending migrations (prisma migrate deploy)");

  const migrated = await runStreaming(npxExecutable, ["prisma", "migrate", "deploy"]);

  if (migrated.spawnFailed || migrated.code !== 0) {
    fail("`npx prisma migrate deploy` failed, so the dev server was not started.", [
      "npx prisma migrate status",
      "If the database and the migration history have diverged, `npx prisma migrate reset` is the local fix — it wipes all data.",
    ]);
  }
}

function startDevServer() {
  announce("Starting the Next.js dev server (npm run dev)");

  const devServer = spawn(npmExecutable, ["run", "dev"], { cwd: REPO_ROOT, stdio: "inherit" });

  const forwardSignal = (signal) => {
    process.on(signal, () => {
      devServer.kill(signal);
    });
  };
  forwardSignal("SIGINT");
  forwardSignal("SIGTERM");

  devServer.on("error", () => {
    fail("Could not start the dev server.", ["Run `npm run dev` on its own to see why."]);
  });

  devServer.on("close", (code, signal) => {
    process.exit(signal !== null ? 0 : (code ?? 0));
  });
}

async function main() {
  loadEnvironment();

  const target = describeDatabaseTarget(process.env.DATABASE_URL);

  if (target.kind === "missing") {
    fail("DATABASE_URL is not set.", [
      "Copy the DATABASE_URL line from .env.example into .env and .env.local.",
      "docs/DEV-DATABASE.md explains why it has to be in both.",
    ]);
  }

  if (target.kind === "unparseable") {
    fail("DATABASE_URL is not a URL that can be parsed.", [
      "It should look like postgresql://user:password@host:5432/database.",
    ]);
  }

  if (target.kind === "local") {
    const service = await readComposeService(target.port);
    await startLocalPostgres(service);
    await waitForHealthyPostgres(service);
  } else {
    announce("Skipping the local Postgres container");
    note(`DATABASE_URL ${target.reason}.`);
    note("Nothing local to start or wait for; going straight to migrations.");
  }

  await applyPendingMigrations();
  startDevServer();
}

await main();
