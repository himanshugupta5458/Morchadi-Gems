import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

import {
  chooseComposeService,
  classifyServiceHealth,
  describeDatabaseTarget,
  readServiceStatus,
} from "@/scripts/dev-stack-plan.mjs";

const REPO_ROOT = fileURLToPath(new URL("../", import.meta.url));

const LOCAL_DATABASE_URL = "postgresql://morchadi_dev:dev_local_only@localhost:5432/morchadi_gems_dev";

/**
 * The shape `docker compose config --format json` prints for the repository's own
 * docker-compose.yml, trimmed to the fields the decision reads. It is a fixture rather than a
 * live `docker compose` call so the suite runs on a machine with no Docker at all.
 */
const COMPOSE_CONFIG = {
  name: "morchadi-gems",
  services: {
    postgres: {
      container_name: "morchadi-gems-postgres",
      image: "postgres:16-alpine",
      healthcheck: {
        test: ["CMD-SHELL", "pg_isready -U morchadi_dev -d morchadi_gems_dev"],
        interval: "5s",
      },
      ports: [{ mode: "ingress", target: 5432, published: "5432", protocol: "tcp" }],
    },
  },
};

const HEALTHY_SERVICE = { hasHealthcheck: true };

describe("describeDatabaseTarget", () => {
  it("recognises the local Docker Postgres from .env.example", () => {
    const target = describeDatabaseTarget(LOCAL_DATABASE_URL);

    expect(target.kind).toBe("local");
    expect(target.host).toBe("localhost");
    expect(target.port).toBe(5432);
  });

  it.each(["127.0.0.1", "0.0.0.0"])("treats %s as this machine", (host) => {
    expect(describeDatabaseTarget(`postgresql://u:p@${host}:5432/db`).kind).toBe("local");
  });

  it("treats a bracketed IPv6 loopback as this machine", () => {
    const target = describeDatabaseTarget("postgresql://u:p@[::1]:5432/db");

    expect(target.kind).toBe("local");
    expect(target.host).toBe("::1");
  });

  it("assumes the default Postgres port when the URL omits one", () => {
    expect(describeDatabaseTarget("postgresql://u:p@localhost/db").port).toBe(5432);
  });

  it("keeps a non-default local port, so the compose lookup can use it", () => {
    expect(describeDatabaseTarget("postgresql://u:p@localhost:15432/db").port).toBe(15432);
  });

  it("calls a Coolify-hosted database remote, so no container is started for it", () => {
    const target = describeDatabaseTarget(
      "postgresql://morchadi:s3cret@db.morchadigems.com:5432/morchadi_gems?sslmode=require",
    );

    expect(target.kind).toBe("remote");
    expect(target.host).toBe("db.morchadigems.com");
    expect(target.reason).toContain("db.morchadigems.com");
  });

  it.each([
    "postgresql://u:p@postgres:5432/db",
    "postgresql://u:p@10.0.0.7:5432/db",
    "postgresql://u:p@my-db.internal:5432/db",
  ])("calls %s remote", (url) => {
    expect(describeDatabaseTarget(url).kind).toBe("remote");
  });

  it("calls a Unix-socket connection remote, because Compose does not manage it", () => {
    const target = describeDatabaseTarget("postgresql://u:p@localhost/db?host=/var/run/postgresql");

    expect(target.kind).toBe("remote");
    expect(target.host).toBe("/var/run/postgresql");
  });

  it.each([undefined, null, "", "   "])("reports %p as missing", (value) => {
    expect(describeDatabaseTarget(value as string | undefined | null).kind).toBe("missing");
  });

  it("reports an unparseable value rather than guessing at it", () => {
    expect(describeDatabaseTarget("not a url").kind).toBe("unparseable");
  });
});

describe("chooseComposeService", () => {
  it("finds the service publishing the port DATABASE_URL connects to", () => {
    const chosen = chooseComposeService(COMPOSE_CONFIG, 5432);

    expect(chosen).toMatchObject({
      ok: true,
      service: "postgres",
      containerName: "morchadi-gems-postgres",
      hasHealthcheck: true,
      matchedByPort: true,
    });
  });

  it("never needs the container name, port or credentials to be written down twice", () => {
    const renamed = {
      services: {
        db: {
          container_name: "somewhere-else",
          healthcheck: { test: ["CMD-SHELL", "pg_isready"] },
          ports: [{ published: "15432", target: 5432 }],
        },
      },
    };

    expect(chooseComposeService(renamed, 15432)).toMatchObject({
      ok: true,
      service: "db",
      containerName: "somewhere-else",
      matchedByPort: true,
    });
  });

  it("accepts the short string port form a compose file may use", () => {
    const shortForm = {
      services: {
        postgres: { healthcheck: { test: ["CMD-SHELL", "x"] }, ports: ["127.0.0.1:5432:5432"] },
      },
    };

    expect(chooseComposeService(shortForm, 5432)).toMatchObject({ ok: true, service: "postgres" });
  });

  it("matches a published port range", () => {
    const ranged = {
      services: { postgres: { ports: [{ published: "5430-5435", target: 5432 }] } },
    };

    expect(chooseComposeService(ranged, 5432)).toMatchObject({ ok: true, matchedByPort: true });
  });

  it("falls back to the only service when its port disagrees with DATABASE_URL", () => {
    const chosen = chooseComposeService(COMPOSE_CONFIG, 15432);

    expect(chosen).toMatchObject({ ok: true, service: "postgres", matchedByPort: false });
  });

  it("refuses to guess between two services publishing the same port", () => {
    const ambiguous = {
      services: {
        postgres: { ports: [{ published: "5432" }] },
        replica: { ports: [{ published: "5432" }] },
      },
    };

    const chosen = chooseComposeService(ambiguous, 5432);

    if (chosen.ok) throw new Error("expected the ambiguous compose file to be refused");
    expect(chosen.reason).toContain("5432");
  });

  it("refuses when several services exist and none publishes the port", () => {
    const unrelated = {
      services: {
        postgres: { ports: [{ published: "5432" }] },
        redis: { ports: [{ published: "6379" }] },
      },
    };

    expect(chooseComposeService(unrelated, 9999).ok).toBe(false);
  });

  it("reports a compose file with no services rather than throwing", () => {
    expect(chooseComposeService({}, 5432).ok).toBe(false);
    expect(chooseComposeService(null, 5432).ok).toBe(false);
  });

  it("notices a service whose healthcheck is disabled or absent", () => {
    const noHealthcheck = { services: { postgres: { ports: [{ published: "5432" }] } } };
    const disabled = {
      services: { postgres: { ports: [{ published: "5432" }], healthcheck: { disable: true } } },
    };

    expect(chooseComposeService(noHealthcheck, 5432)).toMatchObject({ hasHealthcheck: false });
    expect(chooseComposeService(disabled, 5432)).toMatchObject({ hasHealthcheck: false });
  });
});

describe("readServiceStatus", () => {
  const ROW = JSON.stringify({
    Service: "postgres",
    State: "running",
    Health: "healthy",
    Name: "morchadi-gems-postgres",
  });

  it("reads the line-delimited form Compose v2 prints", () => {
    expect(readServiceStatus(`${ROW}\n`, "postgres")).toEqual({
      present: true,
      state: "running",
      health: "healthy",
    });
  });

  it("reads the JSON array form other Compose versions print", () => {
    expect(readServiceStatus(`[${ROW}]`, "postgres")).toMatchObject({ present: true });
  });

  it("reports absence when no container exists yet", () => {
    expect(readServiceStatus("", "postgres").present).toBe(false);
    expect(readServiceStatus("[]", "postgres").present).toBe(false);
    expect(readServiceStatus(ROW, "redis").present).toBe(false);
  });

  it("survives a line of non-JSON noise", () => {
    expect(readServiceStatus(`warning: something\n${ROW}`, "postgres").present).toBe(true);
  });
});

describe("classifyServiceHealth", () => {
  it("waits while the container does not exist yet", () => {
    expect(
      classifyServiceHealth({ present: false, state: "", health: "" }, HEALTHY_SERVICE).verdict,
    ).toBe("waiting");
  });

  it("keeps waiting while the healthcheck is still starting", () => {
    expect(
      classifyServiceHealth({ present: true, state: "running", health: "starting" }, HEALTHY_SERVICE)
        .verdict,
    ).toBe("waiting");
  });

  it("stops only once the healthcheck itself reports healthy", () => {
    expect(
      classifyServiceHealth({ present: true, state: "running", health: "healthy" }, HEALTHY_SERVICE)
        .verdict,
    ).toBe("healthy");
  });

  it("does not call a merely running container ready", () => {
    expect(
      classifyServiceHealth({ present: true, state: "running", health: "" }, HEALTHY_SERVICE).verdict,
    ).toBe("waiting");
  });

  it("fails fast on an unhealthy or exited container", () => {
    expect(
      classifyServiceHealth({ present: true, state: "running", health: "unhealthy" }, HEALTHY_SERVICE)
        .verdict,
    ).toBe("failed");
    expect(
      classifyServiceHealth({ present: true, state: "exited", health: "" }, HEALTHY_SERVICE).verdict,
    ).toBe("failed");
  });

  it("refuses to proceed blind when the service defines no healthcheck", () => {
    expect(
      classifyServiceHealth({ present: true, state: "running", health: "" }, { hasHealthcheck: false })
        .verdict,
    ).toBe("unknowable");
  });
});

/**
 * `npm run dev:all` is a local development convenience and nothing else. These assertions are
 * the guard rail on that boundary: production is started by Coolify's own process manager and
 * production migrations are a deliberate release step, so the day someone reaches for this
 * script to do either, a test says no.
 */
describe("the dev:all boundary", () => {
  const packageJson = JSON.parse(readFileSync(`${REPO_ROOT}package.json`, "utf8")) as {
    scripts: Record<string, string>;
  };

  it("is not referenced by the Dockerfile", () => {
    expect(readFileSync(`${REPO_ROOT}Dockerfile`, "utf8")).not.toContain("dev-stack");
  });

  it("is not part of the build or of any production start command", () => {
    expect(packageJson.scripts.build).not.toContain("dev-stack");
    expect(packageJson.scripts.build).not.toContain("dev:all");
    expect(packageJson.scripts.start).not.toContain("dev-stack");
    expect(packageJson.scripts.start).not.toContain("dev:all");
  });

  it("leaves the individual commands it automates intact", () => {
    expect(packageJson.scripts.dev).toBe("next dev");
    expect(packageJson.scripts["dev:all"]).toBe("node scripts/dev-stack.mjs");
  });
});
