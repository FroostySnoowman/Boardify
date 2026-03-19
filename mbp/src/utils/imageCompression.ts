// Image compression utilities using react-native-image-picker built-in options
// No external manipulation library needed - react-native-image-picker handles resize/quality

export interface CompressedImage {
  uri: string;
  type: string;
  name: string;
}

/**
 * For profile pictures, we rely on react-native-image-picker's built-in
 * maxWidth/maxHeight and quality options. This function just wraps the result.
 */
export function wrapPickerResult(
  uri: string,
  type?: string,
  fileName?: string
): CompressedImage {
  const filename = fileName || uri.split('/').pop() || 'image.jpg';
  const name = filename.endsWith('.jpg') || filename.endsWith('.jpeg') 
    ? filename 
    : filename.replace(/\.[^/.]+$/, '.jpg');

  return {
    uri,
    type: type || 'image/jpeg',
    name,
  };
}

export async function compressImage(
  uri: string,
  _maxWidth: number = 1200,
  _maxHeight: number = 1200,
  _quality: number = 0.8
): Promise<CompressedImage> {
  // With react-native-image-picker, compression is done at pick time
  // This is a passthrough for compatibility
    const filename = uri.split('/').pop() || 'image.jpg';
    const name = filename.endsWith('.jpg') || filename.endsWith('.jpeg') 
      ? filename 
      : filename.replace(/\.[^/.]+$/, '.jpg');

    return {
    uri,
      type: 'image/jpeg',
      name,
    };
}

export async function compressMessageImages(uris: string[]): Promise<CompressedImage[]> {
  const promises = uris.map(async (uri) => {
    // Check if it's a video or gif - don't compress
    const lower = uri.toLowerCase();
    if (lower.includes('video') || lower.endsWith('.gif') || lower.endsWith('.mp4') || lower.endsWith('.mov')) {
      const filename = uri.split('/').pop() || 'media';
      return {
        uri,
        type: lower.endsWith('.gif') ? 'image/gif' : 'video/mp4',
        name: filename,
      };
    }
    // Passthrough - compression done at pick time
    return compressImage(uri, 1200, 1200, 0.8);
  });
  return Promise.all(promises);
}

export async function compressProfilePicture(uri: string): Promise<CompressedImage> {
  // With react-native-image-picker, this is already compressed at pick time
  return compressImage(uri, 400, 400, 0.85);
}

export function validateImageFile(
  _uri: string,
  _type: string,
  _maxSize: number = 10 * 1024 * 1024
): { valid: boolean; error?: string } {
  // Allow all image and video types — the server handles size limits
  return { valid: true };
}
