import { moment } from 'obsidian';

// 支持的语言类型
export type SupportedLanguage = 'en' | 'zh-cn' | 'ja';

// 翻译键值对接口
export interface TranslationMap {
  [key: string]: string | TranslationMap;
}

// 当前语言设置
let currentLanguage: SupportedLanguage = 'en';

// 语言包存储
const translations: Record<SupportedLanguage, TranslationMap> = {
  'en': {},
  'zh-cn': {},
  'ja': {}
};

/**
 * 设置当前语言
 * @param language 语言代码
 */
export function setLanguage(language: SupportedLanguage): void {
  currentLanguage = language;
}

/**
 * 获取当前语言
 * @returns 当前语言代码
 */
export function getCurrentLanguage(): SupportedLanguage {
  return currentLanguage;
}

/**
 * 注册语言包
 * @param language 语言代码
 * @param translationMap 翻译映射
 */
export function registerTranslations(language: SupportedLanguage, translationMap: TranslationMap): void {
  translations[language] = { ...translations[language], ...translationMap };
}

/**
 * 获取翻译文本
 * @param key 翻译键，支持点分隔的嵌套键
 * @param params 可选的参数对象，用于字符串插值
 * @returns 翻译后的文本
 */
export function t(key: string, params?: Record<string, string | number>): string {
  const keys = key.split('.');
  let value: any = translations[currentLanguage];
  
  // 遍历嵌套键
  for (const k of keys) {
    if (value && typeof value === 'object' && k in value) {
      value = value[k];
    } else {
      // 如果当前语言没有找到，尝试使用英文作为后备
      if (currentLanguage !== 'en') {
        let fallbackValue: any = translations['en'];
        for (const fk of keys) {
          if (fallbackValue && typeof fallbackValue === 'object' && fk in fallbackValue) {
            fallbackValue = fallbackValue[fk];
          } else {
            fallbackValue = key; // 最终后备：返回键本身
            break;
          }
        }
        value = fallbackValue;
      } else {
        value = key; // 返回键本身作为后备
      }
      break;
    }
  }
  
  // 确保返回字符串
  let result = typeof value === 'string' ? value : key;
  
  // 处理参数插值
  if (params) {
    Object.entries(params).forEach(([paramKey, paramValue]) => {
      result = result.replace(new RegExp(`\\{${paramKey}\\}`, 'g'), String(paramValue));
    });
  }
  
  return result;
}

/**
 * 根据系统语言自动检测语言设置
 * @returns 检测到的语言代码
 */
export function detectLanguage(): SupportedLanguage {
  const locale = moment.locale();
  
  // 检测中文
  if (locale.startsWith('zh')) {
    return 'zh-cn';
  }

  if (locale.startsWith('ja')) {
    return 'ja';
  }
  
  // 默认返回英文
  return 'en';
}

/**
 * 初始化i18n系统
 * @param language 可选的初始语言，如果不提供则自动检测
 */
export function initI18n(language?: SupportedLanguage): void {
  const initialLanguage = language || detectLanguage();
  setLanguage(initialLanguage);
}