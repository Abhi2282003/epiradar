import { createFileRoute, redirect } from '@tanstack/react-router';
import { pageHead } from '@/lib/epiradar';

// India is the landing page; "/" forwards to /india and keeps any shared search context.
export const Route = createFileRoute('/')({
  beforeLoad: ({ search }) => { throw redirect({ to: '/india', search }); },
  head: () => pageHead('india'),
});
