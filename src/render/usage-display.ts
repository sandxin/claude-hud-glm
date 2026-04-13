import type { RenderContext, UsageData } from '../types.js';
import { isLimitReached } from '../types.js';
import { critical, getQuotaColor, label, quotaBar, RESET } from './colors.js';
import { t } from '../i18n/index.js';

type UsageRenderOptions = {
  colors?: RenderContext['config']['colors'];
  barWidth: number;
};

export function renderExpandedUsageContent(
  usageData: UsageData,
  config: RenderContext['config'],
  options: UsageRenderOptions,
): string | null {
  const segments = getUsageSegments(usageData, config, options, 'expanded');
  if (segments.length === 0) {
    return null;
  }
  return segments.join(' | ');
}

export function getCompactUsageParts(
  usageData: UsageData,
  config: RenderContext['config'],
  options: UsageRenderOptions,
): string[] {
  return getUsageSegments(usageData, config, options, 'compact');
}

export function shouldRenderUsageData(
  usageData: UsageData | null,
  config: RenderContext['config'],
): boolean {
  if (!usageData) {
    return false;
  }

  if (usageData.provider === 'glm') {
    return config.display?.showGlmTokenUsage !== false || config.display?.showGlmMcpUsage !== false;
  }

  return config.display?.showUsage !== false;
}

function getUsageSegments(
  usageData: UsageData,
  config: RenderContext['config'],
  {
    colors,
    barWidth,
  }: UsageRenderOptions,
  mode: 'expanded' | 'compact',
): string[] {
  if (usageData.provider === 'glm') {
    return getGlmUsageSegments(usageData, config, colors, barWidth);
  }
  return getClaudeUsageSegments(usageData, config, colors, barWidth, mode);
}

function getClaudeUsageSegments(
  usageData: Extract<UsageData, { provider: 'claude' }>,
  config: RenderContext['config'],
  colors: RenderContext['config']['colors'] | undefined,
  barWidth: number,
  mode: 'expanded' | 'compact',
): string[] {
  const usageLabel = label(t('label.usage'), colors);

  if (isLimitReached(usageData)) {
    const resetTime = usageData.fiveHour === 100
      ? formatRelativeResetTime(usageData.fiveHourResetAt)
      : formatRelativeResetTime(usageData.sevenDayResetAt);
    const warning = critical(`⚠ ${t('status.limitReached')}${resetTime ? ` (${t('format.resets')} ${resetTime})` : ''}`, colors);
    return mode === 'expanded' ? [`${usageLabel} ${warning}`] : [warning];
  }

  const threshold = config.display?.usageThreshold ?? 0;
  const fiveHour = usageData.fiveHour;
  const sevenDay = usageData.sevenDay;
  const effectiveUsage = Math.max(fiveHour ?? 0, sevenDay ?? 0);
  if (effectiveUsage < threshold) {
    return [];
  }

  const usageBarEnabled = config.display?.usageBarEnabled ?? true;
  const sevenDayThreshold = config.display?.sevenDayThreshold ?? 80;

  if (fiveHour === null && sevenDay !== null) {
    const weeklyOnlyPart = formatClaudeUsageWindowPart({
      label: t('label.weekly'),
      percent: sevenDay,
      resetAt: usageData.sevenDayResetAt,
      colors,
      usageBarEnabled,
      barWidth,
      forceLabel: true,
    });
    return mode === 'expanded' ? [`${usageLabel} ${weeklyOnlyPart}`] : [weeklyOnlyPart];
  }

  const fiveHourPart = formatClaudeUsageWindowPart({
    label: '5h',
    percent: fiveHour,
    resetAt: usageData.fiveHourResetAt,
    colors,
    usageBarEnabled,
    barWidth,
  });

  if (sevenDay !== null && sevenDay >= sevenDayThreshold) {
    const sevenDayPart = formatClaudeUsageWindowPart({
      label: t('label.weekly'),
      percent: sevenDay,
      resetAt: usageData.sevenDayResetAt,
      colors,
      usageBarEnabled,
      barWidth,
      forceLabel: true,
    });
    return [`${usageLabel} ${fiveHourPart}`, sevenDayPart];
  }

  return [`${usageLabel} ${fiveHourPart}`];
}

function getGlmUsageSegments(
  usageData: Extract<UsageData, { provider: 'glm' }>,
  config: RenderContext['config'],
  colors: RenderContext['config']['colors'] | undefined,
  barWidth: number,
): string[] {
  const segments: string[] = [];
  const threshold = config.display?.usageThreshold ?? 0;
  const effectiveUsage = Math.max(usageData.tokensPercent ?? 0, usageData.mcpPercent ?? 0);
  if (effectiveUsage < threshold) {
    return [];
  }

  const glmBarEnable = config.display?.glmBarEnable ?? true;

  if (config.display?.showGlmTokenUsage !== false) {
    segments.push(formatGlmUsageWindowPart({
      label: 'GLM 5h',
      percent: usageData.tokensPercent,
      resetAt: usageData.tokenResetAt,
      colors,
      barEnabled: glmBarEnable,
      barWidth,
      resetFormatter: formatTimeReset,
    }));
  }

  if (config.display?.showGlmMcpUsage !== false) {
    segments.push(formatGlmUsageWindowPart({
      label: 'MCP',
      percent: usageData.mcpPercent,
      resetAt: usageData.mcpResetAt,
      colors,
      barEnabled: glmBarEnable,
      barWidth,
      resetFormatter: formatDateReset,
    }));
  }

  return segments;
}

function formatUsagePercent(
  percent: number | null,
  colors?: RenderContext['config']['colors'],
): string {
  if (percent === null) {
    return label('--', colors);
  }
  const color = getQuotaColor(percent, colors);
  return `${color}${percent}%${RESET}`;
}

function formatClaudeUsageWindowPart({
  label: windowLabel,
  percent,
  resetAt,
  colors,
  usageBarEnabled,
  barWidth,
  forceLabel = false,
}: {
  label: string;
  percent: number | null;
  resetAt: Date | null;
  colors?: RenderContext['config']['colors'];
  usageBarEnabled: boolean;
  barWidth: number;
  forceLabel?: boolean;
}): string {
  const usageDisplay = formatUsagePercent(percent, colors);
  const reset = formatRelativeResetTime(resetAt);
  const styledLabel = label(windowLabel, colors);

  if (usageBarEnabled) {
    const body = reset
      ? `${quotaBar(percent ?? 0, barWidth, colors)} ${usageDisplay} (${t('format.resetsIn')} ${reset})`
      : `${quotaBar(percent ?? 0, barWidth, colors)} ${usageDisplay}`;
    return forceLabel ? `${styledLabel} ${body}` : body;
  }

  return reset
    ? `${styledLabel} ${usageDisplay} (${t('format.resetsIn')} ${reset})`
    : `${styledLabel} ${usageDisplay}`;
}

function formatGlmUsageWindowPart({
  label: windowLabel,
  percent,
  resetAt,
  colors,
  barEnabled,
  barWidth,
  resetFormatter,
}: {
  label: string;
  percent: number | null;
  resetAt: Date | null;
  colors?: RenderContext['config']['colors'];
  barEnabled: boolean;
  barWidth: number;
  resetFormatter: (date: Date | null) => string;
}): string {
  const styledLabel = label(windowLabel, colors);
  const usageDisplay = formatUsagePercent(percent, colors);
  const resetDisplay = resetFormatter(resetAt);

  if (barEnabled) {
    return resetDisplay
      ? `${styledLabel} ${quotaBar(percent ?? 0, barWidth, colors)} ${usageDisplay} ${resetDisplay}`
      : `${styledLabel} ${quotaBar(percent ?? 0, barWidth, colors)} ${usageDisplay}`;
  }

  return resetDisplay
    ? `${styledLabel}: ${usageDisplay} ${resetDisplay}`
    : `${styledLabel}: ${usageDisplay}`;
}

function formatRelativeResetTime(resetAt: Date | null): string {
  if (!resetAt) {
    return '';
  }

  const now = new Date();
  const diffMs = resetAt.getTime() - now.getTime();
  if (diffMs <= 0) {
    return '';
  }

  const diffMins = Math.ceil(diffMs / 60000);
  if (diffMins < 60) {
    return `${diffMins}m`;
  }

  const hours = Math.floor(diffMins / 60);
  const mins = diffMins % 60;

  if (hours >= 24) {
    const days = Math.floor(hours / 24);
    const remainingHours = hours % 24;
    if (remainingHours > 0) {
      return `${days}d ${remainingHours}h`;
    }
    return `${days}d`;
  }

  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

function formatTimeReset(resetAt: Date | null): string {
  if (!resetAt) {
    return '';
  }
  return `${String(resetAt.getHours()).padStart(2, '0')}:${String(resetAt.getMinutes()).padStart(2, '0')}`;
}

function formatDateReset(resetAt: Date | null): string {
  if (!resetAt) {
    return '';
  }
  return `${String(resetAt.getMonth() + 1).padStart(2, '0')}-${String(resetAt.getDate()).padStart(2, '0')}`;
}
