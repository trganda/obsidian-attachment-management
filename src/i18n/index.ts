import { moment } from "obsidian";
import { loadAllTranslations } from "./loader";

// Supported languages
export type SupportedLanguage = "en" | "zh";

// Translation map interface
export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

// Current language
let currentLanguage: SupportedLanguage = "en";

// Registered translation packs
const translations: Record<SupportedLanguage, TranslationMap> = {
  en: {},
  zh: {},
};

/**
 * Set the current language.
 * @param language language code
 */
export function setLanguage(language: SupportedLanguage): void {
  currentLanguage = language;
}

/**
 * Get the current language.
 * @returns current language code
 */
export function getCurrentLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * Register a translation pack.
 * @param language language code
 * @param translationMap translation map
 */
export function registerTranslations(language: SupportedLanguage, translationMap: TranslationMap): void {
  translations[language] = { ...translations[language], ...translationMap };
}

/**
 * Resolve a translation string.
 * @param key dot-separated translation key
 * @param params optional values for string interpolation
 * @returns translated text
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split(".");
  let value: string | TranslationMap = translations[currentLanguage];

  // Walk the nested keys
  for (const k of keys) {
    if (value && typeof value === "object" && k in value) {
      value = value[k];
    } else {
      // Fall back to English when the current language has no entry
      if (currentLanguage !== "en") {
        let fallbackValue: string | TranslationMap = translations["en"];
        for (const fk of keys) {
          if (fallbackValue && typeof fallbackValue === "object" && fk in fallbackValue) {
            fallbackValue = fallbackValue[fk];
          } else {
            fallbackValue = key; // Last-resort fallback: return the key itself
            break;
          }
        }
        value = fallbackValue;
      } else {
        value = key; // Return the key itself as a last-resort fallback
      }
      break;
    }
  }

  // Make sure the resolved value is a string
  let result = typeof value === "string" ? value : key;

  // Interpolate parameters
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, "g"), String(paramValue));
    });
  }

  return result;
}

/**
 * Detect the language from the system locale.
 * @returns detected language code
 */
export function detectLanguage(): SupportedLanguage {
  const language = moment.locale();
  return (language.startsWith("zh") ? "zh" : "en") as SupportedLanguage;
}

/**
 * Initialize the i18n system.
 * @param language optional initial language; auto-detected when omitted
 */
export function initI18n(language?: SupportedLanguage): void {
  loadAllTranslations();
  const initialLanguage = language || detectLanguage();
  setLanguage(initialLanguage);
}
