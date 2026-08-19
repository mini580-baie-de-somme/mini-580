import type { MediaVariantUrls } from "@/lib/media-variants";

/** Media row already registered after a Telegram photo upload. */
export type TelegramInboundMedia = MediaVariantUrls & {
  mediaId: string;
};

export function formatTelegramInboundMediaBlock(
  items: TelegramInboundMedia[]
): string {
  if (!items.length) return "";

  const lines = items.map((item, index) => {
    const header = `${index + 1}. mediaId=${item.mediaId}`;
    const urls = [
      `urlOrigin=${item.urlOrigin}`,
      `urlPicto=${item.urlPicto}`,
      `urlPetite=${item.urlPetite}`,
      `urlMoyenne=${item.urlMoyenne}`,
      `urlGrande=${item.urlGrande}`,
    ];
    return `${header}\n   ${urls.join("\n   ")}`;
  });

  return [
    "",
    "Médias Telegram (déjà enregistrés en médiathèque — NE PAS rappeler media.create) :",
    "Utilise media.attach avec mediaIds ou le mediaId ci-dessous.",
    ...lines,
  ].join("\n");
}
