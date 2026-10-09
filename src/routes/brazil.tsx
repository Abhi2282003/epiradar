import { createFileRoute } from '@tanstack/react-router';
import { PageSkeleton } from '@/components/epiradar/pages';
import { SurveillancePage, SurveillanceError } from '@/components/epiradar/command-centre';
import { surveillanceQuery } from '@/lib/surveillance-query';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/brazil')({
  loaderDeps: ({ search }) => ({ disease: search.disease, horizon: search.horizon }),
  loader: async ({ context, deps }) => { await context.queryClient.ensureQueryData(surveillanceQuery(deps.disease, deps.horizon)); },
  head: () => pageHead('command'),
  pendingComponent: PageSkeleton,
  errorComponent: SurveillanceError,
  notFoundComponent: () => <p>No surveillance workspace found.</p>,
  component: () => <SurveillancePage kind="command" />,
});
