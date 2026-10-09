# EpiRadar shell
- [x] Shared design, navigation, theme toggle, and context controls
- [x] Six empty views, loading states, and region command palette
- [x] URL and horizon tests; desktop/mobile verification

# Real-data Command centre and Map
- [x] Shared live forecast queries and refresh
- [x] Municipality boundaries, risk map, sortable table, URL selection
- [x] Command KPIs, provenance, fastest-building risk, live events
- [x] Full-height Map with horizon slider
- [x] Rule tests and desktop/mobile flow verification

- [ ] Verify populated forecast KPIs and live events end to end — blocked until real prediction and event rows arrive.

# Live weather layer
- [x] weather_now table, refresh route, 6-hourly schedule, first run (92 municipalities)
- [x] Map layer switch, drawer Weather and Cases and climate sections, tests

# Scenario lab, climate-aware trust, seasons
- [x] Scenario lab with empty state + live climate outlook
- [x] Climate card keys, climate driver tags, season picker, tests
- [ ] Verify the full Scenario lab with real rows — blocked until the climate model writes scenarios

# Worldwide, part 1
- [x] World tables, views, ingest allow-list, model scope tabs
- [x] /world globe map, GIBS + JRC layers, live wind/cloud grid, country drawer, header stats, tests
- [ ] Verify country choropleth, drawer charts and backtests with real rows — blocked until country data is loaded
- [ ] Part 2: India view and admin1 burden

# India-first, part 2
- [x] India tables, landing /india, /brazil move, grouped nav, EN/HI/MR
- [x] India map, KPIs, state drawer, Pune spotlight, seasonality, Karnataka history
- [x] District weather refresh (640 districts), WHO and ICTS refreshes, 12-hourly schedules
- [x] Model & data India tab, formula/year/dictionary/batching tests
- [ ] World map: WHO malaria/cholera choropleth and drawer charts
- [ ] World map: India outline per DataMeet with caveat footer
