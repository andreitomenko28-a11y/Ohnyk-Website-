// Camera-or-gallery chooser. Both paths need a runtime permission, so denial
// is surfaced here rather than failing silently.

import { Alert, Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { useI18n } from '../i18n/index.jsx';
import { useTheme } from '../theme/ThemeContext.jsx';
import { pickFromLibrary, takePhoto } from '../api/images.js';
import { radius, spacing } from '../theme/tokens.js';

export default function PhotoPickerSheet({ visible, onClose, onPicked, multiple = false, limit = 1 }) {
  const { t } = useI18n();
  const { colors } = useTheme();

  async function run(source) {
    onClose();
    const { denied, assets } = source === 'camera'
      ? await takePhoto()
      : await pickFromLibrary({ multiple, limit });

    if (denied) {
      Alert.alert(t('permissionNeededTitle'), t(source === 'camera' ? 'permissionCamera' : 'permissionLibrary'));
      return;
    }
    if (assets.length) onPicked(assets);
  }

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[styles.sheet, { backgroundColor: colors.surface, borderColor: colors.line }]}
          onPress={(e) => e.stopPropagation()}
        >
          <Text style={[styles.title, { color: colors.fg }]}>{t('addPhoto')}</Text>

          <Pressable onPress={() => run('camera')} style={[styles.option, { borderColor: colors.line }]}>
            <Text style={[styles.optionText, { color: colors.fg }]}>{t('takePhoto')}</Text>
          </Pressable>
          <Pressable onPress={() => run('library')} style={[styles.option, { borderColor: colors.line }]}>
            <Text style={[styles.optionText, { color: colors.fg }]}>{t('chooseFromGallery')}</Text>
          </Pressable>
          <Pressable onPress={onClose} style={styles.cancel}>
            <Text style={[styles.optionText, { color: colors.muted }]}>{t('cancel')}</Text>
          </Pressable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  sheet: {
    borderTopLeftRadius: radius.card,
    borderTopRightRadius: radius.card,
    borderWidth: 1,
    padding: spacing.lg,
    paddingBottom: spacing.xxl,
  },
  title: { fontSize: 16, fontWeight: '700', marginBottom: spacing.md },
  option: { borderWidth: 1, borderRadius: radius.md, paddingVertical: spacing.md, alignItems: 'center', marginBottom: spacing.sm },
  cancel: { paddingVertical: spacing.md, alignItems: 'center' },
  optionText: { fontSize: 15, fontWeight: '600' },
});
