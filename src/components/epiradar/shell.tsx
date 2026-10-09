import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useRouterState, useSearch } from '@tanstack/react-router';
import { Bell, ChevronDown, Command, FlaskConical, Globe2, History, LayoutDashboard, Map, MapPinned, Moon, Radar, Search, ShieldCheck, Sun } from 'lucide-react';
import { useT, DISEASE_KEY, type Key } from '@/lib/i18n';
import { LanguageSwitch } from './i18n-ui';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { useQuery } from '@tanstack/react-query';
import { DISEASES, validateContext } from '@/lib/epiradar';
import { getRegionList } from '@/lib/region.functions';
import { RegionDrawer } from './region-drawer';
import { LivePill, useRealtimeUpdates } from './realtime';
import { Toaster } from '@/components/ui/sonner';
const groups = [
  { heading: 'nav.group.india', items: [{ to: '/india', label: 'nav.india', icon: MapPinned }] },
  { heading: 'nav.group.world', items: [{ to: '/world', label: 'nav.world', icon: Globe2 }] },
  { heading: 'nav.group.brazil', items: [
    { to: '/brazil', label: 'nav.command', icon: LayoutDashboard },
    { to: '/map', label: 'nav.map', icon: Map },
    { to: '/scenarios', label: 'nav.scenarios', icon: FlaskConical },
    { to: '/replay', label: 'nav.replay', icon: History },
    { to: '/alerts', label: 'nav.alerts', icon: Bell },
  ] },
  { heading: 'nav.group.trust', items: [{ to: '/trust', label: 'nav.trust', icon: ShieldCheck }] },
] as const satisfies readonly { heading: Key; items: readonly { to: string; label: Key; icon: unknown }[] }[];
/** Pages that use the weekly municipal DISEASE / HORIZON controls. */
export const BRAZIL_PATHS = ['/brazil', '/map', '/scenarios', '/replay', '/alerts'];
export function AppShell({ children }: { children: ReactNode }) {
  const search = useSearch({ strict: false });
  const context = validateContext(search);
  const navigate = useNavigate({ from: '/brazil' });
  const t = useT();
  const pathname = useRouterState({ select: st => st.location.pathname });
  const brazil = BRAZIL_PATHS.includes(pathname);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [light, setLight] = useState(false);
  useRealtimeUpdates();
  const regions = useQuery({ queryKey: ['region-list'], queryFn: () => getRegionList(), enabled: paletteOpen, staleTime: 300_000 });
  const matches = (regions.data ?? []).filter(r => r.name.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 12);
  const openRegion = (region: string) => { setPaletteOpen(false); setQuery(''); void navigate({ to: '.', search: (prev: Record<string, unknown>) => ({ ...validateContext(prev), region }) } as never); };
  useEffect(() => {
    const saved = localStorage.getItem('epiradar-theme') === 'light';
    setLight(saved);
    document.documentElement.dataset['theme'] = saved ? 'light' : 'dark';
    const shortcut = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setPaletteOpen(open => !open);
      }
    };
    window.addEventListener('keydown', shortcut);
    return () => window.removeEventListener('keydown', shortcut);
  }, []);
  const toggleTheme = () => {
    const next = !light; setLight(next);
    document.documentElement.dataset['theme'] = next ? 'light' : 'dark';
    localStorage.setItem('epiradar-theme', next ? 'light' : 'dark');
  };
  return <div className="app-shell">
    <a href="#main-content" className="sr-only focus:not-sr-only">{t('shell.skip')}</a>
    <aside className="sidebar" aria-label="Main navigation">
      <Link to="/india" search={context} className="wordmark" aria-label={t('shell.home')}><Radar className="brand-icon" /><span className="sidebar-text">EpiRadar<span className="text-primary">.</span></span></Link>
      <div className="sidebar-caption">{t('shell.caption')}</div>
      <nav>{groups.map(g => <div key={g.heading} className="nav-group"><div className="nav-heading">{t(g.heading)}</div>{g.items.map(item => <Link key={item.to} to={item.to} search={context} activeOptions={{ exact: true }} className="nav-link" title={t(item.label)} aria-label={t(item.label)}><item.icon /><span className="sidebar-text">{t(item.label)}</span></Link>)}</div>)}</nav>
      <div className="sidebar-bottom">
        <div className="connection-status"><p><span className="status-dot" />{t('shell.readOnly')}</p><small>{t('shell.realData')}</small></div>
        <Button variant="ghost" className="theme-control" onClick={toggleTheme} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} title={light ? 'Switch to dark mode' : 'Switch to light mode'}>{light ? <Moon /> : <Sun />}<span className="sidebar-text">{light ? t('shell.dark') : t('shell.light')}</span></Button>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        {brazil ? <>
        <label className="context-control"><span className="control-label">{t('topbar.disease')}</span><span className="select-wrap"><select aria-label={t('topbar.disease')} value={context.disease} onChange={event => navigate({ to: '.', search: prev => ({ ...prev, disease: event.target.value, horizon: context.horizon }) } as never)}>{DISEASES.map(disease => <option key={disease} value={disease}>{DISEASE_KEY[disease] ? t(DISEASE_KEY[disease]!) : disease}</option>)}</select><ChevronDown /></span></label>
        <div className="topbar-divider" />
        <label className="context-control"><span className="control-label">{t('topbar.horizon')}</span><span className="select-wrap"><select aria-label={t('topbar.horizon')} value={context.horizon} onChange={event => navigate({ to: '.', search: prev => ({ ...prev, disease: context.disease, horizon: Number(event.target.value) }) } as never)}>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>{i === 0 ? t('topbar.weekAhead') : t('topbar.weeksAhead', { n: i + 1 })}</option>)}</select><ChevronDown /></span></label>
        </> : <div className="topbar-spacer" />}
        <div className="topbar-tools"><LanguageSwitch />{brazil && <Button variant="ghost" className="search-trigger" aria-label={t('topbar.search')} onClick={() => setPaletteOpen(true)}><Search /><span className="search-label">{t('topbar.search')}</span><kbd>⌘ K</kbd></Button>}<LivePill /></div>
      </header>
      <main id="main-content" className="content">{children}</main>
      <RegionDrawer />
      <Toaster position="bottom-right" />
    </div>
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}><DialogContent><DialogTitle className="flex items-center gap-2"><Command className="size-5 text-primary" />Region search</DialogTitle><DialogDescription>Open a municipality to see its forecast, drivers and weather.</DialogDescription><input className="palette-input" aria-label="Search for a region" placeholder="Search for a region…" value={query} onChange={event => setQuery(event.target.value)} onKeyDown={event => { if (event.key === 'Enter' && matches[0]) openRegion(matches[0].id); }} />{regions.isPending ? <div className="palette-empty"><p>Loading municipalities…</p></div> : regions.isError ? <div className="palette-empty"><p>Municipalities could not be retrieved.</p></div> : matches.length ? <ul className="palette-results">{matches.map(r => <li key={r.id}><button type="button" onClick={() => openRegion(r.id)}><span>{r.name}</span><small>{r.admin1}</small></button></li>)}</ul> : <div className="palette-empty"><Search className="size-6" /><p>{regions.data?.length ? 'No municipalities match your search.' : 'No regions loaded yet.'}</p></div>}</DialogContent></Dialog>
  </div>;
}
