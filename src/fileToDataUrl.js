export function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

// Reads an image file and downscales it to keep embedded data URLs (and the
// exported .obp.json) lean. Caps the longest edge to `maxWidth` and re-encodes.
// Animated GIFs and non-images are passed through untouched (canvas would
// flatten a GIF). Images already small enough keep their original bytes so we
// never upscale or needlessly re-compress.
export function imageFileToDataUrl(file, maxWidth = 1600, quality = 0.85) {
  if (!file || file.type === "image/gif" || !file.type?.startsWith("image/")) {
    return fileToDataUrl(file);
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const original = reader.result;
      const img = new Image();
      img.onload = () => {
        const longest = Math.max(img.naturalWidth, img.naturalHeight);
        const scale = Math.min(1, maxWidth / longest);
        if (!isFinite(scale) || scale >= 1) {
          resolve(original); // already small enough — keep as-is
          return;
        }
        try {
          const w = Math.round(img.naturalWidth * scale);
          const h = Math.round(img.naturalHeight * scale);
          const canvas = document.createElement("canvas");
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, w, h);
          // Preserve PNG (transparency-safe); JPEG stays JPEG with compression.
          const outType = file.type === "image/jpeg" ? "image/jpeg" : "image/png";
          const out = canvas.toDataURL(outType, outType === "image/jpeg" ? quality : undefined);
          // Guard against canvas producing something larger than the original.
          resolve(out && out.length < original.length ? out : original);
        } catch {
          resolve(original);
        }
      };
      img.onerror = () => resolve(original);
      img.src = original;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}
