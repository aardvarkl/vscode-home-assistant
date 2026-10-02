# aardvarkl fork of Home Assistant Config Helper

This is a personal fork of
[keesschollaart81/vscode-home-assistant](https://github.com/keesschollaart81/vscode-home-assistant),
the "Home Assistant Config Helper" VS Code extension. The original has had no
release since v2.2.0 (November 2025), so its schema has fallen behind Home
Assistant and shows false errors on valid configuration.

This fork is used in the **Studio Code Server** add-on of Home Assistant.

- Branch with the fixes: **`ha-2026-syntax`**
- Extension ID: **`aardvarkl.vscode-home-assistant-fork`** (a different ID from
  the original, so it can be installed alongside the built-in copy that
  Studio Code Server ships)
- Remotes when working on it: `origin` = this fork, `upstream` = the original

## What's changed compared with upstream 2.2.0

| Change | Why |
|---|---|
| Generic `<domain>.<trigger>` triggers with `target:` / `options:` (e.g. `occupancy.detected`, `door.opened`) | New Home Assistant trigger style was rejected as invalid |
| Generic `<domain>.<condition>` conditions with `target:` / `options:` | Same, for the new condition style |
| `set_conversation_response` action | Not in the schema at all, so every use gave "Expected string" |
| `weekday:` on time triggers, `note:` on triggers/conditions/actions | From upstream PR #4070 by sammyke007 (cherry-picked, author kept) |
| Only `label_id:` is checked against Home Assistant labels | Any `label:` key (trigger variables, `for_each` items) gave "Label does not exist" |

Deliberately **not** changed: warnings on old-style `platform:` / `service:`
syntax. Upstream flags those on purpose to encourage the newer
`trigger:` / `action:` keys.

## Building the `.vsix`

Needs Node.js 22 and npm. The Studio Code Server add-on doesn't include
Node.js, so build somewhere else (any Linux/macOS/Windows machine).

```bash
git clone https://github.com/aardvarkl/vscode-home-assistant.git
cd vscode-home-assistant
git checkout ha-2026-syntax

npm ci                                   # root dependencies
(cd src/language-service && npm ci)      # language service dependencies

npm run schema                           # regenerate ALL JSON schemas (~2 min)
npm run compile                          # build the extension

npx @vscode/vsce package -o vscode-home-assistant-fork-<version>.vsix
```

Notes:

- **Always run `npm run schema` after changing anything under
  `src/language-service/src/schemas/`.** `npm run compile` skips schema
  generation if old JSON files already exist, so stale schemas get packaged.
- If `npm ci` fails building the optional `bufferutil` module because it
  can't download Node.js headers, point it at the local ones:
  `npm_config_nodedir=/path/to/node npm ci`.
- The repo's pre-commit hook runs the full VS Code test suite, which downloads
  VS Code. Where that isn't possible, commit with `HUSKY=0 git commit ...`
  (and test with `tools/validate-yaml.js` instead, below).
- **Bump `"version"` in `package.json`** for every new build, so it's obvious
  which build is installed.

## Testing a schema change

`tools/validate-yaml.js` runs the same validator the extension uses against a
generated schema, without needing VS Code:

```bash
node tools/validate-yaml.js integration-automation tools/samples/new-syntax.yaml
node tools/validate-yaml.js integration-automation /path/to/automations.yaml
```

It prints each problem and a `TOTAL`. `tools/samples/new-syntax.yaml` holds
examples of every syntax this fork adds and should report `TOTAL 0`. Add new
cases there when fixing new false errors.

It only covers schema checks. Entity/area/label existence checks need a live
Home Assistant connection, so test those in Studio Code Server itself.

## Installing in Studio Code Server

1. Upload the `.vsix` into the add-on: drag it from your computer onto the
   **`.vscode`** folder in the Explorer. That folder is git-ignored in the
   Home Assistant config repo, so the package isn't committed.
2. Press **F1** → **Extensions: Install from VSIX…** → type
   `/config/.vscode/` and pick the file from the list.
   (Right-click → "Install Extension VSIX" on the file may not appear, and
   typing the full path sometimes says it doesn't exist; picking from the
   list works.)
3. Reload: **F1** → **Developer: Reload Window**.
4. **First install only:** in the Extensions panel, find the built-in
   *Home Assistant Config Helper* by **keesschollaart** → gear icon →
   **Disable**, then reload again. Both running at once would report
   everything twice.

Installing over the original ID fails with *"is a built-in extension and not
allowed to be updated"*, which is why this fork has its own ID.

### After a Studio Code Server add-on update

Check the Extensions panel. If the built-in keesschollaart extension is
enabled again, disable it. If the fork has gone, reinstall the latest `.vsix`.

## Pushing from the Studio Code Server terminal

The terminal's normal GitHub sign-in pop-up doesn't appear, so `git push`
hangs. Use a
[fine-grained personal access token](https://github.com/settings/personal-access-tokens/new)
limited to this repository with **Contents: Read and write**, and push with:

```bash
GIT_ASKPASS= GIT_TERMINAL_PROMPT=1 git -c credential.helper= -c core.askPass= push
```

Username: `aardvarkl`. Password: paste the **token** (not the GitHub password).
The token isn't saved anywhere.
