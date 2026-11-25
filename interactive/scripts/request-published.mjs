// Copyright © 2026 Christopher Snow. Retry transport failures, never verification failures.
export async function requestPublished(url, fetcher = fetch) {
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const response = await fetcher(url, {
        cache: "no-store",
        signal: AbortSignal.timeout(30000),
      });
      if (
        ![408, 425, 429, 500, 502, 503, 504].includes(response.status) ||
        attempt === 2
      )
        return response;
      await response.body?.cancel().catch(() => {});
    } catch (error) {
      if (attempt === 2) throw error;
    }
    await new Promise((resolve) => setTimeout(resolve, 200 * 2 ** attempt));
  }
}
