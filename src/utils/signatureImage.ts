/**
 * Central handling of the *visual* side of a signature.
 *
 * A signature record (who signed, when, in which context) always lives in the
 * domain model. This module only answers one question: which image should be
 * rendered for a given signer — their own uploaded signature when they have
 * one, otherwise the single shared sample below.
 *
 * The sample is a development/bootstrap placeholder ONLY. It is never stored
 * on a user, never hard-coded inside a document template, and is replaced the
 * moment that user uploads a real signature.
 */

/** The one and only placeholder signature in the system. */
export const SAMPLE_SIGNATURE_DATA_URL =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="220" height="90" viewBox="0 0 220 90">
      <path d="M14 62 C36 20, 52 20, 60 46 C68 72, 84 72, 96 44 C106 20, 124 24, 128 48 C132 70, 150 70, 166 50 C176 38, 190 34, 204 40"
            fill="none" stroke="#1e3a5f" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M44 72 C90 66, 140 66, 186 70" fill="none" stroke="#1e3a5f" stroke-width="1.5" stroke-linecap="round" opacity="0.55"/>
      <text x="110" y="86" text-anchor="middle" font-family="Tahoma, Arial, sans-serif" font-size="9" fill="#64748b">نمونه امضا</text>
    </svg>`
  );

/** Image formats accepted for an uploaded signature. */
export const SIGNATURE_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/webp'];
export const SIGNATURE_IMAGE_ACCEPT = '.png,.jpg,.jpeg,.webp';
export const SIGNATURE_IMAGE_MAX_BYTES = 2 * 1024 * 1024;

export interface SignatureImageValidation {
  isValid: boolean;
  message?: string;
}

export const validateSignatureImageFile = (file: File): SignatureImageValidation => {
  if (!SIGNATURE_IMAGE_MIME_TYPES.includes(file.type.toLowerCase())) {
    return { isValid: false, message: 'فقط فایل‌های تصویری PNG، JPG، JPEG یا WEBP مجاز هستند.' };
  }
  if (file.size > SIGNATURE_IMAGE_MAX_BYTES) {
    return { isValid: false, message: 'حجم تصویر امضا نباید بیشتر از ۲ مگابایت باشد.' };
  }
  return { isValid: true };
};

/**
 * The image to render for a signer. `ownSignatureUrl` must always come from
 * the *real* signer's user record — never from whoever happens to be looking
 * at the document — so a signature can never be shown under another name.
 */
export const resolveSignatureImageUrl = (ownSignatureUrl?: string): string =>
  ownSignatureUrl?.trim() ? ownSignatureUrl : SAMPLE_SIGNATURE_DATA_URL;

/** True when the rendered image is the shared placeholder, not a real upload. */
export const isSampleSignature = (imageUrl?: string): boolean =>
  !imageUrl || imageUrl === SAMPLE_SIGNATURE_DATA_URL;
