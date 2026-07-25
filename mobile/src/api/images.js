// Picking and preparing images for upload.
//
// Two backend constraints drive everything here:
//
//   1. Images are capped at 5 MB. A modern phone camera easily exceeds that,
//      so every picked image is downscaled and re-compressed before upload.
//   2. The upload route verifies magic bytes against the declared MIME type.
//      An iPhone hands back HEIC; sending those bytes while claiming
//      `image/jpeg` is exactly what that check rejects. So we always re-encode
//      to JPEG and declare `image/jpeg` — the bytes and the label agree.
//
// SDK 57 note: `manipulateAsync` is deprecated; the context API
// (`ImageManipulator.manipulate(...).renderAsync()`) is used instead.

import * as ImagePicker from 'expo-image-picker';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

// Long edge cap. Dish photos are displayed at card/detail size, so anything
// larger is wasted bytes on a mobile connection.
const MAX_DIMENSION = 1600;
const QUALITY = 0.8;

export const UPLOAD_MIME = 'image/jpeg';
export const UPLOAD_EXT = 'jpg';

// Downscale + re-encode to JPEG. Returns { uri, name, type } ready for FormData.
export async function prepareForUpload(asset, baseName = 'photo') {
  const context = ImageManipulator.manipulate(asset.uri);

  // Only resize when the image is actually bigger than the cap; upscaling a
  // small picture would just inflate it.
  const longEdge = Math.max(asset.width || 0, asset.height || 0);
  if (longEdge > MAX_DIMENSION) {
    const portrait = (asset.height || 0) >= (asset.width || 0);
    context.resize(portrait ? { height: MAX_DIMENSION } : { width: MAX_DIMENSION });
  }

  const rendered = await context.renderAsync();
  const result = await rendered.saveAsync({ compress: QUALITY, format: SaveFormat.JPEG });

  return { uri: result.uri, name: `${baseName}.${UPLOAD_EXT}`, type: UPLOAD_MIME };
}

// Asks for permission and opens the gallery. Returns [] when denied/cancelled.
export async function pickFromLibrary({ multiple = false, limit = 1 } = {}) {
  const { granted } = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!granted) return { denied: true, assets: [] };

  const result = await ImagePicker.launchImageLibraryAsync({
    mediaTypes: 'images',
    allowsMultipleSelection: multiple,
    selectionLimit: multiple ? limit : 1,
    quality: 1, // compression happens in prepareForUpload, after downscaling
  });
  if (result.canceled) return { denied: false, assets: [] };
  return { denied: false, assets: result.assets ?? [] };
}

// Asks for permission and opens the camera.
export async function takePhoto() {
  const { granted } = await ImagePicker.requestCameraPermissionsAsync();
  if (!granted) return { denied: true, assets: [] };

  const result = await ImagePicker.launchCameraAsync({ mediaTypes: 'images', quality: 1 });
  if (result.canceled) return { denied: false, assets: [] };
  return { denied: false, assets: result.assets ?? [] };
}
