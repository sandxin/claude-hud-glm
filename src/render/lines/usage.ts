import type { RenderContext } from "../../types.js";
import { getProviderLabel } from "../../stdin.js";
import { getAdaptiveBarWidth } from "../../utils/terminal.js";
import { renderExpandedUsageContent, shouldRenderUsageData } from "../usage-display.js";

export function renderUsageLine(ctx: RenderContext): string | null {
  const usageData = ctx.usageData;
  if (!usageData || !shouldRenderUsageData(usageData, ctx.config)) {
    return null;
  }

  if (getProviderLabel(ctx.stdin)) {
    return null;
  }

  const barWidth = getAdaptiveBarWidth();
  return renderExpandedUsageContent(usageData, ctx.config, {
    colors: ctx.config?.colors,
    barWidth,
  });
}
