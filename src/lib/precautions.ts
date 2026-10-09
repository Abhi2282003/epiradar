/** Precautions for each forecast disease, for health officials and for the public, in English, Hindi and Marathi.
 *  Content follows national programme guidance (NCVBDC for dengue, chikungunya and malaria; IDSP/NHM for
 *  diarrhoeal disease and cholera). Decision support only — not medical advice. */
import type { Lang } from '@/lib/i18n';
import type { FcDisease, Tier } from '@/lib/india-forecast';

type L = Record<Lang, string>;

const AEDES_OFFICIAL: L[] = [
  {
    en: 'Start weekly house-to-house larval surveys in wards with past outbreaks; remove or treat every breeding container.',
    hi: 'पिछले प्रकोप वाले वार्डों में साप्ताहिक घर-घर लार्वा सर्वे शुरू करें; हर प्रजनन वाला बर्तन हटाएँ या उपचारित करें।',
    mr: 'मागील उद्रेक झालेल्या प्रभागांत साप्ताहिक घरोघरी अळी सर्वेक्षण सुरू करा; डासोत्पत्तीचे प्रत्येक भांडे काढा किंवा उपचारित करा.',
  },
  {
    en: 'Use temephos larvicide in containers that cannot be emptied; keep fogging for confirmed case clusters only.',
    hi: 'जिन बर्तनों को खाली नहीं किया जा सकता उनमें टेमीफॉस लार्वानाशक डालें; फॉगिंग केवल पुष्ट मामलों के समूह में करें।',
    mr: 'जी भांडी रिकामी करता येत नाहीत त्यात टेमिफॉस अळीनाशक वापरा; धुरीकरण फक्त निश्चित रुग्णांच्या समूहातच करा.',
  },
  {
    en: 'Keep NS1/IgM test kits at sentinel sites and report every positive to IDSP/IHIP within 24 hours.',
    hi: 'सेंटिनल साइटों पर NS1/IgM जाँच किट रखें और हर पॉज़िटिव मामला 24 घंटे के भीतर IDSP/IHIP पर दर्ज करें।',
    mr: 'सेंटिनल केंद्रांवर NS1/IgM चाचणी किट ठेवा आणि प्रत्येक पॉझिटिव्ह रुग्ण 24 तासांत IDSP/IHIP वर नोंदवा.',
  },
  {
    en: 'Prepare hospitals: fever wards, IV fluids and blood-bank/platelet stock; brief doctors on national case-management guidelines.',
    hi: 'अस्पताल तैयार रखें: बुखार वार्ड, IV फ्लूइड और ब्लड बैंक/प्लेटलेट स्टॉक; डॉक्टरों को राष्ट्रीय उपचार दिशानिर्देश बताएँ।',
    mr: 'रुग्णालये तयार ठेवा: तापाचे वॉर्ड, IV सलाईन आणि रक्तपेढी/प्लेटलेट साठा; डॉक्टरांना राष्ट्रीय उपचार मार्गदर्शक सूचना समजावून सांगा.',
  },
  {
    en: 'Run weekly “dry day” drives with schools, offices and the municipal body.',
    hi: 'स्कूलों, दफ़्तरों और नगर निकाय के साथ साप्ताहिक “ड्राई डे” अभियान चलाएँ।',
    mr: 'शाळा, कार्यालये आणि नगरपालिकेसोबत साप्ताहिक “कोरडा दिवस” मोहीम राबवा.',
  },
];

const AEDES_PUBLIC: L[] = [
  {
    en: 'Once a week, empty, scrub and cover water containers, coolers, tyres and flower-pot trays.',
    hi: 'हफ़्ते में एक बार पानी के बर्तन, कूलर, टायर और गमलों की ट्रे खाली करें, रगड़कर साफ़ करें और ढककर रखें।',
    mr: 'आठवड्यातून एकदा पाण्याची भांडी, कूलर, टायर आणि कुंड्यांखालील ताटल्या रिकाम्या करा, घासून स्वच्छ करा आणि झाकून ठेवा.',
  },
  {
    en: 'Aedes mosquitoes bite in the daytime: wear full sleeves, use repellent, and use nets for infants and anyone sleeping by day.',
    hi: 'एडीज़ मच्छर दिन में काटता है: पूरी बाँह के कपड़े पहनें, रिपेलेंट लगाएँ, और शिशुओं व दिन में सोने वालों के लिए मच्छरदानी लगाएँ।',
    mr: 'एडिस डास दिवसा चावतो: पूर्ण बाह्यांचे कपडे घाला, डास प्रतिबंधक लावा आणि बाळांसाठी व दिवसा झोपणाऱ्यांसाठी मच्छरदाणी वापरा.',
  },
  {
    en: 'For fever, see a doctor and get tested. Take paracetamol only — avoid aspirin and ibuprofen.',
    hi: 'बुखार हो तो डॉक्टर को दिखाएँ और जाँच कराएँ। केवल पैरासिटामोल लें — एस्पिरिन और आइबुप्रोफ़ेन से बचें।',
    mr: 'ताप आल्यास डॉक्टरांना दाखवा आणि चाचणी करा. फक्त पॅरासिटामॉल घ्या — ॲस्पिरिन आणि आयबुप्रोफेन टाळा.',
  },
  {
    en: 'Go to hospital at once for severe stomach pain, repeated vomiting, bleeding gums or nose, or drowsiness.',
    hi: 'पेट में तेज़ दर्द, बार-बार उल्टी, मसूड़ों या नाक से खून, या सुस्ती हो तो तुरंत अस्पताल जाएँ।',
    mr: 'पोटात तीव्र वेदना, वारंवार उलट्या, हिरड्या किंवा नाकातून रक्त, किंवा गुंगी असल्यास लगेच रुग्णालयात जा.',
  },
];

const CHIK_EXTRA: L = {
  en: 'For joint pain: rest, fluids and paracetamol; see a doctor if pain lasts beyond two weeks.',
  hi: 'जोड़ों के दर्द में: आराम, तरल पदार्थ और पैरासिटामोल लें; दर्द दो सप्ताह से अधिक रहे तो डॉक्टर को दिखाएँ।',
  mr: 'सांधेदुखीसाठी: विश्रांती, भरपूर पाणी आणि पॅरासिटामॉल घ्या; वेदना दोन आठवड्यांपेक्षा जास्त राहिल्यास डॉक्टरांना दाखवा.',
};

const MALARIA_OFFICIAL: L[] = [
  {
    en: 'Step up active fever surveillance: test every fever case by RDT or microscopy within 24 hours (ASHA/ANM house visits).',
    hi: 'सक्रिय बुखार निगरानी बढ़ाएँ: हर बुखार के मामले की 24 घंटे के भीतर RDT या माइक्रोस्कोपी से जाँच करें (आशा/एएनएम गृह भ्रमण)।',
    mr: 'सक्रिय ताप सर्वेक्षण वाढवा: प्रत्येक तापाच्या रुग्णाची 24 तासांत RDT किंवा सूक्ष्मदर्शकाने तपासणी करा (आशा/एएनएम गृहभेटी).',
  },
  {
    en: 'Check RDT, ACT and primaquine stocks at PHCs and with ASHAs before the peak.',
    hi: 'चरम से पहले PHC और आशा कार्यकर्ताओं के पास RDT, ACT और प्राइमाक्वीन का स्टॉक जाँचें।',
    mr: 'शिखरापूर्वी PHC आणि आशांकडे RDT, ACT आणि प्रायमाक्वीनचा साठा तपासा.',
  },
  {
    en: 'Finish indoor residual spraying in high-risk villages; distribute or replace long-lasting insecticidal nets (LLINs).',
    hi: 'उच्च-जोखिम गाँवों में घरों के अंदर कीटनाशक छिड़काव (IRS) पूरा करें; दीर्घकालिक कीटनाशक मच्छरदानियाँ (LLIN) बाँटें या बदलें।',
    mr: 'उच्च-धोक्याच्या गावांत घरातील कीटकनाशक फवारणी (IRS) पूर्ण करा; दीर्घकाळ टिकणाऱ्या कीटकनाशक मच्छरदाण्या (LLIN) वाटा किंवा बदला.',
  },
  {
    en: 'Manage larval sources: drain stagnant water and release larvivorous fish (Gambusia, guppy) in ponds and wells.',
    hi: 'लार्वा स्रोत प्रबंधन: रुका पानी निकालें और तालाबों व कुओं में लार्वाभक्षी मछली (गम्बूसिया, गप्पी) छोड़ें।',
    mr: 'अळी स्रोत व्यवस्थापन: साचलेले पाणी काढून टाका आणि तळी व विहिरींमध्ये अळीभक्षक मासे (गॅम्बुसिया, गप्पी) सोडा.',
  },
];

const MALARIA_PUBLIC: L[] = [
  {
    en: 'Sleep under an insecticide-treated bed net every night.',
    hi: 'हर रात कीटनाशक-युक्त मच्छरदानी में सोएँ।',
    mr: 'दररोज रात्री कीटकनाशकयुक्त मच्छरदाणीत झोपा.',
  },
  {
    en: 'Anopheles mosquitoes bite from dusk to dawn: cover arms and legs in the evening and use repellent.',
    hi: 'एनोफ़िलीज़ मच्छर शाम से सुबह तक काटता है: शाम को हाथ-पैर ढकें और रिपेलेंट लगाएँ।',
    mr: 'अ‍ॅनोफिलीस डास संध्याकाळपासून पहाटेपर्यंत चावतो: संध्याकाळी हात-पाय झाका आणि डास प्रतिबंधक लावा.',
  },
  {
    en: 'Fever with chills: get a free blood test the same day at the nearest health centre or from your ASHA.',
    hi: 'ठंड लगकर बुखार हो तो उसी दिन नज़दीकी स्वास्थ्य केंद्र या आशा से मुफ़्त खून की जाँच कराएँ।',
    mr: 'थंडी वाजून ताप आल्यास त्याच दिवशी जवळच्या आरोग्य केंद्रात किंवा आशाकडे मोफत रक्त तपासणी करा.',
  },
  {
    en: 'Take the full course of medicine, even after you feel better.',
    hi: 'बेहतर महसूस होने के बाद भी दवा का पूरा कोर्स लें।',
    mr: 'बरे वाटल्यानंतरही औषधाचा पूर्ण कोर्स घ्या.',
  },
];

const WATER_OFFICIAL: L[] = [
  {
    en: 'Test drinking-water sources for residual chlorine and faecal contamination; chlorinate supplies and wells.',
    hi: 'पेयजल स्रोतों में अवशिष्ट क्लोरीन और मल-संदूषण की जाँच करें; जल आपूर्ति और कुओं का क्लोरीनीकरण करें।',
    mr: 'पिण्याच्या पाण्याच्या स्रोतांमध्ये उर्वरित क्लोरीन आणि विष्ठा-प्रदूषण तपासा; पाणीपुरवठा आणि विहिरींचे क्लोरीनीकरण करा.',
  },
  {
    en: 'Repair leaking pipelines near drains and check for sewage overflow after heavy rain.',
    hi: 'नालियों के पास रिसती पाइपलाइनों की मरम्मत करें और भारी बारिश के बाद सीवेज के उफान की जाँच करें।',
    mr: 'गटारांजवळील गळक्या जलवाहिन्या दुरुस्त करा आणि मुसळधार पावसानंतर सांडपाणी ओसंडण्याची तपासणी करा.',
  },
  {
    en: 'Stock ORS and zinc at every sub-centre and with ASHAs; open ORS corners in health facilities.',
    hi: 'हर उपकेंद्र और आशा के पास ORS और जिंक का स्टॉक रखें; स्वास्थ्य केंद्रों में ORS कॉर्नर शुरू करें।',
    mr: 'प्रत्येक उपकेंद्रात आणि आशांकडे ORS आणि झिंकचा साठा ठेवा; आरोग्य केंद्रांत ORS कॉर्नर सुरू करा.',
  },
  {
    en: 'Inspect food vendors, community kitchens and mid-day meals; report case clusters to IDSP within 24 hours.',
    hi: 'खाद्य विक्रेताओं, सामुदायिक रसोई और मध्याह्न भोजन का निरीक्षण करें; मामलों के समूह की सूचना 24 घंटे में IDSP को दें।',
    mr: 'अन्न विक्रेते, सामुदायिक स्वयंपाकघरे आणि माध्यान्ह भोजनाची तपासणी करा; रुग्णांच्या समूहाची माहिती 24 तासांत IDSP ला द्या.',
  },
];

const CHOLERA_OFFICIAL: L[] = [
  {
    en: 'Send stool samples from acute watery diarrhoea for culture or cholera RDT; notify suspected cholera immediately.',
    hi: 'तीव्र पानी जैसे दस्त के मामलों के मल नमूने कल्चर या हैजा RDT के लिए भेजें; संदिग्ध हैजा की तुरंत सूचना दें।',
    mr: 'तीव्र पाण्यासारख्या जुलाबाच्या रुग्णांचे शौच नमुने कल्चर किंवा कॉलरा RDT साठी पाठवा; संशयित कॉलराची त्वरित सूचना द्या.',
  },
  {
    en: 'Super-chlorinate wells and tanks in affected wards and check residual chlorine daily.',
    hi: 'प्रभावित वार्डों में कुओं और टंकियों का अति-क्लोरीनीकरण करें और रोज़ अवशिष्ट क्लोरीन जाँचें।',
    mr: 'बाधित प्रभागांतील विहिरी आणि टाक्यांचे अति-क्लोरीनीकरण करा आणि दररोज उर्वरित क्लोरीन तपासा.',
  },
  {
    en: 'Pre-position ORS, IV Ringer’s lactate and antibiotics; set up a cholera treatment corner.',
    hi: 'ORS, IV रिंगर लैक्टेट और एंटीबायोटिक पहले से उपलब्ध रखें; हैजा उपचार कक्ष तैयार करें।',
    mr: 'ORS, IV रिंगर लॅक्टेट आणि प्रतिजैविके आधीच उपलब्ध ठेवा; कॉलरा उपचार कक्ष तयार ठेवा.',
  },
  {
    en: 'For hotspots with repeated outbreaks, consider oral cholera vaccine with state approval.',
    hi: 'बार-बार प्रकोप वाले हॉटस्पॉट में राज्य की स्वीकृति से मौखिक हैजा टीके पर विचार करें।',
    mr: 'वारंवार उद्रेक होणाऱ्या हॉटस्पॉटमध्ये राज्याच्या मान्यतेने तोंडी कॉलरा लसीचा विचार करा.',
  },
];

const WATER_PUBLIC: L[] = [
  {
    en: 'Drink boiled or chlorinated water; store it covered and take it out with a ladle.',
    hi: 'उबला हुआ या क्लोरीन-युक्त पानी पिएँ; उसे ढककर रखें और करछी से निकालें।',
    mr: 'उकळलेले किंवा क्लोरीनयुक्त पाणी प्या; ते झाकून ठेवा आणि डावाने काढा.',
  },
  {
    en: 'Wash hands with soap before eating, before cooking and after using the toilet.',
    hi: 'खाने से पहले, खाना बनाने से पहले और शौच के बाद साबुन से हाथ धोएँ।',
    mr: 'जेवणापूर्वी, स्वयंपाकापूर्वी आणि शौचालयानंतर साबणाने हात धुवा.',
  },
  {
    en: 'Give a child with diarrhoea ORS and zinc and keep breastfeeding; get care at once for blood in stool, sunken eyes or no urine.',
    hi: 'दस्त होने पर बच्चे को ORS और जिंक दें और स्तनपान जारी रखें; मल में खून, धँसी आँखें या पेशाब न होने पर तुरंत इलाज कराएँ।',
    mr: 'जुलाब झालेल्या बाळाला ORS आणि झिंक द्या आणि स्तनपान सुरू ठेवा; शौचात रक्त, खोल गेलेले डोळे किंवा लघवी न होणे असल्यास लगेच उपचार घ्या.',
  },
  {
    en: 'Eat freshly cooked, hot food; avoid cut fruit and street food during an outbreak.',
    hi: 'ताज़ा पका हुआ गरम खाना खाएँ; प्रकोप के दौरान कटे फल और सड़क का खाना न खाएँ।',
    mr: 'ताजे शिजवलेले गरम अन्न खा; उद्रेकाच्या काळात कापलेली फळे आणि रस्त्यावरचे अन्न टाळा.',
  },
];

const CHOLERA_PUBLIC_EXTRA: L = {
  en: 'Sudden, heavy watery diarrhoea is an emergency: start ORS and go to hospital immediately.',
  hi: 'अचानक बहुत ज़्यादा पानी जैसे दस्त आपात स्थिति है: ORS शुरू करें और तुरंत अस्पताल जाएँ।',
  mr: 'अचानक भरपूर पाण्यासारखे जुलाब ही आणीबाणी आहे: ORS सुरू करा आणि लगेच रुग्णालयात जा.',
};

export const PRECAUTIONS: Record<FcDisease, { official: L[]; public: L[] }> = {
  dengue: { official: AEDES_OFFICIAL, public: AEDES_PUBLIC },
  chikungunya: { official: AEDES_OFFICIAL, public: [...AEDES_PUBLIC.slice(0, 3), CHIK_EXTRA] },
  malaria: { official: MALARIA_OFFICIAL, public: MALARIA_PUBLIC },
  add: { official: WATER_OFFICIAL, public: WATER_PUBLIC },
  cholera: { official: CHOLERA_OFFICIAL, public: [CHOLERA_PUBLIC_EXTRA, ...WATER_PUBLIC.slice(0, 3)] },
};

/** What each risk level asks of the district team. */
export const TIER_ACTION: Record<Tier, L> = {
  very_high: {
    en: 'Act now: start outbreak-response measures this week and alert the district rapid response team.',
    hi: 'अभी कदम उठाएँ: इसी सप्ताह प्रकोप-प्रतिक्रिया उपाय शुरू करें और ज़िला रैपिड रिस्पॉन्स टीम को सतर्क करें।',
    mr: 'आता कृती करा: याच आठवड्यात उद्रेक-प्रतिसाद उपाय सुरू करा आणि जिल्हा जलद प्रतिसाद पथकाला सतर्क करा.',
  },
  high: {
    en: 'Prepare: intensify surveillance and prevention over the next two weeks.',
    hi: 'तैयारी करें: अगले दो सप्ताह में निगरानी और रोकथाम तेज़ करें।',
    mr: 'तयारी करा: पुढील दोन आठवड्यांत देखरेख आणि प्रतिबंध वाढवा.',
  },
  moderate: {
    en: 'Watch: keep routine prevention going and check medicine and test-kit stocks.',
    hi: 'नज़र रखें: नियमित रोकथाम जारी रखें और दवा व जाँच किट का स्टॉक जाँचें।',
    mr: 'लक्ष ठेवा: नियमित प्रतिबंध सुरू ठेवा आणि औषधे व चाचणी किटचा साठा तपासा.',
  },
  low: {
    en: 'Routine surveillance.',
    hi: 'नियमित निगरानी।',
    mr: 'नियमित देखरेख.',
  },
};

export const pick = (l: L, lang: Lang) => l[lang] || l.en;
