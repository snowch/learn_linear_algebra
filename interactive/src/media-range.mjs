// Copyright © 2026 Christopher Snow.
// Native media players seek with byte ranges, including while offline.
export async function mediaRangeResponse(range, response) {
  if (!range || response.status !== 200) return response;
  const match = range.trim().match(/^bytes=(\d*)-(\d*)$/);
  // A server may ignore unsupported/multiple range units and send the full body.
  if (!match || (!match[1] && !match[2])) return response;
  const body = await response.arrayBuffer(),
    length = body.byteLength;
  let start = match[1]
    ? Number(match[1])
    : Math.max(0, length - Number(match[2]));
  let end = match[1] && match[2] ? Number(match[2]) : length - 1;
  const headers = new Headers(response.headers);
  headers.delete("Content-Encoding");
  headers.set("Accept-Ranges", "bytes");
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(end) ||
    start >= length ||
    start > end ||
    (!match[1] && Number(match[2]) === 0)
  ) {
    headers.set("Content-Range", `bytes */${length}`);
    headers.set("Content-Length", "0");
    return new Response(null, { status: 416, headers });
  }
  end = Math.min(end, length - 1);
  headers.set("Content-Range", `bytes ${start}-${end}/${length}`);
  headers.set("Content-Length", String(end - start + 1));
  return new Response(body.slice(start, end + 1), { status: 206, headers });
}
