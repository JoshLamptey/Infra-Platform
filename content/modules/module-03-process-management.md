---
slug: module-03-process-management
title: "Module 3 — Process management"
order: 3
---

## One image, three kinds of process

Module 1 ended with a puzzle: the production image has a single `CMD`, yet it
runs the web server, the Celery worker, and the Celery scheduler. Module 2
showed the mechanism, which is that Compose overrides the command per service.
This module is about what those commands actually *start*.

| Process | Script | Job | How many |
| --- | --- | --- | --- |
| web | `start-api.sh` | Daphne serves HTTP and WebSockets | as many as traffic needs |
| worker | `start-worker.sh` | runs background tasks | as many as load needs |
| beat | `start-beat.sh` | enqueues scheduled tasks on time | **exactly one** |

The wiring lives in the Dockerfile:

```dockerfile
COPY infra/docker/backend/entrypoint.sh   /entrypoint.sh
COPY infra/docker/backend/start-api.sh    /start-api.sh
COPY infra/docker/backend/start-worker.sh /start-worker.sh
COPY infra/docker/backend/start-beat.sh   /start-beat.sh

ENTRYPOINT ["/entrypoint.sh"]
CMD ["/start-api.sh"]
```

`ENTRYPOINT` and `CMD` are not the same thing. `CMD` is the default
*argument list*; the compose `command:` key replaces it. `ENTRYPOINT` is the
fixed program that receives that list, and a compose `command:` does **not**
replace it. So `/entrypoint.sh` runs first in every container (web, worker,
beat, even the one-shot `migrate`), waits for Postgres and Redis, then hands
over to whatever `command` was given.

## The `exec` rule

Look at the last line of each script:

```bash
# entrypoint.sh
exec "$@"

# start-worker.sh
exec celery -A erp worker --loglevel=... --concurrency=...
```

`exec` replaces the running shell with the new program instead of starting it
as a child. Follow the chain for a worker container:

```text
/entrypoint.sh   (PID 1)
   exec "$@"   becomes /start-worker.sh   (still PID 1)
      exec celery ...   becomes celery   (still PID 1)
```

Three programs, one process. By the end, Celery *is* PID 1.

- **Why `exec` matters:** `docker stop` sends SIGTERM to PID 1 and nothing else.
  If the script had launched Celery as a child without `exec`, the shell would
  be PID 1, would not pass the signal on, and Docker would wait out its grace
  period (10 seconds by default) and then send SIGKILL. Graceful shutdown would
  never happen. With `exec`, the server itself receives the signal and can shut
  down cleanly.

Two further consequences, one of them in the repo already:

- **The beat healthcheck depends on it.** Beat cannot be pinged, so the compose
  file inspects the process instead:

  ```bash
  tr '\0' ' ' </proc/1/cmdline | grep -q 'celery .*beat'
  ```

  That reads PID 1's command line (NUL-separated, hence `tr`) and looks for
  `celery ... beat`. It only works because `exec` made Celery PID 1. Delete
  the `exec` and PID 1's command line becomes `/bin/sh /start-beat.sh`, the
  grep fails, and a perfectly healthy beat is reported unhealthy.
- **PID 1 is special.** The kernel gives PID 1 no default signal handlers, so a
  signal with no handler installed is ignored rather than fatal. Daphne and
  Celery install their own handlers, so they stop properly. A tiny program
  that does not (a bare `sleep`, for instance) as PID 1 would shrug off
  SIGTERM entirely. Compose's `init: true` option inserts a minimal init
  process for exactly that case. This repo does not need it.

## WSGI, ASGI, and which server is actually running

An application server and a framework are different layers:

```text
browser  →  nginx  →  Daphne  →  Django + Channels (your code)
            TLS,       speaks      views, consumers, ORM
            limits,    HTTP and
            static     WebSocket
```

The interface between the last two is a standard. **WSGI** is the old one: a
function that receives one request and returns one response, then the
exchange is over. There is no way to keep a connection open and push data
later. **ASGI** is the async successor: the server and app exchange *events*
(connect, receive, disconnect), so one connection can stay open for an hour
while messages flow both ways.

`erp.asgi:application` in `start-api.sh` means "module `erp.asgi`, variable
`application`". The repo gives three independent signs that this app needs
ASGI rather than WSGI:

- `channels`, `channels-redis`, and `daphne` in `requirements/base.txt`
- `start-api.sh` launches Daphne, not Gunicorn
- `prod.conf` has a dedicated `/ws/` location that forwards the upgrade

```nginx
location /ws/ {
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_read_timeout 3600s;
}
```

The `Upgrade` and `Connection` headers are what let a WebSocket handshake
through. The ordinary `location /` block does not forward them, so a handshake
sent to any other path reaches Daphne as a plain HTTP request and is never
upgraded. Notice the timeouts too: 120 seconds for normal requests, 3600 for
`/ws/`. Every hop in the chain has its own clock.

### The server you are not running

`base.txt` installs **three** application servers: Daphne, Gunicorn, and
Uvicorn. Only Daphne is ever started. `gunicorn.conf.py` is a leftover from an
earlier WSGI-era setup, and it is worth reading as a museum piece:

```python
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
worker_class = os.getenv("GUNICORN_WORKER_CLASS", "sync")
worker_connections = 1000
```

- **Why `2n + 1`?** A `sync` worker handles one request at a time and sits
  idle while it waits on the database, so you buy concurrency with *processes*.
  An async server overlaps that waiting inside one event loop, which is why
  Daphne needs no such formula.
- **`worker_connections = 1000` does nothing** here. Gunicorn only reads it for
  async worker classes, and this config selects `sync`.
- **`cpu_count()` is a trap in a container** (more below).

> **Warning:** Installed is not the same as running. Two unused servers in the production
> image are code that gets patched, scanned by Trivy, and could one day be
> invoked by mistake, in exchange for nothing. Auditing "what is installed but
> never started" is a cheap supply-chain habit.

One more fact about the web tier: a container runs **one** Daphne process, which
is one event loop. The repo runs exactly one `api` container. If you ever add a
second, a WebSocket message sent from a consumer in one container must still
reach clients connected to the other, and that needs a shared channel layer.
`channels-redis` in `base.txt` suggests Redis plays that role, so it is worth
confirming `CHANNEL_LAYERS` in settings.

> **Info:** `start-api.sh` does not pass `--proxy-headers` to Daphne, and nginx
> sets `X-Forwarded-For` and `X-Real-IP`. Daphne only trusts forwarded headers
> when that flag is on, so by default the client address Django sees may be
> nginx's container address. Whether that matters depends on whether anything
> in the app reads the client IP (rate limiting, audit logs). That is a question
> for your settings and middleware, not something these files can answer.

## Celery: three roles

```text
app code           Redis (broker)          worker
send_email.delay()  →  queue holds message  →  pulls it, runs it
                                              
beat               Redis (broker)
every day at 08:00  →  enqueues a message  →  (a worker picks it up as above)
```

- The **broker** (Redis) holds task messages. The CI environment shows it on
  database 0 and the result backend on database 1, which are two numbered
  keyspaces inside one Redis server.
- The **worker** pulls messages and executes them.
- **Beat** is only a clock. It never runs a task. It publishes a message when
  a schedule says it is time, and a worker does the rest.

`start-beat.sh` selects `django_celery_beat.schedulers:DatabaseScheduler`, so
the schedule lives in Postgres tables, not in code. That means it can be edited
through the Django admin at runtime, with no redeploy, and it survives beat
restarts.

> **Warning:** Beat must run exactly once. Two beats each publish every
> scheduled task, so every periodic job runs twice: duplicate emails, duplicate
> SMS, double processing. Compose cannot enforce "exactly one", so the guard is
> a comment in `start-beat.sh` and the discipline of never scaling that service.

### The worker flags

```bash
exec celery -A erp worker \
    --concurrency="${CELERY_CONCURRENCY:-2}" \
    --max-tasks-per-child="${CELERY_MAX_TASKS_PER_CHILD:-500}" \
    --prefetch-multiplier="${CELERY_PREFETCH_MULTIPLIER:-1}"
```

| Flag | Meaning | Why this value |
| --- | --- | --- |
| `--concurrency` | number of child processes (prefork pool) | explicit, because the default is the machine's CPU count |
| `--max-tasks-per-child` | recycle a child after this many tasks | contains slow memory leaks |
| `--prefetch-multiplier` | tasks each child reserves ahead of time | `1` keeps long tasks from hoarding the queue; the default is 4 |

Each prefork child is a full Python process with the Django app loaded, so
memory grows roughly with concurrency. It is also why each child that touches
the ORM holds its own database connection.

> **Warning:**
>
> `cpu_count()` reads the **host's** cores, not your container's quota. Inside a
> container limited to `cpus: 1.00` on a 32-core host, Celery's default would
> start 32 children, and the 65-worker figure from `gunicorn.conf.py` shows the
> same blind spot. The `mem_limit` is what ends it: the kernel kills the
> container. Setting `--concurrency` explicitly is not tidiness, it is the fix.

### Shutting down

When the worker receives SIGTERM it does a **warm shutdown**: it stops taking
new tasks and lets running ones finish. Docker, however, only waits its grace
period before SIGKILL. Look at the compose files: none of them sets
`stop_grace_period`, so the 10-second default applies. By default Celery also
acknowledges a task *before* running it, so a task killed mid-run is gone, not
retried, unless `acks_late` is configured.

## Resource limits, by process

From the deployed compose files:

| Service | Staging cpus / mem | Prod cpus / mem |
| --- | --- | --- |
| api | 1.00 / 768m | 1.00 / 768m |
| worker | 1.00 / 768m | 1.50 / 1024m |
| beat | 0.25 / 256m | 0.50 / 256m |

Every service also has `pids_limit` (512 for api and worker, 256 for beat).
The three limits fail in three different ways:

| Limit | When exceeded | You observe |
| --- | --- | --- |
| `cpus` | the kernel throttles the container | everything gets slower, nothing dies |
| `mem_limit` | the kernel OOM-kills it | abrupt death, in-flight work lost, restart policy brings it back |
| `pids_limit` | new processes and threads cannot be created | errors like "resource temporarily unavailable" |

CPU is compressible and memory is not, which is why a memory limit that is too
small is the dangerous one. Raising `CELERY_CONCURRENCY` without raising
`mem_limit` is the classic way to get a worker that dies mid-task.

## Run it yourself

From the repository root. Dev has no source of truth for `web` that matches
production (it runs `runserver`), so this exercise focuses on worker and beat,
which use the same scripts in every environment.

```bash
set -a; . infra/pins.env; set +a
C="docker compose -f infra/compose/dev.yml --env-file env/.env.dev"

$C up -d --build db redis api worker beat
$C ps

# 1. What is PID 1 in each container?
$C exec worker sh -c "tr '\0' ' ' < /proc/1/cmdline; echo"
$C exec beat   sh -c "tr '\0' ' ' < /proc/1/cmdline; echo"

# 2. The worker's process tree
$C top worker

# 3. Run the beat healthcheck by hand
$C exec beat sh -c "tr '\0' ' ' < /proc/1/cmdline | grep -q 'celery .*beat' && echo healthy"

# 4. Ask the worker the question its own healthcheck asks
$C exec worker sh -c 'celery -A erp inspect ping --destination celery@$HOSTNAME'

# 5. Time a graceful stop
time $C stop worker
```

What to confirm:

- In step 1, PID 1 is Celery itself, not `sh` and not `/entrypoint.sh`. That is
  the `exec` chain, visible.
- In step 2 you should see the main Celery process and about two children, one
  per unit of `--concurrency`.
- Step 3 prints `healthy`. Now you know exactly what that check is doing.
- Step 4 answers with `pong`. The `--destination` flag scopes the ping to this
  one worker, since a bare `inspect ping` is broadcast to every worker on the
  broker.
- Step 5 should finish in a few seconds. If an idle worker takes the full 10
  seconds, SIGTERM is not reaching a handler, which is the exact failure the
  `exec` rule exists to prevent.
