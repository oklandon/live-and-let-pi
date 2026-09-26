/**
 * Context Status - always-on footer showing cumulative cost, prompt-cache
 * hit rate, and how close the current context is to triggering compaction.
 *
 * Built on the documented ctx.ui.setFooter() API (see pi's bundled
 * examples/extensions/custom-footer.ts) plus ctx.getContextUsage() and the
 * per-message usage fields (usage.input/output/cacheRead/cacheWrite/cost).
 *
 * Cache hit rate = cacheRead / (input + cacheRead): the fraction of input
 * tokens served from the prompt cache instead of billed fresh. A low number
 * across a long session usually means cache writes are being invalidated
 * (context mutated too early in the prompt) rather than a caching bug.
 *
 * Usage: on by default. Toggle with /context-status.
 */

import type { AssistantMessage } from "@earendil-works/pi-ai";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { truncateToWidth, visibleWidth } from "@earendil-works/pi-tui";

function formatTokens(count: number): string {
	if (count < 1000) return `${count}`;
	if (count < 10000) return `${(count / 1000).toFixed(1)}k`;
	return `${Math.round(count / 1000)}k`;
}

function buildFooter(ctx: any) {
	return (tui: any, theme: any, footerData: any) => {
		const unsub = footerData.onBranchChange(() => tui.requestRender());

		return {
			dispose: unsub,
			invalidate() {},
			render(width: number): string[] {
				let input = 0;
				let output = 0;
				let cacheRead = 0;
				let cacheWrite = 0;
				let cost = 0;

				for (const e of ctx.sessionManager.getBranch()) {
					if (e.type === "message" && e.message.role === "assistant") {
						const m = e.message as AssistantMessage;
						input += m.usage.input;
						output += m.usage.output;
						cacheRead += m.usage.cacheRead ?? 0;
						cacheWrite += m.usage.cacheWrite ?? 0;
						cost += m.usage.cost?.total ?? 0;
					}
				}

				const cacheableInput = input + cacheRead;
				const cacheHitRate = cacheableInput > 0 ? Math.round((cacheRead / cacheableInput) * 100) : null;

				const contextUsage = ctx.getContextUsage?.();
				const contextWindow = ctx.model?.contextWindow as number | undefined;
				const contextPct =
					contextUsage?.tokens && contextWindow ? Math.round((contextUsage.tokens / contextWindow) * 100) : null;

				const parts = [
					`↑${formatTokens(input)} ↓${formatTokens(output)}`,
					cacheHitRate !== null ? `cache:${cacheHitRate}%` : undefined,
					`$${cost.toFixed(3)}`,
				].filter(Boolean);
				const left = theme.fg("dim", parts.join(" "));

				const contextColor = contextPct !== null && contextPct >= 80 ? "warning" : "dim";
				const contextStr = contextPct !== null ? theme.fg(contextColor, `ctx:${contextPct}%`) : "";
				const branch = footerData.getGitBranch();
				const branchStr = branch ? ` (${branch})` : "";
				const right = contextStr + theme.fg("dim", `${contextStr ? " " : ""}${ctx.model?.id || "no-model"}${branchStr}`);

				const pad = " ".repeat(Math.max(1, width - visibleWidth(left) - visibleWidth(right)));
				return [truncateToWidth(left + pad + right, width)];
			},
		};
	};
}

export default function (pi: ExtensionAPI) {
	let enabled = true;

	pi.on("session_start", async (_event, ctx) => {
		if (enabled) ctx.ui.setFooter(buildFooter(ctx));
	});

	pi.registerCommand("context-status", {
		description: "Toggle the cost / cache-hit-rate / context-usage footer",
		handler: async (_args, ctx) => {
			enabled = !enabled;
			ctx.ui.setFooter(enabled ? buildFooter(ctx) : undefined);
			ctx.ui.notify(enabled ? "Context status footer enabled" : "Default footer restored", "info");
		},
	});
}
