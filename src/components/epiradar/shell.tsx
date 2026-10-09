import { useEffect, useState, type ReactNode } from 'react';
import { Link, useNavigate, useSearch } from '@tanstack/react-router';
import { Activity, Bell, ChevronDown, Command, FlaskConical, History, LayoutDashboard, Map, Moon, Radar, Search, ShieldCheck, Sun, Unplug } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import { DISEASES, validateContext } from '@/lib/epiradar';
const navigation = [
  { to: '/', label: 'Command centre', icon: LayoutDashboard },
  { to: '/map', label: 'Map', icon: Map },
  { to: '/scenarios', label: 'Scenario lab', icon: FlaskConical },
  { to: '/replay', label: 'Time machine', icon: History },
  { to: '/alerts', label: 'Alerts', icon: Bell },
  { to: '/trust', label: 'Model & data', icon: ShieldCheck },
] as const;
export function AppShell({ children }: { children: ReactNode }) {
  const search = useSearch({ strict: false });
  const context = validateContext(search);
  const navigate = useNavigate({ from: '/' });
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [light, setLight] = useState(false);
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
    <a href="#main-content" className="sr-only focus:not-sr-only">Skip to content</a>
    <aside className="sidebar" aria-label="Main navigation">
      <Link to="/" search={context} className="wordmark" aria-label="EpiRadar home"><Radar className="brand-icon" /><span className="sidebar-text">EpiRadar<span className="text-primary">.</span></span></Link>
      <div className="sidebar-caption">CLIMATE. HEALTH. FORESIGHT.</div>
      <div className="nav-heading">WORKSPACE</div>
      <nav>{navigation.map(item => <Link key={item.to} to={item.to} search={context} activeOptions={{ exact: true }} className="nav-link" title={item.label} aria-label={item.label}><item.icon /><span className="sidebar-text">{item.label}</span></Link>)}</nav>
      <div className="sidebar-bottom">
        <div className="connection-status"><p><span className="status-dot" />Read-only surveillance</p><small>Real data · live refresh</small></div>
        <Button variant="ghost" className="theme-control" onClick={toggleTheme} aria-label={light ? 'Switch to dark mode' : 'Switch to light mode'} title={light ? 'Switch to dark mode' : 'Switch to light mode'}>{light ? <Moon /> : <Sun />}<span className="sidebar-text">{light ? 'Dark appearance' : 'Light appearance'}</span></Button>
      </div>
    </aside>
    <div className="workspace">
      <header className="topbar">
        <label className="context-control"><span className="control-label">DISEASE</span><span className="select-wrap"><select aria-label="Disease" value={context.disease} onChange={event => navigate({ search: prev => ({ ...prev, disease: event.target.value, horizon: context.horizon }) })}>{DISEASES.map(disease => <option key={disease}>{disease}</option>)}</select><ChevronDown /></span></label>
        <div className="topbar-divider" />
        <label className="context-control"><span className="control-label">FORECAST HORIZON</span><span className="select-wrap"><select aria-label="Forecast horizon" value={context.horizon} onChange={event => navigate({ search: prev => ({ ...prev, disease: context.disease, horizon: Number(event.target.value) }) })}>{Array.from({ length: 8 }, (_, i) => <option key={i + 1} value={i + 1}>{i + 1} {i === 0 ? 'week' : 'weeks'} ahead</option>)}</select><ChevronDown /></span></label>
        <div className="topbar-tools"><Button variant="ghost" className="search-trigger" aria-label="Search regions" onClick={() => setPaletteOpen(true)}><Search /><span className="search-label">Search regions</span><kbd>⌘ K</kbd></Button><span className="live-pill" title="Live monitoring — forecasts refresh as data arrives"><span className="status-dot" />LIVE</span></div>
      </header>
      <main id="main-content" className="content">{children}</main>
    </div>
    <Dialog open={paletteOpen} onOpenChange={setPaletteOpen}><DialogContent><DialogTitle className="flex items-center gap-2"><Command className="size-5 text-primary" />Region search</DialogTitle><DialogDescription>Surveillance regions will appear here once data is loaded.</DialogDescription><input className="palette-input" aria-label="Search for a region" placeholder="Search for a region…" value={query} onChange={event => setQuery(event.target.value)} /><div className="palette-empty"><Search className="size-6" /><p>{query ? 'No regions available to search.' : 'No regions loaded yet.'}</p><p>Region data is not loaded yet.</p></div></DialogContent></Dialog>
  </div>;
}
