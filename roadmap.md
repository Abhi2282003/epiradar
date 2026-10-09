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
