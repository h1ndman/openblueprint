import React, { useRef } from "react";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function Cell({ accent, content, onChange, onCommit, onImageClick }) {
  const c = content || {};
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const hasContent = c.text != null || c.imageUrl || c.videoUrl || c.linkUrl;

  const update = (patch, coalesceKey) =>
    onChange({ ...c, ...patch }, coalesceKey);

  // A cell holds one kind of content at a time, except text + link which may
  // share a cell. Adding image/video clears text & link (and vice versa).
  const NO_MEDIA = { imageUrl: "", videoUrl: "", videoName: "" };
  const NO_TEXT_LINK = { text: undefined, linkUrl: "", linkLabel: "" };

  const addText = () => update({ ...NO_MEDIA, text: c.text ?? "" });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    update({ ...NO_TEXT_LINK, videoUrl: "", videoName: "", imageUrl: dataUrl });
    e.target.value = "";
  };

  const handleUploadVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Embed as a data URL so the video persists and travels inside saved files.
    const dataUrl = await fileToDataUrl(file);
    update({ ...NO_TEXT_LINK, imageUrl: "", videoUrl: dataUrl, videoName: file.name });
    e.target.value = "";
  };

  const handleAddLink = () => {
    const url = window.prompt("Link URL (e.g. https://...)", c.linkUrl || "https://");
    if (url == null) return;
    if (url.trim() === "") {
      update({ linkUrl: "", linkLabel: "" });
      return;
    }
    const label = window.prompt("Link label (optional)", c.linkLabel || "") || url;
    update({ ...NO_MEDIA, linkUrl: url.trim(), linkLabel: label.trim() });
  };

  const clearCell = () => onChange({}, null);

  const hasMedia = !!(c.imageUrl || c.videoUrl);

  const TOOLS = {
    text: ["T", "Add / edit text", addText],
    image: ["▣", "Upload image", () => fileInputRef.current?.click()],
    video: ["▶", "Upload video", () => videoInputRef.current?.click()],
    link: ["🔗", "Add / edit link", handleAddLink],
  };

  const tools = (types) =>
    types.map((t) => (
      <button key={t} className="cell-tool" title={TOOLS[t][1]} onClick={TOOLS[t][2]}>
        {TOOLS[t][0]}
      </button>
    ));

  return (
    <div className="cell" style={{ "--accent": accent }}>
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        hidden
        onChange={handleUpload}
      />
      <input
        ref={videoInputRef}
        type="file"
        accept="video/*"
        hidden
        onChange={handleUploadVideo}
      />

      {hasContent && (
        <div className="cell-popover">
          {!hasMedia && tools(["text", "link"])}
          {!hasMedia && c.text != null && (
            <>
              <span className="cell-tool-sep" />
              {[
                ["s", "Small text"],
                ["m", "Medium text"],
                ["l", "Large text"],
              ].map(([s, label]) => (
                <button
                  key={s}
                  className={`cell-tool ${(c.textSize || "m") === s ? "active" : ""}`}
                  title={label}
                  onClick={() => update({ textSize: s })}
                >
                  {s.toUpperCase()}
                </button>
              ))}
            </>
          )}
          {!hasMedia && <span className="cell-tool-sep" />}
          <button
            className="cell-tool danger"
            title={hasMedia ? "Remove (clear to swap)" : "Clear cell"}
            onClick={clearCell}
          >
            ×
          </button>
        </div>
      )}

      {!hasContent && (
        <div className="cell-empty">
          <span className="cell-empty-plus">+</span>
          <div className="cell-empty-actions">
            {tools(["text", "image", "video", "link"])}
          </div>
        </div>
      )}

      {c.imageUrl && (
        <div className="cell-image-wrap">
          <img
            className="cell-image"
            src={c.imageUrl}
            alt=""
            title="Click to view"
            onClick={() => onImageClick?.()}
          />
        </div>
      )}

      {c.videoUrl && (
        <div className="cell-image-wrap">
          <video className="cell-video" src={c.videoUrl} controls preload="metadata" />
        </div>
      )}

      {(c.text != null && c.text !== undefined) && (
        <textarea
          className={`cell-text size-${c.textSize || "m"}`}
          value={c.text}
          placeholder="Type here…"
          onChange={(e) => update({ text: e.target.value }, "text")}
          onBlur={onCommit}
        />
      )}

      {c.linkUrl && (
        <a
          className="cell-link"
          href={c.linkUrl}
          target="_blank"
          rel="noreferrer"
          onClick={(e) => e.stopPropagation()}
        >
          🔗 {c.linkLabel || c.linkUrl}
        </a>
      )}
    </div>
  );
}
