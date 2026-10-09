import { createFileRoute } from '@tanstack/react-router';
import { PageSkeleton } from '@/components/epiradar/pages';
import { SurveillanceError } from '@/components/epiradar/command-centre';
import { TimeMachine, replayQuery } from '@/components/epiradar/time-machine';
import { PAGE_DETAILS, pageHead } from '@/lib/epiradar';

function ReplayPage() {
  const page = PAGE_DETAILS.replay;
  return <>
    <p className="eyebrow">{page.eyebrow}</p>
    <div className="page-heading"><div><h1>{page.title}</h1><p className="page-description">{page.description}</p></div></div>
    <TimeMachine />
  </>;
}

export const Route = createFileRoute('/replay')({
  loader: async ({ context }) => { await context.queryClient.ensureQueryData(replayQuery); },
  head: () => pageHead('replay'),
  pendingComponent: PageSkeleton,
  errorComponent: SurveillanceError,
  component: ReplayPage,
});
