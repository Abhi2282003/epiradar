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
- Public surveillance reads use a publishable-key server function with Query loader priming, polling and realtime invalidation so incoming pipeline data appears without fabricated fallbacks.
- The shared municipality workspace caches external GeoJSON in Query and imports MapLibre only after hydration so both workspace routes share a map without SSR browser-global failures.
- Preserve municipality selection, map/table mode and table sorting in validated URL context so both surveillance views remain shareable.
- Compare forecast horizons only within the same issue week and model version, and leave incomplete aggregates unavailable rather than treating unknown values as zero.
- One app-wide realtime subscription in the shell batches pipeline bursts into a single refresh/toast; replay events and pulses live only in browser memory, never the database.
- Live weather enters only through the throttled public route /api/public/refresh-weather (Open-Meteo batches, 30-min throttle, scheduled every 6 h); weather aggregation and suitability live in one browser-safe module shared with tests.
