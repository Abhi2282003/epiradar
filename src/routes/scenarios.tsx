import { createFileRoute } from '@tanstack/react-router';
import { PageSkeleton } from '@/components/epiradar/pages';
import { SurveillanceError } from '@/components/epiradar/command-centre';
import { ScenarioLab, scenarioMetaQuery } from '@/components/epiradar/scenario-lab';
import { surveillanceQuery } from '@/lib/surveillance-query';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/scenarios')({
  loaderDeps: ({ search }) => ({ disease: search.disease, horizon: search.horizon }),
  loader: async ({ context, deps }) => {
    await Promise.all([
      context.queryClient.ensureQueryData(scenarioMetaQuery(deps.disease)),
      context.queryClient.ensureQueryData(surveillanceQuery(deps.disease, deps.horizon)),
    ]);
  },
  head: () => pageHead('scenarios'),
  pendingComponent: PageSkeleton,
  errorComponent: SurveillanceError,
  component: ScenarioLab,
});
