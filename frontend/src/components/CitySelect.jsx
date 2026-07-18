import { useI18n } from '../i18n/index.jsx';
import { CITY_GROUPS } from '../lib/cities.js';

// City picker over Ukraine's regional centres. The MVP launch city (Черкаси)
// sits in its own highlighted group at the top; the rest follow, grouped as
// "coming soon". Pass `includeAll` to prepend an "all cities" option (filters).
export default function CitySelect({ value, onChange, includeAll = false, className = '', ...rest }) {
  const { t } = useI18n();
  return (
    <select
      className={`field-input ${className}`}
      value={value ?? ''}
      onChange={(e) => onChange?.(e.target.value)}
      {...rest}
    >
      {includeAll && <option value="">{t('cityAll')}</option>}
      <optgroup label={`★ ${t('cityPriorityGroup')}`}>
        {CITY_GROUPS.priority.map((c) => (
          <option key={c} value={c}>
            {c} ★
          </option>
        ))}
      </optgroup>
      <optgroup label={t('cityOthersGroup')}>
        {CITY_GROUPS.others.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </optgroup>
    </select>
  );
}
