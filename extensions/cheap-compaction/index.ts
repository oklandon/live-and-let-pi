/**
 * Cheap Compaction - runs auto-compaction summaries on a cheaper/faster
 * model than your main conversation model, instead of paying main-model
 * rates for a call whose only job is to compress old context.
 *
 * Adapted from pi's bundled examples/extensions/custom-compaction.ts (which
 * hardcodes Gemini Flash). Here the model is configurable and falls back to
 * pi's default compaction whenever the configured model can't be resolved,
 * so this extension is safe to enable even on a machine that lacks the
 * configured provider's auth.
 *
 * Configure via env vars (both optional):
 *   PI_LIVE_AND_LET_PI_COMPACTION_PROVIDER   default: "anthropic"
 *   PI_LIVE_AND_LET_PI_COMPACTION_MODEL      default: "claude-haiku-4-5"
 */

import { uuidv7 } from "@earendil-works/pi-ai";
import { complete } from "@earendil-works/pi-ai/compat";
import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { convertToLlm, serializeConversation } from "@earendil-works/pi-coding-agent";

const PROVIDER = process.env.PI_LIVE_AND_LET_PI_COMPACTION_PROVIDER || process.env.PI_TOOLKIT_COMPACTION_PROVIDER || "anthropic";
const MODEL_ID = process.env.PI_LIVE_AND_LET_PI_COMPACTION_MODEL || process.env.PI_TOOLKIT_COMPACTION_MODEL || "claude-haiku-4-5";

export default function (pi: ExtensionAPI) {
	pi.on("session_before_compact", async (event, ctx) => {
		const { preparation, signal } = event;
		const { messagesToSummarize, turnPrefixMessages, tokensBefore, firstKeptEntryId, previousSummary } = preparation;

		const model = ctx.modelRegistry.find(PROVIDER, MODEL_ID);
		if (!model) {
			ctx.ui.notify(`cheap-compaction: ${PROVIDER}/${MODEL_ID} not found, using default compaction`, "warning");
			return;
		}

		const auth = await ctx.modelRegistry.getApiKeyAndHeaders(model);
		if (!auth.ok || !auth.apiKey) {
			ctx.ui.notify(`cheap-compaction: no auth for ${PROVIDER}, using default compaction`, "warning");
			return;
		}

		const allMessages = [...messagesToSummarize, ...turnPrefixMessages];
		if (allMessages.length === 0) return;

		ctx.ui.notify(
			`cheap-compaction: summarizing ${allMessages.length} messages (${tokensBefore.toLocaleString()} tokens) with ${model.id}...`,
			"info",
		);

		const conversationText = serializeConversation(convertToLlm(allMessages));
		const previousContext = previousSummary ? `\n\nPrevious session summary for context:\n${previousSummary}` : "";

		const summaryMessages = [
			{
				role: "user" as const,
				content: [
					{
						type: "text" as const,
						text: `You are a conversation summarizer. Create a comprehensive summary of this conversation that captures:${previousContext}

1. The main goals and objectives discussed
2. Key decisions made and their rationale
3. Important code changes, file modifications, or technical details
4. Current state of any ongoing work
5. Any blockers, issues, or open questions
6. Next steps that were planned or suggested

Be thorough but concise. The summary will replace the ENTIRE conversation history, so include all information needed to continue the work effectively.

Format the summary as structured markdown with clear sections.

<conversation>
${conversationText}
</conversation>`,
					},
				],
				timestamp: Date.now(),
			},
		];

		try {
			const response = await complete(
				model,
				{ messages: summaryMessages },
				{
					apiKey: auth.apiKey,
					headers: auth.headers,
					env: auth.env,
					maxTokens: 8192,
					signal,
					cacheRetention: "none",
					sessionId: uuidv7(),
				},
			);

			const summary = response.content
				.filter((c): c is { type: "text"; text: string } => c.type === "text")
				.map((c) => c.text)
				.join("\n");

			if (!summary.trim()) {
				if (!signal.aborted) ctx.ui.notify("cheap-compaction: summary was empty, using default compaction", "warning");
				return;
			}

			return {
				compaction: {
					summary,
					firstKeptEntryId,
					tokensBefore,
					usage: response.usage,
				},
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			ctx.ui.notify(`cheap-compaction: failed (${message}), using default compaction`, "error");
			return;
		}
	});
}
