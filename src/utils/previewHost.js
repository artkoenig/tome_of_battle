export const PREVIEW_HOSTNAME = 'army-builder-git-main-neardy.vercel.app';

export function isPreviewHost(hostname) {
  return hostname === PREVIEW_HOSTNAME;
}
