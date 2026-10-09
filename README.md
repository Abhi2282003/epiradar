# EpiRadar Command Center

Build the app shell for EpiRadar, a climate-informed disease outbreak early-warning dashboard for district health officers. It will show 1–8 week outbreak probabilities per region and disease, explain the drivers, replay past epidemics, and issue alerts.

Design system (apply everywhere):
- Dark navy "mission control" theme by default, with a light-mode toggle. Background #0B1220, surface #111A2E, borders #1E2A44, text #E6EDF7, muted text #94A3B8, accent teal #2DD4BF.
- Font: Inter with tabular numerals for figures; a monospace face for timestamps and codes.
- Risk scale, always shown with a text label and never by colour alone: Low #FDE68A, Moderate #F59E0B, High #DC2626, Very high #9D174D, No data #64748B. Put these in one shared constants file.
- Rounded-xl cards, generous spacing, subtle 1px borders, no gradients, no emoji. Respect prefers-reduced-motion. WCAG AA contrast.

Layout:
- Left sidebar with an "EpiRadar" wordmark and navigation: Command centre (/), Map (/map), Scenario lab (/scenarios), Time machine (/replay), Alerts (/alerts), Model & data (/trust). Collapses to icons on small screens.
- Top bar: disease switcher (Dengue, Chikungunya, Zika, Malaria, Leptospirosis, Diarrhoeal disease), horizon selector (1–8 weeks, default 4), a region search opened with Cmd/Ctrl+K (command palette), and a "LIVE" pill that will later show "updated X min ago".
- Keep disease and horizon in the URL query string so every view is shareable.
- Each page gets a clear title, a one-line description of the decision it supports, skeleton loading states and a polished empty state.

Important: there is no data yet. Do not invent or hard-code any numbers, regions, or charts with fake values. Every number will come from the database, which I will set up next. Empty states should say what will appear there and that data is not loaded yet.

This project was built with [Lovable](https://lovable.dev).

**Live app**: https://epiradar.lovable.app

## Build with Lovable

Continue developing this project in the [Lovable editor](https://lovable.dev/projects/4d6707f2-e512-4db0-a472-100178b83df3).

- **Ship faster**: describe what you want to build and Lovable handles the code.
- **Stay in sync**: every change made in Lovable is committed straight to this repository.
- **Full ownership**: this code is yours. Push to `main` on GitHub and your changes sync back into Lovable, ready for your next prompt.

## Development

Prefer working locally? You need Node.js and npm — [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating).

```sh
git clone <this-repository-url>
cd <repository-name>
npm i
npm run dev
```
