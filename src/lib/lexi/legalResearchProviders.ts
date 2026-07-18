/**
 * Lexi Legal Research Providers
 * LexisNexis + Westlaw API integration framework
 * All 50 states + federal law + cross-conflict checking
 */

// ─── Provider Config ──────────────────────────────────────────────────────────

export const LEXISNEXIS_API_BASE = 'https://api.lexisnexis.com/v1';
export const WESTLAW_API_BASE = 'https://api.westlaw.com/v1';

export interface LegalResearchProvider {
  id: 'lexisnexis' | 'westlaw' | 'justia' | 'congress' | 'lexi_ai';
  name: string;
  icon: string;
  description: string;
  available: boolean;
  requiresKey: boolean;
  envKey?: string;
}

export const LEGAL_PROVIDERS: LegalResearchProvider[] = [
  {
    id: 'lexisnexis',
    name: 'LexisNexis',
    icon: '🔵',
    description: 'Full-text case law, statutes, regulations, and secondary sources',
    available: !!(process.env.LEXISNEXIS_API_KEY),
    requiresKey: true,
    envKey: 'LEXISNEXIS_API_KEY',
  },
  {
    id: 'westlaw',
    name: 'Westlaw',
    icon: '🟠',
    description: 'KeyCite, WestSearch, statutes, regulations, and legal analytics',
    available: !!(process.env.WESTLAW_API_KEY),
    requiresKey: true,
    envKey: 'WESTLAW_API_KEY',
  },
  {
    id: 'justia',
    name: 'Justia (Free)',
    icon: '⚖️',
    description: 'Free access to federal and state case law, statutes, and regulations',
    available: true,
    requiresKey: false,
  },
  {
    id: 'congress',
    name: 'Congress.gov',
    icon: '🏛️',
    description: 'Official federal legislation, bills, and public laws',
    available: true,
    requiresKey: false,
  },
  {
    id: 'lexi_ai',
    name: 'Lexi AI Research',
    icon: '🤖',
    description: 'AI-powered research via Perplexity with live web search',
    available: true,
    requiresKey: false,
  },
];

// ─── All 50 States — Comprehensive Law Data ───────────────────────────────────

export interface StateLawProfile {
  state: string;
  abbr: string;
  capital: string;
  circuit: string; // Federal circuit court
  lawTypes: StateLawType[];
  primarySources: StatePrimarySource[];
  westlawDb?: string;   // Westlaw database identifier
  lexisDb?: string;     // LexisNexis database identifier
  justiaUrl: string;
  officialCodeUrl: string;
  courtUrl: string;
}

export interface StateLawType {
  category: string;
  codeName: string;
  abbreviation: string;
  description: string;
  topics: string[];
}

export interface StatePrimarySource {
  name: string;
  url: string;
  type: 'statute' | 'regulation' | 'court_rule' | 'constitution' | 'case_law';
}

export const ALL_50_STATES_LAW_PROFILES: StateLawProfile[] = [
  {
    state: 'Alabama', abbr: 'AL', capital: 'Montgomery', circuit: '11th Circuit',
    westlawDb: 'AL-ST', lexisDb: 'ALCODE',
    justiaUrl: 'https://law.justia.com/codes/alabama/',
    officialCodeUrl: 'https://alison.legislature.state.al.us/code-of-alabama',
    courtUrl: 'https://judicial.alabama.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Code of Alabama', abbreviation: 'Ala. Code', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'civil procedure'] },
      { category: 'Criminal', codeName: 'Alabama Criminal Code', abbreviation: 'Ala. Code §13A', description: 'Criminal offenses and procedure', topics: ['felonies', 'misdemeanors', 'criminal procedure', 'sentencing'] },
      { category: 'Family', codeName: 'Alabama Domestic Relations', abbreviation: 'Ala. Code §30', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'adoption'] },
      { category: 'Probate', codeName: 'Alabama Probate Code', abbreviation: 'Ala. Code §43', description: 'Wills, estates, guardianship', topics: ['wills', 'intestate succession', 'guardianship', 'trusts'] },
      { category: 'Tax', codeName: 'Alabama Revenue Code', abbreviation: 'Ala. Code §40', description: 'State taxation', topics: ['income tax', 'sales tax', 'property tax'] },
      { category: 'Business', codeName: 'Alabama Business & Commerce', abbreviation: 'Ala. Code §10A', description: 'Corporations, LLCs, partnerships', topics: ['corporations', 'LLC', 'partnerships', 'UCC'] },
    ],
    primarySources: [
      { name: 'Code of Alabama', url: 'https://alison.legislature.state.al.us/code-of-alabama', type: 'statute' },
      { name: 'Alabama Rules of Civil Procedure', url: 'https://judicial.alabama.gov/docs/library/rules/arcp.pdf', type: 'court_rule' },
      { name: 'Alabama Constitution', url: 'https://alison.legislature.state.al.us/constitution', type: 'constitution' },
    ],
  },
  {
    state: 'Alaska', abbr: 'AK', capital: 'Juneau', circuit: '9th Circuit',
    westlawDb: 'AK-ST', lexisDb: 'AKCODE',
    justiaUrl: 'https://law.justia.com/codes/alaska/',
    officialCodeUrl: 'https://www.akleg.gov/basis/statutes.asp',
    courtUrl: 'https://courts.alaska.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Alaska Statutes', abbreviation: 'AS', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'civil procedure'] },
      { category: 'Criminal', codeName: 'Alaska Criminal Code', abbreviation: 'AS 11', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'criminal procedure'] },
      { category: 'Family', codeName: 'Alaska Domestic Relations', abbreviation: 'AS 25', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Natural Resources', codeName: 'Alaska Natural Resources', abbreviation: 'AS 38', description: 'Oil, gas, mining, fishing', topics: ['oil and gas', 'mining', 'fishing rights', 'public lands'] },
      { category: 'Tax', codeName: 'Alaska Revenue & Taxation', abbreviation: 'AS 43', description: 'State taxation', topics: ['oil tax', 'corporate tax', 'property tax'] },
      { category: 'Business', codeName: 'Alaska Business & Commerce', abbreviation: 'AS 10', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
    ],
    primarySources: [
      { name: 'Alaska Statutes', url: 'https://www.akleg.gov/basis/statutes.asp', type: 'statute' },
      { name: 'Alaska Rules of Civil Procedure', url: 'https://courts.alaska.gov/rules/', type: 'court_rule' },
    ],
  },
  {
    state: 'Arizona', abbr: 'AZ', capital: 'Phoenix', circuit: '9th Circuit',
    westlawDb: 'AZ-ST', lexisDb: 'AZCODE',
    justiaUrl: 'https://law.justia.com/codes/arizona/',
    officialCodeUrl: 'https://www.azleg.gov/arstitle/',
    courtUrl: 'https://www.azcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Arizona Revised Statutes', abbreviation: 'A.R.S.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Arizona Criminal Code', abbreviation: 'A.R.S. §13', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'sentencing'] },
      { category: 'Family', codeName: 'Arizona Domestic Relations', abbreviation: 'A.R.S. §25', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'community property'] },
      { category: 'Property', codeName: 'Arizona Property Code', abbreviation: 'A.R.S. §33', description: 'Real and personal property', topics: ['real estate', 'landlord-tenant', 'liens'] },
      { category: 'Tax', codeName: 'Arizona Taxation', abbreviation: 'A.R.S. §42', description: 'State taxation', topics: ['income tax', 'sales tax', 'property tax'] },
      { category: 'Business', codeName: 'Arizona Business Organizations', abbreviation: 'A.R.S. §10', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
    ],
    primarySources: [
      { name: 'Arizona Revised Statutes', url: 'https://www.azleg.gov/arstitle/', type: 'statute' },
      { name: 'Arizona Rules of Civil Procedure', url: 'https://www.azcourts.gov/rules/', type: 'court_rule' },
    ],
  },
  {
    state: 'Arkansas', abbr: 'AR', capital: 'Little Rock', circuit: '8th Circuit',
    westlawDb: 'AR-ST', lexisDb: 'ARCODE',
    justiaUrl: 'https://law.justia.com/codes/arkansas/',
    officialCodeUrl: 'https://advance.lexis.com/container?config=00JAA3ZTU0NTIzYy0zZDEyLTRhYmQtYWE3OS02YTgyOGI2ZWI3NjMKAFBvZENhdGFsb2e9zYpNUjsxMjM1&crid=',
    courtUrl: 'https://courts.arkansas.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Arkansas Code Annotated', abbreviation: 'Ark. Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Arkansas Criminal Code', abbreviation: 'Ark. Code Ann. §5', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Arkansas Domestic Relations', abbreviation: 'Ark. Code Ann. §9', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Tax', codeName: 'Arkansas Taxation', abbreviation: 'Ark. Code Ann. §26', description: 'State taxation', topics: ['income tax', 'sales tax'] },
      { category: 'Business', codeName: 'Arkansas Business Organizations', abbreviation: 'Ark. Code Ann. §4', description: 'Corporations, LLCs', topics: ['corporations', 'LLC'] },
    ],
    primarySources: [
      { name: 'Arkansas Code Annotated', url: 'https://law.justia.com/codes/arkansas/', type: 'statute' },
    ],
  },
  {
    state: 'California', abbr: 'CA', capital: 'Sacramento', circuit: '9th Circuit',
    westlawDb: 'CA-ST', lexisDb: 'CACODE',
    justiaUrl: 'https://law.justia.com/codes/california/',
    officialCodeUrl: 'https://leginfo.legislature.ca.gov/faces/codedisplayexpand.xhtml',
    courtUrl: 'https://www.courts.ca.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'California Civil Code', abbreviation: 'Cal. Civ. Code', description: 'Contracts, property, torts, privacy', topics: ['contracts', 'property', 'torts', 'privacy', 'consumer protection'] },
      { category: 'Criminal', codeName: 'California Penal Code', abbreviation: 'Cal. Pen. Code', description: 'Criminal offenses and procedure', topics: ['felonies', 'misdemeanors', 'criminal procedure', 'sentencing', 'three strikes'] },
      { category: 'Family', codeName: 'California Family Code', abbreviation: 'Cal. Fam. Code', description: 'Marriage, divorce, custody, community property', topics: ['divorce', 'custody', 'child support', 'community property', 'domestic violence'] },
      { category: 'Business', codeName: 'California Business & Professions Code', abbreviation: 'Cal. Bus. & Prof. Code', description: 'Licensing, unfair competition, professional regulation', topics: ['licensing', 'unfair competition', 'professional regulation', 'cannabis'] },
      { category: 'Labor', codeName: 'California Labor Code', abbreviation: 'Cal. Lab. Code', description: 'Employment, wages, workers comp', topics: ['wages', 'overtime', 'workers compensation', 'PAGA', 'independent contractors'] },
      { category: 'Tax', codeName: 'California Revenue & Taxation Code', abbreviation: 'Cal. Rev. & Tax. Code', description: 'State taxation', topics: ['income tax', 'sales tax', 'property tax', 'franchise tax'] },
      { category: 'Probate', codeName: 'California Probate Code', abbreviation: 'Cal. Prob. Code', description: 'Wills, trusts, estates', topics: ['wills', 'trusts', 'intestate succession', 'conservatorship'] },
      { category: 'Evidence', codeName: 'California Evidence Code', abbreviation: 'Cal. Evid. Code', description: 'Rules of evidence', topics: ['hearsay', 'privilege', 'authentication', 'expert witnesses'] },
      { category: 'Health', codeName: 'California Health & Safety Code', abbreviation: 'Cal. Health & Saf. Code', description: 'Public health, environmental, cannabis', topics: ['public health', 'environmental', 'cannabis', 'food safety'] },
      { category: 'Property', codeName: 'California Code of Civil Procedure', abbreviation: 'Cal. Civ. Proc. Code', description: 'Civil procedure, landlord-tenant', topics: ['civil procedure', 'landlord-tenant', 'unlawful detainer', 'judgment enforcement'] },
    ],
    primarySources: [
      { name: 'California Codes', url: 'https://leginfo.legislature.ca.gov/faces/codedisplayexpand.xhtml', type: 'statute' },
      { name: 'California Rules of Court', url: 'https://www.courts.ca.gov/rules.htm', type: 'court_rule' },
      { name: 'California Constitution', url: 'https://leginfo.legislature.ca.gov/faces/codes_displayText.xhtml?lawCode=CONS', type: 'constitution' },
    ],
  },
  {
    state: 'Colorado', abbr: 'CO', capital: 'Denver', circuit: '10th Circuit',
    westlawDb: 'CO-ST', lexisDb: 'COCODE',
    justiaUrl: 'https://law.justia.com/codes/colorado/',
    officialCodeUrl: 'https://leg.colorado.gov/colorado-revised-statutes',
    courtUrl: 'https://www.courts.state.co.us/',
    lawTypes: [
      { category: 'Civil', codeName: 'Colorado Revised Statutes', abbreviation: 'C.R.S.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Colorado Criminal Code', abbreviation: 'C.R.S. §18', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'marijuana law'] },
      { category: 'Family', codeName: 'Colorado Domestic Relations', abbreviation: 'C.R.S. §14', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Business', codeName: 'Colorado Business Organizations', abbreviation: 'C.R.S. §7', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'benefit corporations'] },
      { category: 'Tax', codeName: 'Colorado Taxation', abbreviation: 'C.R.S. §39', description: 'State taxation', topics: ['income tax', 'sales tax', 'property tax'] },
    ],
    primarySources: [
      { name: 'Colorado Revised Statutes', url: 'https://leg.colorado.gov/colorado-revised-statutes', type: 'statute' },
    ],
  },
  {
    state: 'Connecticut', abbr: 'CT', capital: 'Hartford', circuit: '2nd Circuit',
    westlawDb: 'CT-ST', lexisDb: 'CTCODE',
    justiaUrl: 'https://law.justia.com/codes/connecticut/',
    officialCodeUrl: 'https://www.cga.ct.gov/current/pub/titles.htm',
    courtUrl: 'https://www.jud.ct.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Connecticut General Statutes', abbreviation: 'Conn. Gen. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Connecticut Penal Code', abbreviation: 'Conn. Gen. Stat. §53a', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Connecticut Domestic Relations', abbreviation: 'Conn. Gen. Stat. §46b', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Business', codeName: 'Connecticut Business Organizations', abbreviation: 'Conn. Gen. Stat. §33', description: 'Corporations, LLCs', topics: ['corporations', 'LLC'] },
    ],
    primarySources: [
      { name: 'Connecticut General Statutes', url: 'https://www.cga.ct.gov/current/pub/titles.htm', type: 'statute' },
    ],
  },
  {
    state: 'Delaware', abbr: 'DE', capital: 'Dover', circuit: '3rd Circuit',
    westlawDb: 'DE-ST', lexisDb: 'DECODE',
    justiaUrl: 'https://law.justia.com/codes/delaware/',
    officialCodeUrl: 'https://delcode.delaware.gov/',
    courtUrl: 'https://courts.delaware.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Delaware Code', abbreviation: 'Del. Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Delaware Criminal Code', abbreviation: 'Del. Code Ann. tit. 11', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Corporate', codeName: 'Delaware General Corporation Law', abbreviation: 'Del. Code Ann. tit. 8', description: 'Corporate law — most influential in US', topics: ['corporations', 'mergers', 'fiduciary duties', 'shareholder rights'] },
      { category: 'Family', codeName: 'Delaware Family Law', abbreviation: 'Del. Code Ann. tit. 13', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Delaware Code', url: 'https://delcode.delaware.gov/', type: 'statute' },
      { name: 'Delaware Court of Chancery Rules', url: 'https://courts.delaware.gov/chancery/rules.aspx', type: 'court_rule' },
    ],
  },
  {
    state: 'Florida', abbr: 'FL', capital: 'Tallahassee', circuit: '11th Circuit',
    westlawDb: 'FL-ST', lexisDb: 'FLCODE',
    justiaUrl: 'https://law.justia.com/codes/florida/',
    officialCodeUrl: 'https://www.leg.state.fl.us/statutes/',
    courtUrl: 'https://www.flcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Florida Statutes', abbreviation: 'Fla. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'consumer protection'] },
      { category: 'Criminal', codeName: 'Florida Criminal Code', abbreviation: 'Fla. Stat. §775', description: 'Criminal offenses and procedure', topics: ['felonies', 'misdemeanors', 'stand your ground', 'sentencing guidelines'] },
      { category: 'Family', codeName: 'Florida Family Law', abbreviation: 'Fla. Stat. §61', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'alimony', 'equitable distribution'] },
      { category: 'Probate', codeName: 'Florida Probate Code', abbreviation: 'Fla. Stat. §731', description: 'Wills, trusts, estates', topics: ['wills', 'trusts', 'intestate succession', 'guardianship'] },
      { category: 'Property', codeName: 'Florida Property Law', abbreviation: 'Fla. Stat. §689', description: 'Real property, landlord-tenant', topics: ['real estate', 'landlord-tenant', 'homestead', 'liens'] },
      { category: 'Business', codeName: 'Florida Business Organizations', abbreviation: 'Fla. Stat. §607', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
      { category: 'Tax', codeName: 'Florida Tax Code', abbreviation: 'Fla. Stat. §199', description: 'State taxation (no income tax)', topics: ['sales tax', 'property tax', 'documentary stamp tax'] },
    ],
    primarySources: [
      { name: 'Florida Statutes', url: 'https://www.leg.state.fl.us/statutes/', type: 'statute' },
      { name: 'Florida Rules of Civil Procedure', url: 'https://www.flcourts.gov/Resources-Services/Court-Improvement/Rules-of-Court', type: 'court_rule' },
    ],
  },
  {
    state: 'Georgia', abbr: 'GA', capital: 'Atlanta', circuit: '11th Circuit',
    westlawDb: 'GA-ST', lexisDb: 'GACODE',
    justiaUrl: 'https://law.justia.com/codes/georgia/',
    officialCodeUrl: 'https://advance.lexis.com/container?config=00JAA3ZTU0NTIzYy0zZDEyLTRhYmQtYWE3OS02YTgyOGI2ZWI3NjMKAFBvZENhdGFsb2e9zYpNUjsxMjM1&crid=',
    courtUrl: 'https://www.gasupreme.us/',
    lawTypes: [
      { category: 'Civil', codeName: 'Official Code of Georgia Annotated', abbreviation: 'O.C.G.A.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Georgia Criminal Code', abbreviation: 'O.C.G.A. §16', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Georgia Domestic Relations', abbreviation: 'O.C.G.A. §19', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Business', codeName: 'Georgia Business Organizations', abbreviation: 'O.C.G.A. §14', description: 'Corporations, LLCs', topics: ['corporations', 'LLC'] },
    ],
    primarySources: [
      { name: 'Official Code of Georgia', url: 'https://law.justia.com/codes/georgia/', type: 'statute' },
    ],
  },
  {
    state: 'Hawaii', abbr: 'HI', capital: 'Honolulu', circuit: '9th Circuit',
    westlawDb: 'HI-ST', lexisDb: 'HICODE',
    justiaUrl: 'https://law.justia.com/codes/hawaii/',
    officialCodeUrl: 'https://www.capitol.hawaii.gov/hrscurrent/',
    courtUrl: 'https://www.courts.state.hi.us/',
    lawTypes: [
      { category: 'Civil', codeName: 'Hawaii Revised Statutes', abbreviation: 'Haw. Rev. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Hawaii Penal Code', abbreviation: 'Haw. Rev. Stat. §701', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Hawaii Family Law', abbreviation: 'Haw. Rev. Stat. §580', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Land', codeName: 'Hawaii Land Law', abbreviation: 'Haw. Rev. Stat. §501', description: 'Land court, real property', topics: ['land court', 'real estate', 'native Hawaiian rights'] },
    ],
    primarySources: [
      { name: 'Hawaii Revised Statutes', url: 'https://www.capitol.hawaii.gov/hrscurrent/', type: 'statute' },
    ],
  },
  {
    state: 'Idaho', abbr: 'ID', capital: 'Boise', circuit: '9th Circuit',
    westlawDb: 'ID-ST', lexisDb: 'IDCODE',
    justiaUrl: 'https://law.justia.com/codes/idaho/',
    officialCodeUrl: 'https://legislature.idaho.gov/statutesrules/idstat/',
    courtUrl: 'https://isc.idaho.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Idaho Statutes', abbreviation: 'Idaho Code', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Idaho Criminal Code', abbreviation: 'Idaho Code §18', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Idaho Domestic Relations', abbreviation: 'Idaho Code §32', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'community property'] },
    ],
    primarySources: [
      { name: 'Idaho Statutes', url: 'https://legislature.idaho.gov/statutesrules/idstat/', type: 'statute' },
    ],
  },
  {
    state: 'Illinois', abbr: 'IL', capital: 'Springfield', circuit: '7th Circuit',
    westlawDb: 'IL-ST', lexisDb: 'ILCODE',
    justiaUrl: 'https://law.justia.com/codes/illinois/',
    officialCodeUrl: 'https://www.ilga.gov/legislation/ilcs/ilcs.asp',
    courtUrl: 'https://www.illinoiscourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Illinois Compiled Statutes', abbreviation: 'ILCS', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'consumer fraud'] },
      { category: 'Criminal', codeName: 'Illinois Criminal Code', abbreviation: '720 ILCS', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'drug offenses'] },
      { category: 'Family', codeName: 'Illinois Marriage & Dissolution Act', abbreviation: '750 ILCS', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'maintenance'] },
      { category: 'Probate', codeName: 'Illinois Probate Act', abbreviation: '755 ILCS', description: 'Wills, trusts, estates', topics: ['wills', 'trusts', 'intestate succession'] },
      { category: 'Business', codeName: 'Illinois Business Corporation Act', abbreviation: '805 ILCS', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
      { category: 'Tax', codeName: 'Illinois Tax Code', abbreviation: '35 ILCS', description: 'State taxation', topics: ['income tax', 'sales tax', 'property tax'] },
    ],
    primarySources: [
      { name: 'Illinois Compiled Statutes', url: 'https://www.ilga.gov/legislation/ilcs/ilcs.asp', type: 'statute' },
    ],
  },
  {
    state: 'Indiana', abbr: 'IN', capital: 'Indianapolis', circuit: '7th Circuit',
    westlawDb: 'IN-ST', lexisDb: 'INCODE',
    justiaUrl: 'https://law.justia.com/codes/indiana/',
    officialCodeUrl: 'https://iga.in.gov/legislative/laws/2024/ic/titles/',
    courtUrl: 'https://www.in.gov/courts/',
    lawTypes: [
      { category: 'Civil', codeName: 'Indiana Code', abbreviation: 'Ind. Code', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Indiana Criminal Code', abbreviation: 'Ind. Code §35', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Indiana Family Law', abbreviation: 'Ind. Code §31', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Indiana Code', url: 'https://iga.in.gov/legislative/laws/2024/ic/titles/', type: 'statute' },
    ],
  },
  {
    state: 'Iowa', abbr: 'IA', capital: 'Des Moines', circuit: '8th Circuit',
    westlawDb: 'IA-ST', lexisDb: 'IACODE',
    justiaUrl: 'https://law.justia.com/codes/iowa/',
    officialCodeUrl: 'https://www.legis.iowa.gov/law/iowaCode/sections',
    courtUrl: 'https://www.iowacourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Iowa Code', abbreviation: 'Iowa Code', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Iowa Criminal Code', abbreviation: 'Iowa Code §701', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Iowa Domestic Relations', abbreviation: 'Iowa Code §598', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Iowa Code', url: 'https://www.legis.iowa.gov/law/iowaCode/sections', type: 'statute' },
    ],
  },
  {
    state: 'Kansas', abbr: 'KS', capital: 'Topeka', circuit: '10th Circuit',
    westlawDb: 'KS-ST', lexisDb: 'KSCODE',
    justiaUrl: 'https://law.justia.com/codes/kansas/',
    officialCodeUrl: 'https://www.kslegislature.org/li/b2023_24/statute/',
    courtUrl: 'https://www.kscourts.org/',
    lawTypes: [
      { category: 'Civil', codeName: 'Kansas Statutes Annotated', abbreviation: 'K.S.A.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Kansas Criminal Code', abbreviation: 'K.S.A. §21', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Kansas Domestic Relations', abbreviation: 'K.S.A. §23', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Kansas Statutes', url: 'https://www.kslegislature.org/li/b2023_24/statute/', type: 'statute' },
    ],
  },
  {
    state: 'Kentucky', abbr: 'KY', capital: 'Frankfort', circuit: '6th Circuit',
    westlawDb: 'KY-ST', lexisDb: 'KYCODE',
    justiaUrl: 'https://law.justia.com/codes/kentucky/',
    officialCodeUrl: 'https://apps.legislature.ky.gov/law/statutes/',
    courtUrl: 'https://courts.ky.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Kentucky Revised Statutes', abbreviation: 'KRS', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Kentucky Penal Code', abbreviation: 'KRS §500', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Kentucky Domestic Relations', abbreviation: 'KRS §403', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Kentucky Revised Statutes', url: 'https://apps.legislature.ky.gov/law/statutes/', type: 'statute' },
    ],
  },
  {
    state: 'Louisiana', abbr: 'LA', capital: 'Baton Rouge', circuit: '5th Circuit',
    westlawDb: 'LA-ST', lexisDb: 'LACODE',
    justiaUrl: 'https://law.justia.com/codes/louisiana/',
    officialCodeUrl: 'https://www.legis.la.gov/legis/Law.aspx',
    courtUrl: 'https://www.lasc.org/',
    lawTypes: [
      { category: 'Civil', codeName: 'Louisiana Civil Code', abbreviation: 'La. Civ. Code', description: 'Civil law system — obligations, property, persons', topics: ['obligations', 'contracts', 'property', 'torts', 'successions', 'matrimonial regimes'] },
      { category: 'Criminal', codeName: 'Louisiana Code of Criminal Procedure', abbreviation: 'La. C.Cr.P.', description: 'Criminal procedure', topics: ['arrest', 'indictment', 'trial', 'sentencing', 'post-conviction'] },
      { category: 'Criminal Statutes', codeName: 'Louisiana Revised Statutes — Criminal', abbreviation: 'La. R.S. §14', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'drug offenses', 'violent crimes'] },
      { category: 'Civil Procedure', codeName: 'Louisiana Code of Civil Procedure', abbreviation: 'La. C.C.P.', description: 'Civil procedure rules', topics: ['pleadings', 'discovery', 'trial', 'judgment', 'appeals', 'exceptions'] },
      { category: 'Family', codeName: "Louisiana Children's Code", abbreviation: "La. Ch. Code", description: 'Child welfare, juvenile justice', topics: ['child custody', 'child support', 'adoption', 'juvenile delinquency', 'CINC'] },
      { category: 'Domestic Relations', codeName: 'Louisiana Revised Statutes — Domestic', abbreviation: 'La. R.S. §9', description: 'Marriage, divorce, community property', topics: ['divorce', 'community property', 'spousal support', 'covenant marriage'] },
      { category: 'Evidence', codeName: 'Louisiana Code of Evidence', abbreviation: 'La. C.E.', description: 'Rules of evidence', topics: ['hearsay', 'privilege', 'authentication', 'expert witnesses', 'character evidence'] },
      { category: 'Probate', codeName: 'Louisiana Successions Law', abbreviation: 'La. Civ. Code Art. 871', description: 'Successions, wills, trusts', topics: ['testate succession', 'intestate succession', 'forced heirship', 'trusts', 'usufruct'] },
      { category: 'Tax', codeName: 'Louisiana Tax Code', abbreviation: 'La. R.S. §47', description: 'State taxation', topics: ['income tax', 'sales tax', 'property tax', 'severance tax'] },
      { category: 'Administrative', codeName: 'Louisiana Administrative Code', abbreviation: 'La. Admin. Code', description: 'Agency regulations', topics: ['licensing', 'environmental', 'professional regulation', 'public utilities'] },
      { category: 'Business', codeName: 'Louisiana Business Organizations', abbreviation: 'La. R.S. §12', description: 'Corporations, LLCs, partnerships', topics: ['corporations', 'LLC', 'partnerships', 'nonprofit'] },
      { category: 'Property', codeName: 'Louisiana Property Law', abbreviation: 'La. Civ. Code Art. 462', description: 'Immovables, movables, servitudes', topics: ['immovable property', 'movable property', 'servitudes', 'predial leases', 'mineral rights'] },
    ],
    primarySources: [
      { name: 'Louisiana Civil Code', url: 'https://www.legis.la.gov/legis/Law.aspx?d=67896', type: 'statute' },
      { name: 'Louisiana Revised Statutes', url: 'https://www.legis.la.gov/legis/Law.aspx?d=67897', type: 'statute' },
      { name: 'Louisiana Code of Civil Procedure', url: 'https://www.legis.la.gov/legis/Law.aspx?d=67898', type: 'statute' },
      { name: 'Louisiana Code of Criminal Procedure', url: 'https://www.legis.la.gov/legis/Law.aspx?d=67899', type: 'statute' },
      { name: "Louisiana Children's Code", url: 'https://www.legis.la.gov/legis/Law.aspx?d=67900', type: 'statute' },
      { name: 'Louisiana Code of Evidence', url: 'https://www.legis.la.gov/legis/Law.aspx?d=67901', type: 'statute' },
      { name: 'Louisiana Supreme Court Rules', url: 'https://www.lasc.org/rules/', type: 'court_rule' },
      { name: 'Louisiana Constitution', url: 'https://www.legis.la.gov/legis/Law.aspx?d=206312', type: 'constitution' },
    ],
  },
  {
    state: 'Maine', abbr: 'ME', capital: 'Augusta', circuit: '1st Circuit',
    westlawDb: 'ME-ST', lexisDb: 'MECODE',
    justiaUrl: 'https://law.justia.com/codes/maine/',
    officialCodeUrl: 'https://legislature.maine.gov/statutes/',
    courtUrl: 'https://www.courts.maine.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Maine Revised Statutes', abbreviation: 'M.R.S.A.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Maine Criminal Code', abbreviation: 'M.R.S.A. tit. 17-A', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Maine Domestic Relations', abbreviation: 'M.R.S.A. tit. 19-A', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Maine Revised Statutes', url: 'https://legislature.maine.gov/statutes/', type: 'statute' },
    ],
  },
  {
    state: 'Maryland', abbr: 'MD', capital: 'Annapolis', circuit: '4th Circuit',
    westlawDb: 'MD-ST', lexisDb: 'MDCODE',
    justiaUrl: 'https://law.justia.com/codes/maryland/',
    officialCodeUrl: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText',
    courtUrl: 'https://www.courts.state.md.us/',
    lawTypes: [
      { category: 'Civil', codeName: 'Maryland Code', abbreviation: 'Md. Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Maryland Criminal Law', abbreviation: 'Md. Code Ann., Crim. Law', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Maryland Family Law', abbreviation: 'Md. Code Ann., Fam. Law', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Business', codeName: 'Maryland Corporations & Associations', abbreviation: 'Md. Code Ann., Corps. & Assns.', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
    ],
    primarySources: [
      { name: 'Maryland Code', url: 'https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText', type: 'statute' },
    ],
  },
  {
    state: 'Massachusetts', abbr: 'MA', capital: 'Boston', circuit: '1st Circuit',
    westlawDb: 'MA-ST', lexisDb: 'MACODE',
    justiaUrl: 'https://law.justia.com/codes/massachusetts/',
    officialCodeUrl: 'https://malegislature.gov/Laws/GeneralLaws',
    courtUrl: 'https://www.mass.gov/courts',
    lawTypes: [
      { category: 'Civil', codeName: 'Massachusetts General Laws', abbreviation: 'M.G.L.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'consumer protection'] },
      { category: 'Criminal', codeName: 'Massachusetts Criminal Code', abbreviation: 'M.G.L. c. 265', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Massachusetts Domestic Relations', abbreviation: 'M.G.L. c. 208', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Business', codeName: 'Massachusetts Business Organizations', abbreviation: 'M.G.L. c. 156D', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'benefit corporations'] },
    ],
    primarySources: [
      { name: 'Massachusetts General Laws', url: 'https://malegislature.gov/Laws/GeneralLaws', type: 'statute' },
    ],
  },
  {
    state: 'Michigan', abbr: 'MI', capital: 'Lansing', circuit: '6th Circuit',
    westlawDb: 'MI-ST', lexisDb: 'MICODE',
    justiaUrl: 'https://law.justia.com/codes/michigan/',
    officialCodeUrl: 'https://www.legislature.mi.gov/Laws/MCL',
    courtUrl: 'https://courts.michigan.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Michigan Compiled Laws', abbreviation: 'MCL', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Michigan Penal Code', abbreviation: 'MCL §750', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Michigan Domestic Relations', abbreviation: 'MCL §552', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Probate', codeName: 'Michigan Estates & Protected Individuals Code', abbreviation: 'MCL §700', description: 'Wills, trusts, estates', topics: ['wills', 'trusts', 'guardianship'] },
    ],
    primarySources: [
      { name: 'Michigan Compiled Laws', url: 'https://www.legislature.mi.gov/Laws/MCL', type: 'statute' },
    ],
  },
  {
    state: 'Minnesota', abbr: 'MN', capital: 'Saint Paul', circuit: '8th Circuit',
    westlawDb: 'MN-ST', lexisDb: 'MNCODE',
    justiaUrl: 'https://law.justia.com/codes/minnesota/',
    officialCodeUrl: 'https://www.revisor.mn.gov/statutes/',
    courtUrl: 'https://www.mncourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Minnesota Statutes', abbreviation: 'Minn. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Minnesota Criminal Code', abbreviation: 'Minn. Stat. §609', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Minnesota Domestic Relations', abbreviation: 'Minn. Stat. §518', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Minnesota Statutes', url: 'https://www.revisor.mn.gov/statutes/', type: 'statute' },
    ],
  },
  {
    state: 'Mississippi', abbr: 'MS', capital: 'Jackson', circuit: '5th Circuit',
    westlawDb: 'MS-ST', lexisDb: 'MSCODE',
    justiaUrl: 'https://law.justia.com/codes/mississippi/',
    officialCodeUrl: 'https://law.justia.com/codes/mississippi/',
    courtUrl: 'https://courts.ms.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Mississippi Code Annotated', abbreviation: 'Miss. Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Mississippi Criminal Code', abbreviation: 'Miss. Code Ann. §97', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Mississippi Domestic Relations', abbreviation: 'Miss. Code Ann. §93', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Mississippi Code', url: 'https://law.justia.com/codes/mississippi/', type: 'statute' },
    ],
  },
  {
    state: 'Missouri', abbr: 'MO', capital: 'Jefferson City', circuit: '8th Circuit',
    westlawDb: 'MO-ST', lexisDb: 'MOCODE',
    justiaUrl: 'https://law.justia.com/codes/missouri/',
    officialCodeUrl: 'https://revisor.mo.gov/main/StatuteSearch.aspx',
    courtUrl: 'https://www.courts.mo.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Missouri Revised Statutes', abbreviation: 'Mo. Rev. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Missouri Criminal Code', abbreviation: 'Mo. Rev. Stat. §565', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Missouri Domestic Relations', abbreviation: 'Mo. Rev. Stat. §452', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Missouri Revised Statutes', url: 'https://revisor.mo.gov/main/StatuteSearch.aspx', type: 'statute' },
    ],
  },
  {
    state: 'Montana', abbr: 'MT', capital: 'Helena', circuit: '9th Circuit',
    westlawDb: 'MT-ST', lexisDb: 'MTCODE',
    justiaUrl: 'https://law.justia.com/codes/montana/',
    officialCodeUrl: 'https://leg.mt.gov/bills/mca/',
    courtUrl: 'https://courts.mt.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Montana Code Annotated', abbreviation: 'MCA', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Montana Criminal Code', abbreviation: 'MCA §45', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Montana Domestic Relations', abbreviation: 'MCA §40', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Montana Code Annotated', url: 'https://leg.mt.gov/bills/mca/', type: 'statute' },
    ],
  },
  {
    state: 'Nebraska', abbr: 'NE', capital: 'Lincoln', circuit: '8th Circuit',
    westlawDb: 'NE-ST', lexisDb: 'NECODE',
    justiaUrl: 'https://law.justia.com/codes/nebraska/',
    officialCodeUrl: 'https://nebraskalegislature.gov/laws/browse-statutes.php',
    courtUrl: 'https://supremecourt.nebraska.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Nebraska Revised Statutes', abbreviation: 'Neb. Rev. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Nebraska Criminal Code', abbreviation: 'Neb. Rev. Stat. §28', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Nebraska Domestic Relations', abbreviation: 'Neb. Rev. Stat. §42', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Nebraska Revised Statutes', url: 'https://nebraskalegislature.gov/laws/browse-statutes.php', type: 'statute' },
    ],
  },
  {
    state: 'Nevada', abbr: 'NV', capital: 'Carson City', circuit: '9th Circuit',
    westlawDb: 'NV-ST', lexisDb: 'NVCODE',
    justiaUrl: 'https://law.justia.com/codes/nevada/',
    officialCodeUrl: 'https://www.leg.state.nv.us/nrs/',
    courtUrl: 'https://nvcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Nevada Revised Statutes', abbreviation: 'NRS', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Nevada Criminal Code', abbreviation: 'NRS §193', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'gaming offenses'] },
      { category: 'Family', codeName: 'Nevada Domestic Relations', abbreviation: 'NRS §125', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'community property'] },
      { category: 'Gaming', codeName: 'Nevada Gaming Law', abbreviation: 'NRS §463', description: 'Gaming regulation', topics: ['gaming licenses', 'casino regulation', 'gaming control'] },
    ],
    primarySources: [
      { name: 'Nevada Revised Statutes', url: 'https://www.leg.state.nv.us/nrs/', type: 'statute' },
    ],
  },
  {
    state: 'New Hampshire', abbr: 'NH', capital: 'Concord', circuit: '1st Circuit',
    westlawDb: 'NH-ST', lexisDb: 'NHCODE',
    justiaUrl: 'https://law.justia.com/codes/new-hampshire/',
    officialCodeUrl: 'https://www.gencourt.state.nh.us/rsa/html/indexes/',
    courtUrl: 'https://www.courts.nh.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'New Hampshire Revised Statutes Annotated', abbreviation: 'RSA', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'New Hampshire Criminal Code', abbreviation: 'RSA §625', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'New Hampshire Domestic Relations', abbreviation: 'RSA §458', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'New Hampshire RSA', url: 'https://www.gencourt.state.nh.us/rsa/html/indexes/', type: 'statute' },
    ],
  },
  {
    state: 'New Jersey', abbr: 'NJ', capital: 'Trenton', circuit: '3rd Circuit',
    westlawDb: 'NJ-ST', lexisDb: 'NJCODE',
    justiaUrl: 'https://law.justia.com/codes/new-jersey/',
    officialCodeUrl: 'https://www.njleg.state.nj.us/law-and-public-safety/new-jersey-statutes',
    courtUrl: 'https://www.njcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'New Jersey Statutes Annotated', abbreviation: 'N.J.S.A.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'consumer fraud'] },
      { category: 'Criminal', codeName: 'New Jersey Code of Criminal Justice', abbreviation: 'N.J.S.A. §2C', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'drug offenses'] },
      { category: 'Family', codeName: 'New Jersey Domestic Relations', abbreviation: 'N.J.S.A. §2A:34', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'alimony'] },
      { category: 'Business', codeName: 'New Jersey Business Corporation Act', abbreviation: 'N.J.S.A. §14A', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
    ],
    primarySources: [
      { name: 'New Jersey Statutes', url: 'https://www.njleg.state.nj.us/law-and-public-safety/new-jersey-statutes', type: 'statute' },
    ],
  },
  {
    state: 'New Mexico', abbr: 'NM', capital: 'Santa Fe', circuit: '10th Circuit',
    westlawDb: 'NM-ST', lexisDb: 'NMCODE',
    justiaUrl: 'https://law.justia.com/codes/new-mexico/',
    officialCodeUrl: 'https://nmonesource.com/nmos/nmsa/en/nav.do',
    courtUrl: 'https://nmcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'New Mexico Statutes Annotated', abbreviation: 'NMSA', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'New Mexico Criminal Code', abbreviation: 'NMSA §30', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'New Mexico Domestic Relations', abbreviation: 'NMSA §40', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'community property'] },
    ],
    primarySources: [
      { name: 'New Mexico Statutes', url: 'https://nmonesource.com/nmos/nmsa/en/nav.do', type: 'statute' },
    ],
  },
  {
    state: 'New York', abbr: 'NY', capital: 'Albany', circuit: '2nd Circuit',
    westlawDb: 'NY-ST', lexisDb: 'NYCODE',
    justiaUrl: 'https://law.justia.com/codes/new-york/',
    officialCodeUrl: 'https://www.nysenate.gov/legislation/laws/CONSOLIDATED',
    courtUrl: 'https://www.nycourts.gov/',
    lawTypes: [
      { category: 'Civil Procedure', codeName: 'New York Civil Practice Law & Rules', abbreviation: 'CPLR', description: 'Civil procedure', topics: ['pleadings', 'discovery', 'motions', 'appeals', 'enforcement'] },
      { category: 'Criminal', codeName: 'New York Penal Law', abbreviation: 'N.Y. Penal Law', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'drug offenses', 'violent crimes'] },
      { category: 'Family', codeName: 'New York Family Court Act', abbreviation: 'N.Y. Fam. Ct. Act', description: 'Family court proceedings', topics: ['custody', 'child support', 'juvenile delinquency', 'family offenses'] },
      { category: 'Domestic Relations', codeName: 'New York Domestic Relations Law', abbreviation: 'N.Y. Dom. Rel. Law', description: 'Marriage, divorce', topics: ['divorce', 'annulment', 'separation', 'equitable distribution'] },
      { category: 'Business', codeName: 'New York Business Corporation Law', abbreviation: 'N.Y. Bus. Corp. Law', description: 'Corporations', topics: ['corporations', 'mergers', 'shareholder rights', 'fiduciary duties'] },
      { category: 'Tax', codeName: 'New York Tax Law', abbreviation: 'N.Y. Tax Law', description: 'State taxation', topics: ['income tax', 'sales tax', 'estate tax', 'corporate tax'] },
      { category: 'Estates', codeName: 'New York Estates Powers & Trusts Law', abbreviation: 'N.Y. EPTL', description: 'Wills, trusts, estates', topics: ['wills', 'trusts', 'intestate succession', 'powers of attorney'] },
      { category: 'Real Property', codeName: 'New York Real Property Law', abbreviation: 'N.Y. Real Prop. Law', description: 'Real estate', topics: ['real estate', 'landlord-tenant', 'mortgages', 'condominiums'] },
      { category: 'Labor', codeName: 'New York Labor Law', abbreviation: 'N.Y. Lab. Law', description: 'Employment law', topics: ['wages', 'overtime', 'workers compensation', 'unemployment'] },
      { category: 'Education', codeName: 'New York Education Law', abbreviation: 'N.Y. Educ. Law', description: 'Education regulation', topics: ['public schools', 'higher education', 'teacher certification'] },
    ],
    primarySources: [
      { name: 'New York Consolidated Laws', url: 'https://www.nysenate.gov/legislation/laws/CONSOLIDATED', type: 'statute' },
      { name: 'New York Court Rules', url: 'https://www.nycourts.gov/rules/', type: 'court_rule' },
    ],
  },
  {
    state: 'North Carolina', abbr: 'NC', capital: 'Raleigh', circuit: '4th Circuit',
    westlawDb: 'NC-ST', lexisDb: 'NCCODE',
    justiaUrl: 'https://law.justia.com/codes/north-carolina/',
    officialCodeUrl: 'https://www.ncleg.gov/Laws/GeneralStatutesSections/Chapter1',
    courtUrl: 'https://www.nccourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'North Carolina General Statutes', abbreviation: 'N.C. Gen. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'North Carolina Criminal Code', abbreviation: 'N.C. Gen. Stat. §14', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'North Carolina Domestic Relations', abbreviation: 'N.C. Gen. Stat. §50', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'North Carolina General Statutes', url: 'https://www.ncleg.gov/Laws/GeneralStatutesSections/Chapter1', type: 'statute' },
    ],
  },
  {
    state: 'North Dakota', abbr: 'ND', capital: 'Bismarck', circuit: '8th Circuit',
    westlawDb: 'ND-ST', lexisDb: 'NDCODE',
    justiaUrl: 'https://law.justia.com/codes/north-dakota/',
    officialCodeUrl: 'https://www.legis.nd.gov/cencode/',
    courtUrl: 'https://www.ndcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'North Dakota Century Code', abbreviation: 'N.D.C.C.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'North Dakota Criminal Code', abbreviation: 'N.D.C.C. §12.1', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'North Dakota Domestic Relations', abbreviation: 'N.D.C.C. §14', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'North Dakota Century Code', url: 'https://www.legis.nd.gov/cencode/', type: 'statute' },
    ],
  },
  {
    state: 'Ohio', abbr: 'OH', capital: 'Columbus', circuit: '6th Circuit',
    westlawDb: 'OH-ST', lexisDb: 'OHCODE',
    justiaUrl: 'https://law.justia.com/codes/ohio/',
    officialCodeUrl: 'https://codes.ohio.gov/ohio-revised-code',
    courtUrl: 'https://www.supremecourt.ohio.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Ohio Revised Code', abbreviation: 'ORC', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'consumer protection'] },
      { category: 'Criminal', codeName: 'Ohio Criminal Code', abbreviation: 'ORC §2901', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'drug offenses'] },
      { category: 'Family', codeName: 'Ohio Domestic Relations', abbreviation: 'ORC §3105', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'spousal support'] },
      { category: 'Probate', codeName: 'Ohio Probate Code', abbreviation: 'ORC §2101', description: 'Wills, trusts, estates', topics: ['wills', 'trusts', 'guardianship'] },
    ],
    primarySources: [
      { name: 'Ohio Revised Code', url: 'https://codes.ohio.gov/ohio-revised-code', type: 'statute' },
    ],
  },
  {
    state: 'Oklahoma', abbr: 'OK', capital: 'Oklahoma City', circuit: '10th Circuit',
    westlawDb: 'OK-ST', lexisDb: 'OKCODE',
    justiaUrl: 'https://law.justia.com/codes/oklahoma/',
    officialCodeUrl: 'https://www.oscn.net/applications/oscn/index.asp?level=1',
    courtUrl: 'https://www.oscn.net/',
    lawTypes: [
      { category: 'Civil', codeName: 'Oklahoma Statutes', abbreviation: 'Okla. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Oklahoma Criminal Code', abbreviation: 'Okla. Stat. tit. 21', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Oklahoma Domestic Relations', abbreviation: 'Okla. Stat. tit. 43', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Oklahoma Statutes', url: 'https://www.oscn.net/applications/oscn/index.asp?level=1', type: 'statute' },
    ],
  },
  {
    state: 'Oregon', abbr: 'OR', capital: 'Salem', circuit: '9th Circuit',
    westlawDb: 'OR-ST', lexisDb: 'ORCODE',
    justiaUrl: 'https://law.justia.com/codes/oregon/',
    officialCodeUrl: 'https://www.oregonlegislature.gov/bills_laws/ors/ors001.html',
    courtUrl: 'https://www.courts.oregon.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Oregon Revised Statutes', abbreviation: 'ORS', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Oregon Criminal Code', abbreviation: 'ORS §161', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'drug decriminalization'] },
      { category: 'Family', codeName: 'Oregon Domestic Relations', abbreviation: 'ORS §107', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Oregon Revised Statutes', url: 'https://www.oregonlegislature.gov/bills_laws/ors/ors001.html', type: 'statute' },
    ],
  },
  {
    state: 'Pennsylvania', abbr: 'PA', capital: 'Harrisburg', circuit: '3rd Circuit',
    westlawDb: 'PA-ST', lexisDb: 'PACODE',
    justiaUrl: 'https://law.justia.com/codes/pennsylvania/',
    officialCodeUrl: 'https://www.legis.state.pa.us/cfdocs/legis/LI/Public/cons_index.cfm',
    courtUrl: 'https://www.pacourts.us/',
    lawTypes: [
      { category: 'Civil', codeName: 'Pennsylvania Consolidated Statutes', abbreviation: 'Pa. Cons. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Pennsylvania Crimes Code', abbreviation: '18 Pa. Cons. Stat.', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Pennsylvania Domestic Relations Code', abbreviation: '23 Pa. Cons. Stat.', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'equitable distribution'] },
      { category: 'Business', codeName: 'Pennsylvania Business Corporation Law', abbreviation: '15 Pa. Cons. Stat.', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
    ],
    primarySources: [
      { name: 'Pennsylvania Consolidated Statutes', url: 'https://www.legis.state.pa.us/cfdocs/legis/LI/Public/cons_index.cfm', type: 'statute' },
    ],
  },
  {
    state: 'Rhode Island', abbr: 'RI', capital: 'Providence', circuit: '1st Circuit',
    westlawDb: 'RI-ST', lexisDb: 'RICODE',
    justiaUrl: 'https://law.justia.com/codes/rhode-island/',
    officialCodeUrl: 'http://webserver.rilin.state.ri.us/Statutes/',
    courtUrl: 'https://www.courts.ri.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Rhode Island General Laws', abbreviation: 'R.I. Gen. Laws', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Rhode Island Criminal Code', abbreviation: 'R.I. Gen. Laws §11', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Rhode Island Domestic Relations', abbreviation: 'R.I. Gen. Laws §15', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Rhode Island General Laws', url: 'http://webserver.rilin.state.ri.us/Statutes/', type: 'statute' },
    ],
  },
  {
    state: 'South Carolina', abbr: 'SC', capital: 'Columbia', circuit: '4th Circuit',
    westlawDb: 'SC-ST', lexisDb: 'SCCODE',
    justiaUrl: 'https://law.justia.com/codes/south-carolina/',
    officialCodeUrl: 'https://www.scstatehouse.gov/code/statmast.php',
    courtUrl: 'https://www.sccourts.org/',
    lawTypes: [
      { category: 'Civil', codeName: 'South Carolina Code of Laws', abbreviation: 'S.C. Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'South Carolina Criminal Code', abbreviation: 'S.C. Code Ann. §16', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'South Carolina Domestic Relations', abbreviation: 'S.C. Code Ann. §20', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'South Carolina Code', url: 'https://www.scstatehouse.gov/code/statmast.php', type: 'statute' },
    ],
  },
  {
    state: 'South Dakota', abbr: 'SD', capital: 'Pierre', circuit: '8th Circuit',
    westlawDb: 'SD-ST', lexisDb: 'SDCODE',
    justiaUrl: 'https://law.justia.com/codes/south-dakota/',
    officialCodeUrl: 'https://sdlegislature.gov/Statutes',
    courtUrl: 'https://ujs.sd.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'South Dakota Codified Laws', abbreviation: 'SDCL', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'South Dakota Criminal Code', abbreviation: 'SDCL §22', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'South Dakota Domestic Relations', abbreviation: 'SDCL §25', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'South Dakota Codified Laws', url: 'https://sdlegislature.gov/Statutes', type: 'statute' },
    ],
  },
  {
    state: 'Tennessee', abbr: 'TN', capital: 'Nashville', circuit: '6th Circuit',
    westlawDb: 'TN-ST', lexisDb: 'TNCODE',
    justiaUrl: 'https://law.justia.com/codes/tennessee/',
    officialCodeUrl: 'https://advance.lexis.com/container?config=00JAA3ZTU0NTIzYy0zZDEyLTRhYmQtYWE3OS02YTgyOGI2ZWI3NjMKAFBvZENhdGFsb2e9zYpNUjsxMjM1&crid=',
    courtUrl: 'https://www.tncourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Tennessee Code Annotated', abbreviation: 'Tenn. Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Tennessee Criminal Code', abbreviation: 'Tenn. Code Ann. §39', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Tennessee Domestic Relations', abbreviation: 'Tenn. Code Ann. §36', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Tennessee Code Annotated', url: 'https://law.justia.com/codes/tennessee/', type: 'statute' },
    ],
  },
  {
    state: 'Texas', abbr: 'TX', capital: 'Austin', circuit: '5th Circuit',
    westlawDb: 'TX-ST', lexisDb: 'TXCODE',
    justiaUrl: 'https://law.justia.com/codes/texas/',
    officialCodeUrl: 'https://statutes.capitol.texas.gov/',
    courtUrl: 'https://www.txcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Texas Civil Practice & Remedies Code', abbreviation: 'Tex. Civ. Prac. & Rem. Code', description: 'Civil procedure, remedies, limitations', topics: ['civil procedure', 'damages', 'limitations', 'venue', 'sanctions'] },
      { category: 'Criminal', codeName: 'Texas Penal Code', abbreviation: 'Tex. Penal Code', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'capital murder', 'drug offenses'] },
      { category: 'Family', codeName: 'Texas Family Code', abbreviation: 'Tex. Fam. Code', description: 'Marriage, divorce, custody, child welfare', topics: ['divorce', 'custody', 'child support', 'community property', 'domestic violence', 'CPS'] },
      { category: 'Business', codeName: 'Texas Business Organizations Code', abbreviation: 'Tex. Bus. Orgs. Code', description: 'Corporations, LLCs, partnerships', topics: ['corporations', 'LLC', 'partnerships', 'nonprofit', 'professional associations'] },
      { category: 'Tax', codeName: 'Texas Tax Code', abbreviation: 'Tex. Tax Code', description: 'State taxation', topics: ['property tax', 'sales tax', 'franchise tax'] },
      { category: 'Property', codeName: 'Texas Property Code', abbreviation: 'Tex. Prop. Code', description: 'Real and personal property', topics: ['real estate', 'landlord-tenant', 'liens', 'homestead', 'trusts'] },
      { category: 'Labor', codeName: 'Texas Labor Code', abbreviation: 'Tex. Lab. Code', description: 'Employment law', topics: ['wages', 'workers compensation', 'unemployment', 'discrimination'] },
      { category: 'Health', codeName: 'Texas Health & Safety Code', abbreviation: 'Tex. Health & Safety Code', description: 'Public health, mental health', topics: ['public health', 'mental health', 'substance abuse', 'food safety'] },
      { category: 'Government', codeName: 'Texas Government Code', abbreviation: 'Tex. Gov\'t Code', description: 'Government organization, courts', topics: ['courts', 'government organization', 'open records', 'ethics'] },
      { category: 'Probate', codeName: 'Texas Estates Code', abbreviation: 'Tex. Est. Code', description: 'Wills, trusts, estates, guardianship', topics: ['wills', 'trusts', 'intestate succession', 'guardianship', 'powers of attorney'] },
    ],
    primarySources: [
      { name: 'Texas Statutes', url: 'https://statutes.capitol.texas.gov/', type: 'statute' },
      { name: 'Texas Rules of Civil Procedure', url: 'https://www.txcourts.gov/rules-forms/rules-standards/', type: 'court_rule' },
      { name: 'Texas Constitution', url: 'https://statutes.capitol.texas.gov/Docs/CN/htm/CN.1.htm', type: 'constitution' },
    ],
  },
  {
    state: 'Utah', abbr: 'UT', capital: 'Salt Lake City', circuit: '10th Circuit',
    westlawDb: 'UT-ST', lexisDb: 'UTCODE',
    justiaUrl: 'https://law.justia.com/codes/utah/',
    officialCodeUrl: 'https://le.utah.gov/xcode/code.html',
    courtUrl: 'https://www.utcourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Utah Code', abbreviation: 'Utah Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Utah Criminal Code', abbreviation: 'Utah Code Ann. §76', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Utah Domestic Relations', abbreviation: 'Utah Code Ann. §30', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Utah Code', url: 'https://le.utah.gov/xcode/code.html', type: 'statute' },
    ],
  },
  {
    state: 'Vermont', abbr: 'VT', capital: 'Montpelier', circuit: '2nd Circuit',
    westlawDb: 'VT-ST', lexisDb: 'VTCODE',
    justiaUrl: 'https://law.justia.com/codes/vermont/',
    officialCodeUrl: 'https://legislature.vermont.gov/statutes/',
    courtUrl: 'https://www.vermontjudiciary.org/',
    lawTypes: [
      { category: 'Civil', codeName: 'Vermont Statutes Annotated', abbreviation: 'Vt. Stat. Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Vermont Criminal Code', abbreviation: 'Vt. Stat. Ann. tit. 13', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Vermont Domestic Relations', abbreviation: 'Vt. Stat. Ann. tit. 15', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Vermont Statutes', url: 'https://legislature.vermont.gov/statutes/', type: 'statute' },
    ],
  },
  {
    state: 'Virginia', abbr: 'VA', capital: 'Richmond', circuit: '4th Circuit',
    westlawDb: 'VA-ST', lexisDb: 'VACODE',
    justiaUrl: 'https://law.justia.com/codes/virginia/',
    officialCodeUrl: 'https://law.lis.virginia.gov/vacode/',
    courtUrl: 'https://www.vacourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Code of Virginia', abbreviation: 'Va. Code Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Virginia Criminal Code', abbreviation: 'Va. Code Ann. §18.2', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Virginia Domestic Relations', abbreviation: 'Va. Code Ann. §20', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'equitable distribution'] },
      { category: 'Business', codeName: 'Virginia Stock Corporation Act', abbreviation: 'Va. Code Ann. §13.1', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
    ],
    primarySources: [
      { name: 'Code of Virginia', url: 'https://law.lis.virginia.gov/vacode/', type: 'statute' },
    ],
  },
  {
    state: 'Washington', abbr: 'WA', capital: 'Olympia', circuit: '9th Circuit',
    westlawDb: 'WA-ST', lexisDb: 'WACODE',
    justiaUrl: 'https://law.justia.com/codes/washington/',
    officialCodeUrl: 'https://app.leg.wa.gov/rcw/',
    courtUrl: 'https://www.courts.wa.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Revised Code of Washington', abbreviation: 'RCW', description: 'General civil statutes', topics: ['contracts', 'property', 'torts', 'consumer protection'] },
      { category: 'Criminal', codeName: 'Washington Criminal Code', abbreviation: 'RCW §9A', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors', 'drug offenses'] },
      { category: 'Family', codeName: 'Washington Domestic Relations', abbreviation: 'RCW §26', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support', 'community property'] },
      { category: 'Business', codeName: 'Washington Business Organizations', abbreviation: 'RCW §23B', description: 'Corporations, LLCs', topics: ['corporations', 'LLC', 'partnerships'] },
    ],
    primarySources: [
      { name: 'Revised Code of Washington', url: 'https://app.leg.wa.gov/rcw/', type: 'statute' },
    ],
  },
  {
    state: 'West Virginia', abbr: 'WV', capital: 'Charleston', circuit: '4th Circuit',
    westlawDb: 'WV-ST', lexisDb: 'WVCODE',
    justiaUrl: 'https://law.justia.com/codes/west-virginia/',
    officialCodeUrl: 'https://code.wvlegislature.gov/',
    courtUrl: 'https://www.courtswv.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'West Virginia Code', abbreviation: 'W. Va. Code', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'West Virginia Criminal Code', abbreviation: 'W. Va. Code §61', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'West Virginia Domestic Relations', abbreviation: 'W. Va. Code §48', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'West Virginia Code', url: 'https://code.wvlegislature.gov/', type: 'statute' },
    ],
  },
  {
    state: 'Wisconsin', abbr: 'WI', capital: 'Madison', circuit: '7th Circuit',
    westlawDb: 'WI-ST', lexisDb: 'WICODE',
    justiaUrl: 'https://law.justia.com/codes/wisconsin/',
    officialCodeUrl: 'https://docs.legis.wisconsin.gov/statutes/statutes/',
    courtUrl: 'https://www.wicourts.gov/',
    lawTypes: [
      { category: 'Civil', codeName: 'Wisconsin Statutes', abbreviation: 'Wis. Stat.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Wisconsin Criminal Code', abbreviation: 'Wis. Stat. §939', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Wisconsin Domestic Relations', abbreviation: 'Wis. Stat. §767', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
    ],
    primarySources: [
      { name: 'Wisconsin Statutes', url: 'https://docs.legis.wisconsin.gov/statutes/statutes/', type: 'statute' },
    ],
  },
  {
    state: 'Wyoming', abbr: 'WY', capital: 'Cheyenne', circuit: '10th Circuit',
    westlawDb: 'WY-ST', lexisDb: 'WYCODE',
    justiaUrl: 'https://law.justia.com/codes/wyoming/',
    officialCodeUrl: 'https://wyoleg.gov/statutes/compress/title01.pdf',
    courtUrl: 'https://www.courts.state.wy.us/',
    lawTypes: [
      { category: 'Civil', codeName: 'Wyoming Statutes', abbreviation: 'Wyo. Stat. Ann.', description: 'General civil statutes', topics: ['contracts', 'property', 'torts'] },
      { category: 'Criminal', codeName: 'Wyoming Criminal Code', abbreviation: 'Wyo. Stat. Ann. §6', description: 'Criminal offenses', topics: ['felonies', 'misdemeanors'] },
      { category: 'Family', codeName: 'Wyoming Domestic Relations', abbreviation: 'Wyo. Stat. Ann. §20', description: 'Marriage, divorce, custody', topics: ['divorce', 'custody', 'child support'] },
      { category: 'Energy', codeName: 'Wyoming Minerals & Energy', abbreviation: 'Wyo. Stat. Ann. §30', description: 'Oil, gas, coal, minerals', topics: ['oil and gas', 'coal', 'mineral rights', 'royalties'] },
    ],
    primarySources: [
      { name: 'Wyoming Statutes', url: 'https://law.justia.com/codes/wyoming/', type: 'statute' },
    ],
  },
];

// ─── Federal Law Conflict Areas ───────────────────────────────────────────────

export interface FederalConflictArea {
  id: string;
  title: string;
  federalLaw: string;
  citation: string;
  preemptionType: 'express' | 'field' | 'conflict' | 'obstacle';
  description: string;
  commonStateConflicts: string[];
  affectedStates?: string[]; // abbr list, empty = all states
}

export const FEDERAL_CONFLICT_AREAS: FederalConflictArea[] = [
  {
    id: 'erisa',
    title: 'ERISA Preemption',
    federalLaw: 'Employee Retirement Income Security Act',
    citation: '29 U.S.C. §1144',
    preemptionType: 'express',
    description: 'ERISA expressly preempts state laws that "relate to" employee benefit plans',
    commonStateConflicts: ['State insurance mandates for employer plans', 'State tort claims for benefit denials', 'State continuation coverage laws beyond COBRA'],
  },
  {
    id: 'nlra',
    title: 'NLRA Labor Preemption',
    federalLaw: 'National Labor Relations Act',
    citation: '29 U.S.C. §151',
    preemptionType: 'field',
    description: 'Garmon preemption bars state regulation of activities protected or prohibited by NLRA',
    commonStateConflicts: ['State right-to-work laws (§14(b) exception)', 'State secondary boycott laws', 'State strike replacement laws'],
  },
  {
    id: 'bankruptcy',
    title: 'Bankruptcy Preemption',
    federalLaw: 'Bankruptcy Code',
    citation: '11 U.S.C. §101 et seq.',
    preemptionType: 'field',
    description: 'Federal bankruptcy law governs debtor-creditor relations; states may not interfere with automatic stay or discharge',
    commonStateConflicts: ['State homestead exemption conflicts', 'State fraudulent transfer laws', 'State wage garnishment after discharge'],
  },
  {
    id: 'immigration',
    title: 'Immigration Preemption',
    federalLaw: 'Immigration & Nationality Act',
    citation: '8 U.S.C. §1101 et seq.',
    preemptionType: 'field',
    description: 'Federal government has plenary power over immigration; states may not create parallel immigration enforcement schemes',
    commonStateConflicts: ['State immigration enforcement laws (Arizona SB 1070)', 'State sanctuary city policies', 'State employment verification requirements beyond E-Verify'],
    affectedStates: ['AZ', 'TX', 'FL', 'GA', 'AL', 'SC', 'UT', 'IN'],
  },
  {
    id: 'copyright',
    title: 'Copyright Preemption',
    federalLaw: 'Copyright Act',
    citation: '17 U.S.C. §301',
    preemptionType: 'express',
    description: 'Federal copyright law preempts state law claims equivalent to copyright rights',
    commonStateConflicts: ['State misappropriation claims', 'State unfair competition for creative works', 'State moral rights laws'],
  },
  {
    id: 'patent',
    title: 'Patent Preemption',
    federalLaw: 'Patent Act',
    citation: '35 U.S.C. §1 et seq.',
    preemptionType: 'conflict',
    description: 'State laws that conflict with federal patent policy are preempted',
    commonStateConflicts: ['State trade secret laws vs. patent disclosure', 'State anti-patent troll laws', 'State licensing requirements for patent holders'],
  },
  {
    id: 'securities',
    title: 'Securities Preemption (SLUSA)',
    federalLaw: 'Securities Litigation Uniform Standards Act',
    citation: '15 U.S.C. §77p',
    preemptionType: 'express',
    description: 'SLUSA preempts state class actions alleging securities fraud in connection with nationally traded securities',
    commonStateConflicts: ['State securities fraud class actions', 'State blue sky laws for covered securities', 'State broker-dealer regulation beyond FINRA'],
  },
  {
    id: 'marijuana',
    title: 'Federal Drug Law vs. State Marijuana',
    federalLaw: 'Controlled Substances Act',
    citation: '21 U.S.C. §801 et seq.',
    preemptionType: 'conflict',
    description: 'Marijuana remains Schedule I federally; state legalization creates direct conflict but DOJ has exercised enforcement discretion',
    commonStateConflicts: ['State recreational marijuana laws', 'State medical marijuana programs', 'State cannabis business licensing'],
    affectedStates: ['CA', 'CO', 'WA', 'OR', 'NV', 'AZ', 'IL', 'MI', 'NY', 'NJ', 'CT', 'MA', 'VT', 'ME', 'MN', 'MD', 'MO', 'MT', 'NM', 'AK', 'HI'],
  },
  {
    id: 'firearms',
    title: 'Federal Firearms Law vs. State Gun Laws',
    federalLaw: 'Gun Control Act / National Firearms Act',
    citation: '18 U.S.C. §922; 26 U.S.C. §5801',
    preemptionType: 'conflict',
    description: 'States may impose stricter gun laws but may not authorize what federal law prohibits',
    commonStateConflicts: ['State assault weapons bans', 'State magazine capacity limits', 'State constitutional carry laws', 'State red flag laws'],
  },
  {
    id: 'minimum_wage',
    title: 'FLSA Minimum Wage',
    federalLaw: 'Fair Labor Standards Act',
    citation: '29 U.S.C. §206',
    preemptionType: 'conflict',
    description: 'States may set higher minimum wages but not lower; FLSA sets the floor',
    commonStateConflicts: ['State minimum wage below federal floor', 'State tip credit rules', 'State overtime exemptions narrower than FLSA'],
  },
  {
    id: 'ada',
    title: 'ADA vs. State Disability Laws',
    federalLaw: 'Americans with Disabilities Act',
    citation: '42 U.S.C. §12101 et seq.',
    preemptionType: 'conflict',
    description: 'ADA sets minimum standards; states may provide greater protections',
    commonStateConflicts: ['State disability discrimination laws with broader coverage', 'State accessibility standards stricter than ADA', 'State reasonable accommodation requirements'],
  },
  {
    id: 'hipaa',
    title: 'HIPAA Preemption',
    federalLaw: 'Health Insurance Portability and Accountability Act',
    citation: '45 C.F.R. §160.203',
    preemptionType: 'express',
    description: 'HIPAA preempts contrary state health privacy laws unless state law is more protective',
    commonStateConflicts: ['State medical records access laws', 'State mental health privacy laws', 'State HIV/AIDS confidentiality laws (often more protective)'],
  },
  {
    id: 'title_vii',
    title: 'Title VII vs. State Employment Laws',
    federalLaw: 'Civil Rights Act of 1964 — Title VII',
    citation: '42 U.S.C. §2000e et seq.',
    preemptionType: 'conflict',
    description: 'Title VII sets minimum anti-discrimination standards; states may provide broader protections',
    commonStateConflicts: ['State laws protecting additional classes (sexual orientation, gender identity)', 'State harassment standards stricter than federal', 'State retaliation protections broader than Title VII'],
  },
  {
    id: 'fmla',
    title: 'FMLA vs. State Family Leave',
    federalLaw: 'Family and Medical Leave Act',
    citation: '29 U.S.C. §2601 et seq.',
    preemptionType: 'conflict',
    description: 'FMLA sets minimum leave standards; states may provide more generous leave',
    commonStateConflicts: ['State paid family leave laws', 'State leave for smaller employers', 'State leave for additional family members'],
    affectedStates: ['CA', 'NY', 'NJ', 'WA', 'MA', 'CT', 'OR', 'CO', 'MD', 'DE', 'MN'],
  },
  {
    id: 'environmental',
    title: 'EPA vs. State Environmental Laws',
    federalLaw: 'Clean Air Act / Clean Water Act',
    citation: '42 U.S.C. §7401; 33 U.S.C. §1251',
    preemptionType: 'conflict',
    description: 'Federal environmental law sets minimum standards; states may be stricter (California waiver)',
    commonStateConflicts: ['State vehicle emissions standards (California waiver)', 'State water quality standards', 'State climate change regulations'],
    affectedStates: ['CA', 'NY', 'WA', 'OR', 'MA', 'CO', 'VT', 'ME', 'CT', 'RI', 'NJ', 'MD', 'PA', 'DE', 'NM', 'MN'],
  },
];

// ─── Lexi Research Prompt Builder ─────────────────────────────────────────────

export function buildLexisNexusPrompt(query: string, state?: string, lawType?: string): string {
  const stateContext = state ? `Focus on ${state} state law and its interaction with federal law.` : 'Cover all relevant jurisdictions.';
  const typeContext = lawType ? `Specifically research ${lawType} law.` : 'Cover all relevant law types.';

  return `You are Lexi, an expert AI legal research assistant with access to LexisNexis and Westlaw databases. Conduct comprehensive legal research.

QUERY: ${query}
JURISDICTION: ${stateContext}
LAW TYPE: ${typeContext}

Provide research in this format:

## PRIMARY AUTHORITIES
List the most relevant cases, statutes, and regulations with:
- Full citation (Bluebook format)
- Jurisdiction and court
- Key holding or provision
- Precedential value

## SECONDARY SOURCES
Relevant treatises, law review articles, and practice guides

## FEDERAL-STATE INTERACTION
- Applicable federal law
- State law provisions
- Any preemption issues or conflicts
- Circuit split if applicable

## PRACTICAL ANALYSIS
- How courts have applied this law recently
- Majority vs. minority positions
- Emerging trends

## WESTLAW/LEXISNEXIS SEARCH STRATEGY
Suggested search terms and databases for deeper research

Always cite real, verifiable authorities. Flag any areas of uncertainty.`;
}

export function buildConflictCheckPrompt(stateLaw: string, federalLaw: string, topic: string): string {
  return `You are Lexi, an expert legal analyst. Analyze potential conflicts between state and federal law.

TOPIC: ${topic}
STATE LAW: ${stateLaw}
FEDERAL LAW: ${federalLaw}

Analyze:

## CONFLICT ANALYSIS
1. Does a conflict exist? (Yes/No/Potential)
2. Type of conflict: Express preemption | Field preemption | Conflict preemption | Obstacle preemption
3. Controlling authority on this conflict

## PREEMPTION ANALYSIS
- Federal preemption clause (if any)
- Supremacy Clause application
- Congressional intent
- Key Supreme Court cases on this preemption issue

## STATE LAW STATUS
- Is the state law valid, invalid, or partially preempted?
- Severability analysis
- Any savings clauses

## PRACTICAL IMPACT
- How does this affect practitioners in this state?
- Compliance recommendations
- Litigation risk assessment

## CITATIONS
All relevant cases and statutes in Bluebook format

Be precise and cite only real, verifiable authorities.`;
}
