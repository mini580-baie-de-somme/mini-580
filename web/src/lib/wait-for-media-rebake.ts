/** Poll until server-side async rebake rotates variant URLs (client-only). */

export type RebakePollMedia = {
  id: string;
  urlMoyenne?: string | null;
  urlGrande?: string | null;
  urlPicto?: string | null;
};

export async function waitForMediaRebake<T extends RebakePollMedia>(
  mediaId: string,
  previous: Pick<RebakePollMedia, "urlMoyenne" | "urlGrande" | "urlPicto">,
  opts?: { maxMs?: number; intervalMs?: number }
): Promise<T | null> {
  const maxMs = opts?.maxMs ?? 45_000;
  const intervalMs = opts?.intervalMs ?? 1_000;
  const deadline = Date.now() + maxMs;
  const before = [
    previous.urlMoyenne,
    previous.urlGrande,
    previous.urlPicto,
  ].filter(Boolean);

  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, intervalMs));
    let res: Response;
    try {
      res = await fetch(`/api/media-library/${mediaId}`, {
        cache: "no-store",
      });
    } catch {
      continue;
    }
    if (!res.ok) continue;
    let data: T;
    try {
      data = (await res.json()) as T;
    } catch {
      continue;
    }
    const after = [data.urlMoyenne, data.urlGrande, data.urlPicto].filter(
      Boolean
    );
    const changed =
      after.length > 0 &&
      (before.length === 0 ||
        after.some((url) => !before.includes(url as string)));
    if (changed) return data;
  }
  return null;
}
