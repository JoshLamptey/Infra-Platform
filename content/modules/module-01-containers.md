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

A multi-stage build declares several `FROM ... AS <name>` blocks in one
file. Later stages can `COPY --from=<name>` specific files out of an
earlier stage, discarding everything else that stage produced.

## Stage walkthrough (`infra/docker/backend/Dockerfile`)

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
|---|---|
| Separate `builder`/`runtime` | Smaller final image, no compiler as attack surface |
| Wheels built once, installed via `--no-index` | Reproducible installs |
| Requirements copied before app code | Dependency layer cache survives code edits |
| Non-root `appuser` with configurable UID | Least privilege; matches host UID in dev |
| One image, multiple `CMD`s per stage/script | Web/worker/beat can't drift out of sync |
| No image-level `HEALTHCHECK` | Health semantics differ per service |
