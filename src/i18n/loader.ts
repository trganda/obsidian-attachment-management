import { registerTranslations, SupportedLanguage } from "./index";
import { en } from "./locales/en";
import { zhCn as zh } from "./locales/zh";

/**
 * Load all translation packs.
 */
export function loadAllTranslations() {
  // Register the English pack
  registerTranslations("en", en);

  // Register the Chinese pack
  registerTranslations("zh", zh);
}

/**
 * Get the list of supported languages.
 * @returns supported languages with code and display names
 */
export function getSupportedLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
  return [
    {
      code: "en",
      name: "English",
      nativeName: "English",
    },
    {
      code: "zh",
      name: "Chinese (Simplified)",
      nativeName: "简体中文",
    },
  ];
}

/**
 * Get the display name for a language code.
 * @param code language code
 * @returns language display name
 */
export function getLanguageName(code: SupportedLanguage): string {
  const languages = getSupportedLanguages();
  const language = languages.find((lang) => lang.code === code);
  return language ? language.nativeName : code;
}
