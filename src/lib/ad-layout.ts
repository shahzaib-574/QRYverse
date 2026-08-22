export const desktopBannerMargin = 16;
export const mobileBannerFallbackMargin = 116;
export const bannerControlGap = 12;

/**
 * Keeps a bottom banner clear of the highest bottom-navigation control.
 * Android's banner host adds the system bottom inset separately, so the
 * WebView safe inset is removed from the margin calculated from DOM geometry.
 */
export function resolveMobileBannerMargin(
  viewportHeight: number,
  exclusionTop: number | undefined,
  safeBottomInset: number,
): number {
  if (!Number.isFinite(viewportHeight) || !Number.isFinite(exclusionTop)) {
    return mobileBannerFallbackMargin;
  }

  const occupiedHeight = viewportHeight - (exclusionTop ?? viewportHeight) - Math.max(0, safeBottomInset);
  if (!Number.isFinite(occupiedHeight) || occupiedHeight <= 0) return mobileBannerFallbackMargin;
  return Math.max(mobileBannerFallbackMargin, Math.ceil(occupiedHeight + bannerControlGap));
}
