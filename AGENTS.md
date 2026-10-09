<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

## App architecture
- Keep EpiRadar chrome in the shared root shell and each workspace view in its own leaf route so navigation and context remain consistent.
- Validate disease and horizon at the root route and preserve both in navigation so every view has shareable context.
- Keep risk definitions and context validation in one shared browser-safe module; use semantic CSS tokens for risk swatches so theming remains centralised.
- Render explicit empty states until real data is connected; do not seed demonstration health records.
- Use theme storage only for appearance preferences, never for surveillance data.
- Pipeline data enters only through the token-protected server route /api/public/ingest (allow-listed tables, service-role upsert); clients get read-only access except alert status updates by signed-in users.
