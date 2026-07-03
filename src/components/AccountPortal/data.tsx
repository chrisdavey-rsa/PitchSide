import React from 'react';

export const NATIONS_LIST = [
  { code: 'GB', name: 'United Kingdom', flag: '🇬🇧' },
  { code: 'IE', name: 'Ireland', flag: '🇮🇪' },
  { code: 'FR', name: 'France', flag: '🇫🇷' },
  { code: 'NZ', name: 'New Zealand', flag: '🇳🇿' },
  { code: 'AU', name: 'Australia', flag: '🇦🇺' },
  { code: 'ZA', name: 'South Africa', flag: '🇿🇦' },
  { code: 'US', name: 'United States', flag: '🇺🇸' },
  { code: 'CA', name: 'Canada', flag: '🇨🇦' },
  { code: 'IT', name: 'Italy', flag: '🇮🇹' },
  { code: 'JP', name: 'Japan', flag: '🇯🇵' },
  { code: 'AR', name: 'Argentina', flag: '🇦🇷' },
  { code: 'ES', name: 'Spain', flag: '🇪🇸' },
  { code: 'DE', name: 'Germany', flag: '🇩🇪' },
  { code: 'BR', name: 'Brazil', flag: '🇧🇷' },
  { code: 'NL', name: 'Netherlands', flag: '🇳🇱' },
  { code: 'PT', name: 'Portugal', flag: '🇵🇹' },
  { code: 'IN', name: 'India', flag: '🇮🇳' },
  { code: 'CH', name: 'Switzerland', flag: '🇨🇭' },
  { code: 'BE', name: 'Belgium', flag: '🇧🇪' },
  { code: 'SE', name: 'Sweden', flag: '🇸🇪' },
  { code: 'NO', name: 'Norway', flag: '🇳🇴' },
  { code: 'FI', name: 'Finland', flag: '🇫🇮' },
  { code: 'DK', name: 'Denmark', flag: '🇩🇰' },
];

export const COUNTRY_CODE_MAP: Record<string, string> = {
  uk: 'gb',
  'united kingdom': 'gb',
  gb: 'gb',
  england: 'gb',
  za: 'za',
  'south africa': 'za',
  nz: 'nz',
  'new zealand': 'nz',
  au: 'au',
  australia: 'au',
  ie: 'ie',
  ireland: 'ie',
  fr: 'fr',
  france: 'fr',
  it: 'it',
  italy: 'it',
  jp: 'jp',
  japan: 'jp',
  ar: 'ar',
  argentina: 'ar',
  'los pumas': 'ar',
  es: 'es',
  spain: 'es',
  de: 'de',
  germany: 'de',
  br: 'br',
  brazil: 'br',
  us: 'us',
  'united states': 'us',
  usa: 'us',
  ca: 'ca',
  canada: 'ca',
  nl: 'nl',
  netherlands: 'nl',
  pt: 'pt',
  portugal: 'pt',
  in: 'in',
  india: 'in',
  ch: 'ch',
  switzerland: 'ch',
  be: 'be',
  belgium: 'be',
  se: 'se',
  sweden: 'se',
  no: 'no',
  norway: 'no',
  fi: 'fi',
  finland: 'fi',
  dk: 'dk',
  denmark: 'dk',
  fiji: 'fj',
  fj: 'fj',
  samoa: 'ws',
  ws: 'ws',
  wales: 'gb-wls',
  scotland: 'gb-sct',
};

export const getCountryCode = (name?: string): string => {
  if (!name) return 'gb';
  const c = name.toLowerCase().trim();
  if (COUNTRY_CODE_MAP[c]) return COUNTRY_CODE_MAP[c];
  
  const found = NATIONS_LIST.find(
    (n) => n.name.toLowerCase() === c || n.code.toLowerCase() === c
  );
  if (found) return found.code.toLowerCase();
  
  return 'gb';
};

export const getCountryFlag = (countryInput?: string): React.ReactNode => {
  return (
    <img 
      src={`https://flagcdn.com/16x12/${getCountryCode(countryInput)}.png`} 
      width="16" 
      height="12" 
      alt={countryInput || 'GB'} 
      className="rounded-xs object-cover select-none inline-block align-middle"
      referrerPolicy="no-referrer"
    />
  );
};
