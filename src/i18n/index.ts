import { moment } from "obsidian";
import { loadAllTranslations } from "./loader";
import type { en } from "./locales/en";

// Supported languages
export type SupportedLanguage = "en" | "zh";

// Translation map interface (loose shape used by non-canonical locales)
export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

// Dotted paths whose value is a string in the English locale
type TPath<T> = {
  [K in keyof T & string]: T[K] extends string ? K : T[K] extends object ? `${K}.${TPath<T[K]>}` : never;
}[keyof T & string];

// Value at a dotted path
type TPathValue<T, P extends string> = P extends `${infer K}.${infer Rest}`
  ? K extends keyof T
    ? TPathValue<T[K], Rest>
    : never
  : P extends keyof T
    ? T[P]
    : never;

// Names of {placeholder}s in a template string. ${name} (the literal docs
// notation for plugin variables) is intentionally skipped.
type TPlaceholders<S extends string> = S extends `${infer Before}{${infer Name}}${infer Rest}`
  ? Before extends `${string}$`
    ? TPlaceholders<Rest>
    : Name | TPlaceholders<Rest>
  : never;

export type TKey = TPath<typeof en>;

type TParams<K extends TKey> = TPlaceholders<Extract<TPathValue<typeof en, K>, string>>;

// Require a params object only when the resolved string has placeholders.
type TArgs<K extends TKey> = [TParams<K>] extends [never] ? [] : [Record<TParams<K>, string | number>];

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
export function t<K extends TKey>(key: K, ...args: TArgs<K>): string {
  const params = args[0] as Record<string, string | number> | undefined;
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
