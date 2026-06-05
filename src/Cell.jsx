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
  const hasContent = c.text || c.imageUrl || c.videoUrl || c.linkUrl;

  const update = (patch, coalesceKey) =>
    onChange({ ...c, ...patch }, coalesceKey);

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await fileToDataUrl(file);
    update({ imageUrl: dataUrl });
    e.target.value = "";
  };

  const handleUploadVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    // Embed as a data URL so the video persists and travels inside saved files.
    const dataUrl = await fileToDataUrl(file);
    update({ videoUrl: dataUrl, videoName: file.name });
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
    update({ linkUrl: url.trim(), linkLabel: label.trim() });
  };

  return (
    <div className="cell" style={{ "--accent": accent }}>
      <div className="cell-toolbar">
        <button
          className="cell-tool"
          title="Add / edit text"
          onClick={() => update({ text: c.text ?? "" })}
        >
          T
        </button>
        <button
          className="cell-tool"
          title="Upload image"
          onClick={() => fileInputRef.current?.click()}
        >
          ▣
        </button>
        <button
          className="cell-tool"
          title="Upload video"
          onClick={() => videoInputRef.current?.click()}
        >
          ▶
        </button>
        <button className="cell-tool" title="Add link" onClick={handleAddLink}>
          🔗
        </button>
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
      </div>

      {!hasContent && (
        <button
          className="cell-empty"
          onClick={() => update({ text: "" })}
          title="Click to add text, or use the toolbar to upload an image / add a link"
        >
          <span className="cell-empty-plus">+</span>
          <span className="cell-empty-hint">text · image · video · link</span>
        </button>
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
          <button
            className="cell-image-remove"
            title="Remove image"
            onClick={() => update({ imageUrl: "" })}
          >
            ×
          </button>
        </div>
      )}

      {c.videoUrl && (
        <div className="cell-image-wrap">
          <video className="cell-video" src={c.videoUrl} controls preload="metadata" />
          <button
            className="cell-image-remove"
            title="Remove video"
            onClick={() => update({ videoUrl: "", videoName: "" })}
          >
            ×
          </button>
        </div>
      )}

      {(c.text != null && c.text !== undefined) && (
        <textarea
          className="cell-text"
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
