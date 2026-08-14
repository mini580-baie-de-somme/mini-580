import { vi } from "vitest";
import { SESSION_COMPACT_USER_PROMPT } from "@/lib/telegram/session-context";

export type MockRunResult = {
  status: string;
  result?: string;
  usage?: { inputTokens?: number };
  id?: string;
  error?: { message?: string };
};

export type MockAgentHandle = {
  agentId: string;
  send: ReturnType<typeof vi.fn>;
  dispose: ReturnType<typeof vi.fn>;
};

let agentSeq = 0;

export function resetCursorAgentMockState(): void {
  agentSeq = 0;
}

export function makeMockAgent(input: {
  agentId?: string;
  onSend?: (message: string) => MockRunResult | Promise<MockRunResult>;
  waitDelayMs?: number;
}): MockAgentHandle {
  const agentId = input.agentId ?? `mock-agent-${++agentSeq}`;
  const dispose = vi.fn(async () => undefined);
  const send = vi.fn(async (message: string) => {
    const wait = vi.fn(async () => {
      if (input.waitDelayMs) {
        await new Promise((r) => setTimeout(r, input.waitDelayMs));
      }
      if (input.onSend) {
        return input.onSend(message);
      }
      return {
        status: "completed",
        result: "mock-reply",
        usage: { inputTokens: 1000 },
        id: "run-1",
      } satisfies MockRunResult;
    });
    return { wait };
  });
  return { agentId, send, dispose };
}

export function installCursorAgentMock(input?: {
  onCreate?: () => MockAgentHandle;
  onResume?: (agentId: string, message?: string) => MockAgentHandle;
}): {
  create: ReturnType<typeof vi.fn>;
  resume: ReturnType<typeof vi.fn>;
  resetDefaults: () => void;
} {
  const defaults = input ?? {};

  const create = vi.fn(async () => {
    const agent = defaults.onCreate?.() ?? makeMockAgent({});
    return {
      agentId: agent.agentId,
      send: agent.send,
      [Symbol.asyncDispose]: agent.dispose,
    };
  });

  const resume = vi.fn(async (agentId: string) => {
    const agent =
      defaults.onResume?.(agentId) ??
      makeMockAgent({
        agentId,
        onSend: (message) =>
          message === SESSION_COMPACT_USER_PROMPT
            ? { status: "completed", result: "Synthèse compaction test.", id: "compact-1" }
            : { status: "completed", result: "mock-resume-reply", usage: { inputTokens: 1000 }, id: "run-resume" },
      });
    return {
      agentId: agent.agentId,
      send: agent.send,
      [Symbol.asyncDispose]: agent.dispose,
    };
  });

  function resetDefaults() {
    create.mockReset();
    resume.mockReset();
    create.mockImplementation(async () => {
      const agent = defaults.onCreate?.() ?? makeMockAgent({});
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });
    resume.mockImplementation(async (agentId: string) => {
      const agent =
        defaults.onResume?.(agentId) ??
        makeMockAgent({
          agentId,
          onSend: (message) =>
            message === SESSION_COMPACT_USER_PROMPT
              ? { status: "completed", result: "Synthèse compaction test.", id: "compact-1" }
              : { status: "completed", result: "mock-resume-reply", usage: { inputTokens: 1000 }, id: "run-resume" },
        });
      return {
        agentId: agent.agentId,
        send: agent.send,
        [Symbol.asyncDispose]: agent.dispose,
      };
    });
  }

  resetDefaults();

  return { create, resume, resetDefaults };
}

export function isCompactPrompt(message: string): boolean {
  return message === SESSION_COMPACT_USER_PROMPT;
}
