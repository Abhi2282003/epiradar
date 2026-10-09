/** UI dictionaries (en / hi / mr), language store and Indian number formatting. Browser-safe. */
import { useSyncExternalStore } from 'react';

export const LANGS = ['en', 'hi', 'mr'] as const;
export type Lang = (typeof LANGS)[number];
export const LANG_LABEL: Record<Lang, string> = { en: 'EN', hi: 'हिं', mr: 'मरा' };
export const LANG_NAME: Record<Lang, string> = { en: 'English', hi: 'हिन्दी', mr: 'मराठी' };

const en = {
  'nav.group.india': 'INDIA', 'nav.group.world': 'WORLD', 'nav.group.brazil': 'BRAZIL FORECAST LAB (weekly, municipal)', 'nav.group.trust': 'TRUST',
  'nav.india': 'India overview', 'nav.world': 'World', 'nav.command': 'Command centre', 'nav.map': 'Map', 'nav.scenarios': 'Scenario lab', 'nav.replay': 'Time machine', 'nav.alerts': 'Alerts', 'nav.trust': 'Model & data',
  'shell.caption': 'CLIMATE. HEALTH. FORESIGHT.', 'shell.readOnly': 'Read-only surveillance', 'shell.realData': 'Real data · live refresh', 'shell.light': 'Light appearance', 'shell.dark': 'Dark appearance', 'shell.skip': 'Skip to content', 'shell.home': 'EpiRadar home',
  'topbar.disease': 'DISEASE', 'topbar.horizon': 'FORECAST HORIZON (WEEKS)', 'topbar.weekAhead': '1 week ahead', 'topbar.weeksAhead': '{n} weeks ahead', 'topbar.search': 'Search regions', 'topbar.language': 'Language',
  'disease.dengue': 'Dengue', 'disease.chikungunya': 'Chikungunya', 'disease.malaria': 'Malaria', 'disease.cholera': 'Cholera', 'disease.zika': 'Zika', 'disease.lepto': 'Leptospirosis', 'disease.add': 'Diarrhoeal disease',
  'risk.title': 'Risk', 'risk.Low': 'Low', 'risk.Moderate': 'Moderate', 'risk.High': 'High', 'risk.Very high': 'Very high', 'risk.No data': 'No data', 'legend.riskScale': 'RISK SCALE', 'legend.noData': 'No data', 'legend.suitability': 'Suitability (0–1)', 'legend.incidence': 'Incidence per 1,00,000 (quantiles)',
  'badge.reported': 'Reported', 'badge.suitability': 'Suitability', 'badge.forecast': 'Forecast',
  'badge.reported.tip': 'Official counts as published by the health authority. Not a model output.',
  'badge.suitability.tip': "How favourable today's weather is for the mosquito, from live weather. Not a forecast of cases.",
  'badge.forecast.tip': 'A model prediction, checked against past seasons in a backtest.',
  'unit.people': 'people', 'unit.per100k': 'per 1,00,000', 'unit.mm': 'mm', 'unit.celsius': '°C', 'unit.kmh': 'km/h', 'unit.percent': '%',
  'term.outbreak': 'outbreak', 'term.forecast': 'forecast', 'term.cases': 'Reported cases', 'term.deaths': 'Deaths', 'term.suitability': 'Suitability', 'term.risk': 'Risk', 'term.district': 'District', 'term.state': 'State', 'term.mosquito': 'mosquito', 'term.rain': 'Rain', 'term.temperature': 'Temperature', 'term.humidity': 'Humidity', 'term.incidence': 'Incidence', 'term.population': 'Population', 'term.year': 'Year', 'term.note': 'Note', 'term.source': 'Source', 'term.wind': 'Wind', 'term.cloud': 'Cloud cover',
  'common.loading': 'Loading…', 'common.error': 'This could not be loaded. Please try again.', 'common.refresh': 'Refresh', 'common.asOf': 'as of {d}', 'common.updated': 'updated {d}', 'common.partial': 'partial year', 'common.close': 'Close', 'common.open': 'Open',
  'india.eyebrow': 'INDIA · STATES AND DISTRICTS', 'india.title': 'India: climate-sensitive disease monitor', 'india.description': 'Official reported burden by state, with live district weather suitability for the mosquito vectors.',
  'india.yearLabel': 'Year', 'india.yearRange': 'Years with data: {a}–{b}',
  'kpi.cases': 'Reported cases', 'kpi.deaths': 'Deaths', 'kpi.cfr': 'Case fatality rate', 'kpi.states': 'States reporting', 'kpi.ofStates': 'of {n} states/UTs', 'kpi.favourable': 'Districts where this week favours the {vector}', 'kpi.ofDistricts': 'of {n} districts with live weather', 'kpi.people': 'People living there', 'kpi.atLeast': 'at least; some district populations are missing',
  'vector.aedes': 'Aedes mosquito', 'vector.anopheles': 'Anopheles mosquito',
  'map.layers': 'Map layers', 'map.projection': 'PROJECTION', 'map.globe': 'Globe', 'map.flat': 'Flat', 'map.states': 'STATES', 'map.stateChoropleth': 'Incidence per 1,00,000, {year}', 'map.outlines': 'Outlines only', 'map.districts': 'DISTRICTS (LIVE WEATHER)', 'map.dots': 'Suitability dots (size = population)', 'map.wind': 'Wind arrows', 'map.cloud': 'Cloud shading', 'map.base': 'BASE MAP', 'map.dark': 'Dark', 'map.date': 'DATE (TIME-ENABLED LAYERS)', 'map.environment': 'ENVIRONMENT', 'map.opacity': 'Opacity', 'map.unavailable': 'Unavailable', 'map.unavailableArea': 'Unavailable for this date or area', 'map.useLatest': 'Use latest', 'map.focus': 'QUICK FOCUS', 'map.noBoundaries': 'State boundaries are not loaded yet. They appear when geo_assets "india-states-v1" is loaded.', 'map.boundariesFailed': 'State boundaries could not be loaded.', 'map.failed': 'The map could not be loaded.', 'map.noDataArea': 'Area without data',
  'focus.india': 'India', 'focus.IN-MH': 'Maharashtra', 'focus.IN-D521': 'Pune', 'focus.IN-D519': 'Mumbai', 'focus.IN-DL': 'Delhi', 'focus.IN-KL': 'Kerala', 'focus.IN-KA': 'Karnataka',
  'layer.truecolor': 'Satellite true colour', 'layer.night': 'Night lights', 'layer.precip': 'Precipitation (IMERG)', 'layer.lst': 'Land surface temperature', 'layer.ndvi': 'Vegetation (NDVI)', 'layer.soil': 'Soil moisture', 'layer.clouds': 'Clouds', 'layer.flood': 'Floods', 'layer.pop': 'Population density', 'layer.water': 'Surface water occurrence',
  'empty.states': 'No states are loaded yet. State totals will appear when india_states and admin1_burden are loaded.', 'empty.burden': 'No reported totals are loaded for this disease yet.', 'empty.weather': 'District weather has not been stored yet. It appears after the first refresh of Open-Meteo.', 'empty.series': 'Monthly national dengue appears when country_series (IND) is loaded.', 'empty.districts': 'No districts are loaded for this state yet.', 'empty.history': 'No ICTS history is stored yet.',
  'weather.live': 'Live from your browser', 'weather.stored': 'Stored district weather', 'weather.stale': 'Stored weather is missing or older than 36 hours; showing live values fetched from your browser.', 'weather.refresh': 'Refresh district weather',
  'drawer.trend': 'Yearly reported cases and deaths', 'drawer.rank': 'Rank by incidence: {r} of {n} states', 'drawer.notes': 'Notes', 'drawer.districts': 'Districts: live weather and suitability', 'drawer.sources': 'Sources', 'drawer.aedes': 'Aedes', 'drawer.anopheles': 'Anopheles', 'drawer.temp7': '7-day temp', 'drawer.rain14': '14-day rain', 'drawer.rainNext7': 'Next 7 days rain', 'drawer.history': 'Karnataka district history (ICTS)', 'drawer.historical': 'Historical · last date {d}', 'drawer.allDistricts': 'All districts', 'drawer.unknownState': 'No state matches this link.',
  'spot.title': 'Maharashtra & Pune spotlight', 'spot.trend': 'Maharashtra: reported cases by year', 'spot.pune': 'Pune right now', 'spot.top5': 'Top 5 Maharashtra districts by Aedes suitability', 'spot.noPune': 'Pune weather has not been stored yet.',
  'sentence.both': 'This week’s weather in {place} favours both Aedes and Anopheles mosquitoes.', 'sentence.aedes': 'This week’s weather in {place} favours the Aedes mosquito (dengue, chikungunya) more than Anopheles.', 'sentence.anopheles': 'This week’s weather in {place} favours the Anopheles mosquito (malaria) more than Aedes.', 'sentence.neither': 'This week’s weather in {place} is not especially favourable for either mosquito.',
  'season.title': 'National seasonality', 'season.caption': 'India’s monthly reported dengue. Cases usually peak after the monsoon, from August to November.',
  'fc.title': 'Forecasting India', 'fc.body1': 'Forecasts are live for Brazil municipalities (weekly) and 69 countries (monthly).', 'fc.body2': 'India has no open weekly district case feed. The same pipeline switches on when IDSP/IHIP weekly district counts are connected. Until then India shows official reported burden plus live climate suitability.',
  'world.eyebrow': 'GLOBAL SURVEILLANCE', 'world.title': 'World', 'world.description': 'Global disease outlook by country with live satellite, climate and weather layers.', 'world.disease': 'DISEASE', 'world.dengueForecast': 'Dengue (forecast)', 'world.malariaWho': 'Malaria (WHO estimates)', 'world.choleraWho': 'Cholera (WHO reported)', 'world.indicator': 'Indicator', 'world.year': 'Year',
  'world.kpi.withData': 'Countries with data', 'world.kpi.withForecast': 'Countries with a forecast', 'world.kpi.high': 'High or above next month', 'world.kpi.latest': 'Latest data month', 'world.kpi.grid': 'Weather grid', 'world.kpi.reporting': 'Countries reporting', 'world.kpi.total': 'Total', 'world.metric.prob': 'Dengue outbreak probability, next month', 'world.metric.cases': 'Dengue cases, latest 12 months, per 100k', 'world.liveGrid': 'LIVE WEATHER GRID', 'world.refreshGrid': 'Refresh grid', 'world.noCountries': 'No countries are loaded yet.', 'world.noWho': 'WHO figures appear after the first WHO refresh.', 'world.boundaryNote': 'Boundaries are illustrative. India as per the Survey of India depiction (DataMeet).', 'world.whoSeries': 'WHO Global Health Observatory',
  'who.est_cases': 'Estimated cases', 'who.est_incidence': 'Estimated incidence (per 1,000 at risk)', 'who.est_deaths': 'Estimated deaths', 'who.reported_cases': 'Reported cases', 'who.reported_deaths': 'Reported deaths', 'who.cfr': 'Case fatality rate (%)',
  'trust.title': 'Model & data', 'trust.description': 'Assess data coverage and model reliability before making a decision.', 'trust.eyebrow': 'TRANSPARENCY & ASSURANCE', 'trust.tab.brazil': 'Brazil municipalities', 'trust.tab.world': 'World, national', 'trust.tab.india': 'India', 'trust.sources': 'Data sources', 'trust.india.sources': 'India sources', 'trust.india.coverage': 'Coverage and partial years', 'trust.india.formulas': 'Suitability formulas', 'trust.india.limits': 'Limits', 'trust.india.noCoverage': 'Coverage appears when admin1_burden is loaded for India.',
  'trust.limit1': 'Reported burden is yearly state totals only.', 'trust.limit2': 'There is no open weekly district case feed for India, so there is no India forecast yet.', 'trust.limit3': 'District populations come from Census 2011; districts split later may be undercounted.', 'trust.limit4': 'Suitability describes weather favourable to mosquitoes, not disease risk or case numbers.',
  'page.command.title': 'Command centre', 'page.map.title': 'Map', 'page.scenarios.title': 'Scenario lab', 'page.replay.title': 'Time machine', 'page.alerts.title': 'Alerts',
  'footer.decision': 'DECISION SUPPORT · NOT A CLINICAL DIAGNOSIS',
} as const;
export type Key = keyof typeof en;
type Dict = Record<Key, string>;

const hi: Dict = {
  'nav.group.india': 'भारत', 'nav.group.world': 'विश्व', 'nav.group.brazil': 'ब्राज़ील पूर्वानुमान प्रयोगशाला (साप्ताहिक, नगरपालिका)', 'nav.group.trust': 'भरोसा',
  'nav.india': 'भारत अवलोकन', 'nav.world': 'विश्व', 'nav.command': 'कमांड केंद्र', 'nav.map': 'नक्शा', 'nav.scenarios': 'परिदृश्य प्रयोगशाला', 'nav.replay': 'टाइम मशीन', 'nav.alerts': 'चेतावनियाँ', 'nav.trust': 'मॉडल और डेटा',
  'shell.caption': 'जलवायु. स्वास्थ्य. दूरदृष्टि.', 'shell.readOnly': 'केवल-पठन निगरानी', 'shell.realData': 'वास्तविक डेटा · लाइव अपडेट', 'shell.light': 'हल्का रूप', 'shell.dark': 'गहरा रूप', 'shell.skip': 'सामग्री पर जाएँ', 'shell.home': 'EpiRadar मुखपृष्ठ',
  'topbar.disease': 'रोग', 'topbar.horizon': 'पूर्वानुमान अवधि (सप्ताह)', 'topbar.weekAhead': '1 सप्ताह आगे', 'topbar.weeksAhead': '{n} सप्ताह आगे', 'topbar.search': 'क्षेत्र खोजें', 'topbar.language': 'भाषा',
  'disease.dengue': 'डेंगू', 'disease.chikungunya': 'चिकनगुनिया', 'disease.malaria': 'मलेरिया', 'disease.cholera': 'हैजा', 'disease.zika': 'ज़ीका', 'disease.lepto': 'लेप्टोस्पायरोसिस', 'disease.add': 'दस्त रोग',
  'risk.title': 'जोखिम', 'risk.Low': 'कम', 'risk.Moderate': 'मध्यम', 'risk.High': 'उच्च', 'risk.Very high': 'बहुत उच्च', 'risk.No data': 'डेटा नहीं', 'legend.riskScale': 'जोखिम पैमाना', 'legend.noData': 'डेटा नहीं', 'legend.suitability': 'अनुकूलता (0–1)', 'legend.incidence': 'प्रति 1,00,000 दर (क्वांटाइल)',
  'badge.reported': 'दर्ज', 'badge.suitability': 'अनुकूलता', 'badge.forecast': 'पूर्वानुमान',
  'badge.reported.tip': 'स्वास्थ्य प्राधिकरण द्वारा प्रकाशित आधिकारिक आँकड़े। यह मॉडल का परिणाम नहीं है।',
  'badge.suitability.tip': 'लाइव मौसम के अनुसार आज का मौसम मच्छर के लिए कितना अनुकूल है। यह मामलों का पूर्वानुमान नहीं है।',
  'badge.forecast.tip': 'मॉडल का पूर्वानुमान, जिसे पिछले मौसमों पर बैकटेस्ट से जाँचा गया है।',
  'unit.people': 'लोग', 'unit.per100k': 'प्रति 1,00,000', 'unit.mm': 'मिमी', 'unit.celsius': '°C', 'unit.kmh': 'किमी/घं', 'unit.percent': '%',
  'term.outbreak': 'प्रकोप', 'term.forecast': 'पूर्वानुमान', 'term.cases': 'दर्ज मामले', 'term.deaths': 'मौतें', 'term.suitability': 'अनुकूलता', 'term.risk': 'जोखिम', 'term.district': 'ज़िला', 'term.state': 'राज्य', 'term.mosquito': 'मच्छर', 'term.rain': 'बारिश', 'term.temperature': 'तापमान', 'term.humidity': 'आर्द्रता', 'term.incidence': 'दर', 'term.population': 'जनसंख्या', 'term.year': 'वर्ष', 'term.note': 'टिप्पणी', 'term.source': 'स्रोत', 'term.wind': 'हवा', 'term.cloud': 'बादल',
  'common.loading': 'लोड हो रहा है…', 'common.error': 'यह लोड नहीं हो सका। कृपया फिर से प्रयास करें।', 'common.refresh': 'रीफ़्रेश', 'common.asOf': '{d} तक', 'common.updated': '{d} अपडेट', 'common.partial': 'आंशिक वर्ष', 'common.close': 'बंद करें', 'common.open': 'खोलें',
  'india.eyebrow': 'भारत · राज्य और ज़िले', 'india.title': 'भारत: जलवायु-संवेदनशील रोग निगरानी', 'india.description': 'राज्यवार आधिकारिक दर्ज बोझ, और मच्छरों के लिए ज़िलेवार लाइव मौसम अनुकूलता।',
  'india.yearLabel': 'वर्ष', 'india.yearRange': 'डेटा वाले वर्ष: {a}–{b}',
  'kpi.cases': 'दर्ज मामले', 'kpi.deaths': 'मौतें', 'kpi.cfr': 'मृत्यु दर (CFR)', 'kpi.states': 'रिपोर्ट करने वाले राज्य', 'kpi.ofStates': '{n} राज्यों/केंद्रशासित प्रदेशों में से', 'kpi.favourable': 'ज़िले जहाँ इस सप्ताह मौसम {vector} के अनुकूल है', 'kpi.ofDistricts': 'लाइव मौसम वाले {n} ज़िलों में से', 'kpi.people': 'वहाँ रहने वाले लोग', 'kpi.atLeast': 'कम से कम; कुछ ज़िलों की जनसंख्या उपलब्ध नहीं',
  'vector.aedes': 'एडीज़ मच्छर', 'vector.anopheles': 'एनोफ़िलीज़ मच्छर',
  'map.layers': 'नक्शे की परतें', 'map.projection': 'प्रक्षेपण', 'map.globe': 'ग्लोब', 'map.flat': 'समतल', 'map.states': 'राज्य', 'map.stateChoropleth': 'प्रति 1,00,000 दर, {year}', 'map.outlines': 'केवल सीमाएँ', 'map.districts': 'ज़िले (लाइव मौसम)', 'map.dots': 'अनुकूलता बिंदु (आकार = जनसंख्या)', 'map.wind': 'हवा के तीर', 'map.cloud': 'बादल छाया', 'map.base': 'आधार नक्शा', 'map.dark': 'गहरा', 'map.date': 'तारीख (समय-आधारित परतें)', 'map.environment': 'पर्यावरण', 'map.opacity': 'अपारदर्शिता', 'map.unavailable': 'उपलब्ध नहीं', 'map.unavailableArea': 'इस तारीख या क्षेत्र के लिए उपलब्ध नहीं', 'map.useLatest': 'नवीनतम दिखाएँ', 'map.focus': 'त्वरित फ़ोकस', 'map.noBoundaries': 'राज्य सीमाएँ अभी लोड नहीं हुई हैं। geo_assets "india-states-v1" लोड होने पर दिखेंगी।', 'map.boundariesFailed': 'राज्य सीमाएँ लोड नहीं हो सकीं।', 'map.failed': 'नक्शा लोड नहीं हो सका।', 'map.noDataArea': 'बिना डेटा का क्षेत्र',
  'focus.india': 'भारत', 'focus.IN-MH': 'महाराष्ट्र', 'focus.IN-D521': 'पुणे', 'focus.IN-D519': 'मुंबई', 'focus.IN-DL': 'दिल्ली', 'focus.IN-KL': 'केरल', 'focus.IN-KA': 'कर्नाटक',
  'layer.truecolor': 'उपग्रह वास्तविक रंग', 'layer.night': 'रात की रोशनी', 'layer.precip': 'वर्षा (IMERG)', 'layer.lst': 'भूमि सतह तापमान', 'layer.ndvi': 'वनस्पति (NDVI)', 'layer.soil': 'मिट्टी की नमी', 'layer.clouds': 'बादल', 'layer.flood': 'बाढ़', 'layer.pop': 'जनसंख्या घनत्व', 'layer.water': 'सतही जल',
  'empty.states': 'अभी कोई राज्य लोड नहीं है। india_states और admin1_burden लोड होने पर राज्यवार आँकड़े दिखेंगे।', 'empty.burden': 'इस रोग के लिए अभी कोई दर्ज आँकड़े लोड नहीं हैं।', 'empty.weather': 'ज़िलों का मौसम अभी संग्रहीत नहीं है। Open-Meteo के पहले रीफ़्रेश के बाद दिखेगा।', 'empty.series': 'country_series (IND) लोड होने पर राष्ट्रीय मासिक डेंगू दिखेगा।', 'empty.districts': 'इस राज्य के लिए अभी कोई ज़िला लोड नहीं है।', 'empty.history': 'ICTS इतिहास अभी संग्रहीत नहीं है।',
  'weather.live': 'आपके ब्राउज़र से लाइव', 'weather.stored': 'संग्रहीत ज़िला मौसम', 'weather.stale': 'संग्रहीत मौसम उपलब्ध नहीं या 36 घंटे से पुराना है; आपके ब्राउज़र से लाया गया लाइव मौसम दिखाया जा रहा है।', 'weather.refresh': 'ज़िला मौसम रीफ़्रेश करें',
  'drawer.trend': 'वार्षिक दर्ज मामले और मौतें', 'drawer.rank': 'दर के अनुसार स्थान: {n} राज्यों में {r}', 'drawer.notes': 'टिप्पणियाँ', 'drawer.districts': 'ज़िले: लाइव मौसम और अनुकूलता', 'drawer.sources': 'स्रोत', 'drawer.aedes': 'एडीज़', 'drawer.anopheles': 'एनोफ़िलीज़', 'drawer.temp7': '7-दिन तापमान', 'drawer.rain14': '14-दिन बारिश', 'drawer.rainNext7': 'अगले 7 दिन बारिश', 'drawer.history': 'कर्नाटक ज़िला इतिहास (ICTS)', 'drawer.historical': 'ऐतिहासिक · अंतिम तारीख {d}', 'drawer.allDistricts': 'सभी ज़िले', 'drawer.unknownState': 'इस लिंक से कोई राज्य नहीं मिला।',
  'spot.title': 'महाराष्ट्र और पुणे पर विशेष', 'spot.trend': 'महाराष्ट्र: वर्षवार दर्ज मामले', 'spot.pune': 'पुणे अभी', 'spot.top5': 'एडीज़ अनुकूलता में महाराष्ट्र के शीर्ष 5 ज़िले', 'spot.noPune': 'पुणे का मौसम अभी संग्रहीत नहीं है।',
  'sentence.both': 'इस सप्ताह {place} का मौसम एडीज़ और एनोफ़िलीज़ दोनों मच्छरों के अनुकूल है।', 'sentence.aedes': 'इस सप्ताह {place} का मौसम एनोफ़िलीज़ से अधिक एडीज़ मच्छर (डेंगू, चिकनगुनिया) के अनुकूल है।', 'sentence.anopheles': 'इस सप्ताह {place} का मौसम एडीज़ से अधिक एनोफ़िलीज़ मच्छर (मलेरिया) के अनुकूल है।', 'sentence.neither': 'इस सप्ताह {place} का मौसम किसी भी मच्छर के लिए विशेष अनुकूल नहीं है।',
  'season.title': 'राष्ट्रीय मौसमी रुझान', 'season.caption': 'भारत में मासिक दर्ज डेंगू। मामले आमतौर पर मानसून के बाद, अगस्त से नवंबर तक चरम पर होते हैं।',
  'fc.title': 'भारत के लिए पूर्वानुमान', 'fc.body1': 'पूर्वानुमान ब्राज़ील की नगरपालिकाओं (साप्ताहिक) और 69 देशों (मासिक) के लिए लाइव हैं।', 'fc.body2': 'भारत में ज़िलेवार साप्ताहिक मामलों का कोई खुला स्रोत नहीं है। IDSP/IHIP के साप्ताहिक ज़िला आँकड़े जुड़ते ही यही प्रणाली चालू होगी। तब तक भारत में आधिकारिक दर्ज बोझ और लाइव जलवायु अनुकूलता दिखाई जाती है।',
  'world.eyebrow': 'वैश्विक निगरानी', 'world.title': 'विश्व', 'world.description': 'लाइव उपग्रह, जलवायु और मौसम परतों के साथ देशवार रोग स्थिति।', 'world.disease': 'रोग', 'world.dengueForecast': 'डेंगू (पूर्वानुमान)', 'world.malariaWho': 'मलेरिया (WHO अनुमान)', 'world.choleraWho': 'हैजा (WHO दर्ज)', 'world.indicator': 'संकेतक', 'world.year': 'वर्ष',
  'world.kpi.withData': 'डेटा वाले देश', 'world.kpi.withForecast': 'पूर्वानुमान वाले देश', 'world.kpi.high': 'अगले महीने उच्च या अधिक', 'world.kpi.latest': 'नवीनतम डेटा माह', 'world.kpi.grid': 'मौसम ग्रिड', 'world.kpi.reporting': 'रिपोर्ट करने वाले देश', 'world.kpi.total': 'कुल', 'world.metric.prob': 'डेंगू प्रकोप संभावना, अगला महीना', 'world.metric.cases': 'डेंगू मामले, पिछले 12 महीने, प्रति 1,00,000', 'world.liveGrid': 'लाइव मौसम ग्रिड', 'world.refreshGrid': 'ग्रिड रीफ़्रेश करें', 'world.noCountries': 'अभी कोई देश लोड नहीं है।', 'world.noWho': 'WHO के पहले रीफ़्रेश के बाद आँकड़े दिखेंगे।', 'world.boundaryNote': 'सीमाएँ केवल सांकेतिक हैं। भारत भारतीय सर्वेक्षण विभाग के चित्रण (DataMeet) के अनुसार।', 'world.whoSeries': 'WHO वैश्विक स्वास्थ्य वेधशाला',
  'who.est_cases': 'अनुमानित मामले', 'who.est_incidence': 'अनुमानित दर (जोखिम वाले प्रति 1,000)', 'who.est_deaths': 'अनुमानित मौतें', 'who.reported_cases': 'दर्ज मामले', 'who.reported_deaths': 'दर्ज मौतें', 'who.cfr': 'मृत्यु दर (%)',
  'trust.title': 'मॉडल और डेटा', 'trust.description': 'निर्णय से पहले डेटा कवरेज और मॉडल की विश्वसनीयता जाँचें।', 'trust.eyebrow': 'पारदर्शिता और आश्वासन', 'trust.tab.brazil': 'ब्राज़ील नगरपालिकाएँ', 'trust.tab.world': 'विश्व, राष्ट्रीय', 'trust.tab.india': 'भारत', 'trust.sources': 'डेटा स्रोत', 'trust.india.sources': 'भारत के स्रोत', 'trust.india.coverage': 'कवरेज और आंशिक वर्ष', 'trust.india.formulas': 'अनुकूलता सूत्र', 'trust.india.limits': 'सीमाएँ', 'trust.india.noCoverage': 'भारत के लिए admin1_burden लोड होने पर कवरेज दिखेगा।',
  'trust.limit1': 'दर्ज बोझ केवल वार्षिक राज्य योग है।', 'trust.limit2': 'भारत के लिए ज़िलेवार साप्ताहिक मामलों का खुला स्रोत नहीं है, इसलिए अभी भारत का पूर्वानुमान नहीं है।', 'trust.limit3': 'ज़िलों की जनसंख्या जनगणना 2011 से है; बाद में बँटे ज़िलों की गिनती कम हो सकती है।', 'trust.limit4': 'अनुकूलता मच्छरों के लिए अनुकूल मौसम बताती है, रोग जोखिम या मामलों की संख्या नहीं।',
  'page.command.title': 'कमांड केंद्र', 'page.map.title': 'नक्शा', 'page.scenarios.title': 'परिदृश्य प्रयोगशाला', 'page.replay.title': 'टाइम मशीन', 'page.alerts.title': 'चेतावनियाँ',
  'footer.decision': 'निर्णय सहायता · नैदानिक निदान नहीं',
};

const mr: Dict = {
  'nav.group.india': 'भारत', 'nav.group.world': 'जग', 'nav.group.brazil': 'ब्राझील अंदाज प्रयोगशाळा (साप्ताहिक, नगरपालिका)', 'nav.group.trust': 'विश्वास',
  'nav.india': 'भारत आढावा', 'nav.world': 'जग', 'nav.command': 'कमांड केंद्र', 'nav.map': 'नकाशा', 'nav.scenarios': 'परिस्थिती प्रयोगशाळा', 'nav.replay': 'टाइम मशीन', 'nav.alerts': 'इशारे', 'nav.trust': 'मॉडेल आणि डेटा',
  'shell.caption': 'हवामान. आरोग्य. दूरदृष्टी.', 'shell.readOnly': 'केवळ-वाचन देखरेख', 'shell.realData': 'खरा डेटा · थेट अद्ययावत', 'shell.light': 'फिकट स्वरूप', 'shell.dark': 'गडद स्वरूप', 'shell.skip': 'मजकुराकडे जा', 'shell.home': 'EpiRadar मुखपृष्ठ',
  'topbar.disease': 'रोग', 'topbar.horizon': 'अंदाज कालावधी (आठवडे)', 'topbar.weekAhead': '1 आठवडा पुढे', 'topbar.weeksAhead': '{n} आठवडे पुढे', 'topbar.search': 'प्रदेश शोधा', 'topbar.language': 'भाषा',
  'disease.dengue': 'डेंगू', 'disease.chikungunya': 'चिकुनगुनिया', 'disease.malaria': 'मलेरिया', 'disease.cholera': 'कॉलरा', 'disease.zika': 'झिका', 'disease.lepto': 'लेप्टोस्पायरोसिस', 'disease.add': 'अतिसार रोग',
  'risk.title': 'धोका', 'risk.Low': 'कमी', 'risk.Moderate': 'मध्यम', 'risk.High': 'उच्च', 'risk.Very high': 'खूप उच्च', 'risk.No data': 'डेटा नाही', 'legend.riskScale': 'धोका प्रमाण', 'legend.noData': 'डेटा नाही', 'legend.suitability': 'अनुकूलता (0–1)', 'legend.incidence': 'दर प्रति 1,00,000 (क्वांटाइल)',
  'badge.reported': 'नोंदवलेले', 'badge.suitability': 'अनुकूलता', 'badge.forecast': 'अंदाज',
  'badge.reported.tip': 'आरोग्य प्राधिकरणाने प्रकाशित केलेली अधिकृत आकडेवारी. हे मॉडेलचे उत्तर नाही.',
  'badge.suitability.tip': 'थेट हवामानानुसार आजचे हवामान डासांसाठी किती अनुकूल आहे. हा रुग्णसंख्येचा अंदाज नाही.',
  'badge.forecast.tip': 'मॉडेलचा अंदाज, जो मागील हंगामांवर बॅकटेस्टने तपासला आहे.',
  'unit.people': 'लोक', 'unit.per100k': 'प्रति 1,00,000', 'unit.mm': 'मिमी', 'unit.celsius': '°C', 'unit.kmh': 'किमी/तास', 'unit.percent': '%',
  'term.outbreak': 'उद्रेक', 'term.forecast': 'अंदाज', 'term.cases': 'नोंदवलेले रुग्ण', 'term.deaths': 'मृत्यू', 'term.suitability': 'अनुकूलता', 'term.risk': 'धोका', 'term.district': 'जिल्हा', 'term.state': 'राज्य', 'term.mosquito': 'डास', 'term.rain': 'पाऊस', 'term.temperature': 'तापमान', 'term.humidity': 'आर्द्रता', 'term.incidence': 'दर', 'term.population': 'लोकसंख्या', 'term.year': 'वर्ष', 'term.note': 'टीप', 'term.source': 'स्रोत', 'term.wind': 'वारा', 'term.cloud': 'ढग',
  'common.loading': 'लोड होत आहे…', 'common.error': 'हे लोड होऊ शकले नाही. कृपया पुन्हा प्रयत्न करा.', 'common.refresh': 'रीफ्रेश', 'common.asOf': '{d} पर्यंत', 'common.updated': '{d} अद्ययावत', 'common.partial': 'अपूर्ण वर्ष', 'common.close': 'बंद करा', 'common.open': 'उघडा',
  'india.eyebrow': 'भारत · राज्ये आणि जिल्हे', 'india.title': 'भारत: हवामान-संवेदनशील रोग देखरेख', 'india.description': 'राज्यनिहाय अधिकृत नोंदवलेला भार आणि डासांसाठी जिल्हानिहाय थेट हवामान अनुकूलता.',
  'india.yearLabel': 'वर्ष', 'india.yearRange': 'डेटा असलेली वर्षे: {a}–{b}',
  'kpi.cases': 'नोंदवलेले रुग्ण', 'kpi.deaths': 'मृत्यू', 'kpi.cfr': 'मृत्यू दर (CFR)', 'kpi.states': 'अहवाल देणारी राज्ये', 'kpi.ofStates': '{n} राज्ये/केंद्रशासित प्रदेशांपैकी', 'kpi.favourable': 'जिल्हे जिथे या आठवड्याचे हवामान {vector} ला अनुकूल आहे', 'kpi.ofDistricts': 'थेट हवामान असलेल्या {n} जिल्ह्यांपैकी', 'kpi.people': 'तिथे राहणारे लोक', 'kpi.atLeast': 'किमान; काही जिल्ह्यांची लोकसंख्या उपलब्ध नाही',
  'vector.aedes': 'एडिस डास', 'vector.anopheles': 'अ‍ॅनोफिलीस डास',
  'map.layers': 'नकाशाचे स्तर', 'map.projection': 'प्रक्षेपण', 'map.globe': 'पृथ्वीगोल', 'map.flat': 'सपाट', 'map.states': 'राज्ये', 'map.stateChoropleth': 'दर प्रति 1,00,000, {year}', 'map.outlines': 'फक्त सीमा', 'map.districts': 'जिल्हे (थेट हवामान)', 'map.dots': 'अनुकूलता बिंदू (आकार = लोकसंख्या)', 'map.wind': 'वाऱ्याचे बाण', 'map.cloud': 'ढगांची छाया', 'map.base': 'मूळ नकाशा', 'map.dark': 'गडद', 'map.date': 'तारीख (वेळ-आधारित स्तर)', 'map.environment': 'पर्यावरण', 'map.opacity': 'अपारदर्शकता', 'map.unavailable': 'उपलब्ध नाही', 'map.unavailableArea': 'या तारखेसाठी किंवा भागासाठी उपलब्ध नाही', 'map.useLatest': 'नवीनतम दाखवा', 'map.focus': 'त्वरित लक्ष', 'map.noBoundaries': 'राज्यांच्या सीमा अजून लोड झालेल्या नाहीत. geo_assets "india-states-v1" लोड झाल्यावर दिसतील.', 'map.boundariesFailed': 'राज्यांच्या सीमा लोड होऊ शकल्या नाहीत.', 'map.failed': 'नकाशा लोड होऊ शकला नाही.', 'map.noDataArea': 'डेटा नसलेला भाग',
  'focus.india': 'भारत', 'focus.IN-MH': 'महाराष्ट्र', 'focus.IN-D521': 'पुणे', 'focus.IN-D519': 'मुंबई', 'focus.IN-DL': 'दिल्ली', 'focus.IN-KL': 'केरळ', 'focus.IN-KA': 'कर्नाटक',
  'layer.truecolor': 'उपग्रह नैसर्गिक रंग', 'layer.night': 'रात्रीचे दिवे', 'layer.precip': 'पर्जन्य (IMERG)', 'layer.lst': 'जमिनीचे पृष्ठीय तापमान', 'layer.ndvi': 'वनस्पती (NDVI)', 'layer.soil': 'मातीतील ओलावा', 'layer.clouds': 'ढग', 'layer.flood': 'पूर', 'layer.pop': 'लोकसंख्येची घनता', 'layer.water': 'पृष्ठीय पाणी',
  'empty.states': 'अजून कोणतेही राज्य लोड झालेले नाही. india_states आणि admin1_burden लोड झाल्यावर राज्यनिहाय आकडे दिसतील.', 'empty.burden': 'या रोगासाठी अजून नोंदवलेले आकडे लोड झालेले नाहीत.', 'empty.weather': 'जिल्ह्यांचे हवामान अजून साठवलेले नाही. Open-Meteo च्या पहिल्या रीफ्रेशनंतर दिसेल.', 'empty.series': 'country_series (IND) लोड झाल्यावर राष्ट्रीय मासिक डेंगू दिसेल.', 'empty.districts': 'या राज्यासाठी अजून जिल्हे लोड झालेले नाहीत.', 'empty.history': 'ICTS इतिहास अजून साठवलेला नाही.',
  'weather.live': 'तुमच्या ब्राउझरवरून थेट', 'weather.stored': 'साठवलेले जिल्हा हवामान', 'weather.stale': 'साठवलेले हवामान उपलब्ध नाही किंवा 36 तासांपेक्षा जुने आहे; तुमच्या ब्राउझरवरून आणलेले थेट हवामान दाखवत आहोत.', 'weather.refresh': 'जिल्हा हवामान रीफ्रेश करा',
  'drawer.trend': 'वार्षिक नोंदवलेले रुग्ण आणि मृत्यू', 'drawer.rank': 'दरानुसार क्रमांक: {n} राज्यांपैकी {r}', 'drawer.notes': 'टिपा', 'drawer.districts': 'जिल्हे: थेट हवामान आणि अनुकूलता', 'drawer.sources': 'स्रोत', 'drawer.aedes': 'एडिस', 'drawer.anopheles': 'अ‍ॅनोफिलीस', 'drawer.temp7': '7-दिवस तापमान', 'drawer.rain14': '14-दिवस पाऊस', 'drawer.rainNext7': 'पुढील 7 दिवस पाऊस', 'drawer.history': 'कर्नाटक जिल्हा इतिहास (ICTS)', 'drawer.historical': 'ऐतिहासिक · शेवटची तारीख {d}', 'drawer.allDistricts': 'सर्व जिल्हे', 'drawer.unknownState': 'या दुव्याशी जुळणारे राज्य नाही.',
  'spot.title': 'महाराष्ट्र आणि पुणे विशेष', 'spot.trend': 'महाराष्ट्र: वर्षनिहाय नोंदवलेले रुग्ण', 'spot.pune': 'पुणे आत्ता', 'spot.top5': 'एडिस अनुकूलतेनुसार महाराष्ट्रातील पहिले 5 जिल्हे', 'spot.noPune': 'पुण्याचे हवामान अजून साठवलेले नाही.',
  'sentence.both': 'या आठवड्यात {place} मधील हवामान एडिस आणि अ‍ॅनोफिलीस दोन्ही डासांना अनुकूल आहे.', 'sentence.aedes': 'या आठवड्यात {place} मधील हवामान अ‍ॅनोफिलीसपेक्षा एडिस डासाला (डेंगू, चिकुनगुनिया) अधिक अनुकूल आहे.', 'sentence.anopheles': 'या आठवड्यात {place} मधील हवामान एडिसपेक्षा अ‍ॅनोफिलीस डासाला (मलेरिया) अधिक अनुकूल आहे.', 'sentence.neither': 'या आठवड्यात {place} मधील हवामान कोणत्याही डासासाठी विशेष अनुकूल नाही.',
  'season.title': 'राष्ट्रीय हंगामी कल', 'season.caption': 'भारतातील मासिक नोंदवलेला डेंगू. रुग्ण सहसा पावसाळ्यानंतर, ऑगस्ट ते नोव्हेंबर दरम्यान शिखरावर असतात.',
  'fc.title': 'भारतासाठी अंदाज', 'fc.body1': 'ब्राझीलच्या नगरपालिका (साप्ताहिक) आणि 69 देशांसाठी (मासिक) अंदाज थेट उपलब्ध आहेत.', 'fc.body2': 'भारतात जिल्हानिहाय साप्ताहिक रुग्णसंख्येचा खुला स्रोत नाही. IDSP/IHIP ची साप्ताहिक जिल्हा आकडेवारी जोडली की हीच प्रणाली सुरू होईल. तोपर्यंत भारतासाठी अधिकृत नोंदवलेला भार आणि थेट हवामान अनुकूलता दाखवली जाते.',
  'world.eyebrow': 'जागतिक देखरेख', 'world.title': 'जग', 'world.description': 'थेट उपग्रह, हवामान आणि वातावरण स्तरांसह देशनिहाय रोग स्थिती.', 'world.disease': 'रोग', 'world.dengueForecast': 'डेंगू (अंदाज)', 'world.malariaWho': 'मलेरिया (WHO अनुमान)', 'world.choleraWho': 'कॉलरा (WHO नोंदवलेले)', 'world.indicator': 'निर्देशक', 'world.year': 'वर्ष',
  'world.kpi.withData': 'डेटा असलेले देश', 'world.kpi.withForecast': 'अंदाज असलेले देश', 'world.kpi.high': 'पुढील महिन्यात उच्च किंवा अधिक', 'world.kpi.latest': 'नवीनतम डेटा महिना', 'world.kpi.grid': 'हवामान ग्रिड', 'world.kpi.reporting': 'अहवाल देणारे देश', 'world.kpi.total': 'एकूण', 'world.metric.prob': 'डेंगू उद्रेक शक्यता, पुढील महिना', 'world.metric.cases': 'डेंगू रुग्ण, मागील 12 महिने, प्रति 1,00,000', 'world.liveGrid': 'थेट हवामान ग्रिड', 'world.refreshGrid': 'ग्रिड रीफ्रेश करा', 'world.noCountries': 'अजून कोणतेही देश लोड झालेले नाहीत.', 'world.noWho': 'WHO च्या पहिल्या रीफ्रेशनंतर आकडे दिसतील.', 'world.boundaryNote': 'सीमा केवळ दर्शक आहेत. भारत सर्व्हे ऑफ इंडियाच्या चित्रणानुसार (DataMeet).', 'world.whoSeries': 'WHO जागतिक आरोग्य वेधशाळा',
  'who.est_cases': 'अनुमानित रुग्ण', 'who.est_incidence': 'अनुमानित दर (धोक्यातील प्रति 1,000)', 'who.est_deaths': 'अनुमानित मृत्यू', 'who.reported_cases': 'नोंदवलेले रुग्ण', 'who.reported_deaths': 'नोंदवलेले मृत्यू', 'who.cfr': 'मृत्यू दर (%)',
  'trust.title': 'मॉडेल आणि डेटा', 'trust.description': 'निर्णय घेण्यापूर्वी डेटा व्याप्ती आणि मॉडेलची विश्वासार्हता तपासा.', 'trust.eyebrow': 'पारदर्शकता आणि खात्री', 'trust.tab.brazil': 'ब्राझील नगरपालिका', 'trust.tab.world': 'जग, राष्ट्रीय', 'trust.tab.india': 'भारत', 'trust.sources': 'डेटा स्रोत', 'trust.india.sources': 'भारताचे स्रोत', 'trust.india.coverage': 'व्याप्ती आणि अपूर्ण वर्षे', 'trust.india.formulas': 'अनुकूलता सूत्रे', 'trust.india.limits': 'मर्यादा', 'trust.india.noCoverage': 'भारतासाठी admin1_burden लोड झाल्यावर व्याप्ती दिसेल.',
  'trust.limit1': 'नोंदवलेला भार फक्त वार्षिक राज्य एकूण आहे.', 'trust.limit2': 'भारतासाठी जिल्हानिहाय साप्ताहिक रुग्णसंख्येचा खुला स्रोत नाही, म्हणून अजून भारताचा अंदाज नाही.', 'trust.limit3': 'जिल्ह्यांची लोकसंख्या जनगणना 2011 नुसार आहे; नंतर विभागलेल्या जिल्ह्यांची गणना कमी असू शकते.', 'trust.limit4': 'अनुकूलता डासांना अनुकूल हवामान दर्शवते, रोगाचा धोका किंवा रुग्णसंख्या नव्हे.',
  'page.command.title': 'कमांड केंद्र', 'page.map.title': 'नकाशा', 'page.scenarios.title': 'परिस्थिती प्रयोगशाळा', 'page.replay.title': 'टाइम मशीन', 'page.alerts.title': 'इशारे',
  'footer.decision': 'निर्णय सहाय्य · वैद्यकीय निदान नाही',
};

export const DICTS: Record<Lang, Dict> = { en, hi, mr };

export function translate(lang: Lang, key: Key, vars?: Record<string, string | number>) {
  let s = DICTS[lang][key] ?? en[key];
  if (vars) for (const [k, v] of Object.entries(vars)) s = s.replaceAll(`{${k}}`, String(v));
  return s;
}

// ---- Language store (localStorage, sets <html lang>) ----
const STORAGE = 'epiradar-lang';
let current: Lang = 'en';
const listeners = new Set<() => void>();
export const isLang = (v: unknown): v is Lang => typeof v === 'string' && (LANGS as readonly string[]).includes(v);
export function initLang() {
  const saved = localStorage.getItem(STORAGE);
  setLang(isLang(saved) ? saved : 'en', false);
}
export function setLang(lang: Lang, persist = true) {
  current = lang;
  if (persist) localStorage.setItem(STORAGE, lang);
  document.documentElement.lang = lang;
  listeners.forEach(l => l());
}
export function useLang(): Lang {
  return useSyncExternalStore(cb => { listeners.add(cb); return () => listeners.delete(cb); }, () => current, () => 'en');
}
export function useT() {
  const lang = useLang();
  return Object.assign((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), { lang });
}

/** Indian digit grouping (1,23,456) with Latin digits. */
export function formatIN(v: number | null | undefined, digits = 0) {
  if (v == null || !Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-IN', { maximumFractionDigits: digits, minimumFractionDigits: 0 }).format(v);
}
export const DISEASE_KEY: Record<string, Key> = { Dengue: 'disease.dengue', Chikungunya: 'disease.chikungunya', Zika: 'disease.zika', Malaria: 'disease.malaria', Leptospirosis: 'disease.lepto', 'Diarrhoeal disease': 'disease.add', Cholera: 'disease.cholera', dengue: 'disease.dengue', chikungunya: 'disease.chikungunya', malaria: 'disease.malaria', cholera: 'disease.cholera' };
export const riskKey = (label: string) => `risk.${label}` as Key;
/** Localised state name with English fallback. */
export function stateName(s: { name: string; name_hi?: string | null; name_mr?: string | null } | null | undefined, lang: Lang) {
  if (!s) return '—';
  return (lang === 'hi' ? s.name_hi : lang === 'mr' ? s.name_mr : null) || s.name;
}
