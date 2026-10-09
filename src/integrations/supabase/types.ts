export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.18"
  }
  public: {
    Tables: {
      admin1_burden: {
        Row: {
          admin1: string
          cases: number | null
          confirmed: number | null
          country_iso3: string
          deaths: number | null
          disease_id: string
          incidence: number | null
          note: string | null
          pf: number | null
          population: number | null
          source: string | null
          tested: number | null
          year: number
        }
        Insert: {
          admin1: string
          cases?: number | null
          confirmed?: number | null
          country_iso3: string
          deaths?: number | null
          disease_id: string
          incidence?: number | null
          note?: string | null
          pf?: number | null
          population?: number | null
          source?: string | null
          tested?: number | null
          year: number
        }
        Update: {
          admin1?: string
          cases?: number | null
          confirmed?: number | null
          country_iso3?: string
          deaths?: number | null
          disease_id?: string
          incidence?: number | null
          note?: string | null
          pf?: number | null
          population?: number | null
          source?: string | null
          tested?: number | null
          year?: number
        }
        Relationships: []
      }
      alerts: {
        Row: {
          disease_id: string | null
          id: string
          issued_at: string | null
          lead_weeks: number | null
          level: string | null
          message: string | null
          region_id: string | null
          status: string | null
        }
        Insert: {
          disease_id?: string | null
          id?: string
          issued_at?: string | null
          lead_weeks?: number | null
          level?: string | null
          message?: string | null
          region_id?: string | null
          status?: string | null
        }
        Update: {
          disease_id?: string | null
          id?: string
          issued_at?: string | null
          lead_weeks?: number | null
          level?: string | null
          message?: string | null
          region_id?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "alerts_disease_id_fkey"
            columns: ["disease_id"]
            isOneToOne: false
            referencedRelation: "diseases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "alerts_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      backtests: {
        Row: {
          cases_actual: number | null
          cases_p10: number | null
          cases_p50: number | null
          cases_p90: number | null
          disease_id: string
          horizon_weeks: number
          outbreak_actual: boolean | null
          outbreak_prob: number | null
          region_id: string
          target_week: string
          threshold_cases: number | null
        }
        Insert: {
          cases_actual?: number | null
          cases_p10?: number | null
          cases_p50?: number | null
          cases_p90?: number | null
          disease_id: string
          horizon_weeks: number
          outbreak_actual?: boolean | null
          outbreak_prob?: number | null
          region_id: string
          target_week: string
          threshold_cases?: number | null
        }
        Update: {
          cases_actual?: number | null
          cases_p10?: number | null
          cases_p50?: number | null
          cases_p90?: number | null
          disease_id?: string
          horizon_weeks?: number
          outbreak_actual?: boolean | null
          outbreak_prob?: number | null
          region_id?: string
          target_week?: string
          threshold_cases?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "backtests_disease_id_fkey"
            columns: ["disease_id"]
            isOneToOne: false
            referencedRelation: "diseases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "backtests_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      countries: {
        Row: {
          area_km2: number | null
          dengue_first: string | null
          dengue_last: string | null
          dengue_resolution: string | null
          has_forecast: boolean | null
          iso_num: string | null
          iso3: string
          lat: number | null
          lon: number | null
          name: string | null
          population: number | null
          region: string | null
          subregion: string | null
        }
        Insert: {
          area_km2?: number | null
          dengue_first?: string | null
          dengue_last?: string | null
          dengue_resolution?: string | null
          has_forecast?: boolean | null
          iso_num?: string | null
          iso3: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          population?: number | null
          region?: string | null
          subregion?: string | null
        }
        Update: {
          area_km2?: number | null
          dengue_first?: string | null
          dengue_last?: string | null
          dengue_resolution?: string | null
          has_forecast?: boolean | null
          iso_num?: string | null
          iso3?: string
          lat?: number | null
          lon?: number | null
          name?: string | null
          population?: number | null
          region?: string | null
          subregion?: string | null
        }
        Relationships: []
      }
      country_backtests: {
        Row: {
          cases_actual: number | null
          disease_id: string
          horizon_months: number
          iso3: string
          outbreak_actual: boolean | null
          outbreak_prob: number | null
          target_month: string
        }
        Insert: {
          cases_actual?: number | null
          disease_id: string
          horizon_months: number
          iso3: string
          outbreak_actual?: boolean | null
          outbreak_prob?: number | null
          target_month: string
        }
        Update: {
          cases_actual?: number | null
          disease_id?: string
          horizon_months?: number
          iso3?: string
          outbreak_actual?: boolean | null
          outbreak_prob?: number | null
          target_month?: string
        }
        Relationships: []
      }
      country_forecasts: {
        Row: {
          cases_p10: number | null
          cases_p50: number | null
          cases_p90: number | null
          disease_id: string
          drivers: Json | null
          horizon_months: number
          iso3: string
          issue_month: string | null
          model_version: string | null
          narrative: string | null
          outbreak_prob: number | null
          risk_level: string | null
          target_month: string
          threshold: number | null
        }
        Insert: {
          cases_p10?: number | null
          cases_p50?: number | null
          cases_p90?: number | null
          disease_id: string
          drivers?: Json | null
          horizon_months: number
          iso3: string
          issue_month?: string | null
          model_version?: string | null
          narrative?: string | null
          outbreak_prob?: number | null
          risk_level?: string | null
          target_month: string
          threshold?: number | null
        }
        Update: {
          cases_p10?: number | null
          cases_p50?: number | null
          cases_p90?: number | null
          disease_id?: string
          drivers?: Json | null
          horizon_months?: number
          iso3?: string
          issue_month?: string | null
          model_version?: string | null
          narrative?: string | null
          outbreak_prob?: number | null
          risk_level?: string | null
          target_month?: string
          threshold?: number | null
        }
        Relationships: []
      }
      country_reported: {
        Row: {
          disease_id: string
          indicator: string
          iso3: string
          source: string | null
          value: number | null
          year: number
        }
        Insert: {
          disease_id: string
          indicator: string
          iso3: string
          source?: string | null
          value?: number | null
          year: number
        }
        Update: {
          disease_id?: string
          indicator?: string
          iso3?: string
          source?: string | null
          value?: number | null
          year?: number
        }
        Relationships: []
      }
      country_series: {
        Row: {
          cases: number | null
          disease_id: string
          iso3: string
          month: string
          mu: number | null
          outbreak: boolean | null
          threshold: number | null
        }
        Insert: {
          cases?: number | null
          disease_id: string
          iso3: string
          month: string
          mu?: number | null
          outbreak?: boolean | null
          threshold?: number | null
        }
        Update: {
          cases?: number | null
          disease_id?: string
          iso3?: string
          month?: string
          mu?: number | null
          outbreak?: boolean | null
          threshold?: number | null
        }
        Relationships: []
      }
      data_sources: {
        Row: {
          cadence: string | null
          id: string
          last_success_at: string | null
          name: string | null
          note: string | null
          rows_last_run: number | null
          status: string | null
        }
        Insert: {
          cadence?: string | null
          id: string
          last_success_at?: string | null
          name?: string | null
          note?: string | null
          rows_last_run?: number | null
          status?: string | null
        }
        Update: {
          cadence?: string | null
          id?: string
          last_success_at?: string | null
          name?: string | null
          note?: string | null
          rows_last_run?: number | null
          status?: string | null
        }
        Relationships: []
      }
      diseases: {
        Row: {
          color: string | null
          id: string
          name: string
          vector: string | null
        }
        Insert: {
          color?: string | null
          id: string
          name: string
          vector?: string | null
        }
        Update: {
          color?: string | null
          id?: string
          name?: string
          vector?: string | null
        }
        Relationships: []
      }
      drivers: {
        Row: {
          contribution: number | null
          family: string | null
          label: string | null
          prediction_id: string
          rank: number
        }
        Insert: {
          contribution?: number | null
          family?: string | null
          label?: string | null
          prediction_id: string
          rank: number
        }
        Update: {
          contribution?: number | null
          family?: string | null
          label?: string | null
          prediction_id?: string
          rank?: number
        }
        Relationships: [
          {
            foreignKeyName: "drivers_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "latest_predictions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "drivers_prediction_id_fkey"
            columns: ["prediction_id"]
            isOneToOne: false
            referencedRelation: "predictions"
            referencedColumns: ["id"]
          },
        ]
      }
      geo_assets: {
        Row: {
          id: string
          license: string | null
          source: string | null
          topo: Json
          updated_at: string | null
        }
        Insert: {
          id: string
          license?: string | null
          source?: string | null
          topo: Json
          updated_at?: string | null
        }
        Update: {
          id?: string
          license?: string | null
          source?: string | null
          topo?: Json
          updated_at?: string | null
        }
        Relationships: []
      }
      india_district_history: {
        Row: {
          cases: number | null
          deaths: number | null
          district_name: string
          week_start: string
        }
        Insert: {
          cases?: number | null
          deaths?: number | null
          district_name: string
          week_start: string
        }
        Update: {
          cases?: number | null
          deaths?: number | null
          district_name?: string
          week_start?: string
        }
        Relationships: []
      }
      india_forecasts: {
        Row: {
          created_at: string
          disease_id: string
          district_id: string
          drivers: Json
          horizon: number
          inputs: Json
          issue_month: string
          model_version: string
          prob: number
          prob_no_climate: number | null
          rank_india: number | null
          risk_level: string
          target_month: string
          typical_prob: number | null
        }
        Insert: {
          created_at?: string
          disease_id: string
          district_id: string
          drivers?: Json
          horizon: number
          inputs?: Json
          issue_month: string
          model_version: string
          prob: number
          prob_no_climate?: number | null
          rank_india?: number | null
          risk_level: string
          target_month: string
          typical_prob?: number | null
        }
        Update: {
          created_at?: string
          disease_id?: string
          district_id?: string
          drivers?: Json
          horizon?: number
          inputs?: Json
          issue_month?: string
          model_version?: string
          prob?: number
          prob_no_climate?: number | null
          rank_india?: number | null
          risk_level?: string
          target_month?: string
          typical_prob?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "india_forecasts_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "india_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      india_outbreaks: {
        Row: {
          cases: number | null
          deaths: number | null
          disease_id: string
          district_id: string
          month: string
          outbreaks: number
        }
        Insert: {
          cases?: number | null
          deaths?: number | null
          disease_id: string
          district_id: string
          month: string
          outbreaks: number
        }
        Update: {
          cases?: number | null
          deaths?: number | null
          disease_id?: string
          district_id?: string
          month?: string
          outbreaks?: number
        }
        Relationships: [
          {
            foreignKeyName: "india_outbreaks_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: false
            referencedRelation: "india_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      india_district_weather: {
        Row: {
          aedes_suitability: number | null
          anopheles_suitability: number | null
          as_of: string | null
          cloud_cover: number | null
          district_id: string
          humidity_7d: number | null
          rain_14d_mm: number | null
          rain_7d_mm: number | null
          rain_next7d_mm: number | null
          temp_max_7d: number | null
          temp_mean_7d: number | null
          temp_min_7d: number | null
          temp_next7d: number | null
          updated_at: string | null
          wind_dir_deg: number | null
          wind_speed_max: number | null
        }
        Insert: {
          aedes_suitability?: number | null
          anopheles_suitability?: number | null
          as_of?: string | null
          cloud_cover?: number | null
          district_id: string
          humidity_7d?: number | null
          rain_14d_mm?: number | null
          rain_7d_mm?: number | null
          rain_next7d_mm?: number | null
          temp_max_7d?: number | null
          temp_mean_7d?: number | null
          temp_min_7d?: number | null
          temp_next7d?: number | null
          updated_at?: string | null
          wind_dir_deg?: number | null
          wind_speed_max?: number | null
        }
        Update: {
          aedes_suitability?: number | null
          anopheles_suitability?: number | null
          as_of?: string | null
          cloud_cover?: number | null
          district_id?: string
          humidity_7d?: number | null
          rain_14d_mm?: number | null
          rain_7d_mm?: number | null
          rain_next7d_mm?: number | null
          temp_max_7d?: number | null
          temp_mean_7d?: number | null
          temp_min_7d?: number | null
          temp_next7d?: number | null
          updated_at?: string | null
          wind_dir_deg?: number | null
          wind_speed_max?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "india_district_weather_district_id_fkey"
            columns: ["district_id"]
            isOneToOne: true
            referencedRelation: "india_districts"
            referencedColumns: ["id"]
          },
        ]
      }
      india_districts: {
        Row: {
          area_km2: number | null
          census_code: string | null
          id: string
          lat: number | null
          lon: number | null
          name: string
          population: number | null
          state_id: string
        }
        Insert: {
          area_km2?: number | null
          census_code?: string | null
          id: string
          lat?: number | null
          lon?: number | null
          name: string
          population?: number | null
          state_id: string
        }
        Update: {
          area_km2?: number | null
          census_code?: string | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string
          population?: number | null
          state_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "india_districts_state_id_fkey"
            columns: ["state_id"]
            isOneToOne: false
            referencedRelation: "india_states"
            referencedColumns: ["id"]
          },
        ]
      }
      india_states: {
        Row: {
          area_km2: number | null
          id: string
          lat: number | null
          lon: number | null
          name: string
          name_hi: string | null
          name_mr: string | null
          population: number | null
        }
        Insert: {
          area_km2?: number | null
          id: string
          lat?: number | null
          lon?: number | null
          name: string
          name_hi?: string | null
          name_mr?: string | null
          population?: number | null
        }
        Update: {
          area_km2?: number | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string
          name_hi?: string | null
          name_mr?: string | null
          population?: number | null
        }
        Relationships: []
      }
      live_events: {
        Row: {
          id: number
          kind: string | null
          message: string | null
          payload: Json | null
          region_id: string | null
          severity: string | null
          ts: string | null
        }
        Insert: {
          id?: never
          kind?: string | null
          message?: string | null
          payload?: Json | null
          region_id?: string | null
          severity?: string | null
          ts?: string | null
        }
        Update: {
          id?: never
          kind?: string | null
          message?: string | null
          payload?: Json | null
          region_id?: string | null
          severity?: string | null
          ts?: string | null
        }
        Relationships: []
      }
      model_runs: {
        Row: {
          card: Json | null
          created_at: string | null
          disease_id: string | null
          model_version: string
          scope: string | null
        }
        Insert: {
          card?: Json | null
          created_at?: string | null
          disease_id?: string | null
          model_version: string
          scope?: string | null
        }
        Update: {
          card?: Json | null
          created_at?: string | null
          disease_id?: string | null
          model_version?: string
          scope?: string | null
        }
        Relationships: []
      }
      observations: {
        Row: {
          cases: number | null
          cases_est: number | null
          disease_id: string
          humidity: number | null
          incidence: number | null
          ndvi: number | null
          rain_mm: number | null
          region_id: string
          river_discharge: number | null
          soil_moisture: number | null
          temp_mean: number | null
          threshold_cases: number | null
          week_start: string
        }
        Insert: {
          cases?: number | null
          cases_est?: number | null
          disease_id: string
          humidity?: number | null
          incidence?: number | null
          ndvi?: number | null
          rain_mm?: number | null
          region_id: string
          river_discharge?: number | null
          soil_moisture?: number | null
          temp_mean?: number | null
          threshold_cases?: number | null
          week_start: string
        }
        Update: {
          cases?: number | null
          cases_est?: number | null
          disease_id?: string
          humidity?: number | null
          incidence?: number | null
          ndvi?: number | null
          rain_mm?: number | null
          region_id?: string
          river_discharge?: number | null
          soil_moisture?: number | null
          temp_mean?: number | null
          threshold_cases?: number | null
          week_start?: string
        }
        Relationships: [
          {
            foreignKeyName: "observations_disease_id_fkey"
            columns: ["disease_id"]
            isOneToOne: false
            referencedRelation: "diseases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "observations_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      predictions: {
        Row: {
          cases_p10: number | null
          cases_p50: number | null
          cases_p90: number | null
          disease_id: string | null
          horizon_weeks: number | null
          id: string
          issue_week: string | null
          issued_at: string | null
          model_version: string | null
          narrative: string | null
          outbreak_prob: number | null
          region_id: string | null
          risk_level: string | null
          target_week: string | null
          threshold_cases: number | null
        }
        Insert: {
          cases_p10?: number | null
          cases_p50?: number | null
          cases_p90?: number | null
          disease_id?: string | null
          horizon_weeks?: number | null
          id?: string
          issue_week?: string | null
          issued_at?: string | null
          model_version?: string | null
          narrative?: string | null
          outbreak_prob?: number | null
          region_id?: string | null
          risk_level?: string | null
          target_week?: string | null
          threshold_cases?: number | null
        }
        Update: {
          cases_p10?: number | null
          cases_p50?: number | null
          cases_p90?: number | null
          disease_id?: string | null
          horizon_weeks?: number | null
          id?: string
          issue_week?: string | null
          issued_at?: string | null
          model_version?: string | null
          narrative?: string | null
          outbreak_prob?: number | null
          region_id?: string | null
          risk_level?: string | null
          target_week?: string | null
          threshold_cases?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_disease_id_fkey"
            columns: ["disease_id"]
            isOneToOne: false
            referencedRelation: "diseases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      regions: {
        Row: {
          admin1: string | null
          country: string
          density: number | null
          id: string
          lat: number | null
          lon: number | null
          name: string
          official_code: string | null
          population: number | null
          rain_2050_pct: number | null
          temp_2050_c: number | null
        }
        Insert: {
          admin1?: string | null
          country: string
          density?: number | null
          id: string
          lat?: number | null
          lon?: number | null
          name: string
          official_code?: string | null
          population?: number | null
          rain_2050_pct?: number | null
          temp_2050_c?: number | null
        }
        Update: {
          admin1?: string | null
          country?: string
          density?: number | null
          id?: string
          lat?: number | null
          lon?: number | null
          name?: string
          official_code?: string | null
          population?: number | null
          rain_2050_pct?: number | null
          temp_2050_c?: number | null
        }
        Relationships: []
      }
      scenarios: {
        Row: {
          disease_id: string
          horizon_weeks: number
          outbreak_prob: number | null
          rain_delta_pct: number
          region_id: string
          temp_delta_c: number
        }
        Insert: {
          disease_id: string
          horizon_weeks: number
          outbreak_prob?: number | null
          rain_delta_pct: number
          region_id: string
          temp_delta_c: number
        }
        Update: {
          disease_id?: string
          horizon_weeks?: number
          outbreak_prob?: number | null
          rain_delta_pct?: number
          region_id?: string
          temp_delta_c?: number
        }
        Relationships: []
      }
      weather_now: {
        Row: {
          daily: Json
          fc_rain_16d_mm: number | null
          fc_tmean_16d: number | null
          fc_tsuit_16d: number | null
          rain_28d_mm: number | null
          rain_7d_mm: number | null
          region_id: string
          rh_7d: number | null
          tmax_7d: number | null
          tmean_7d: number | null
          tsuit_7d: number | null
          updated_at: string
        }
        Insert: {
          daily?: Json
          fc_rain_16d_mm?: number | null
          fc_tmean_16d?: number | null
          fc_tsuit_16d?: number | null
          rain_28d_mm?: number | null
          rain_7d_mm?: number | null
          region_id: string
          rh_7d?: number | null
          tmax_7d?: number | null
          tmean_7d?: number | null
          tsuit_7d?: number | null
          updated_at?: string
        }
        Update: {
          daily?: Json
          fc_rain_16d_mm?: number | null
          fc_tmean_16d?: number | null
          fc_tsuit_16d?: number | null
          rain_28d_mm?: number | null
          rain_7d_mm?: number | null
          region_id?: string
          rh_7d?: number | null
          tmax_7d?: number | null
          tmean_7d?: number | null
          tsuit_7d?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "weather_now_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: true
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
      world_weather_grid: {
        Row: {
          cloud_cover: number | null
          lat: number
          lon: number
          precip_mm: number | null
          rh: number | null
          temp_c: number | null
          updated_at: string | null
          wind_dir: number | null
          wind_speed: number | null
        }
        Insert: {
          cloud_cover?: number | null
          lat: number
          lon: number
          precip_mm?: number | null
          rh?: number | null
          temp_c?: number | null
          updated_at?: string | null
          wind_dir?: number | null
          wind_speed?: number | null
        }
        Update: {
          cloud_cover?: number | null
          lat?: number
          lon?: number
          precip_mm?: number | null
          rh?: number | null
          temp_c?: number | null
          updated_at?: string | null
          wind_dir?: number | null
          wind_speed?: number | null
        }
        Relationships: []
      }
    }
    Views: {
      country_cases_12m: {
        Row: {
          cases_12m: number | null
          disease_id: string | null
          iso3: string | null
          last_month: string | null
          months_reported: number | null
        }
        Relationships: []
      }
      latest_country_forecasts: {
        Row: {
          cases_p10: number | null
          cases_p50: number | null
          cases_p90: number | null
          disease_id: string | null
          drivers: Json | null
          horizon_months: number | null
          iso3: string | null
          issue_month: string | null
          model_version: string | null
          narrative: string | null
          outbreak_prob: number | null
          risk_level: string | null
          target_month: string | null
          threshold: number | null
        }
        Relationships: []
      }
      latest_predictions: {
        Row: {
          cases_p10: number | null
          cases_p50: number | null
          cases_p90: number | null
          disease_id: string | null
          horizon_weeks: number | null
          id: string | null
          issue_week: string | null
          issued_at: string | null
          model_version: string | null
          narrative: string | null
          outbreak_prob: number | null
          region_id: string | null
          risk_level: string | null
          target_week: string | null
          threshold_cases: number | null
        }
        Relationships: [
          {
            foreignKeyName: "predictions_disease_id_fkey"
            columns: ["disease_id"]
            isOneToOne: false
            referencedRelation: "diseases"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "predictions_region_id_fkey"
            columns: ["region_id"]
            isOneToOne: false
            referencedRelation: "regions"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {},
  },
} as const
