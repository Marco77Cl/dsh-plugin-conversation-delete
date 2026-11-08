/**
 * dsh-plugin-conversation-delete — Host half.
 *
 * DSH deliberately has no session-deletion API: sessions can only be archived.
 * This plugin adds one narrow, authenticated owner-only route that really
 * removes a conversation:
 *
 *   1. archive the session through the workspace registry (this releases the
 *      main-view reference, clears its pin, and refuses while work is running);
 *   2. remove the Session-owned log directory reported by the persistence
 *      backend itself (never a path supplied by the browser);
 *   3. remove the matching projection-cache row when it lives in the standard
 *      `$DSH_HOME/storages` layout.
 *
 * The route is registered with the Host Connection's exact-Fetch registry, so
 * it sits behind the same browser cookie/token, Host/Origin, and owner-Peer
 * checks as every other `/api` call.
 */

import { promises as fs } from 'node:fs'
import { basename, dirname, join, resolve as resolvePath } from 'node:path'

export const name = 'session-delete'
export const inject = ['connection', 'sessionPersistence', 'workspaceRegistry']

/** The exact Fetch route the browser half calls. */
const ROUTE = '/api/session-delete/delete'
/** Session ids are `session-<uuid>`; the persistence backend also emits safe suffixes. */
const SESSION_ID = /^session-[A-Za-z0-9._-]{1,160}$/

/**
 * Register the deletion route for the lifetime of this plugin.
 * @param ctx - Host Cordis context.
 */
export function apply(ctx) {
  ctx.effect(
    () =>
      ctx.connection.fetch.register({
        path: ROUTE,
        methods: ['POST'],
        requestBody: 'buffered',
        fetch: (request) => handle(ctx, request),
      }),
    'session-delete: exact Fetch route',
  )
}

/**
 * Delete one conversation.
 * @param ctx - Host context carrying the persistence and workspace services.
 * @param request - The authenticated browser request.
 * @returns a JSON response describing the outcome.
 */
async function handle(ctx, request) {
  let payload
  try {
    payload = await request.json()
  } catch {
    return json({ ok: false, code: 'invalid-json', message: 'Request body is not JSON.' }, 400)
  }

  const sessionId = typeof payload?.sessionId === 'string' ? payload.sessionId.trim() : ''
  if (!SESSION_ID.test(sessionId)) {
    return json({ ok: false, code: 'invalid', message: 'Not a valid session id.' }, 400)
  }

  // Resolve the storage location from the backend, never from the request.
  let snapshot
  try {
    snapshot = await ctx.sessionPersistence.stat(sessionId)
  } catch (error) {
    return json(
      {
        ok: false,
        code: 'not-found',
        message: `Conversation not found (${error?.name ?? 'unknown'}).`,
      },
      404,
    )
  }

  const location = snapshot?.location
  if (
    location === undefined ||
    location.kind !== 'jsonl' ||
    typeof location.path !== 'string' ||
    location.path === ''
  ) {
    return json(
      { ok: false, code: 'unsupported', message: 'This conversation has no local log to delete.' },
      409,
    )
  }

  const logPath = resolvePath(location.path)
  const sessionDir = dirname(logPath)
  const root = typeof ctx.sessionPersistence.root === 'string' ? resolvePath(ctx.sessionPersistence.root) : undefined

  if (basename(sessionDir) !== sessionId) {
    return json(
      { ok: false, code: 'unsupported', message: 'Log directory and session id disagree; refusing to delete.' },
      409,
    )
  }
  if (root !== undefined && !isInside(root, logPath)) {
    return json(
      { ok: false, code: 'unsupported', message: 'Log path is outside the session store; refusing to delete.' },
      409,
    )
  }

  // Archive first: it is the supported way to release the main-view reference
  // and it refuses while a turn, subagent, job, or reminder is still running.
  const wasArchived = ctx.workspaceRegistry.archivedSessionIds.includes(sessionId)
  try {
    await ctx.workspaceRegistry.archiveSession(sessionId)
  } catch (error) {
    if (error?.name === 'WorkspaceActiveSessionError') {
      return json(
        {
          ok: false,
          code: 'active',
          message: describeActivity(error.activity),
          activity: error.activity,
        },
        409,
      )
    }
    if (error?.name !== 'WorkspaceUnknownSessionError') throw error
    // A persisted session the registry never accounted for can still be removed.
  }

  // Delete the Session-owned directory (log generations plus the lock file).
  try {
    await fs.rm(sessionDir, { recursive: true, force: true })
  } catch (error) {
    // Nothing was removed: put the conversation back where the user can see it.
    if (!wasArchived) await ctx.workspaceRegistry.unarchiveSession(sessionId).catch(() => {})
    return json(
      {
        ok: false,
        code: 'remove-failed',
        message: `Could not remove the session log: ${error?.message ?? String(error)}`,
      },
      500,
    )
  }

  // Best-effort cache cleanup. A missing or non-standard layout is not an error:
  // the cache is a derived artifact and filters itself when the log is gone.
  const cacheRemoved = await removeProjectionCache(ctx, sessionId)

  return json({ ok: true, sessionId, removed: sessionDir, cacheRemoved })
}

/**
 * Remove the projection-cache row for a session when it follows the default
 * `$DSH_HOME/storages` layout.
 * @param ctx - Host context.
 * @param sessionId - Deleted session id.
 * @returns whether a cache file was removed.
 */
async function removeProjectionCache(ctx, sessionId) {
  const root = ctx.sessionPersistence.root
  if (typeof root !== 'string' || root === '') return false
  const cachePath = join(dirname(resolvePath(root)), 'storages', 'session_projcache', 'sessions', `${sessionId}.json`)
  try {
    await fs.unlink(cachePath)
    return true
  } catch {
    return false
  }
}

/**
 * Human-readable reason for a refused archive.
 * @param activity - The activity families reported by the registry.
 * @returns a sentence naming what must stop first.
 */
function describeActivity(activity) {
  const parts = Array.isArray(activity)
    ? activity.map((entry) => {
        const label = typeof entry?.kind === 'string' ? entry.kind : 'activity'
        const items = Array.isArray(entry?.items) ? entry.items : []
        const names = items
          .map((item) => (typeof item?.label === 'string' ? item.label : typeof item?.name === 'string' ? item.name : undefined))
          .filter(Boolean)
        return names.length > 0 ? `${label} (${names.join(', ')})` : label
      })
    : []
  return parts.length > 0 ? parts.join('; ') : 'running work'
}

/**
 * Whether a child path stays inside a parent directory.
 * @param parent - Resolved absolute parent.
 * @param child - Resolved absolute child.
 * @returns true when `child` is `parent` or below it.
 */
function isInside(parent, child) {
  const prefix = parent.endsWith('/') ? parent : `${parent}/`
  return child === parent || child.startsWith(prefix)
}

/**
 * Build a JSON response.
 * @param value - JSON-serializable body.
 * @param status - HTTP status.
 * @returns the response.
 */
function json(value, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8' },
  })
}
