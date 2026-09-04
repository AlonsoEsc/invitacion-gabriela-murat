import { languageOptions } from "../i18n.js";

export function LanguageSwitcher({ language, label, onChange }) {
  return (
    <nav className="language-switcher" aria-label={label}>
      {languageOptions.map((option) => (
        <button
          key={option.code}
          type="button"
          lang={option.code}
          aria-label={option.label}
          aria-pressed={language === option.code}
          className={language === option.code ? "is-active" : ""}
          onClick={() => onChange(option.code)}
        >
          {option.shortLabel}
        </button>
      ))}
    </nav>
  );
}

export function QuranVerse({ copy, compact = false }) {
  return (
    <blockquote className={`quran-verse${compact ? " quran-verse--compact" : ""}`}>
      <p className="quran-verse__arabic" lang="ar" dir="rtl">{copy.arabic}</p>
      {copy.translation && <p className="quran-verse__translation">{copy.translation}</p>}
      <cite>{copy.reference}</cite>
    </blockquote>
  );
}
