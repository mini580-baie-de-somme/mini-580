import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";

const afterMock = vi.fn((fn: () => void | Promise<void>) => {
  void fn();
});

vi.mock("next/server", () => ({
  after: (fn: () => void | Promise<void>) => afterMock(fn),
}));

vi.mock("@/lib/db", () => ({
  prisma: {
    media: {
      update: vi.fn(),
    },
  },
}));

vi.mock("@/lib/media-library", () => ({
  collectPreviousDisplayUrls: vi.fn(() => []),
  rebakeMediaVariants: vi.fn(async () => ({
    urlPicto: "/p.webp",
    urlPetite: "/pt.webp",
    urlMoyenne: "/m.webp",
    urlGrande: "/g.webp",
  })),
  syncCoverImageUrlsAfterRebake: vi.fn(),
}));

describe("runLayoutRebake", () => {
  const originalNodeEnv = process.env.NODE_ENV;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
    vi.resetModules();
  });

  it("schedules rebake with after() in production without awaiting it", async () => {
    process.env.NODE_ENV = "production";
    const { runLayoutRebake } = await import("@/lib/layout-rebake-schedule");
    const { rebakeMediaVariants } = await import("@/lib/media-library");

    let rebakeResolved = false;
    vi.mocked(rebakeMediaVariants).mockImplementation(async () => {
      await new Promise((r) => setTimeout(r, 50));
      rebakeResolved = true;
      return {
        urlPicto: "/p.webp",
        urlPetite: "/pt.webp",
        urlMoyenne: "/m.webp",
        urlGrande: "/g.webp",
      };
    });

    const media = {
      id: "media-1",
      urlOrigin: "/media/x/origin.jpg",
      kind: "IMAGE",
    } as Parameters<typeof runLayoutRebake>[0];

    const result = await runLayoutRebake(media, { traceId: "mt-test" }, []);
    expect(result).toEqual({ mode: "async", rebakePending: true });
    expect(afterMock).toHaveBeenCalledTimes(1);
    expect(rebakeResolved).toBe(false);
  });
});
