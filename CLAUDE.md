# Leads

Go-to-market lead research and enrichment, driven through the
[Clay](https://www.clay.com) plugin for Claude Code.

## Clay plugin

This repo enables the official Clay plugin at the project level via
`.claude/settings.json`:

- Marketplace: `clay-plugins` → `clay-run/agent-plugins`
- Plugin: `clay@clay-plugins`

When you open this repo in Claude Code (v2.1.91+), it offers to install the
marketplace and plugin automatically. If it doesn't, run:

```
/plugin marketplace add clay-run/agent-plugins
/plugin install clay@clay-plugins
```

### First-time setup (one per machine)

The plugin talks to Clay through the bundled `clay` CLI. It needs a one-time
sign-in, which stores a session on disk:

```
clay login            # opens a browser
clay login --device   # headless / SSH / container: prints a link + code
clay whoami           # exit 0 with a user/workspace object = ready
```

If `clay` is not on PATH right after installing, Claude Code adds the plugin's
`bin/` directory on the next session. Until then, invoke the bundled launcher
directly:

```
"$(ls -1dt ~/.claude/plugins/cache/*/clay/*/bin/clay | head -n1)" whoami
```

The `clay:setup` skill walks through all of this (PATH, sign-in, version check,
first-run onboarding). Run it with `/clay:setup`.

### Working with Clay

Start with the `clay` skill (`/clay:clay`). It picks the right primitive for a
task:

- **Searches** — find companies and people from Clay's native dataset
  (`clay searches ...`).
- **Routines** — run enrichment functions and workflows against records
  (`clay routines ...`).
- **Tables** — query and analyze existing Clay tables (`clay tables ...`).

Other bundled skills: `routines`, `workflows`, `tables-*`, `searches`,
`audiences`, `campaigns`, `signals`, `public-api`, `cli`, `clay-feedback`.

The CLI is JSON-first: success writes JSON to stdout with exit 0; errors write
`{ "error": { "code", "message" } }` to stderr. Exit 3 means not signed in.
Credential and billing subcommands (`login`, `logout`, `api-keys`, `webhooks`,
`feedback`, `credits top-up`) always prompt; other `clay` calls are
auto-approved by the plugin's hooks.
