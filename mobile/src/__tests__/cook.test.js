// Module 8.3 — dish payloads, profile patching, and upload preparation.

import {
  buildCreateDishPayload,
  buildUpdateDishPayload,
  parsePrice,
} from '../api/dishPayload.js';
import { buildCookProfilePatch } from '../api/cook.js';

describe('price parsing', () => {
  it('accepts a comma decimal separator (Ukrainian keyboards)', () => {
    expect(parsePrice('120,50')).toBe(120.5);
    expect(parsePrice('120.50')).toBe(120.5);
    expect(parsePrice('120')).toBe(120);
  });

  it('returns null for blank or non-numeric input', () => {
    expect(parsePrice('')).toBeNull();
    expect(parsePrice('   ')).toBeNull();
    expect(parsePrice('дорого')).toBeNull();
  });
});

describe('create dish payload (schema is .strict())', () => {
  const form = {
    name: '  Борщ  ',
    price: '120',
    description: '',
    categoryId: '',
    isAvailable: true,
    availableDays: [],
    availableFrom: '',
    availableUntil: '',
  };

  it('sends only name, price and availability when nothing else is filled', () => {
    expect(buildCreateDishPayload(form)).toEqual({
      name: 'Борщ',
      price: 120,
      isAvailable: true,
    });
  });

  it('omits an unselected category instead of sending a blank one', () => {
    // The server would tolerate '' here (its schema allows it and maps it to
    // null), but a create has nothing to clear, so the key is simply left out.
    expect(buildCreateDishPayload(form)).not.toHaveProperty('categoryId');
    const withCategory = buildCreateDishPayload({ ...form, categoryId: 'abc-uuid' });
    expect(withCategory.categoryId).toBe('abc-uuid');
  });

  it('drops unknown weekday values rather than letting the server reject them', () => {
    const payload = buildCreateDishPayload({ ...form, availableDays: ['MON', 'FUNDAY', 'SAT'] });
    expect(payload.availableDays).toEqual(['MON', 'SAT']);
  });

  it('converts the price string to a number', () => {
    expect(typeof buildCreateDishPayload({ ...form, price: '99,90' }).price).toBe('number');
  });
});

describe('update dish payload (only changed fields)', () => {
  const original = {
    name: 'Борщ',
    price: 120,
    description: 'Смачний',
    categoryId: 'cat-1',
    isAvailable: true,
    availableDays: ['MON'],
    availableFrom: '10:00',
    availableUntil: '20:00',
  };
  const asForm = {
    name: 'Борщ',
    price: '120',
    description: 'Смачний',
    categoryId: 'cat-1',
    isAvailable: true,
    availableDays: ['MON'],
    availableFrom: '10:00',
    availableUntil: '20:00',
  };

  it('is empty when nothing changed, so the caller can skip the request', () => {
    // The server rejects an empty patch with "no fields to update".
    expect(buildUpdateDishPayload(asForm, original)).toEqual({});
  });

  it('includes only the field that actually changed', () => {
    expect(buildUpdateDishPayload({ ...asForm, price: '150' }, original)).toEqual({ price: 150 });
    expect(buildUpdateDishPayload({ ...asForm, name: 'Зелений борщ' }, original)).toEqual({
      name: 'Зелений борщ',
    });
  });

  it('sends "" to clear an optional field (the server maps it to null)', () => {
    expect(buildUpdateDishPayload({ ...asForm, description: '' }, original)).toEqual({
      description: '',
    });
    expect(buildUpdateDishPayload({ ...asForm, categoryId: '' }, original)).toEqual({
      categoryId: '',
    });
  });

  it('detects availability and weekday changes', () => {
    expect(buildUpdateDishPayload({ ...asForm, isAvailable: false }, original)).toEqual({
      isAvailable: false,
    });
    expect(buildUpdateDishPayload({ ...asForm, availableDays: ['MON', 'TUE'] }, original)).toEqual({
      availableDays: ['MON', 'TUE'],
    });
  });
});

describe('cook profile patch', () => {
  const cook = {
    displayName: 'Кухня Оксани',
    bio: 'Готую борщ',
    kitchenAddress: 'вул. Смілянська, 44',
    deliveryZone: 'Центр',
    city: 'Черкаси',
  };

  it('is empty when nothing changed (server rejects an empty body)', () => {
    expect(buildCookProfilePatch({ ...cook }, cook)).toEqual({});
  });

  it('sends only the edited field', () => {
    expect(buildCookProfilePatch({ ...cook, bio: 'Готую вареники' }, cook)).toEqual({
      bio: 'Готую вареники',
    });
  });

  it('ignores whitespace-only edits', () => {
    expect(buildCookProfilePatch({ ...cook, city: '  Черкаси  ' }, cook)).toEqual({});
  });
});

describe('image preparation for upload', () => {
  let images;
  let manipulator;

  beforeEach(() => {
    jest.resetModules();
    jest.doMock('expo-image-manipulator', () => {
      const saveAsync = jest.fn(async () => ({ uri: 'file:///tmp/out.jpg' }));
      const resize = jest.fn();
      const context = {
        resize: jest.fn(function (size) {
          resize(size);
          return this;
        }),
        renderAsync: jest.fn(async () => ({ saveAsync })),
      };
      return {
        ImageManipulator: { manipulate: jest.fn(() => context) },
        SaveFormat: { JPEG: 'jpeg' },
        __context: context,
        __saveAsync: saveAsync,
        __resize: resize,
      };
    });
    jest.doMock('expo-image-picker', () => ({
      requestMediaLibraryPermissionsAsync: jest.fn(),
      requestCameraPermissionsAsync: jest.fn(),
      launchImageLibraryAsync: jest.fn(),
      launchCameraAsync: jest.fn(),
    }));
    manipulator = require('expo-image-manipulator');
    images = require('../api/images.js');
  });

  afterEach(() => {
    jest.dontMock('expo-image-manipulator');
    jest.dontMock('expo-image-picker');
  });

  it('always declares image/jpeg, because the server verifies magic bytes', async () => {
    // An iPhone hands back HEIC; sending those bytes labelled as JPEG is
    // exactly what the server's signature check rejects.
    const file = await images.prepareForUpload({ uri: 'file:///photo.heic', width: 800, height: 600 });
    expect(file.type).toBe('image/jpeg');
    expect(file.name).toMatch(/\.jpg$/);
    expect(manipulator.__saveAsync).toHaveBeenCalledWith(
      expect.objectContaining({ format: 'jpeg' }),
    );
  });

  it('downscales an oversized image by its long edge', async () => {
    await images.prepareForUpload({ uri: 'file:///big.jpg', width: 4000, height: 3000 });
    expect(manipulator.__resize).toHaveBeenCalledWith({ width: 1600 });

    manipulator.__resize.mockClear();
    await images.prepareForUpload({ uri: 'file:///tall.jpg', width: 3000, height: 4000 });
    expect(manipulator.__resize).toHaveBeenCalledWith({ height: 1600 });
  });

  it('does not upscale an image that is already small', async () => {
    await images.prepareForUpload({ uri: 'file:///small.jpg', width: 800, height: 600 });
    expect(manipulator.__resize).not.toHaveBeenCalled();
  });
});
