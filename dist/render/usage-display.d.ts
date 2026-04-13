import type { RenderContext, UsageData } from '../types.js';
type UsageRenderOptions = {
    colors?: RenderContext['config']['colors'];
    barWidth: number;
};
export declare function renderExpandedUsageContent(usageData: UsageData, config: RenderContext['config'], options: UsageRenderOptions): string | null;
export declare function getCompactUsageParts(usageData: UsageData, config: RenderContext['config'], options: UsageRenderOptions): string[];
export declare function shouldRenderUsageData(usageData: UsageData | null, config: RenderContext['config']): boolean;
export {};
//# sourceMappingURL=usage-display.d.ts.map