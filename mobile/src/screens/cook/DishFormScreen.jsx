// Create or edit a dish, including its photos.
//
// Photos can only be attached to a dish that exists, so on create the dish is
// saved first and the picked images are uploaded straight after; when editing,
// uploads happen immediately.

import { useEffect, useState } from 'react';
import { ActivityIndicator, Image, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import Screen from '../../components/Screen.jsx';
import Field from '../../components/Field.jsx';
import Button from '../../components/Button.jsx';
import PhotoPickerSheet from '../../components/PhotoPickerSheet.jsx';
import { apiError } from '../../api/client.js';
import {
  createDish,
  deleteDishPhoto,
  fetchCategories,
  updateDish,
  uploadDishPhotos,
} from '../../api/cook.js';
import { mediaUrl } from './CookProfileScreen.jsx';
import { useI18n } from '../../i18n/index.jsx';
import { useTheme } from '../../theme/ThemeContext.jsx';
import { radius, spacing } from '../../theme/tokens.js';

const MAX_PHOTOS = 8;

function toForm(dish) {
  return {
    name: dish?.name ?? '',
    description: dish?.description ?? '',
    price: dish?.price != null ? String(dish.price) : '',
    categoryId: dish?.categoryId ?? '',
    isAvailable: dish?.isAvailable ?? true,
    availableDays: dish?.availableDays ?? [],
    availableFrom: dish?.availableFrom ?? '',
    availableUntil: dish?.availableUntil ?? '',
  };
}

// The category tree is two levels; dishes attach to a leaf.
function flattenCategories(tree) {
  const out = [];
  for (const root of tree) {
    if (root.children?.length) {
      for (const child of root.children) out.push({ ...child, parentName: root.name });
    } else {
      out.push({ ...root, parentName: null });
    }
  }
  return out;
}

export default function DishFormScreen({ route, navigation }) {
  const existing = route.params?.dish ?? null;
  const { t } = useI18n();
  const { colors } = useTheme();

  const [form, setForm] = useState(() => toForm(existing));
  const [dish, setDish] = useState(existing);
  const [categories, setCategories] = useState([]);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    fetchCategories()
      .then((tree) => setCategories(flattenCategories(tree)))
      .catch(() => setCategories([])); // a missing list must not block saving
  }, []);

  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }));

  async function onSave() {
    setSaving(true);
    setError('');
    try {
      if (dish) {
        const updated = await updateDish(dish.id, form, dish);
        if (updated) setDish(updated); // null means nothing changed
      } else {
        setDish(await createDish(form));
      }
      navigation.goBack();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setSaving(false);
    }
  }

  async function onPicked(assets) {
    setUploading(true);
    setError('');
    try {
      let target = dish;
      // Photos need a dish id, so create it first when adding a new dish.
      if (!target) {
        target = await createDish(form);
        setDish(target);
      }
      setDish(await uploadDishPhotos(target.id, assets));
    } catch (err) {
      setError(apiError(err));
    } finally {
      setUploading(false);
    }
  }

  async function onRemovePhoto(photoId) {
    try {
      setDish(await deleteDishPhoto(dish.id, photoId));
    } catch (err) {
      setError(apiError(err));
    }
  }

  const photos = dish?.photos ?? [];
  const canAddPhotos = photos.length < MAX_PHOTOS;

  return (
    <Screen title={existing ? t('editDish') : t('addDish')}>
      <ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <Field label={t('dishName')} value={form.name} onChangeText={set('name')} />
        <Field
          label={t('dishPrice')}
          value={form.price}
          onChangeText={set('price')}
          keyboardType="decimal-pad"
        />
        <Field
          label={t('dishDescription')}
          value={form.description}
          onChangeText={set('description')}
          multiline
        />

        <Text style={[styles.label, { color: colors.muted }]}>{t('dishCategory')}</Text>
        <View style={styles.chips}>
          {categories.map((c) => {
            const active = form.categoryId === c.id;
            return (
              <Pressable
                key={c.id}
                onPress={() => set('categoryId')(active ? '' : c.id)}
                style={[
                  styles.chip,
                  {
                    borderColor: active ? colors.ember : colors.line,
                    backgroundColor: active ? `${colors.ember}14` : 'transparent',
                  },
                ]}
              >
                <Text style={{ color: active ? colors.ember : colors.muted, fontSize: 12.5 }}>
                  {c.name}
                </Text>
              </Pressable>
            );
          })}
        </View>

        <View style={styles.switchRow}>
          <Text style={[styles.switchLabel, { color: colors.fg }]}>{t('dishAvailable')}</Text>
          <Switch
            value={form.isAvailable}
            onValueChange={set('isAvailable')}
            trackColor={{ true: colors.ember }}
          />
        </View>

        <Text style={[styles.label, { color: colors.muted }]}>
          {t('dishPhotos')} ({photos.length}/{MAX_PHOTOS})
        </Text>
        <View style={styles.photos}>
          {photos.map((p) => (
            <Pressable key={p.id} onLongPress={() => onRemovePhoto(p.id)}>
              <Image source={{ uri: mediaUrl(p.url) }} style={styles.photo} />
            </Pressable>
          ))}
          {canAddPhotos ? (
            <Pressable
              onPress={() => setPickerOpen(true)}
              disabled={uploading}
              style={[styles.photo, styles.addPhoto, { borderColor: colors.line, backgroundColor: colors.elevated }]}
            >
              {uploading ? (
                <ActivityIndicator color={colors.ember} />
              ) : (
                <Text style={{ color: colors.muted, fontSize: 22 }}>+</Text>
              )}
            </Pressable>
          ) : null}
        </View>
        {photos.length ? (
          <Text style={[styles.hint, { color: colors.muted }]}>{t('photoLongPressHint')}</Text>
        ) : null}

        {error ? <Text style={[styles.error, { color: colors.ember }]}>{error}</Text> : null}

        <Button title={t('save')} onPress={onSave} busy={saving} style={styles.save} />
      </ScrollView>

      <PhotoPickerSheet
        visible={pickerOpen}
        onClose={() => setPickerOpen(false)}
        onPicked={onPicked}
        multiple
        limit={MAX_PHOTOS - photos.length}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: spacing.xxl },
  label: { fontSize: 12, fontWeight: '600', marginBottom: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginBottom: spacing.lg },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.sm },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing.lg },
  switchLabel: { fontSize: 14.5, fontWeight: '600' },
  photos: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  photo: { width: 84, height: 84, borderRadius: radius.md },
  addPhoto: { borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hint: { fontSize: 11.5, marginTop: spacing.sm },
  error: { fontSize: 13, marginTop: spacing.md, fontWeight: '500' },
  save: { marginTop: spacing.xl },
});
