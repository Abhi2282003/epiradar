import { createFileRoute } from '@tanstack/react-router';
import { PageSkeleton } from '@/components/epiradar/pages';
import { SurveillanceError } from '@/components/epiradar/command-centre';
import { AlertsPage } from '@/components/epiradar/alerts-page';
import { openAlertsQuery, surveillanceQuery, trustQuery } from '@/lib/surveillance-query';
import { replayQuery } from '@/components/epiradar/time-machine';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/alerts')({
  loaderDeps: ({ search }) => ({ disease: search.disease, horizon: search.horizon }),
  loader: async ({ context, deps }) => {
    await Promise.all([context.queryClient.ensureQueryData(trustQuery(deps.disease)), context.queryClient.ensureQueryData(replayQuery), context.queryClient.ensureQueryData(surveillanceQuery(deps.disease, deps.horizon)), context.queryClient.ensureQueryData(openAlertsQuery(deps.disease))]);
  },
  head: () => pageHead('alerts'),
  pendingComponent: PageSkeleton,
  errorComponent: SurveillanceError,
  component: AlertsPage,
});
