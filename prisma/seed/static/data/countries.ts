export const COUNTRIES = [
  { countryCode: 'IN', name: 'India', currencyCode: 'INR', currencySymbol: '₹', countryFlagEmoji: '🇮🇳', countryPhoneExtension: '+91', nationalLanguage: 'hi', timezone: 'Asia/Kolkata', market: 'TIER_3' },
  { countryCode: 'US', name: 'United States', currencyCode: 'USD', currencySymbol: '$', countryFlagEmoji: '🇺🇸', countryPhoneExtension: '+1', nationalLanguage: 'en', timezone: 'America/New_York', market: 'TIER_1' },
  { countryCode: 'GB', name: 'United Kingdom', currencyCode: 'GBP', currencySymbol: '£', countryFlagEmoji: '🇬🇧', countryPhoneExtension: '+44', nationalLanguage: 'en', timezone: 'Europe/London', market: 'TIER_1' },
  { countryCode: 'DE', name: 'Germany', currencyCode: 'EUR', currencySymbol: '€', countryFlagEmoji: '🇩🇪', countryPhoneExtension: '+49', nationalLanguage: 'de', timezone: 'Europe/Berlin', market: 'TIER_2' },
  { countryCode: 'AE', name: 'United Arab Emirates', currencyCode: 'AED', currencySymbol: 'د.إ', countryFlagEmoji: '🇦🇪', countryPhoneExtension: '+971', nationalLanguage: 'ar', timezone: 'Asia/Dubai', market: 'TIER_3' },
  { countryCode: 'SG', name: 'Singapore', currencyCode: 'SGD', currencySymbol: 'S$', countryFlagEmoji: '🇸🇬', countryPhoneExtension: '+65', nationalLanguage: 'en', timezone: 'Asia/Singapore', market: 'TIER_3' },
  { countryCode: 'MY', name: 'Malaysia', currencyCode: 'MYR', currencySymbol: 'RM', countryFlagEmoji: '🇲🇾', countryPhoneExtension: '+60', nationalLanguage: 'ms', timezone: 'Asia/Kuala_Lumpur', market: 'TIER_3' },
] as const;

export const MARKETS = [
  { key: 'TIER_1', name: 'Tier 1', defaultCurrencyCode: 'USD' },
  { key: 'TIER_2', name: 'Tier 2', defaultCurrencyCode: 'EUR' },
  { key: 'TIER_3', name: 'Tier 3', defaultCurrencyCode: 'INR' },
  { key: 'TIER_4', name: 'Tier 4', defaultCurrencyCode: 'USD' },
] as const;
