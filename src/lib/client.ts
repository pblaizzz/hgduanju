export async function fetchApi<T>(url: string, signal?: AbortSignal): Promise<T> {
  const response = await fetch(url, { signal });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error?.message || '加载失败，请稍后再试。');
  return body as T;
}
