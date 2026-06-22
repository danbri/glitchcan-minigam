# edot ↔ git: methodology for diffing and saving back to remote repos

A design study (not yet implemented) for letting edot **edit a file fetched
from a git host, see a diff, and write it back** — staying true to the
project's "static files on GitHub Pages, no backend" constraint.

## 1. What already exists (the foundation)

- **Open from URL / git URL** (`js/open-url.js`): `resolveSourceUrl()` rewrites
  `github.com/.../blob/...`, gist, GitLab, Bitbucket and Gitea links to their
  raw file URL and returns `{ url, provider, owner, repo, ref, path, corsRisk }`.
- That metadata is **stored on the document** (`doc.source`) when opened from a
  URL, so a save-back path already knows *where the file came from*.
- Read works in-browser today because `raw.githubusercontent.com` and gist raw
  send permissive CORS headers.

So the **read half is done**. The rest is diff + write.

## 2. The hard constraint: auth without a backend

GitHub Pages serves static files and **cannot hold a secret**, which rules out
the classic OAuth web flow (it needs a client secret for the token exchange).
Viable options, best-first:

| Approach | Secret needed? | UX | Notes |
| --- | --- | --- | --- |
| **GitHub Device Flow** | No | Enter a code at github.com/login/device | Designed for secretless/native clients. **Recommended.** Requires a GitHub App/OAuth app *client id* (public, not secret). |
| **Fine-grained PAT, pasted by user** | No | User creates a token scoped to one repo | Zero infra; matches the repo's existing PAT practice (see `CLAUDE.md`). Good "advanced" fallback. |
| **GitHub App + tiny serverless token-exchange** | Yes (on a function) | Cleanest "Sign in" button | Needs one Cloud Function / Worker — breaks "no backend", but it's ~30 lines and the only way to get the polished web OAuth UX. |

`api.github.com` **does send CORS headers**, so once a token is in hand all
REST calls work directly from the browser — no proxy for the API itself.

**Token storage:** keep it in memory by default; offer "remember on this
device" → `sessionStorage` (cleared on tab close) over `localStorage`. Never
persist to IndexedDB alongside documents. Scope to the single target repo
(fine-grained PAT / GitHub App installation on one repo).

## 3. Reading the file *for writing* (sha matters)

Writing through the GitHub Contents API needs the blob **sha** of the file you
are replacing. So the save path uses the **API** read, not the raw read:

```
GET https://api.github.com/repos/{owner}/{repo}/contents/{path}?ref={ref}
  Authorization: Bearer <token>
→ { sha, content (base64), encoding }
```

Keep both: the decoded **baseline text** (for diffing) and the **sha** (for the
conditional write). Capture them at open time so the diff is always against the
real remote state.

## 4. Diffing methodology

**Baseline tracking.** On open, store the original bytes/text as the *baseline*
on `doc.source.baseline`. The diff is always `baseline → current export`.

**Format-aware export before diffing.** edot's internal model is *sanitized
HTML*. To produce a meaningful diff you must re-export to the **source format**
first (a `.md` file ⇒ `htmlToMarkdown`, `.html` ⇒ body HTML, `.txt` ⇒ plain
text). Diffing the editor's HTML against a Markdown baseline would be noise.

**Algorithm/library.** Vendor a small, dependency-free differ:

- **`jsdiff`** (BSD) — `diffLines`/`createTwoFilesPatch` → unified diff. ~12 kB.
- or **`diff-match-patch`** (Apache-2.0) — character-level, good for prose.

Recommended: `jsdiff` line diff for code/markdown, rendered as a unified or
side-by-side view (reuse the `<dialog>` pattern; colour add/remove lines).

**Normalization noise.** Round-tripping through sanitize+export normalizes
whitespace, attribute order, entity encoding, list markers, etc. Mitigations,
in order of fidelity:

1. **Preserve & patch** — keep the original text; when only part of the doc
   changed, splice edited regions back into the untouched original (minimizes
   churn). Hard in general.
2. **Re-export + diff** — simplest; accept some cosmetic diff lines. Good enough
   for Markdown/plain text, which edot round-trips cleanly.
3. **Source-of-truth = the format** — for Markdown especially, consider editing
   with a Markdown-preserving model so export is near-identity.

**Binary formats (.docx).** Don't byte-diff a zip. Options: diff the
**extracted text** (via `docxToHtml`→`toPlainText`) for a human-readable change
summary, and treat the write as a wholesale replacement. True structural docx
diff is out of scope.

## 5. Writing back

Two strategies; offer both.

### a) Direct commit (simple, for your own repo)

```
PUT https://api.github.com/repos/{owner}/{repo}/contents/{path}
{
  "message": "<commit message>",
  "content": "<base64(utf8(newContent))>",
  "sha":     "<baseline sha>",
  "branch":  "<ref>"
}
```

- A **stale sha → 409 Conflict**: the file moved under you. Re-`GET`, show the
  remote-vs-local diff, and let the user rebase their change or overwrite.
- Encode as base64 of the UTF-8 bytes (use `TextEncoder` + chunked `btoa`, the
  same helper already in `io-docx.js`).

### b) Branch + Pull Request (safe default, for others' repos)

1. `GET /repos/{o}/{r}/git/ref/heads/{base}` → base sha.
2. `POST /repos/{o}/{r}/git/refs` `{ ref: "refs/heads/edot-<ts>", sha }`.
3. `PUT …/contents/{path}` with `branch: edot-<ts>` (as above).
4. `POST /repos/{o}/{r}/pulls` `{ title, head: "edot-<ts>", base }`.

This never touches the default branch and produces a reviewable PR — the right
default when the source isn't yours.

### Conflict & safety rules

- Always write with the conditional `sha`; never blind-overwrite.
- Confirm the **destination** (owner/repo/branch/path) in the UI before any
  network write — saving back is outward-facing and hard to reverse.
- Refuse to write binary re-encodings the editor can't faithfully reproduce
  (e.g. block "save back" to `.docx` until image-export lands), or warn loudly.

## 6. Proposed module shape

```
js/
  open-url.js     ✅ exists — URL resolution + provider metadata
  git-remote.js   ▢ auth (device-flow / PAT), getFile(sha+content),
                    putFile(), createBranch(), openPullRequest()
  diff.js         ▢ baseline tracking + unified diff (vendored jsdiff)
  git-ui.js       ▢ "Save to GitHub…" dialog: destination confirm, diff
                    preview, commit message, [Commit | Open PR]
```

`doc.source` (already captured on URL-open) carries provider/owner/repo/ref/
path; `git-remote` adds `sha` + `baseline` at open time.

## 7. CORS & limits, summarized

- `raw.githubusercontent.com`, gist raw, `api.github.com` → **CORS-OK** from the
  browser. GitLab/Bitbucket/Gitea raw and their APIs are **inconsistent** —
  expect to need a PAT and possibly a proxy for non-GitHub hosts.
- Unauthenticated API: 60 req/h; authenticated: 5,000 req/h — fine for editing.
- Pages can't keep secrets → **Device Flow or pasted fine-grained PAT** are the
  only true no-backend auth paths; a GitHub App with a micro token-exchange
  Worker is the upgrade if a polished "Sign in" button is wanted.

## 8. Recommendation (phased)

1. **MVP, GitHub-only, PR-based:** fine-grained PAT entry → `getFile` (sha) →
   re-export to source format → `jsdiff` preview in a dialog → branch + PR.
   No new infra, scoped token, safe by construction. Covers Markdown/text/HTML.
2. **Polish:** GitHub **Device Flow** so users don't hand-make a PAT; "remember
   on this device" in `sessionStorage`; direct-commit option for own repos.
3. **Later:** other hosts (GitLab/Bitbucket) behind the same `git-remote`
   interface; smarter "preserve & patch" diffing to cut normalization noise;
   block/guard binary save-back until export fidelity is proven.

The net: edot can become a genuine *edit-review-commit* surface for text docs
in git, entirely client-side, with PR-based writes as the safe default and the
already-built URL/provider plumbing doing the routing.
