import { createFileRoute } from '@tanstack/react-router';
import { DashboardPage, PageSkeleton } from '@/components/epiradar/pages';
import { pageHead } from '@/lib/epiradar';

export const Route = createFileRoute('/scenarios')({
  head: () => pageHead('scenarios'),
  pendingComponent: PageSkeleton,
  component: () => <DashboardPage kind="scenarios" />,
});
