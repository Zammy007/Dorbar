export class ApiError extends Error {
  status: number;
  data?: unknown;
  constructor(message: string, status: number, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

export async function apiRequest<T>(
  url: string,
  options: {
    method?: string;
    body?: unknown;
    token?: string | null;
  } = {}
): Promise<T> {
  const headers: Record<string, string> = {};
  if (options.body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (options.token) {
    headers['Authorization'] = `Bearer ${options.token}`;
  }

  const res = await fetch(url, {
    method: options.method ?? 'GET',
    headers,
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
  });

  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }

  if (!res.ok) {
    throw new ApiError(
      json?.error || `Request failed (${res.status})`,
      res.status,
      json
    );
  }

  return json as T;
}

export function apiUploadWithProgress<T>(
  url: string,
  formData: FormData,
  token: string,
  method: 'POST' | 'PATCH' = 'POST',
  onProgress?: (percent: number) => void
): Promise<T> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open(method, url);
    xhr.setRequestHeader('Authorization', `Bearer ${token}`);

    xhr.upload.addEventListener('progress', (event) => {
      if (event.lengthComputable && onProgress) {
        onProgress(Math.round((event.loaded / event.total) * 100));
      }
    });

    xhr.addEventListener('load', () => {
      let json: any = null;
      try {
        json = xhr.responseText ? JSON.parse(xhr.responseText) : null;
      } catch {
        json = null;
      }
      if (xhr.status >= 200 && xhr.status < 300) {
        resolve(json as T);
      } else {
        reject(new ApiError(json?.error || `Upload failed (${xhr.status})`, xhr.status, json));
      }
    });

    xhr.addEventListener('error', () => {
      reject(new ApiError('Network error while uploading file.', 0));
    });

    xhr.send(formData);
  });
}

export async function triggerDocumentDownload(
  docId: number,
  fallbackFilename: string,
  studentToken?: string | null
): Promise<void> {
  const url = `/api/documents/${docId}/download`;

  if (!studentToken) {
    const link = document.createElement('a');
    link.href = url;
    link.download = fallbackFilename;
    link.rel = 'noopener';
    document.body.appendChild(link);
    link.click();
    link.remove();
    return;
  }

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${studentToken}` },
  });
  if (!res.ok) {
    throw new Error('Could not download document.');
  }
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = objectUrl;
  link.download = fallbackFilename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(objectUrl), 15000);
}
