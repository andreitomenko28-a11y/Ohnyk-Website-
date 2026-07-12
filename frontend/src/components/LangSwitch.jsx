import { useI18n } from '../i18n/index.jsx';

export default function LangSwitch({ className = '' }) {
  const { lang, setLang } = useI18n();
  return (
    <div className={`mt-5 text-center text-xs text-[color:var(--muted)] ${className}`}>
      <button
        onClick={() => setLang('uk')}
        className={`px-1 font-bold ${lang === 'uk' ? 'text-ember' : 'text-[color:var(--muted)]'}`}
      >
        УКР
      </button>
      /
      <button
        onClick={() => setLang('en')}
        className={`px-1 font-bold ${lang === 'en' ? 'text-ember' : 'text-[color:var(--muted)]'}`}
      >
        ENG
      </button>
    </div>
  );
}
