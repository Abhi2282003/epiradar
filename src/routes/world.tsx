import { createFileRoute } from '@tanstack/react-router';
import { PageSkeleton } from '@/components/epiradar/pages';
import { SurveillanceError } from '@/components/epiradar/command-centre';
import { WorldPage } from '@/components/epiradar/world-page';
import { worldOverviewQuery } from '@/lib/world-query';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/world')({
  loaderDeps: ({ search }) => ({ disease: search.disease }),
  loader: async ({ context, deps }) => { await context.queryClient.ensureQueryData(worldOverviewQuery(deps.disease)); },
  head: () => pageHead('world'),
  pendingComponent: PageSkeleton,
  errorComponent: SurveillanceError,
  component: WorldPage,
});
