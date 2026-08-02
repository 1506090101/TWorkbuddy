/**
 * Agent Buddy — i18n Hook
 *
 * Lightweight internationalization using Zustand for state.
 * No external dependencies — just a hook that reads locale from uiStore
 * and returns a `t()` function.
 *
 * Usage:
 *   const { t, locale, setLocale } = useTranslation();
 *   <h1>{t("welcome.title")}</h1>
 */
import { useCallback } from "react";
import { useUIStore } from "@stores/uiStore";
import { translations, type TranslationKey } from "./translations";
import type { Locale } from "@shared/types";

export function useTranslation() {
  const locale = useUIStore((s) => s.locale);
  const setLocale = useUIStore((s) => s.setLocale);

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>): string => {
      const dict = translations[locale] ?? translations["zh-CN"];
      let str = dict[key] ?? key;

      // Simple parameter interpolation: {name} → value
      if (params) {
        for (const [k, v] of Object.entries(params)) {
          str = str.replace(new RegExp(`\\{${k}\\}`, "g"), String(v));
        }
      }

      return str;
    },
    [locale]
  );

  return { t, locale, setLocale };
}

export type { Locale, TranslationKey };
