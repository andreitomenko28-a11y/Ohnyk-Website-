// Ukrainian regional centres (oblast capitals + Kyiv). Черкаси is the MVP
// launch city, so it is pinned to the top and highlighted across the UI; the
// rest are listed alphabetically (Ukrainian collation) and are available for
// future expansion.
export const MVP_CITY = 'Черкаси';

const OTHER_CITIES = [
  'Вінниця',
  'Дніпро',
  'Донецьк',
  'Житомир',
  'Запоріжжя',
  'Івано-Франківськ',
  'Київ',
  'Кропивницький',
  'Луганськ',
  'Луцьк',
  'Львів',
  'Миколаїв',
  'Одеса',
  'Полтава',
  'Рівне',
  'Сімферополь',
  'Суми',
  'Тернопіль',
  'Ужгород',
  'Харків',
  'Херсон',
  'Хмельницький',
  'Чернівці',
  'Чернігів',
].sort((a, b) => a.localeCompare(b, 'uk'));

// Full ordered list with the MVP city first.
export const CITIES = [MVP_CITY, ...OTHER_CITIES];

// Split form for grouped pickers (priority city vs. the rest).
export const CITY_GROUPS = { priority: [MVP_CITY], others: OTHER_CITIES };
