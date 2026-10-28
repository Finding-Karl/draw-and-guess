import { ROOM_CODE_LENGTH } from '@dg/shared';

/**
 * QR rendering.
 *
 * Uses the public `qrcode` package rather than writing an encoder, because a
 * hand-rolled QR implementation is a liability with no portfolio upside — the
 * interesting part of this project is real-time UI, not Reed-Solomon.
 *
 * Everything is same-origin so a QR scanned on the LAN in dev actually works.
 */

export function joinUrl(code: string): string {
  return `${location.origin}/?room=${code}`;
}

/** Absolute path form, used for the printed fallback under the QR. */
export function playUrl(code: string): string {
  return `${location.origin}/play/${code}`;
}

export async function qrDataUrl(text: string, size = 512): Promise<string | null> {
  try {
    const mod = await import('qrcode');
    return await mod.toDataURL(text, {
      width: size,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: { dark: '#111111', light: '#ffffff' },
    });
  } catch (err) {
    console.error('[qr] failed to render', err);
    return null;
  }
}

/** Normalizes a ?room= parameter, returning null when it isn't plausible. */
export function parseRoomParam(param: string | null): string | null {
  if (!param) return null;
  const code = param.trim().toUpperCase();
  return code.length === ROOM_CODE_LENGTH ? code : null;
}
