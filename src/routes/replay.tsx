import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage, PageSkeleton } from '@/components/epiradar/pages';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/replay')({
  head: () => pageHead('replay'),
  pendingComponent: PageSkeleton,
  component: () => <DashboardPage kind="replay" />,
});
