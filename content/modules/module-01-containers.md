---
slug: module-01-containers
title: "Module 1 — Containers & the app image"
order: 1
---

## The core idea: layers, not a blob

A Docker image is a stack of read-only layers, one per instruction that
changes the filesystem. Layers are cached: if an instruction and everything
before it are unchanged, Docker reuses the cached layer. Instruction order
is a design decision — put things that change rarely (dependency lists)
above things that change constantly (source code).

A multi-stage build declares several stages in one file. Later stages can
copy specific files out of an earlier stage, discarding everything else
that stage produced:

```dockerfile
FROM python:3.12-slim AS builder
RUN pip wheel --wheel-dir /wheels -r requirements.txt

FROM python:3.12-slim AS runtime
COPY --from=builder /wheels /wheels
RUN pip install --no-index --find-links=/wheels -r requirements.txt
```

<Callout variant="why">
`runtime` never runs `pip install` against the internet — it only installs
from the local `/wheels` folder built by `builder`. That's what makes the
install reproducible: nothing here can silently pull a different package
version than what `builder` already resolved.
</Callout>

## Stage walkthrough (`infra/docker/backend/Dockerfile`)

<PipelineStages stages={[
  { name: "base", kept: true, note: "shared env flags" },
  { name: "builder", kept: false, note: "compiler + full wheel build" },
  { name: "runtime", kept: true, note: "shared foundation" },
  { name: "production", kept: true, note: "what actually ships" },
]} />

- **`base`** — shared Python environment flags.
- **`builder`** — installs a full compiler toolchain and builds wheels
  from `requirements/base.txt`. Nothing here ships to the final image.
- **`builder-dev`** — extends `builder`, adds dev-only wheels.
- **`runtime`** — installs only runtime shared libraries (no compiler),
  creates a non-root user, installs from pre-built wheels with
  `--no-index --find-links`, discards the wheels afterward.
- **`development`** — adds dev wheels back in, runs `manage.py runserver`.
- **`production`** — sets production settings, runs `/start-api.sh`.
  No image-level `HEALTHCHECK` — this image is reused for web, worker,
  beat, migrate, and collectstatic, so health semantics live in Compose.

## Why it's built this way

| Design choice | What it buys you |
| --- | --- |
| Separate `builder`/`runtime` | Smaller final image, no compiler as attack surface |
| Wheels built once, installed via `--no-index` | Reproducible installs |
| Requirements copied before app code | Dependency layer cache survives code edits |
| Non-root `appuser` with configurable UID | Least privilege; matches host UID in dev |
| One image, multiple `CMD`s per stage/script | Web/worker/beat can't drift out of sync |
| No image-level `HEALTHCHECK` | Health semantics differ per service |

<Callout variant="warning">
Only `builder` is fully discarded. `base` and `runtime` are genuine
ancestors of `production` via the `FROM` chain — their layers persist
into what ships. The thing that makes the final image small isn't that
"most stages get thrown away" — it's that the *one* stage with a compiler
toolchain in it specifically never becomes an ancestor of anything that
ships.
</Callout>
