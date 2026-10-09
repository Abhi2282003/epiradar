# EpiRadar pipeline data (branch `pipeline-data`)

This branch is **not** the app. It holds the India model code and the files the app database loads.
The Lovable app lives on `main`; nothing here is synced to Lovable.

## India district outbreak forecast, v2 (`india-epiclim-v2`, current)

Weekly-issued: the latest NASA POWER daily weather is cut into 4-week windows and the forecast covers weeks 1–4, 5–8 and 9–12.
Inputs are every signal in the HC-01 problem statement:
- weather: rain and its anomaly, temperature, humidity, heat, wind
- satellite-based water and energy: MERRA-2 soil wetness, CERES sunlight
- vector suitability: Aedes and Anopheles
- mobility: a gravity model of travel between districts
- surveillance: IDSP outbreak history
- population: Census density
- the climate normal of the coming season

Each row also stores:
- the same forecast without climate
- a weather-only forecast, used to find blind spots
- a rain × temperature what-if grid

Files are in `india/v2/` and results in `results/v2/`.

## India district outbreak forecast (`india-epiclim-v1`)

- **Unit:** 640 districts (Census 2011 boundaries), monthly; forecasts 1, 2 and 3 months ahead.
- **Diseases:** dengue, chikungunya, malaria, acute diarrhoeal disease (`add`), cholera.
- **Target:** an IDSP-reported outbreak with onset in the target month.
- **Training data:**
  - IDSP weekly outbreak reports 2009–2022, as compiled in the EpiClim dataset (8,985 reports). Each report is placed in its 2011 district by location.
  - NASA POWER monthly temperature, rainfall and humidity, 2008–2026, at every district centroid.
- **Test:** rolling origin. Each year 2015–2022 is predicted by a model trained only on earlier years. Results are in `results/`.

| File | What it is |
| --- | --- |
| `india/forecast_2026-09_<disease>.json` | Rows for `public.india_forecasts`: weather up to September 2026; targets October to December 2026 |
| `india/outbreaks_2009_2022.json` | Rows for `public.india_outbreaks`: outbreaks per district, disease and month of onset |
| `india/model_card_india-epiclim-v1.json` | Model card loaded into `public.model_runs` (`scope = 'india-district'`) |
| `pipeline/` | Code: clean EpiClim → train → forecast → export |
| `results/` | Rolling-test metrics, risk-level statistics and the Karnataka weekly model |

## Reproduce

```bash
pip install -r pipeline/requirements.txt
python pipeline/scripts/epiclim_events.py      # needs data/epiclim/EpiClim_Final_data.csv and DataMeet dists11.geojson
python pipeline/scripts/parse_india_monthly.py <NASA POWER monthly exports>
python pipeline/scripts/train_epiclim.py
python pipeline/scripts/forecast_epiclim.py
python pipeline/scripts/export_epiclim.py
```

## Sources

- EpiClim: weekly district-wise all-India multi-epidemic climate-health dataset, built from IDSP weekly outbreak reports.
- NASA POWER (NASA Langley Research Center).
- DataMeet 2011 district boundaries (CC BY 2.5 India).
