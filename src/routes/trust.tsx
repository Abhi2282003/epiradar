import { createFileRoute } from '@tanstack/react-router';
import { PageSkeleton } from '@/components/epiradar/pages';
import { SurveillanceError } from '@/components/epiradar/command-centre';
import { TrustPage } from '@/components/epiradar/trust-page';
import { trustQuery } from '@/lib/surveillance-query';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/trust')({
  loaderDeps: ({ search }) => ({ disease: search.disease }),
  loader: async ({ context, deps }) => { await context.queryClient.ensureQueryData(trustQuery(deps.disease)); },
  head: () => pageHead('trust'),
  pendingComponent: PageSkeleton,
  errorComponent: SurveillanceError,
  component: TrustPage,
});
