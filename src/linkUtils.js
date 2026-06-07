// Helpers for recognizing video links so we can render them as a video tile
// (with a real thumbnail / play affordance) instead of a plain text link.

const VIDEO_FILE_RE = /\.(mp4|webm|ogg|ogv|mov|m4v|avi|mkv|m3u8)(\?|#|$)/i;
const VIDEO_HOST_RE =
  /(youtube\.com|youtu\.be|vimeo\.com|wistia\.|loom\.com|dailymotion\.com|\/stream\b|\/video\b|videomanifest)/i;

// A link that points straight at a playable video file — we can render it
// inline with a <video> element (first frame becomes the thumbnail).
export function isDirectVideo(url) {
  return VIDEO_FILE_RE.test(url || "");
}

// A link that is a video but not a direct file (YouTube, Vimeo, SharePoint
// Stream, Loom, etc.) — we show a video-styled card with a play badge.
export function isVideoLink(url) {
  if (!url) return false;
  return isDirectVideo(url) || VIDEO_HOST_RE.test(url);
}

// Best-effort YouTube thumbnail (works when the machine can reach the network).
export function youTubeThumb(url) {
  if (!url) return null;
  const m = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|v\/)|youtu\.be\/)([\w-]{11})/
  );
  return m ? `https://img.youtube.com/vi/${m[1]}/hqdefault.jpg` : null;
}
