import React, { useRef, useState } from "react";
import { createPortal } from "react-dom";
import { fileToDataUrl, imageFileToDataUrl } from "./fileToDataUrl.js";
import { isDirectVideo, isVideoLink, youTubeThumb } from "./linkUtils.js";

export default function Cell({ accent, content, onChange, onCommit, onImageClick, stateLabel, onFlip }) {
  const c = content || {};
  const fileInputRef = useRef(null);
  const videoInputRef = useRef(null);
  const hasContent = c.text != null || c.imageUrl || c.videoUrl || c.linkUrl;

  const update = (patch, coalesceKey) =>
    onChange({ ...c, ...patch }, coalesceKey);

  const [uploadPct, setUploadPct] = useState(null); // null = idle, 0..100 = loading
  const [solvesOpen, setSolvesOpen] = useState(false);
  const solves = c.solves || {};
  const hasSolves = !!(solves.customer || solves.business || solves.kpis);
  const updateSolves = (patch) =>
    update({ solves: { ...solves, ...patch } }, "solves");

  // A cell holds one kind of content at a time, except text + link which may
  // share a cell. Adding image/video clears text & link (and vice versa).
  const NO_MEDIA = { imageUrl: "", videoUrl: "", videoName: "" };
  const NO_TEXT_LINK = { text: undefined, linkUrl: "", linkLabel: "" };

  const addText = () => update({ ...NO_MEDIA, text: c.text ?? "" });

  const handleUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPct(0);
    try {
      const dataUrl = await imageFileToDataUrl(file, 1600, 0.85, (p) =>
        setUploadPct(Math.round(p * 100))
      );
      update({ ...NO_TEXT_LINK, videoUrl: "", videoName: "", imageUrl: dataUrl });
    } finally {
      setUploadPct(null);
    }
    e.target.value = "";
  };

  const handleUploadVideo = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPct(0);
    try {
      // Embed as a data URL so the video persists and travels inside saved files.
      const dataUrl = await fileToDataUrl(file, (p) => setUploadPct(Math.round(p * 100)));
      update({ ...NO_TEXT_LINK, imageUrl: "", videoUrl: dataUrl, videoName: file.name });
    } finally {
      setUploadPct(null);
    }
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

      {uploadPct != null && (
        <div className="cell-uploading">
          <div className="cell-uploading-label">
            {uploadPct >= 100
              ? "Finishing…"
              : uploadPct > 0
              ? `Loading… ${uploadPct}%`
              : "Loading…"}
          </div>
          <div className="cell-progress">
            {uploadPct > 0 && uploadPct < 100 ? (
              <div className="cell-progress-bar" style={{ width: `${uploadPct}%` }} />
            ) : (
              <div className="cell-progress-bar indeterminate" />
            )}
          </div>
        </div>
      )}

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

      {c.linkUrl && isDirectVideo(c.linkUrl) && (
        <div className="cell-image-wrap">
          <video className="cell-video" src={c.linkUrl} controls preload="metadata" />
        </div>
      )}

      {c.linkUrl && !isDirectVideo(c.linkUrl) && isVideoLink(c.linkUrl) && (
        <a
          className="cell-videolink"
          href={c.linkUrl}
          target="_blank"
          rel="noreferrer"
          title={c.linkUrl}
          onClick={(e) => e.stopPropagation()}
          style={youTubeThumb(c.linkUrl) ? { backgroundImage: `url(${youTubeThumb(c.linkUrl)})` } : undefined}
        >
          <span className="cell-videolink-play">▶</span>
          <span className="cell-videolink-label">{c.linkLabel || c.linkUrl}</span>
        </a>
      )}

      {c.linkUrl && !isVideoLink(c.linkUrl) && (
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

      {onFlip && (
        <button
          className={`cell-flip-btn ${stateLabel === "Current" ? "current" : ""}`}
          title="Flip between future / current state"
          onClick={(e) => {
            e.stopPropagation();
            onFlip();
          }}
        >
          {stateLabel} ⇄
        </button>
      )}

      {hasContent && (
        <button
          className={`cell-solves-btn ${hasSolves ? "filled" : ""}`}
          title="Solves for — customer & business problems and KPIs"
          onClick={(e) => {
            e.stopPropagation();
            setSolvesOpen(true);
          }}
        >
          ◇ Solves for
        </button>
      )}

      {solvesOpen && createPortal(
        <div
          className="solves-overlay"
          onClick={(e) => {
            e.stopPropagation();
            setSolvesOpen(false);
            onCommit?.();
          }}
        >
          <div
            className="solves-card"
            style={{ "--accent": accent }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="solves-head">
              <span className="solves-title">◇ Solves for</span>
              <button
                className="solves-close"
                title="Close"
                onClick={() => {
                  setSolvesOpen(false);
                  onCommit?.();
                }}
              >
                ×
              </button>
            </div>
            {[
              ["customer", "Customer problem addressed", "What pain does this remove for the customer?"],
              ["business", "Business problem addressed", "What business problem or opportunity does this serve?"],
              ["kpis", "KPIs supported", "Which metrics does this move? (e.g. activation, retention, CSAT)"],
            ].map(([field, label, placeholder]) => (
              <label key={field} className="solves-field">
                <span className="solves-label">{label}</span>
                <textarea
                  className="solves-input"
                  value={solves[field] || ""}
                  placeholder={placeholder}
                  onChange={(e) => updateSolves({ [field]: e.target.value })}
                  onBlur={onCommit}
                />
              </label>
            ))}
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
