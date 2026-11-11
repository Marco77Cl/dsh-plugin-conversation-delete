# dsh-plugin-conversation-delete

[中文说明](README.zh.md)

Adds a **Delete conversation** action to every conversation row in DeepSeek Harness.

DSH intentionally ships archive without deletion: archived conversations stay on
disk forever. This plugin adds a real, permanent delete behind an explicit
confirmation dialog.


## What it does

- Adds **删除对话 / Delete conversation** to the `⋯` menu of every conversation
  (and to the row's right-click menu, which shares the same contribution).
- Asks for confirmation, naming the conversation, and warns that the action
  cannot be undone.
- Deletes:
  1. the conversation's log directory under `$DSH_HOME/sessions/…`
     (all format generations and the writer lock);
  2. its projection-cache row under
     `$DSH_HOME/storages/session_projcache/sessions/…` when it uses the standard
     layout;
  3. its place in the sidebar — the conversation is archived through the
     workspace registry first, which releases the open view, clears its pin, and
     refuses while a turn, subagent, background job, or reminder is still running.
- Reloads the page so the sidebar reflects the deletion immediately.

## Safety behavior

- **Running work is never deleted underneath itself.** If the conversation is
  active, the plugin refuses and tells you what is still running. Stop it first.
- Only the owner browser can call the route. The endpoint is registered through
  the Host Connection's exact-Fetch registry, so it sits behind the same
  browser cookie, Host/Origin check, and owner-Peer gate as the rest of `/api`.
- The path to delete comes from the session-persistence backend, never from the
  browser, and is checked to stay inside the persistence root with a matching
  session id.
- Deleting is permanent. Archive remains the reversible option.

## Install

### From npm (plugin market / Discover)

```sh
dsh plugin --profile <profile> add dsh-plugin-conversation-delete
```

Then enable the bundle in **Plugins** if your host does not enable new bundles
automatically, and refresh the page.

Published on npm as
[`dsh-plugin-conversation-delete`](https://www.npmjs.com/package/dsh-plugin-conversation-delete),
so the install is prebuilt — no build step and no `allowBuilds` approval.

### Local build

```sh
git clone https://github.com/Marco77Cl/dsh-plugin-conversation-delete.git
cd dsh-plugin-conversation-delete
npm pack
dsh plugin --profile <profile> add file:$(pwd)/dsh-plugin-conversation-delete-*.tgz
```

For DSH Desktop, install through the app's plugin manager (or the plugin
market) rather than a separate `dsh` CLI — Desktop uses its own profile.

## Requirements

- DSH `>= 0.2.2-rc.1` with the Web UI (Desktop or `dsh web`).
- The shipped `workspace`, `session-persistence-jsonl`, `session-projection-cache`,
  `client-connection`, and `ui-workspace` plugins. Profiles built from
  `dsh-base` + `dsh-web-app` have all of them.

## How it works

| Half | File | Role |
| --- | --- | --- |
| Host | `lib/index.js` | Registers `POST /api/session-delete/delete` on the exact-Fetch registry; archives the session, validates the backend-reported log path, removes the log directory and cache row. |
| Client | `lib/client.js` | Contributes the `session.delete` menu item through `ctx.contextMenus`, mounts a confirm dialog in `shell.overlay`, calls the route, reloads. |
| Bundle | `cordis.patch.yml` | Inserts the plugin row into the profile. |

Both halves are plain JavaScript; the client entry is a hand-written
`__ModuleLoader__` factory, so no build step is required.

## License

MIT
