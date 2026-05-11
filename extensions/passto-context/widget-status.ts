export interface WidgetNoticeState {
  text: string;
  expiresAt: number;
}

export function truncateWidgetNotice(text: string, maxChars: number): string {
  const trimmed = text.trim();
  if (!trimmed) return "";
  if (trimmed.length <= maxChars) return trimmed;
  return `${trimmed.slice(0, Math.max(1, maxChars - 1))}…`;
}

export function isWidgetNoticeActive(notice: WidgetNoticeState | null, now = Date.now()): boolean {
  return Boolean(notice && notice.expiresAt > now && notice.text.trim());
}

export function getVisibleWidgetNotice(
  notice: WidgetNoticeState | null,
  maxChars: number,
  now = Date.now(),
): string {
  if (!isWidgetNoticeActive(notice, now)) {
    return "";
  }

  return truncateWidgetNotice(notice!.text, maxChars);
}

export function appendWidgetNotice(
  baseStatus: string,
  notice: WidgetNoticeState | null,
  maxChars: number,
  now = Date.now(),
): string {
  const visibleNotice = getVisibleWidgetNotice(notice, maxChars, now);
  if (!visibleNotice) {
    return baseStatus;
  }

  return `${baseStatus} | ${visibleNotice}`;
}
