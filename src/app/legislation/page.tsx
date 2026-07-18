'use client';

import React, { useState, useCallback } from 'react';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import AttorneyDisclaimer from '@/components/AttorneyDisclaimer';


// ── Types ─────────────────────────────────────────────────────────────────────

interface LegislationResult {
  congress: number;
  type: string;
  number: string;
  title: string;
  sponsor?: string;
  status?: string;
  introducedDate?: string;
  url: string;
  summary?: string;
}

interface StateCode {
  state: string;
  abbr: string;
  categories: string[];
  url: string;
}

type SearchTab = 'congress' | 'states';
type BillType = 'all' | 'hr' | 's' | 'hjres' | 'sjres' | 'hconres' | 'sconres' | 'hres' | 'sres';
type LawCategory =
  | 'all' |'civil' |'criminal' |'family' |'property' |'contract' |'tort' |'constitutional' |'administrative' |'tax' |'bankruptcy' |'immigration' |'environmental' |'labor' |'corporate' |'intellectual_property' |'health' |'education' |'housing' |'consumer' |'securities';

// ── Data ──────────────────────────────────────────────────────────────────────

const BILL_TYPES: Array<{ id: BillType; label: string; description: string }> = [
  { id: 'all', label: 'All Types', description: 'All bill and resolution types' },
  { id: 'hr', label: 'H.R.', description: 'House Bill' },
  { id: 's', label: 'S.', description: 'Senate Bill' },
  { id: 'hjres', label: 'H.J.Res.', description: 'House Joint Resolution' },
  { id: 'sjres', label: 'S.J.Res.', description: 'Senate Joint Resolution' },
  { id: 'hconres', label: 'H.Con.Res.', description: 'House Concurrent Resolution' },
  { id: 'sconres', label: 'S.Con.Res.', description: 'Senate Concurrent Resolution' },
  { id: 'hres', label: 'H.Res.', description: 'House Simple Resolution' },
  { id: 'sres', label: 'S.Res.', description: 'Senate Simple Resolution' },
];

const LAW_CATEGORIES: Array<{ id: LawCategory; label: string; icon: string }> = [
  { id: 'all', label: 'All Categories', icon: '⚖️' },
  { id: 'civil', label: 'Civil Law', icon: '🏛️' },
  { id: 'criminal', label: 'Criminal Law', icon: '🔒' },
  { id: 'family', label: 'Family Law', icon: '👨‍👩‍👧' },
  { id: 'property', label: 'Property Law', icon: '🏠' },
  { id: 'contract', label: 'Contract Law', icon: '📝' },
  { id: 'tort', label: 'Tort Law', icon: '⚠️' },
  { id: 'constitutional', label: 'Constitutional Law', icon: '📜' },
  { id: 'administrative', label: 'Administrative Law', icon: '🏢' },
  { id: 'tax', label: 'Tax Law', icon: '💰' },
  { id: 'bankruptcy', label: 'Bankruptcy Law', icon: '📉' },
  { id: 'immigration', label: 'Immigration Law', icon: '🌍' },
  { id: 'environmental', label: 'Environmental Law', icon: '🌿' },
  { id: 'labor', label: 'Labor & Employment', icon: '👷' },
  { id: 'corporate', label: 'Corporate Law', icon: '🏦' },
  { id: 'intellectual_property', label: 'Intellectual Property', icon: '💡' },
  { id: 'health', label: 'Health Law', icon: '🏥' },
  { id: 'education', label: 'Education Law', icon: '🎓' },
  { id: 'housing', label: 'Housing Law', icon: '🏘️' },
  { id: 'consumer', label: 'Consumer Protection', icon: '🛡️' },
  { id: 'securities', label: 'Securities Law', icon: '📊' },
];

const ALL_STATES: StateCode[] = [
  { state: 'Alabama', abbr: 'AL', categories: ['Code of Alabama', 'Alabama Rules of Civil Procedure', 'Alabama Criminal Code', 'Alabama Family Code', 'Alabama Tax Code'], url: 'https://law.justia.com/codes/alabama/' },
  { state: 'Alaska', abbr: 'AK', categories: ['Alaska Statutes', 'Alaska Rules of Court', 'Alaska Criminal Code', 'Alaska Family Law', 'Alaska Administrative Code'], url: 'https://law.justia.com/codes/alaska/' },
  { state: 'Arizona', abbr: 'AZ', categories: ['Arizona Revised Statutes', 'Arizona Rules of Civil Procedure', 'Arizona Criminal Code', 'Arizona Family Law', 'Arizona Tax Code'], url: 'https://law.justia.com/codes/arizona/' },
  { state: 'Arkansas', abbr: 'AR', categories: ['Arkansas Code', 'Arkansas Rules of Civil Procedure', 'Arkansas Criminal Code', 'Arkansas Family Law', 'Arkansas Tax Code'], url: 'https://law.justia.com/codes/arkansas/' },
  { state: 'California', abbr: 'CA', categories: ['California Civil Code', 'California Penal Code', 'California Family Code', 'California Business & Professions Code', 'California Health & Safety Code', 'California Labor Code', 'California Tax Code', 'California Probate Code', 'California Evidence Code', 'California Code of Civil Procedure'], url: 'https://law.justia.com/codes/california/' },
  { state: 'Colorado', abbr: 'CO', categories: ['Colorado Revised Statutes', 'Colorado Rules of Civil Procedure', 'Colorado Criminal Code', 'Colorado Family Law', 'Colorado Tax Code'], url: 'https://law.justia.com/codes/colorado/' },
  { state: 'Connecticut', abbr: 'CT', categories: ['Connecticut General Statutes', 'Connecticut Practice Book', 'Connecticut Criminal Code', 'Connecticut Family Law', 'Connecticut Tax Code'], url: 'https://law.justia.com/codes/connecticut/' },
  { state: 'Delaware', abbr: 'DE', categories: ['Delaware Code', 'Delaware Court Rules', 'Delaware Criminal Code', 'Delaware Family Law', 'Delaware Corporate Law'], url: 'https://law.justia.com/codes/delaware/' },
  { state: 'Florida', abbr: 'FL', categories: ['Florida Statutes', 'Florida Rules of Civil Procedure', 'Florida Criminal Code', 'Florida Family Law Rules', 'Florida Tax Code', 'Florida Probate Code', 'Florida Evidence Code'], url: 'https://law.justia.com/codes/florida/' },
  { state: 'Georgia', abbr: 'GA', categories: ['Official Code of Georgia', 'Georgia Civil Practice Act', 'Georgia Criminal Code', 'Georgia Family Law', 'Georgia Tax Code'], url: 'https://law.justia.com/codes/georgia/' },
  { state: 'Hawaii', abbr: 'HI', categories: ['Hawaii Revised Statutes', 'Hawaii Rules of Civil Procedure', 'Hawaii Criminal Code', 'Hawaii Family Court Rules', 'Hawaii Tax Code'], url: 'https://law.justia.com/codes/hawaii/' },
  { state: 'Idaho', abbr: 'ID', categories: ['Idaho Statutes', 'Idaho Rules of Civil Procedure', 'Idaho Criminal Code', 'Idaho Family Law', 'Idaho Tax Code'], url: 'https://law.justia.com/codes/idaho/' },
  { state: 'Illinois', abbr: 'IL', categories: ['Illinois Compiled Statutes', 'Illinois Code of Civil Procedure', 'Illinois Criminal Code', 'Illinois Marriage & Dissolution Act', 'Illinois Tax Code', 'Illinois Probate Act'], url: 'https://law.justia.com/codes/illinois/' },
  { state: 'Indiana', abbr: 'IN', categories: ['Indiana Code', 'Indiana Rules of Trial Procedure', 'Indiana Criminal Code', 'Indiana Family Law', 'Indiana Tax Code'], url: 'https://law.justia.com/codes/indiana/' },
  { state: 'Iowa', abbr: 'IA', categories: ['Iowa Code', 'Iowa Rules of Civil Procedure', 'Iowa Criminal Code', 'Iowa Family Law', 'Iowa Tax Code'], url: 'https://law.justia.com/codes/iowa/' },
  { state: 'Kansas', abbr: 'KS', categories: ['Kansas Statutes', 'Kansas Rules of Civil Procedure', 'Kansas Criminal Code', 'Kansas Family Law', 'Kansas Tax Code'], url: 'https://law.justia.com/codes/kansas/' },
  { state: 'Kentucky', abbr: 'KY', categories: ['Kentucky Revised Statutes', 'Kentucky Rules of Civil Procedure', 'Kentucky Penal Code', 'Kentucky Family Law', 'Kentucky Tax Code'], url: 'https://law.justia.com/codes/kentucky/' },
  { state: 'Louisiana', abbr: 'LA', categories: ['Louisiana Civil Code', 'Louisiana Code of Civil Procedure', 'Louisiana Code of Criminal Procedure', 'Louisiana Revised Statutes', 'Louisiana Children\'s Code', 'Louisiana Evidence Code', 'Louisiana Tax Code', 'Louisiana Probate Code', 'Louisiana Administrative Code'], url: 'https://law.justia.com/codes/louisiana/' },
  { state: 'Maine', abbr: 'ME', categories: ['Maine Revised Statutes', 'Maine Rules of Civil Procedure', 'Maine Criminal Code', 'Maine Family Law', 'Maine Tax Code'], url: 'https://law.justia.com/codes/maine/' },
  { state: 'Maryland', abbr: 'MD', categories: ['Maryland Code', 'Maryland Rules', 'Maryland Criminal Law', 'Maryland Family Law', 'Maryland Tax Code', 'Maryland Courts & Judicial Proceedings'], url: 'https://law.justia.com/codes/maryland/' },
  { state: 'Massachusetts', abbr: 'MA', categories: ['Massachusetts General Laws', 'Massachusetts Rules of Civil Procedure', 'Massachusetts Criminal Code', 'Massachusetts Family Law', 'Massachusetts Tax Code'], url: 'https://law.justia.com/codes/massachusetts/' },
  { state: 'Michigan', abbr: 'MI', categories: ['Michigan Compiled Laws', 'Michigan Court Rules', 'Michigan Penal Code', 'Michigan Family Law', 'Michigan Tax Code', 'Michigan Probate Code'], url: 'https://law.justia.com/codes/michigan/' },
  { state: 'Minnesota', abbr: 'MN', categories: ['Minnesota Statutes', 'Minnesota Rules of Civil Procedure', 'Minnesota Criminal Code', 'Minnesota Family Law', 'Minnesota Tax Code'], url: 'https://law.justia.com/codes/minnesota/' },
  { state: 'Mississippi', abbr: 'MS', categories: ['Mississippi Code', 'Mississippi Rules of Civil Procedure', 'Mississippi Criminal Code', 'Mississippi Family Law', 'Mississippi Tax Code'], url: 'https://law.justia.com/codes/mississippi/' },
  { state: 'Missouri', abbr: 'MO', categories: ['Missouri Revised Statutes', 'Missouri Rules of Civil Procedure', 'Missouri Criminal Code', 'Missouri Family Law', 'Missouri Tax Code'], url: 'https://law.justia.com/codes/missouri/' },
  { state: 'Montana', abbr: 'MT', categories: ['Montana Code Annotated', 'Montana Rules of Civil Procedure', 'Montana Criminal Code', 'Montana Family Law', 'Montana Tax Code'], url: 'https://law.justia.com/codes/montana/' },
  { state: 'Nebraska', abbr: 'NE', categories: ['Nebraska Revised Statutes', 'Nebraska Rules of Civil Procedure', 'Nebraska Criminal Code', 'Nebraska Family Law', 'Nebraska Tax Code'], url: 'https://law.justia.com/codes/nebraska/' },
  { state: 'Nevada', abbr: 'NV', categories: ['Nevada Revised Statutes', 'Nevada Rules of Civil Procedure', 'Nevada Criminal Code', 'Nevada Family Law', 'Nevada Tax Code', 'Nevada Gaming Law'], url: 'https://law.justia.com/codes/nevada/' },
  { state: 'New Hampshire', abbr: 'NH', categories: ['New Hampshire Revised Statutes', 'New Hampshire Rules of Civil Procedure', 'New Hampshire Criminal Code', 'New Hampshire Family Law', 'New Hampshire Tax Code'], url: 'https://law.justia.com/codes/new-hampshire/' },
  { state: 'New Jersey', abbr: 'NJ', categories: ['New Jersey Statutes', 'New Jersey Court Rules', 'New Jersey Criminal Code', 'New Jersey Family Law', 'New Jersey Tax Code', 'New Jersey Evidence Rules'], url: 'https://law.justia.com/codes/new-jersey/' },
  { state: 'New Mexico', abbr: 'NM', categories: ['New Mexico Statutes', 'New Mexico Rules of Civil Procedure', 'New Mexico Criminal Code', 'New Mexico Family Law', 'New Mexico Tax Code'], url: 'https://law.justia.com/codes/new-mexico/' },
  { state: 'New York', abbr: 'NY', categories: ['New York Civil Practice Law & Rules', 'New York Penal Law', 'New York Family Court Act', 'New York Business Corporation Law', 'New York Tax Law', 'New York Domestic Relations Law', 'New York Estates Powers & Trusts', 'New York Real Property Law', 'New York Labor Law', 'New York Education Law'], url: 'https://law.justia.com/codes/new-york/' },
  { state: 'North Carolina', abbr: 'NC', categories: ['North Carolina General Statutes', 'North Carolina Rules of Civil Procedure', 'North Carolina Criminal Code', 'North Carolina Family Law', 'North Carolina Tax Code'], url: 'https://law.justia.com/codes/north-carolina/' },
  { state: 'North Dakota', abbr: 'ND', categories: ['North Dakota Century Code', 'North Dakota Rules of Civil Procedure', 'North Dakota Criminal Code', 'North Dakota Family Law', 'North Dakota Tax Code'], url: 'https://law.justia.com/codes/north-dakota/' },
  { state: 'Ohio', abbr: 'OH', categories: ['Ohio Revised Code', 'Ohio Rules of Civil Procedure', 'Ohio Criminal Code', 'Ohio Family Law', 'Ohio Tax Code', 'Ohio Evidence Rules'], url: 'https://law.justia.com/codes/ohio/' },
  { state: 'Oklahoma', abbr: 'OK', categories: ['Oklahoma Statutes', 'Oklahoma Rules of Civil Procedure', 'Oklahoma Criminal Code', 'Oklahoma Family Law', 'Oklahoma Tax Code'], url: 'https://law.justia.com/codes/oklahoma/' },
  { state: 'Oregon', abbr: 'OR', categories: ['Oregon Revised Statutes', 'Oregon Rules of Civil Procedure', 'Oregon Criminal Code', 'Oregon Family Law', 'Oregon Tax Code'], url: 'https://law.justia.com/codes/oregon/' },
  { state: 'Pennsylvania', abbr: 'PA', categories: ['Pennsylvania Consolidated Statutes', 'Pennsylvania Rules of Civil Procedure', 'Pennsylvania Crimes Code', 'Pennsylvania Domestic Relations Code', 'Pennsylvania Tax Code', 'Pennsylvania Evidence Rules'], url: 'https://law.justia.com/codes/pennsylvania/' },
  { state: 'Rhode Island', abbr: 'RI', categories: ['Rhode Island General Laws', 'Rhode Island Rules of Civil Procedure', 'Rhode Island Criminal Code', 'Rhode Island Family Law', 'Rhode Island Tax Code'], url: 'https://law.justia.com/codes/rhode-island/' },
  { state: 'South Carolina', abbr: 'SC', categories: ['South Carolina Code of Laws', 'South Carolina Rules of Civil Procedure', 'South Carolina Criminal Code', 'South Carolina Family Law', 'South Carolina Tax Code'], url: 'https://law.justia.com/codes/south-carolina/' },
  { state: 'South Dakota', abbr: 'SD', categories: ['South Dakota Codified Laws', 'South Dakota Rules of Civil Procedure', 'South Dakota Criminal Code', 'South Dakota Family Law', 'South Dakota Tax Code'], url: 'https://law.justia.com/codes/south-dakota/' },
  { state: 'Tennessee', abbr: 'TN', categories: ['Tennessee Code Annotated', 'Tennessee Rules of Civil Procedure', 'Tennessee Criminal Code', 'Tennessee Family Law', 'Tennessee Tax Code'], url: 'https://law.justia.com/codes/tennessee/' },
  { state: 'Texas', abbr: 'TX', categories: ['Texas Civil Practice & Remedies Code', 'Texas Penal Code', 'Texas Family Code', 'Texas Business Organizations Code', 'Texas Tax Code', 'Texas Property Code', 'Texas Labor Code', 'Texas Health & Safety Code', 'Texas Government Code', 'Texas Probate Code'], url: 'https://law.justia.com/codes/texas/' },
  { state: 'Utah', abbr: 'UT', categories: ['Utah Code', 'Utah Rules of Civil Procedure', 'Utah Criminal Code', 'Utah Family Law', 'Utah Tax Code'], url: 'https://law.justia.com/codes/utah/' },
  { state: 'Vermont', abbr: 'VT', categories: ['Vermont Statutes', 'Vermont Rules of Civil Procedure', 'Vermont Criminal Code', 'Vermont Family Law', 'Vermont Tax Code'], url: 'https://law.justia.com/codes/vermont/' },
  { state: 'Virginia', abbr: 'VA', categories: ['Code of Virginia', 'Virginia Rules of Court', 'Virginia Criminal Code', 'Virginia Family Law', 'Virginia Tax Code', 'Virginia Evidence Code'], url: 'https://law.justia.com/codes/virginia/' },
  { state: 'Washington', abbr: 'WA', categories: ['Revised Code of Washington', 'Washington Rules of Civil Procedure', 'Washington Criminal Code', 'Washington Family Law', 'Washington Tax Code'], url: 'https://law.justia.com/codes/washington/' },
  { state: 'West Virginia', abbr: 'WV', categories: ['West Virginia Code', 'West Virginia Rules of Civil Procedure', 'West Virginia Criminal Code', 'West Virginia Family Law', 'West Virginia Tax Code'], url: 'https://law.justia.com/codes/west-virginia/' },
  { state: 'Wisconsin', abbr: 'WI', categories: ['Wisconsin Statutes', 'Wisconsin Rules of Civil Procedure', 'Wisconsin Criminal Code', 'Wisconsin Family Law', 'Wisconsin Tax Code'], url: 'https://law.justia.com/codes/wisconsin/' },
  { state: 'Wyoming', abbr: 'WY', categories: ['Wyoming Statutes', 'Wyoming Rules of Civil Procedure', 'Wyoming Criminal Code', 'Wyoming Family Law', 'Wyoming Tax Code'], url: 'https://law.justia.com/codes/wyoming/' },
];

const CONGRESS_CATEGORIES: Array<{ id: string; label: string; usc_title: string; description: string }> = [
  { id: 'title1', label: 'General Provisions', usc_title: '1 U.S.C.', description: 'Rules of construction, definitions, and general provisions' },
  { id: 'title2', label: 'Congress', usc_title: '2 U.S.C.', description: 'Congressional organization, procedures, and operations' },
  { id: 'title3', label: 'President', usc_title: '3 U.S.C.', description: 'Presidential powers, succession, and compensation' },
  { id: 'title4', label: 'Flag & Seal', usc_title: '4 U.S.C.', description: 'Flag, seal, seat of government, and states' },
  { id: 'title5', label: 'Government Organization', usc_title: '5 U.S.C.', description: 'Government organization and employees, administrative procedure' },
  { id: 'title6', label: 'Domestic Security', usc_title: '6 U.S.C.', description: 'Homeland security and domestic security' },
  { id: 'title7', label: 'Agriculture', usc_title: '7 U.S.C.', description: 'Agricultural laws, farm programs, and food safety' },
  { id: 'title8', label: 'Aliens & Nationality', usc_title: '8 U.S.C.', description: 'Immigration, naturalization, and citizenship' },
  { id: 'title9', label: 'Arbitration', usc_title: '9 U.S.C.', description: 'Federal Arbitration Act and dispute resolution' },
  { id: 'title10', label: 'Armed Forces', usc_title: '10 U.S.C.', description: 'Military law, UCMJ, and armed forces organization' },
  { id: 'title11', label: 'Bankruptcy', usc_title: '11 U.S.C.', description: 'Bankruptcy code — Chapters 7, 11, 12, 13' },
  { id: 'title12', label: 'Banks & Banking', usc_title: '12 U.S.C.', description: 'Banking regulation, Federal Reserve, and financial institutions' },
  { id: 'title13', label: 'Census', usc_title: '13 U.S.C.', description: 'Census bureau and population statistics' },
  { id: 'title14', label: 'Coast Guard', usc_title: '14 U.S.C.', description: 'Coast Guard organization and operations' },
  { id: 'title15', label: 'Commerce & Trade', usc_title: '15 U.S.C.', description: 'Antitrust, consumer protection, FTC, trademarks, securities' },
  { id: 'title16', label: 'Conservation', usc_title: '16 U.S.C.', description: 'National parks, wildlife, and natural resource conservation' },
  { id: 'title17', label: 'Copyrights', usc_title: '17 U.S.C.', description: 'Copyright law, DMCA, and intellectual property' },
  { id: 'title18', label: 'Crimes & Criminal Procedure', usc_title: '18 U.S.C.', description: 'Federal criminal law, RICO, fraud, civil rights violations' },
  { id: 'title19', label: 'Customs Duties', usc_title: '19 U.S.C.', description: 'Import/export, tariffs, and customs regulations' },
  { id: 'title20', label: 'Education', usc_title: '20 U.S.C.', description: 'Federal education programs, student loans, IDEA' },
  { id: 'title21', label: 'Food & Drugs', usc_title: '21 U.S.C.', description: 'FDA, controlled substances, food safety' },
  { id: 'title22', label: 'Foreign Relations', usc_title: '22 U.S.C.', description: 'Foreign affairs, diplomacy, and international agreements' },
  { id: 'title23', label: 'Highways', usc_title: '23 U.S.C.', description: 'Federal highway programs and transportation' },
  { id: 'title24', label: 'Hospitals & Asylums', usc_title: '24 U.S.C.', description: 'Federal hospitals and health facilities' },
  { id: 'title25', label: 'Indians', usc_title: '25 U.S.C.', description: 'Native American law, tribal sovereignty, and Indian affairs' },
  { id: 'title26', label: 'Internal Revenue Code', usc_title: '26 U.S.C.', description: 'Federal tax law — income, estate, gift, excise taxes' },
  { id: 'title27', label: 'Intoxicating Liquors', usc_title: '27 U.S.C.', description: 'Alcohol regulation and licensing' },
  { id: 'title28', label: 'Judiciary & Judicial Procedure', usc_title: '28 U.S.C.', description: 'Federal courts, jurisdiction, habeas corpus, civil procedure' },
  { id: 'title29', label: 'Labor', usc_title: '29 U.S.C.', description: 'FLSA, FMLA, ERISA, NLRA, and labor relations' },
  { id: 'title30', label: 'Mineral Lands & Mining', usc_title: '30 U.S.C.', description: 'Mining law, mineral rights, and energy resources' },
  { id: 'title31', label: 'Money & Finance', usc_title: '31 U.S.C.', description: 'Federal finance, Treasury, False Claims Act' },
  { id: 'title32', label: 'National Guard', usc_title: '32 U.S.C.', description: 'National Guard organization and operations' },
  { id: 'title33', label: 'Navigation & Navigable Waters', usc_title: '33 U.S.C.', description: 'Maritime law, Clean Water Act, waterways' },
  { id: 'title34', label: 'Crime Control & Law Enforcement', usc_title: '34 U.S.C.', description: 'DOJ programs, victim rights, sex offender registration' },
  { id: 'title35', label: 'Patents', usc_title: '35 U.S.C.', description: 'Patent law, USPTO, and patent procedures' },
  { id: 'title36', label: 'Patriotic & National Observances', usc_title: '36 U.S.C.', description: 'National holidays, patriotic organizations' },
  { id: 'title37', label: 'Pay & Allowances (Armed Forces)', usc_title: '37 U.S.C.', description: 'Military pay, allowances, and benefits' },
  { id: 'title38', label: 'Veterans Benefits', usc_title: '38 U.S.C.', description: 'VA benefits, disability compensation, GI Bill' },
  { id: 'title39', label: 'Postal Service', usc_title: '39 U.S.C.', description: 'USPS organization and postal regulations' },
  { id: 'title40', label: 'Public Buildings & Works', usc_title: '40 U.S.C.', description: 'Federal property, construction, and public works' },
  { id: 'title41', label: 'Public Contracts', usc_title: '41 U.S.C.', description: 'Federal procurement and contracting' },
  { id: 'title42', label: 'Public Health & Welfare', usc_title: '42 U.S.C.', description: 'Civil Rights Act, ADA, Medicare, Medicaid, Social Security' },
  { id: 'title43', label: 'Public Lands', usc_title: '43 U.S.C.', description: 'Federal land management and public lands' },
  { id: 'title44', label: 'Public Printing & Documents', usc_title: '44 U.S.C.', description: 'Federal Register, GPO, and public records' },
  { id: 'title45', label: 'Railroads', usc_title: '45 U.S.C.', description: 'Railroad regulation and labor relations' },
  { id: 'title46', label: 'Shipping', usc_title: '46 U.S.C.', description: 'Maritime commerce, shipping, and admiralty' },
  { id: 'title47', label: 'Telecommunications', usc_title: '47 U.S.C.', description: 'FCC, communications law, internet regulation' },
  { id: 'title48', label: 'Territories & Insular Possessions', usc_title: '48 U.S.C.', description: 'US territories — Puerto Rico, Guam, USVI, etc.' },
  { id: 'title49', label: 'Transportation', usc_title: '49 U.S.C.', description: 'DOT, aviation, motor vehicles, pipeline safety' },
  { id: 'title50', label: 'War & National Defense', usc_title: '50 U.S.C.', description: 'FISA, national security, war powers, espionage' },
  { id: 'title51', label: 'National & Commercial Space', usc_title: '51 U.S.C.', description: 'NASA, space exploration, and commercial space' },
  { id: 'title52', label: 'Voting & Elections', usc_title: '52 U.S.C.', description: 'Voting Rights Act, HAVA, campaign finance' },
  { id: 'title54', label: 'National Park Service', usc_title: '54 U.S.C.', description: 'National parks, monuments, and historic preservation' },
];

const QUICK_TERMS = [
  'habeas corpus', 'due process', 'equal protection', 'civil rights', 'RICO',
  'ADA accommodation', 'FMLA leave', 'Title VII discrimination', 'Section 1983',
  'False Claims Act', 'ERISA preemption', 'Fourth Amendment search', 'Miranda rights',
  'qualified immunity', 'sovereign immunity', 'class action certification',
];

// ── Component ─────────────────────────────────────────────────────────────────

export default function LegislationPage() {
  const [activeTab, setActiveTab] = useState<SearchTab>('congress');
  const [searchQuery, setSearchQuery] = useState('');
  const [billType, setBillType] = useState<BillType>('all');
  const [lawCategory, setLawCategory] = useState<LawCategory>('all');
  const [selectedState, setSelectedState] = useState<string>('');
  const [stateSearch, setStateSearch] = useState('');
  const [uscFilter, setUscFilter] = useState('');

  const filteredStates = ALL_STATES.filter(s =>
    s.state.toLowerCase().includes(stateSearch.toLowerCase()) ||
    s.abbr.toLowerCase().includes(stateSearch.toLowerCase())
  );

  const filteredUSC = CONGRESS_CATEGORIES.filter(c =>
    uscFilter === '' ||
    c.label.toLowerCase().includes(uscFilter.toLowerCase()) ||
    c.description.toLowerCase().includes(uscFilter.toLowerCase()) ||
    c.usc_title.toLowerCase().includes(uscFilter.toLowerCase())
  );

  const selectedStateData = ALL_STATES.find(s => s.abbr === selectedState);

  const buildCongressSearchUrl = useCallback(() => {
    const base = 'https://www.congress.gov/search';
    const params = new URLSearchParams();
    if (searchQuery) params.set('q', JSON.stringify({ source: 'legislation', search: searchQuery }));
    if (billType !== 'all') params.set('q', JSON.stringify({ source: 'legislation', type: billType, search: searchQuery }));
    return `${base}?${params.toString()}`;
  }, [searchQuery, billType]);

  const buildUSCSearchUrl = useCallback((title?: string) => {
    if (title) {
      return `https://uscode.house.gov/browse/prelim@title${title.replace('title', '')}&edition=prelim`;
    }
    if (searchQuery) {
      return `https://uscode.house.gov/search.xhtml?query=${encodeURIComponent(searchQuery)}&searchMode=DisplayAllSections`;
    }
    return 'https://uscode.house.gov/';
  }, [searchQuery]);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <AttorneyDisclaimer />
      <Header />

      {/* Hero */}
      <section className="pt-32 pb-10 px-4 bg-gradient-to-b from-primary/5 to-background border-b border-border">
        <div className="max-w-5xl mx-auto text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary text-xs font-semibold px-3 py-1 rounded-full mb-4 uppercase tracking-wider">
            🏛️ Legal Research Hub
          </div>
          <h1 className="text-3xl md:text-5xl font-bold text-foreground mb-4">
            Federal &amp; State Legislation
          </h1>
          <p className="text-muted-foreground text-base md:text-lg max-w-2xl mx-auto mb-6">
            Search Congress.gov legislation by terminology, browse all 50 U.S. state legal codes, and navigate every title of the United States Code.
          </p>
          {/* Global search bar */}
          <div className="flex flex-col sm:flex-row gap-2 max-w-2xl mx-auto">
            <input
              type="text"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && searchQuery.trim()) {
                  window.open(activeTab === 'congress' ? buildCongressSearchUrl() : buildUSCSearchUrl(), '_blank');
                }
              }}
              placeholder="Search by legal term, statute, or topic…"
              className="flex-1 px-4 py-3 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-sm"
            />
            <button
              onClick={() => {
                if (searchQuery.trim()) {
                  window.open(activeTab === 'congress' ? buildCongressSearchUrl() : buildUSCSearchUrl(), '_blank');
                }
              }}
              className="px-6 py-3 bg-primary text-primary-foreground rounded-lg font-semibold text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
            >
              Search
            </button>
          </div>
          {/* Quick terms */}
          <div className="flex flex-wrap justify-center gap-2 mt-4">
            {QUICK_TERMS.slice(0, 8).map(term => (
              <button
                key={term}
                onClick={() => setSearchQuery(term)}
                className="text-xs px-3 py-1 rounded-full bg-card border border-border text-muted-foreground hover:text-primary hover:border-primary transition-colors"
              >
                {term}
              </button>
            ))}
          </div>
        </div>
      </section>

      {/* Tabs */}
      <div className="sticky top-[80px] z-30 bg-background border-b border-border">
        <div className="max-w-5xl mx-auto px-4 flex gap-1 py-2">
          {[
            { id: 'congress' as SearchTab, label: '🏛️ Congress.gov', desc: 'Bills & Legislation' },
            { id: 'states' as SearchTab, label: '🗺️ All 50 States', desc: 'State Legal Codes' },
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
                activeTab === tab.id
                  ? 'bg-primary text-primary-foreground'
                  : 'text-muted-foreground hover:text-foreground hover:bg-card'
              }`}
            >
              <span>{tab.label}</span>
              <span className={`text-xs hidden sm:inline ${activeTab === tab.id ? 'text-primary-foreground/70' : 'text-muted-foreground'}`}>
                — {tab.desc}
              </span>
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-5xl mx-auto px-4 py-8">

        {/* ── CONGRESS TAB ── */}
        {activeTab === 'congress' && (
          <div className="space-y-8">

            {/* Bill Type Filter */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Filter by Bill Type</h2>
              <div className="flex flex-wrap gap-2">
                {BILL_TYPES.map(bt => (
                  <button
                    key={bt.id}
                    onClick={() => setBillType(bt.id)}
                    title={bt.description}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-colors ${
                      billType === bt.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-primary'
                    }`}
                  >
                    {bt.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Law Category Filter */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Filter by Law Category</h2>
              <div className="flex flex-wrap gap-2">
                {LAW_CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    onClick={() => setLawCategory(cat.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                      lawCategory === cat.id
                        ? 'bg-primary text-primary-foreground border-primary'
                        : 'bg-card border-border text-muted-foreground hover:border-primary hover:text-primary'
                    }`}
                  >
                    {cat.icon} {cat.label}
                  </button>
                ))}
              </div>
            </section>

            {/* Search Actions */}
            <section className="grid sm:grid-cols-2 gap-4">
              <a
                href={buildCongressSearchUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary transition-colors group"
              >
                <span className="text-2xl">📋</span>
                <div>
                  <div className="font-semibold text-foreground group-hover:text-primary text-sm">Search Congress.gov Bills</div>
                  <div className="text-xs text-muted-foreground">Search current &amp; historical legislation by term</div>
                </div>
              </a>
              <a
                href={`https://www.congress.gov/browse/legislation/house-bill`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary transition-colors group"
              >
                <span className="text-2xl">🏠</span>
                <div>
                  <div className="font-semibold text-foreground group-hover:text-primary text-sm">Browse House Bills</div>
                  <div className="text-xs text-muted-foreground">All H.R. bills by congress number</div>
                </div>
              </a>
              <a
                href={`https://www.congress.gov/browse/legislation/senate-bill`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary transition-colors group"
              >
                <span className="text-2xl">🏛️</span>
                <div>
                  <div className="font-semibold text-foreground group-hover:text-primary text-sm">Browse Senate Bills</div>
                  <div className="text-xs text-muted-foreground">All S. bills by congress number</div>
                </div>
              </a>
              <a
                href="https://www.congress.gov/public-laws"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-4 bg-card border border-border rounded-xl hover:border-primary transition-colors group"
              >
                <span className="text-2xl">✅</span>
                <div>
                  <div className="font-semibold text-foreground group-hover:text-primary text-sm">Public Laws</div>
                  <div className="text-xs text-muted-foreground">Bills signed into law by the President</div>
                </div>
              </a>
            </section>

            {/* United States Code — All 54 Titles */}
            <section>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <div>
                  <h2 className="text-lg font-semibold text-foreground">United States Code — All Titles</h2>
                  <p className="text-xs text-muted-foreground">Browse all {CONGRESS_CATEGORIES.length} titles of the U.S.C. — every category of federal law</p>
                </div>
                <input
                  type="text"
                  value={uscFilter}
                  onChange={e => setUscFilter(e.target.value)}
                  placeholder="Filter titles…"
                  className="px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs w-full sm:w-48"
                />
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {filteredUSC.map(title => (
                  <a
                    key={title.id}
                    href={buildUSCSearchUrl(title.id)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-3 bg-card border border-border rounded-lg hover:border-primary transition-colors group"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <div className="text-xs font-bold text-primary">{title.usc_title}</div>
                        <div className="text-sm font-semibold text-foreground group-hover:text-primary leading-tight">{title.label}</div>
                        <div className="text-xs text-muted-foreground mt-1 leading-snug">{title.description}</div>
                      </div>
                      <span className="text-muted-foreground group-hover:text-primary text-xs mt-0.5 shrink-0">↗</span>
                    </div>
                  </a>
                ))}
              </div>
            </section>

            {/* Additional Federal Resources */}
            <section>
              <h2 className="text-lg font-semibold text-foreground mb-3">Additional Federal Legal Resources</h2>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {[
                  { label: 'Code of Federal Regulations (CFR)', url: 'https://www.ecfr.gov/', icon: '📑', desc: 'All federal agency regulations' },
                  { label: 'Federal Register', url: 'https://www.federalregister.gov/', icon: '📰', desc: 'Daily journal of federal government' },
                  { label: 'Supreme Court Opinions', url: 'https://www.supremecourt.gov/opinions/opinions.aspx', icon: '⚖️', desc: 'SCOTUS decisions and opinions' },
                  { label: 'Federal Rules of Civil Procedure', url: 'https://www.uscourts.gov/rules-policies/current-rules-practice-procedure/federal-rules-civil-procedure', icon: '📋', desc: 'FRCP — all rules and amendments' },
                  { label: 'Federal Rules of Evidence', url: 'https://www.uscourts.gov/rules-policies/current-rules-practice-procedure/federal-rules-evidence', icon: '🔍', desc: 'FRE — evidentiary rules' },
                  { label: 'Federal Rules of Criminal Procedure', url: 'https://www.uscourts.gov/rules-policies/current-rules-practice-procedure/federal-rules-criminal-procedure', icon: '🔒', desc: 'FRCrP — criminal procedure rules' },
                  { label: 'PACER — Federal Court Records', url: 'https://pacer.uscourts.gov/', icon: '🗂️', desc: 'Federal court case filings' },
                  { label: 'GovInfo — Official Publications', url: 'https://www.govinfo.gov/', icon: '🏛️', desc: 'Official US government publications' },
                  { label: 'Justia Federal Law', url: 'https://law.justia.com/federal/', icon: '⚖️', desc: 'Free federal case law and statutes' },
                ].map(res => (
                  <a
                    key={res.label}
                    href={res.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-start gap-3 p-3 bg-card border border-border rounded-lg hover:border-primary transition-colors group"
                  >
                    <span className="text-xl shrink-0">{res.icon}</span>
                    <div>
                      <div className="text-sm font-semibold text-foreground group-hover:text-primary leading-tight">{res.label}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">{res.desc}</div>
                    </div>
                  </a>
                ))}
              </div>
            </section>
          </div>
        )}

        {/* ── STATES TAB ── */}
        {activeTab === 'states' && (
          <div className="space-y-6">
            <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">All 50 States — Legal Codes &amp; Categories</h2>
                <p className="text-xs text-muted-foreground">Every state code, statute, and law category</p>
              </div>
              <input
                type="text"
                value={stateSearch}
                onChange={e => setStateSearch(e.target.value)}
                placeholder="Search states…"
                className="px-3 py-2 rounded-lg border border-border bg-card text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs w-full sm:w-48"
              />
            </div>

            {/* State selector grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
              {filteredStates.map(s => (
                <button
                  key={s.abbr}
                  onClick={() => setSelectedState(selectedState === s.abbr ? '' : s.abbr)}
                  className={`px-3 py-2 rounded-lg border text-xs font-semibold transition-colors text-left ${
                    selectedState === s.abbr
                      ? 'bg-primary text-primary-foreground border-primary'
                      : 'bg-card border-border text-foreground hover:border-primary hover:text-primary'
                  }`}
                >
                  <span className="font-bold">{s.abbr}</span>
                  <span className="block text-[10px] font-normal opacity-80 truncate">{s.state}</span>
                </button>
              ))}
            </div>

            {/* Selected state detail */}
            {selectedStateData && (
              <div className="bg-card border border-primary/30 rounded-xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h3 className="text-xl font-bold text-foreground">{selectedStateData.state}</h3>
                    <p className="text-xs text-muted-foreground">All legal codes and categories</p>
                  </div>
                  <a
                    href={selectedStateData.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors"
                  >
                    Browse Full Code ↗
                  </a>
                </div>
                <div className="grid sm:grid-cols-2 gap-2">
                  {selectedStateData.categories.map(cat => (
                    <a
                      key={cat}
                      href={`${selectedStateData.url}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-2 px-3 py-2 bg-background border border-border rounded-lg text-xs text-foreground hover:border-primary hover:text-primary transition-colors group"
                    >
                      <span className="text-primary">📚</span>
                      <span className="group-hover:text-primary">{cat}</span>
                    </a>
                  ))}
                </div>
                {/* State-specific search */}
                <div className="mt-4 flex gap-2">
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={e => setSearchQuery(e.target.value)}
                    placeholder={`Search ${selectedStateData.state} law…`}
                    className="flex-1 px-3 py-2 rounded-lg border border-border bg-background text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary text-xs"
                  />
                  <a
                    href={`https://law.justia.com/codes/${selectedStateData.state.toLowerCase().replace(/\s+/g, '-')}/?q=${encodeURIComponent(searchQuery)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-lg text-xs font-semibold hover:bg-primary/90 transition-colors whitespace-nowrap"
                  >
                    Search
                  </a>
                </div>
              </div>
            )}

            {/* All states list with categories */}
            <div className="space-y-3">
              {filteredStates.map(s => (
                <div key={s.abbr} className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-primary w-8">{s.abbr}</span>
                      <span className="font-semibold text-foreground text-sm">{s.state}</span>
                    </div>
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-primary hover:underline font-medium"
                    >
                      Full Code ↗
                    </a>
                  </div>
                  <div className="px-4 py-3 flex flex-wrap gap-1.5">
                    {s.categories.map(cat => (
                      <span
                        key={cat}
                        className="text-[11px] px-2 py-0.5 bg-background border border-border rounded-full text-muted-foreground"
                      >
                        {cat}
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </main>

      {/* Disclaimer */}
      <div className="max-w-5xl mx-auto px-4 pb-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800">
          <strong>Legal Research Disclaimer:</strong> This page provides links to public legal databases for informational and research purposes only. It does not constitute legal advice. Always verify the current version of any statute or regulation through official government sources. Broussard Legal Services is a paralegal services firm — not a law firm. Consult a licensed attorney for legal advice.
        </div>
      </div>

      <Footer />
    </div>
  );
}
