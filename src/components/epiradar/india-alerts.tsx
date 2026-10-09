import { useQuery } from '@tanstack/react-query';
import { Skeleton } from '@/components/ui/skeleton';
import { indiaOverviewQuery } from '@/lib/india-query';
import { useT } from '@/lib/i18n';
import { IndiaForecastPanel } from './india-forecast';
import { IndiaDistrictDrawer } from './india-district-drawer';

/** India alerts for the Alerts page: the forecast panel (alerts, drivers, precautions) plus the district drawer. */
export function IndiaAlertsSection() {
  const t = useT();
  const q = useQuery(indiaOverviewQuery);
  if (q.isPending) return <Skeleton className="h-40 mb-5" />;
  if (q.isError) return <p className="drawer-empty">{t('common.error')}</p>;
  return <><IndiaForecastPanel districts={q.data.districts} states={q.data.states} /><IndiaDistrictDrawer districts={q.data.districts} states={q.data.states} /></>;
}
