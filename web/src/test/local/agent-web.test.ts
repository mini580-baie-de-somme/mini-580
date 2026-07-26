import { describe, expect, it, vi, afterEach } from "vitest";
import {
  assertPublicHttpUrl,
  agentWebFetch,
  agentWebSearch,
  isTelegramAgentWebEnabled,
} from "@/lib/agent-web";

describe("agent-web", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("isTelegramAgentWebEnabled respects env", () => {
    vi.stubEnv("TELEGRAM_AGENT_WEB_ENABLED", undefined);
    expect(isTelegramAgentWebEnabled()).toBe(false);
    vi.stubEnv("TELEGRAM_AGENT_WEB_ENABLED", "true");
    expect(isTelegramAgentWebEnabled()).toBe(true);
    vi.stubEnv("TELEGRAM_AGENT_WEB_ENABLED", "1");
    expect(isTelegramAgentWebEnabled()).toBe(true);
  });

  it("assertPublicHttpUrl blocks private hosts", () => {
    expect(() => assertPublicHttpUrl("http://127.0.0.1/x")).toThrow(/privé|local/i);
    expect(() => assertPublicHttpUrl("http://192.168.1.1/x")).toThrow();
    expect(assertPublicHttpUrl("https://example.com/path").hostname).toBe("example.com");
  });

  it("agentWebSearch parses DDG html", async () => {
    const html = `
      <a class="result__a" href="https://example.com/a">First result</a>
      <a class="result__snippet">Snippet one</a>
      <a class="result__a" href="https://example.org/b">Second</a>
    `;
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => new Response(html, { status: 200 }))
    );
    const out = await agentWebSearch("test query");
    expect(out.ok).toBe(true);
    expect(out.results.length).toBeGreaterThanOrEqual(1);
    expect(out.results[0].url).toContain("example.com");
  });

  it("agentWebFetch strips html", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () =>
        new Response("<html><body><p>Hello</p><script>x</script></body></html>", {
          status: 200,
          headers: { "content-type": "text/html" },
        })
      )
    );
    const out = await agentWebFetch("https://example.com/page");
    expect(out.ok).toBe(true);
    expect(out.text).toContain("Hello");
    expect(out.text).not.toContain("script");
  });
});
