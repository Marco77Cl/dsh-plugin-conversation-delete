# Publishing checklist

Status (2026-11-08): published to GitHub as a public repository with a `v0.1.0`
release containing the prebuilt tarball, plus a validated format-1 Discover
index. npm publishing is still pending; the community catalog submission
(`awesome-dsh-plugin`) waits for the repository's 1-day age gate.

## 1. Publish to npm

```sh
cd dsh-plugin-conversation-delete
npm login
npm publish --access public
```

- The chosen name is **`dsh-plugin-conversation-delete`** (checked available on
  2026-11-08). The shorter `dsh-plugin-session-delete` is already taken by an
  unrelated package (`dsh-plugin-session-delete@1.0.4`), and `dsh-session-delete`
  is taken by another community plugin.
- `npm pack` output is in `dist/`; the tarball contains only `lib/`,
  `cordis.patch.yml`, `locale/`, `icon.svg`, READMEs, and LICENSE.
- After publishing, replace the local `file:` install with the registry version:

  ```sh
  dsh plugin --profile desktop add dsh-plugin-conversation-delete
  ```

  (For DSH Desktop, use the app's Plugins page or plugin manager instead of a
  separate CLI.)

## 2. How DSH plugin discovery actually works

There are two market surfaces in this build, and neither has a single official
"publish" button:

1. **Plugins → Discover (official `dsh-plugin-market`)**
   Discover only reads index URLs the user adds. A format-1 index is a JSON file
   you host anywhere HTTPS. Each listed version's install target is either npm
   (`name@version`) or a commit-pinned Git URL. Example entry:

   ```json
   {
     "name": "dsh-plugin-conversation-delete",
     "title": { "en": "Delete conversation", "zh": "删除对话" },
     "description": {
       "en": "Permanently delete a conversation from its ⋯ menu.",
       "zh": "在对话的 ⋯ 菜单里永久删除一条对话。"
     },
     "versions": [
       {
         "version": "0.1.0",
         "publishTimestamp": 1794140000,
         "source": { "type": "npm" },
         "engines": { "dsh": ">=0.2.2-rc.1 <1.0.0" }
       }
     ]
   }
   ```

   Host it as `index.json` under the index's own URL; users add that URL in
   Discover. No review is involved.

2. **Community Market / dshmarket catalog (`dsh-plugin-catalog`)**
   The bundled third-party market browses a catalog published as the npm package
   `dsh-plugin-catalog` (homepage <https://awesome-dsh-plugin.com>, repository
   `awesome-dsh-plugin/awesome-dsh-plugin`). Automatic installation there
   resolves the package's npm `latest`; a GitHub-only entry is browse-only.
   Listing is therefore: publish to npm first, then get the entry into that
   catalog (its repository accepts additions).

## 3. Published locations

- Repository: <https://github.com/Marco77Cl/dsh-plugin-conversation-delete>
- Release: <https://github.com/Marco77Cl/dsh-plugin-conversation-delete/releases/tag/v0.1.0>
- Discover index (pinned): `https://cdn.jsdelivr.net/gh/Marco77Cl/dsh-plugin-conversation-delete@f29f833c52a175c0d03a1dd93196cf2e7f7b3a80/index.json`

Add the index URL under **Plugins → Discover → Index sources**.
