/** XHR multipart upload — more reliable than fetch+FormData on Safari iOS for large bodies. */

export type UploadFormDataOptions = {
  method?: "POST" | "PUT" | "PATCH";
  timeoutMs?: number;
  onProgress?: (loaded: number, total: number) => void;
};

export class UploadNetworkError extends TypeError {
  constructor(message = "Failed to fetch") {
    super(message);
    this.name = "UploadNetworkError";
  }
}

function headersFromXhr(xhr: XMLHttpRequest): Headers {
  const headers = new Headers();
  const raw = xhr.getAllResponseHeaders();
  for (const line of raw.trim().split(/[\r\n]+/)) {
    const idx = line.indexOf(":");
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    const val = line.slice(idx + 1).trim();
    if (key) headers.append(key, val);
  }
  return headers;
}

/** Upload FormData via XMLHttpRequest; resolves to a fetch-compatible Response. */
export function uploadFormData(
  url: string,
  body: FormData,
  opts?: UploadFormDataOptions
): Promise<Response> {
  if (typeof XMLHttpRequest === "undefined") {
    return fetch(url, { method: opts?.method ?? "POST", body });
  }

  const method = opts?.method ?? "POST";
  const timeoutMs = opts?.timeoutMs ?? 120_000;

  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.timeout = timeoutMs;
    xhr.responseType = "text";

    if (opts?.onProgress && xhr.upload) {
      xhr.upload.onprogress = (ev) => {
        if (ev.lengthComputable) opts.onProgress!(ev.loaded, ev.total);
      };
    }

    xhr.onload = () => {
      resolve(
        new Response(xhr.responseText, {
          status: xhr.status,
          statusText: xhr.statusText,
          headers: headersFromXhr(xhr),
        })
      );
    };

    xhr.onerror = () => reject(new UploadNetworkError());
    xhr.onabort = () => reject(new UploadNetworkError());
    xhr.ontimeout = () => reject(new UploadNetworkError());

    xhr.send(body);
  });
}
