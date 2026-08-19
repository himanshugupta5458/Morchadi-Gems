# Documentation

Every prompt that changes this repository must also update the relevant folder below
before finishing. See [`CLAUDE.md`](../CLAUDE.md) for the full rule.

| Folder | Purpose |
| --- | --- |
| [`decisions/`](decisions/) | Architecture Decision Records — why the project is built the way it is |
| [`api/`](api/) | Endpoint contracts — request, response, errors, validation rules |
| [`design/`](design/) | Design tokens and component reference — how to build a page that matches the rest |
| [`progress/`](progress/) | `BUILD_LOG.md`, the running record of what each prompt built |
| [`logs/`](logs/) | Diagnosis and error-resolution logs — symptom, root cause, fix |
| [`testing/`](testing/) | Test plans and their results |

Each folder has its own `README.md` with its file-naming convention. Read it before adding
a file.

Deployment lives outside this tree: [`DEPLOY.md`](../DEPLOY.md) at the repo root is the
Coolify procedure, and [`decisions/ADR-032-coolify-docker-deploy.md`](decisions/ADR-032-coolify-docker-deploy.md)
is the reasoning behind the container.
