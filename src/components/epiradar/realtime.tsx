import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';
import { getFreshness } from '@/lib/replay.functions';
import { pulseRegions } from '@/lib/live-store';
import type { Prediction, Region } from '@/lib/surveillance';

type SurveillanceCache = { regions: Region[]; predictions: Prediction[] };
const TABLE_KEYS: Record<string, string[][]> = {
  predictions: [['surveillance'], ['region-summary'], ['region-forecast'], ['drivers']],
  alerts: [['surveillance'], ['open-alerts']],
  live_events: [['surveillance']],
  data_sources: [['surveillance'], ['freshness'], ['trust'], ['weather']],
  weather_now: [['weather']],
};

/** One app-wide realtime subscription; batches bursts from the pipeline into one refresh and one toast. */
export function useRealtimeUpdates() {
  const client = useQueryClient();
  useEffect(() => {
    let pending = new Set<string>();
    let forecastRegions = new Set<string>();
    let messages: string[] = [];
    let changed = new Set<string>();
    let timer: ReturnType<typeof setTimeout> | undefined;
    const flush = () => {
      for (const table of pending) for (const key of TABLE_KEYS[table] ?? []) void client.invalidateQueries({ queryKey: key });
      const cache = client.getQueriesData<SurveillanceCache>({ queryKey: ['surveillance'] }).find(([, d]) => d)?.[1];
      const name = (id: string) => cache?.regions.find(r => r.id === id)?.name ?? id;
      if (messages.length) toast(messages[0]!, messages.length > 1 ? { description: `+${messages.length - 1} more live events` } : undefined);
      else if (forecastRegions.size === 1) toast(`New forecast for ${name([...forecastRegions][0]!)}`);
      else if (forecastRegions.size > 1) toast(`New forecasts for ${forecastRegions.size} municipalities`);
      pulseRegions([...changed]);
      pending = new Set(); forecastRegions = new Set(); messages = []; changed = new Set(); timer = undefined;
    };
    const queue = () => { if (!timer) timer = setTimeout(flush, 1200); };
    const channel = supabase.channel('epiradar-live');
    for (const table of Object.keys(TABLE_KEYS)) {
      for (const event of ['INSERT', 'UPDATE'] as const) {
        channel.on('postgres_changes', { event, schema: 'public', table }, payload => {
          pending.add(table);
          const row = payload.new as Record<string, unknown>;
          if (table === 'live_events' && typeof row['message'] === 'string') messages.push(row['message']);
          if (table === 'predictions' && typeof row['region_id'] === 'string') {
            const region = row['region_id'];
            forecastRegions.add(region);
            const caches = client.getQueriesData<SurveillanceCache>({ queryKey: ['surveillance'] });
            const previous = caches.flatMap(([, d]) => d?.predictions ?? []).find(p => p.region_id === region && p.horizon_weeks === row['horizon_weeks'] && p.disease_id === row['disease_id']);
            if (previous && previous.risk_level !== row['risk_level']) changed.add(region);
          }
          queue();
        });
      }
    }
    channel.subscribe();
    return () => { if (timer) clearTimeout(timer); void supabase.removeChannel(channel); };
  }, [client]);
}

export function LivePill() {
  const { data, isError } = useQuery({ queryKey: ['freshness'], queryFn: () => getFreshness(), refetchInterval: 60_000 });
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => { setNow(Date.now()); const id = setInterval(() => setNow(Date.now()), 30_000); return () => clearInterval(id); }, []);
  const time = data ? Date.parse(data) : NaN;
  const stale = Number.isFinite(time) && now != null && now - time > 24 * 3_600_000;
  const label = isError ? 'LIVE · status unavailable' : !data ? 'LIVE · no updates yet' : now == null ? 'LIVE' : `LIVE · updated ${formatDistanceToNow(time, { addSuffix: true })}`;
  return <span className={`live-pill ${stale ? 'live-pill-stale' : ''}`} title={stale ? 'Newest data source update is older than 24 hours' : 'Newest successful data source update'}><span className="status-dot" />{label}</span>;
}
