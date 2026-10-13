---
slug: module-02-compose
title: "Module 2 — Local orchestration (Compose)"
order: 2
---

## The mental model

A Compose file describes one **stack**: a set of services (containers), the
networks they share, and the volumes that hold their data. `docker compose up`
reads the file and makes reality match it.

The five files in `infra/compose/` describe the *same application* five
times, each shaped for a different audience:

| File | Audience | Defining trait |
| --- | --- | --- |
| `dev.yml` | you, writing code | builds from source, bind-mounts your working tree |
| `dev-image.yml` | you, sanity-checking | runs the exact prebuilt image, no source mounted |
| `staging.yml` | the staging server | prebuilt image only, resource limits, nginx in front |
| `hotfix-validation.yml` | the hotfix gate | staging's shape with its own env file and project name |
| `prod.yml` | production | staging's shape plus TLS, bigger limits, `restart: always` |

The `name:` at the top of each file (`erp-dev`, `erp-staging`, `erp-prod`)
sets the **project name**. Compose prefixes every container, network, and
named volume with it, so `postgres_data` in `dev.yml` is really
`erp-dev_postgres_data`. That prefix is what stops two environments on one
machine from sharing a database by accident.

## Variables: three forms and one escape

Open any compose file and you will see these four shapes:

```yaml
image: ${POSTGRES_IMAGE:?load infra/pins.env}
mem_limit: ${REDIS_MEM_LIMIT:-256m}
image: ${APP_IMAGE}
test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
```

| Syntax | What happens |
| --- | --- |
| `${VAR:-default}` | use `default` if `VAR` is unset or empty |
| `${VAR:?message}` | **stop with an error** carrying `message` if `VAR` is unset or empty |
| `${VAR}` | substitute the value; an unset variable becomes an empty string |
| `$$` | a literal `$`, left for the container's own shell to expand later |

> Why this matters: Image references use `:?` and tuning knobs use `:-`, and that split is
deliberate. A missing image pin should be a loud failure at render time,
because a silent fallback would let an unpinned image into the stack and
quietly defeat the digest pinning in `infra/pins.env`. A missing memory limit
has a sensible default, so a default is fine.

The `$$` in the healthcheck matters. Compose interpolates `${...}` and `$VAR`
while it reads the YAML, on the host, before any container exists.
`POSTGRES_USER` is only known *inside* the Postgres container, so `$$` makes
Compose hand a single `$` through for the container's shell to resolve when
the check runs.

> Warning: There are two different "env files" and they are easy to confuse.
`--env-file env/.env.dev` on the command line fills in the `${...}` values
while Compose reads the YAML. `env_file:` inside a service injects variables
into that container's environment at runtime. Different jobs, different
moments. And the shell's own environment beats `--env-file` when both define
a name, which is exactly how `deploy.sh` supplies `APP_IMAGE` per deploy
without touching the YAML.

## YAML anchors and `x-` fields

```yaml
x-json-logging: &json-logging
  driver: json-file
  options:
    max-size: "10m"
    max-file: "3"

services:
  db:
    logging: *json-logging
  redis:
    logging: *json-logging
```

`&json-logging` defines an anchor, `*json-logging` reuses it. Compose ignores
any top-level key starting with `x-`, which makes it the sanctioned place to
park reusable fragments. The logging block caps each container at about 30 MB
of logs. Without a cap, Docker's default `json-file` driver grows without limit
until the disk fills.

`dev.yml` uses the same trick for the image:

```yaml
x-backend-image: &backend-image erp_dev_backend:dev

services:
  api:
    image: *backend-image
    build: *backend-build
  migrate:
    image: *backend-image
```

Only `api` has a `build:` key. `migrate`, `worker`, `beat`, and
`collectstatic` reuse the tag that `api` builds. That produces a first-run
trap worth remembering: run `migrate` before anything has built the image and
Compose tries to *pull* `erp_dev_backend:dev` from a registry, where it does
not exist. Build through `api` first.

## Start order is not readiness

```yaml
db:
  healthcheck:
    test: ["CMD-SHELL", "pg_isready -U $$POSTGRES_USER -d $$POSTGRES_DB"]
    interval: 10s
    timeout: 5s
    retries: 5

api:
  depends_on:
    db:
      condition: service_healthy
    redis:
      condition: service_healthy
```

A container is *started* the moment its process launches. Postgres launches
long before it accepts connections, and on a first boot it spends extra time
initialising its data directory. The short form `depends_on: [db]` waits only
for "started", so `api` and `migrate` would race the database and fail
intermittently. `condition: service_healthy` waits for the healthcheck to
report success instead.

In the deployed files, each service gets a check shaped to what "alive"
means for *it* (`dev.yml` skips most of these, since you are watching it
yourself):

| Service | Check | Why that shape |
| --- | --- | --- |
| `db` | `pg_isready` | asks Postgres directly whether it accepts connections |
| `redis` | `redis-cli ping` | the protocol's own liveness probe |
| `api` | `curl` against `/health/liveness/` | proves the web app answers HTTP |
| `worker` | `celery inspect ping` | a worker has no port, so ask it over the broker |
| `beat` | grep the process command line | beat cannot be pinged at all |

This is the payoff of Module 1's decision to keep `HEALTHCHECK` out of the
image. One image, five different definitions of healthy, owned by Compose.

The app adds its own second layer: `entrypoint.sh` runs `wait_for_db` and
`wait_for_redis` before the real command. Compose gates the *start*, the
entrypoint gates the *app*. Belt and braces.

`nginx` is the exception: it uses `condition: service_started` for `api`. It
needs the `api` container to exist on the network, so its hostname resolves,
but it can tolerate `api` still warming up. That is a judgement call you
should be able to defend.

## Where data lives

```yaml
# dev.yml, api service
volumes:
  - ../../:/app
  - ../../storage/static:/app/staticfiles

# dev.yml, db service
volumes:
  - postgres_data:/var/lib/postgresql/data
```

| Kind | Looks like | Lifetime | Used for |
| --- | --- | --- | --- |
| Bind mount | `../../:/app` | it *is* a host folder | live code in dev, static/media/logs elsewhere |
| Named volume | `postgres_data:/var/...` | managed by Docker, survives `down` | the database, Redis data |

Two details. Relative paths in a compose file resolve against the *file's own
folder*, not your shell's working directory, which is why you see `../../`
(from `infra/compose/` back to the repo root). And the bind mount of the whole
source tree is what makes `runserver` hot-reload. In staging and prod there is
no source mount at all: the code in the container is exactly the code in the
image.

> Warning: `docker compose down` keeps named volumes. `docker compose down -v`
deletes them, and with them your dev database. Reach for `-v` only when you
actually want a clean slate.

## Ports: who can reach what

| Syntax | Reachable from |
| --- | --- |
| `"8039:8000"` | every network interface on the host, including your LAN |
| `"127.0.0.1:5439:5432"` | this machine only (loopback) |
| `expose: ["8000"]` | not published to the host at all |

`expose` documents a port for other containers and publishes nothing to the
host. Containers on one Compose network can reach each other on any listening
port regardless, so `expose` is documentation, not a firewall.

The dev database and Redis sit on host ports 5439 and 6339, not the usual 5432
and 6379, so they do not collide with a Postgres or Redis you already run
locally. Notice that `dev.yml` and `dev-image.yml` both claim 5439 and 6339,
so you cannot run both stacks at once.

In staging and prod the rule flips: `db` and `redis` publish **nothing**,
`api` only uses `expose`, and `nginx` is the single published entry point
(80 in staging, 80 and 443 in prod). `scripts/verify_infra_policy.py` enforces
the database and Redis part in CI, so a stray `ports:` fails the PR.

## Profiles: jobs that are not services

```yaml
migrate:
  command: ["python", "manage.py", "migrate", "--noinput"]
  profiles: ["migrate"]
```

`docker compose up` skips any service that has a profile. `migrate` and
`collectstatic` are *tasks*, not long-running services, so they only run when
asked:

```bash
docker compose -f infra/compose/dev.yml --env-file env/.env.dev run --rm migrate
```

`run` starts a one-off container (after its `depends_on` conditions pass) and
`--rm` deletes it when it exits. This is exactly what `deploy.sh` does in its
migration gate: bring up `db` and `redis`, `run --rm migrate`, `run --rm
collectstatic`, and only *then* start `api`, `worker`, `beat`, and `nginx`.
You will take that script apart in Module 8.

## dev.yml versus dev-image.yml

| | `dev.yml` | `dev-image.yml` |
| --- | --- | --- |
| Image | `build:` from your source | `image: ${APP_IMAGE}` prebuilt |
| Source | bind-mounted, live | none, baked into the image |
| API process | Django `runserver` | the image's own `start-api.sh` (Daphne) |
| Healthchecks | none on `api` | same as staging and prod |
| Tests | the code you are writing | **the artifact that will ship** |

`dev-image.yml` demands `APP_IMAGE` through a `:?` guard, with a message that
says it must be the GHCR digest reference. It exercises the production start
path locally, including the production `CMD`.

That is also why the policy script forbids `build:` in every non-dev compose
file. A server that builds its own image deploys something CI never scanned or
tested. Staging and prod only ever *pull* an image that already passed the
pipeline. Hold that thought for Module 7.

## How the environments differ

| | Dev | Staging | Prod |
| --- | --- | --- | --- |
| Image | built locally | `APP_IMAGE` | `APP_IMAGE` |
| Source mount | yes | no | no |
| `restart` | none | `unless-stopped` | `always` |
| Resource limits | none | `cpus`, `mem_limit`, `pids_limit` | larger limits |
| Log rotation | none | 10 MB x 3 | 10 MB x 3 |
| DB and Redis ports | loopback | not published | not published |
| Front door | `api` on 8039 | nginx on 80 | nginx on 80 and 443 |

`unless-stopped` and `always` differ in one case: after the Docker daemon or
host restarts, `always` brings back even a container you stopped by hand, while
`unless-stopped` respects that you stopped it.

The limits deserve a careful read. `cpus` caps CPU, `mem_limit` makes the
kernel kill the container if it exceeds the cap, and `pids_limit` caps the
process count, a guard against fork bombs. The `${VAR:-default}` pattern lets
each host tune them from its env file without editing the YAML. One principle
to carry forward: the kernel enforces `mem_limit`, while software such as
Redis or Postgres enforces its own memory settings separately, and neither one
knows about the other.

## Run it yourself

From the repository root. This is the hands-on half of the module, and it
mirrors what `pr-checks.yml` does when it renders every compose file.

```bash
cp env/.env.dev.example env/.env.dev        # first time only

# 1. Watch the :? guard fire. pins.env is not loaded yet.
docker compose -f infra/compose/dev.yml --env-file env/.env.dev config

# 2. Load the pins into your shell, then render the resolved file.
set -a; . infra/pins.env; set +a
docker compose -f infra/compose/dev.yml --env-file env/.env.dev config

# 3. Bring the stack up. api builds the image the others reuse.
docker compose -f infra/compose/dev.yml --env-file env/.env.dev up -d --build db redis api
docker compose -f infra/compose/dev.yml --env-file env/.env.dev ps

# 4. Run the one-shot migration job.
docker compose -f infra/compose/dev.yml --env-file env/.env.dev run --rm migrate

# 5. Tear down. Add -v only if you want the database volume gone too.
docker compose -f infra/compose/dev.yml --env-file env/.env.dev down
```

Things to confirm with your own eyes:

- In step 1 the error names the missing variable and carries the
  `load infra/pins.env` message.
- In step 2's output, search for `pg_isready`. The `$$` has become a single
  `$`, and every `${...}` has resolved to a real value.
- In step 3's `ps`, `db` and `redis` report `(healthy)`, and `api` only
  started after both did.
