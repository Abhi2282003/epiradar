import { createFileRoute } from '@tanstack/react-router';
import { PageSkeleton } from '@/components/epiradar/pages';
import { SurveillanceError } from '@/components/epiradar/command-centre';
import { IndiaPage } from '@/components/epiradar/india-page';
import { indiaOverviewQuery } from '@/lib/india-query';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/india')({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(indiaOverviewQuery); },
  head: () => pageHead('india'),
  pendingComponent: PageSkeleton,
  errorComponent: SurveillanceError,
  component: IndiaPage,
});
