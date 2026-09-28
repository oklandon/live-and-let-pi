import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { Type } from "typebox";

interface GrillState {
  active: boolean;
  topic: string;
  checkpoint: string;
  questionsAsked: number;
  updatedAt: number;
}

const DEFAULT_STATE: GrillState = {
  active: false,
  topic: "",
  checkpoint: "",
  questionsAsked: 0,
  updatedAt: Date.now(),
};

// Store state in memory during session
let grillState: GrillState = { ...DEFAULT_STATE };

const GRILL_SYSTEM_PROMPT = `You are a Socratic interviewer helping to deeply understand a topic before proceeding with work.

Your role:
1. Ask ONE focused, open-ended question at a time
2. Listen carefully and build on the user's responses
3. Maintain a shared understanding checkpoint
4. Track decisions and assumptions
5. Identify gaps in understanding
6. Ask clarifying follow-ups before moving on
7. Help the user reach clarity and confidence

Style:
- Be curious and non-judgmental
- Ask "why" and "how" to dig deeper
- Help the user think through implications
- Avoid jumping to solutions
- Build consensus on understanding before decisions

When the user indicates readiness or asks to finish, guide them through:
1. Summarizing the shared understanding
2. Confirming key decisions and assumptions
3. Identifying next steps
4. Asking what outputs would be valuable`;

export default function (pi: ExtensionAPI) {
  // Register the /grill command
  pi.registerCommand("grill", {
    description: "Start or manage a Socratic planning session",
    parameters: Type.Object({
      action: Type.Optional(Type.Union([
        Type.Literal("start"),
        Type.Literal("stop"),
        Type.Literal("checkpoint"),
        Type.Literal("status"),
        Type.Literal("continue"),
      ])),
      topic: Type.Optional(Type.String()),
    }),
    handler: async (input, ctx) => {
      const args = (input as any) || {};
      const action = args.action || "start";
      const topic = args.topic || "";

      if (action === "start") {
        return handleGrillStart(pi, ctx, topic);
      } else if (action === "stop") {
        return handleGrillStop(ctx);
      } else if (action === "checkpoint") {
        return handleCheckpoint(ctx);
      } else if (action === "status") {
        return handleGrillStatus(ctx);
      } else if (action === "continue") {
        return handleGrillContinue(pi, ctx);
      }
    },
  });

  // Listen for agent_before_settle to inject grill instructions
  pi.on("before_agent_start", async (event) => {
    if (grillState.active) {
      // Inject grill mode instructions into the system prompt
      let systemPrompt = event.systemPrompt || "";
      
      if (!systemPrompt.includes("GRILL MODE ACTIVE")) {
        systemPrompt += `\n\n## GRILL MODE ACTIVE\n\n${GRILL_SYSTEM_PROMPT}`;
        systemPrompt += `\n\nCurrent Topic: ${grillState.topic}`;
        systemPrompt += `\n\nShared Understanding Checkpoint:\n${grillState.checkpoint || "(Starting fresh...)"}`;
      }
      
      event.systemPrompt = systemPrompt;
      event.forceSystemPrompt = true;
    }
  });

  async function handleGrillStart(pi: ExtensionAPI, ctx: ExtensionContext, topic: string) {
    if (!topic) {
      // Ask the user for a topic
      const result = await ctx.ui.editor({
        title: "Start Grill Session",
        placeholder: "What topic would you like to deeply understand?",
        defaultValue: "",
      });

      if (!result) {
        ctx.ui.notify("Grill session cancelled", "info");
        return;
      }

      topic = result;
    }

    grillState = {
      active: true,
      topic: topic.trim(),
      checkpoint: `# Shared Understanding\n\n## Topic\n${topic.trim()}\n\n## Starting Questions\n- What do we need to understand about this?\n- What are the key constraints?\n- Who are the stakeholders?`,
      questionsAsked: 0,
      updatedAt: Date.now(),
    };

    ctx.ui.notify(
      `🔥 Grill session started: "${grillState.topic}"\n\nI'll ask focused questions to build shared understanding.\n\nUse \`/grill checkpoint\` to review our progress, \`/grill status\` for details, or \`/grill stop\` when done.`,
      "info"
    );

    // Send an initial message to the assistant
    await pi.sendMessage({
      role: "user",
      content: `I want to start a grill session on: "${topic}"\n\nPlease begin by asking your first focused, open-ended question to help us deeply understand this topic.`,
    });
  }

  async function handleGrillStop(ctx: ExtensionContext) {
    if (!grillState.active) {
      ctx.ui.notify("No active grill session", "info");
      return;
    }

    const topic = grillState.topic;
    const checkpoint = grillState.checkpoint;

    grillState = { ...DEFAULT_STATE };

    ctx.ui.notify(
      `✓ Grill session ended: "${topic}"\n\nFinal checkpoint:\n\n${checkpoint}`,
      "success"
    );
  }

  async function handleCheckpoint(ctx: ExtensionContext) {
    if (!grillState.active) {
      ctx.ui.notify("No active grill session", "info");
      return;
    }

    const checkpoint = grillState.checkpoint || "(empty)";
    await ctx.ui.custom(
      "Checkpoint",
      async (ui) => {
        return ui.panel({
          border: "rounded",
          padding: [1, 2],
          children: [
            ui.text(checkpoint, { wrap: true }),
          ],
        });
      }
    );
  }

  async function handleGrillStatus(ctx: ExtensionContext) {
    if (!grillState.active) {
      ctx.ui.notify("No active grill session", "info");
      return;
    }

    const status = `
Grill Session Status
═══════════════════

Topic: "${grillState.topic}"
Status: ACTIVE
Questions asked: ${grillState.questionsAsked}
Started: ${new Date(grillState.updatedAt).toLocaleString()}

Commands:
  /grill checkpoint - View the shared understanding checkpoint
  /grill stop       - End the grill session
  /grill continue   - Resume asking questions
`;

    ctx.ui.notify(status, "info");
  }

  async function handleGrillContinue(pi: ExtensionAPI, ctx: ExtensionContext) {
    if (!grillState.active) {
      ctx.ui.notify("No active grill session to continue", "info");
      return;
    }

    grillState.questionsAsked++;
    grillState.updatedAt = Date.now();

    await pi.sendMessage({
      role: "user",
      content: `Continue the grill session. Ask your next focused question about "${grillState.topic}", based on what we've discussed so far. Help us go deeper into understanding.`,
    });
  }
}
