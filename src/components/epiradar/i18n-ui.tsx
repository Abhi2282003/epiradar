import { useEffect } from 'react';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { PAGE_DETAILS, type PageKind } from '@/lib/epiradar';
import { initLang, LANGS, LANG_LABEL, LANG_NAME, setLang, useLang, useT, type Key } from '@/lib/i18n';

const TITLE_KEY: Record<PageKind, Key> = { india: 'nav.india', world: 'world.title', command: 'page.command.title', map: 'page.map.title', scenarios: 'page.scenarios.title', replay: 'page.replay.title', alerts: 'page.alerts.title', trust: 'trust.title' };
export function PageTitle({ kind }: { kind: PageKind }) {
  const t = useT();
  return <>{t.lang === 'en' ? PAGE_DETAILS[kind].title : t(TITLE_KEY[kind])}</>;
}

export function LanguageSwitch() {
  const lang = useLang();
  const t = useT();
  useEffect(() => { initLang(); }, []);
  return <div className="lang-switch" role="group" aria-label={t('topbar.language')}>
    {LANGS.map(l => <button key={l} type="button" lang={l} aria-pressed={lang === l} title={LANG_NAME[l]} onClick={() => setLang(l)}>{LANG_LABEL[l]}</button>)}
  </div>;
}

export type BadgeKind = 'reported' | 'suitability' | 'forecast';
/** One provenance badge per panel, with an explanatory tooltip. */
export function DataBadge({ kind }: { kind: BadgeKind }) {
  const t = useT();
  return <TooltipProvider delayDuration={150}><Tooltip><TooltipTrigger asChild>
    <button type="button" className={`data-badge data-badge-${kind}`}>{t(`badge.${kind}` as Key)}<Info className="size-3" /></button>
  </TooltipTrigger><TooltipContent className="max-w-72">{t(`badge.${kind}.tip` as Key)}</TooltipContent></Tooltip></TooltipProvider>;
}

/** Localised risk level label (input is the English band name). */
export function RiskName({ label }: { label: string }) {
  const t = useT();
  return <>{t.lang === 'en' ? label : t(`risk.${label}` as Key) ?? label}</>;
}
