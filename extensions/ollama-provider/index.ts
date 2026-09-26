/**
 * Ollama Provider - registers locally running Ollama models with pi,
 * portable across machines: it probes the local Ollama server at startup
 * and only registers the provider when one actually answers, so the same
 * package works whether or not a given machine has Ollama running.
 *
 * Ollama exposes an OpenAI-compatible endpoint (`/v1/models`, `/v1/chat/completions`),
 * so this uses pi's `openai-completions` API type rather than a custom
 * streaming implementation. See docs/custom-provider.md and docs/models.md
 * in the pi-coding-agent package for the underlying mechanisms.
 *
 * Configure via env vars (both optional):
 *   OLLAMA_BASE_URL   default: "http://127.0.0.1:11434/v1"
 *   PI_TOOLKIT_OLLAMA_PROBE_TIMEOUT_MS   default: 300
 */

import type { ExtensionAPI } from "@earendil-works/pi-coding-agent";

const BASE_URL = process.env.OLLAMA_BASE_URL || "http://127.0.0.1:11434/v1";
const PROBE_TIMEOUT_MS = Number(process.env.PI_TOOLKIT_OLLAMA_PROBE_TIMEOUT_MS) || 300;

interface OllamaModel {
	id: string;
}

async function probeModels(): Promise<OllamaModel[] | null> {
	const controller = new AbortController();
	const timeout = setTimeout(() => controller.abort(), PROBE_TIMEOUT_MS);
	try {
		const response = await fetch(`${BASE_URL}/models`, { signal: controller.signal });
		if (!response.ok) return null;
		const payload = (await response.json()) as { data?: OllamaModel[] };
		return payload.data ?? [];
	} catch {
		return null;
	} finally {
		clearTimeout(timeout);
	}
}

export default async function (pi: ExtensionAPI) {
	const models = await probeModels();
	if (models === null) return; // Ollama not reachable on this machine; register nothing.

	pi.registerProvider("ollama", {
		name: "Ollama (local)",
		baseUrl: BASE_URL,
		apiKey: "ollama", // Ollama ignores the key; pi requires a non-empty value to treat the provider as authenticated.
		api: "openai-completions",
		compat: {
			// Most locally-served models don't understand the "developer" role or reasoning_effort.
			supportsDeveloperRole: false,
			supportsReasoningEffort: false,
		},
		models: models.map((m) => ({
			id: m.id,
			name: m.id,
			reasoning: false,
			input: ["text"] as const,
			cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 },
			// Ollama's OpenAI-compat /v1/models doesn't report context window or max
			// output tokens; these are conservative defaults. Override per model in
			// ~/.pi/agent/models.json (providers.ollama.modelOverrides) if a model
			// supports more.
			contextWindow: 8192,
			maxTokens: 4096,
		})),
	});
}
