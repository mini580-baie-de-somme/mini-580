/** Search-param keys for virtual modal / overlay URLs (browser back closes overlay). */

export const VIRTUAL_PARAM_PHOTO = "photo";
export const VIRTUAL_PARAM_COVER = "cover";
export const VIRTUAL_PARAM_LIBRARY = "library";
export const VIRTUAL_PARAM_MEDIA = "media";
export const VIRTUAL_PARAM_VIEW = "view";

export const PHOTO_MODAL_PARAM_KEYS = [
  VIRTUAL_PARAM_PHOTO,
  VIRTUAL_PARAM_COVER,
  VIRTUAL_PARAM_LIBRARY,
] as const;

export const MEDIA_EDIT_PARAM_KEYS = [VIRTUAL_PARAM_MEDIA] as const;

export const GALLERY_VIEW_PARAM_KEYS = [VIRTUAL_PARAM_VIEW] as const;

export type SearchParamsInput =
  | URLSearchParams
  | { get: (key: string) => string | null; toString: () => string }
  | string;

export type PhotoModalState =
  | { kind: "closed" }
  | { kind: "add" }
  | { kind: "edit"; imageId: string }
  | { kind: "add-cover" }
  | { kind: "edit-cover"; imageId: string }
  | { kind: "pick-library" };

function toSearchParams(input: SearchParamsInput): URLSearchParams {
  if (typeof input === "string") return new URLSearchParams(input);
  return new URLSearchParams(input.toString());
}

/** Parse PostGalleryEditor modal state from URL search params. */
export function parsePhotoModalState(input: SearchParamsInput): PhotoModalState {
  const params = toSearchParams(input);

  if (params.get(VIRTUAL_PARAM_LIBRARY) === "1") {
    return { kind: "pick-library" };
  }

  const cover = params.get(VIRTUAL_PARAM_COVER) === "1";
  const photo = params.get(VIRTUAL_PARAM_PHOTO);

  if (cover) {
    if (photo && photo !== "new") {
      return { kind: "edit-cover", imageId: photo };
    }
    return { kind: "add-cover" };
  }

  if (photo === "new") return { kind: "add" };
  if (photo) return { kind: "edit", imageId: photo };

  return { kind: "closed" };
}

/** Serialize PostGalleryEditor modal state to a URL patch (`null` removes key). */
export function serializePhotoModalState(
  state: PhotoModalState
): Record<string, string | null> {
  switch (state.kind) {
    case "closed":
      return {
        [VIRTUAL_PARAM_PHOTO]: null,
        [VIRTUAL_PARAM_COVER]: null,
        [VIRTUAL_PARAM_LIBRARY]: null,
      };
    case "add":
      return {
        [VIRTUAL_PARAM_PHOTO]: "new",
        [VIRTUAL_PARAM_COVER]: null,
        [VIRTUAL_PARAM_LIBRARY]: null,
      };
    case "edit":
      return {
        [VIRTUAL_PARAM_PHOTO]: state.imageId,
        [VIRTUAL_PARAM_COVER]: null,
        [VIRTUAL_PARAM_LIBRARY]: null,
      };
    case "add-cover":
      return {
        [VIRTUAL_PARAM_PHOTO]: null,
        [VIRTUAL_PARAM_COVER]: "1",
        [VIRTUAL_PARAM_LIBRARY]: null,
      };
    case "edit-cover":
      return {
        [VIRTUAL_PARAM_PHOTO]: state.imageId,
        [VIRTUAL_PARAM_COVER]: "1",
        [VIRTUAL_PARAM_LIBRARY]: null,
      };
    case "pick-library":
      return {
        [VIRTUAL_PARAM_LIBRARY]: "1",
        [VIRTUAL_PARAM_PHOTO]: null,
        [VIRTUAL_PARAM_COVER]: null,
      };
  }
}

/** Parse media-library edit overlay (`media=new` or `media=<id>`). */
export function parseMediaEditState(input: SearchParamsInput): string | null {
  return toSearchParams(input).get(VIRTUAL_PARAM_MEDIA);
}

export function serializeMediaEditState(
  editingId: string | null
): Record<string, string | null> {
  return { [VIRTUAL_PARAM_MEDIA]: editingId };
}

/** Parse public gallery slideshow (`view=<photoId>`). */
export function parseGalleryViewState(input: SearchParamsInput): string | null {
  return toSearchParams(input).get(VIRTUAL_PARAM_VIEW);
}

export function serializeGalleryViewState(
  photoId: string | null
): Record<string, string | null> {
  return { [VIRTUAL_PARAM_VIEW]: photoId };
}

export function buildVirtualUrl(
  pathname: string,
  searchParams: SearchParamsInput,
  patch: Record<string, string | null | undefined>,
  keysToClear: readonly string[] = []
): string {
  const params = toSearchParams(searchParams);

  for (const key of keysToClear) {
    params.delete(key);
  }

  for (const [key, value] of Object.entries(patch)) {
    if (value === null || value === undefined || value === "") {
      params.delete(key);
    } else {
      params.set(key, value);
    }
  }

  const qs = params.toString();
  return qs ? `${pathname}?${qs}` : pathname;
}

type RouterLike = {
  back: () => void;
  replace: (url: string, options?: { scroll?: boolean }) => void;
};

/** Close overlay: history.back when opened via push, else replace without virtual keys. */
export function closeVirtualUrl(
  router: RouterLike,
  pathname: string,
  searchParams: SearchParamsInput,
  keysToClear: readonly string[],
  openedViaPush: boolean
): void {
  if (openedViaPush) {
    router.back();
    return;
  }
  const url = buildVirtualUrl(pathname, searchParams, {}, keysToClear);
  router.replace(url, { scroll: false });
}
