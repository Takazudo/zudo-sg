# _temp-resource/

Committed scratch resources handed from one coding session to a **later** session via git — the reliable channel when session-local scratch storage is unavailable (for example, a web implementation session).

## Rule

- One subdirectory per topic, named `<issue-number>-<topic-slug>/`.
- Put prototypes, design references, fixtures, or sample data here only when a downstream session needs them and they are not already in the repository or expressible inline in the issue.
- Reference files by their in-repository path from the issue body.

## Lifecycle

- **Committed** (not gitignored) so the resource travels on the branch/PR.
- **Temporary per topic** — delete the topic subdirectory when delegated work is complete so scratch resources do not reach the parent branch.
- Keep this root README and the repository tooling exclusions as permanent handoff plumbing.
