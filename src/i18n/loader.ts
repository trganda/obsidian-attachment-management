import { registerTranslations, SupportedLanguage } from "./index";
import { en } from "./locales/en";
import { zhCn as zh } from "./locales/zh";

/**
 * 加载所有语言包
 */
export function loadAllTranslations() {
  // 注册英文语言包
  registerTranslations("en", en);
  
  // 注册中文语言包
  registerTranslations("zh", zh);
}

/**
 * 获取支持的语言列表
 * @returns 支持的语言列表，包含代码和显示名称
 */
export function getSupportedLanguages(): Array<{ code: SupportedLanguage; name: string; nativeName: string }> {
  return [
    {
      code: "en",
      name: "English",
      nativeName: "English"
    },
    {
      code: "zh",
      name: "Chinese (Simplified)",
      nativeName: "简体中文"
    }
  ];
}

/**
 * 根据语言代码获取语言显示名称
 * @param code 语言代码
 * @returns 语言显示名称
 */
export function getLanguageName(code: SupportedLanguage): string {
  const languages = getSupportedLanguages();
  const language = languages.find(lang => lang.code === code);
  return language ? language.nativeName : code;
}