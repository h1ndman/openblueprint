import React, { useEffect, useMemo, useRef, useState } from "react";
import { useHistory } from "./useHistory.js";
import { createInitialState, uid, DEFAULT_COL_WIDTH } from "./initialState.js";
import Cell from "./Cell.jsx";
import ActorIcon, { ACTOR_ICONS } from "./ActorIcon.jsx";
import { imageFileToDataUrl } from "./fileToDataUrl.js";
import { isDirectVideo, isVideoLink, youTubeThumb } from "./linkUtils.js";
import {
  buildThemeVars,
  actorColor,
  readableText,
  mix,
  DEFAULT_THEME,
  THEME_PRESETS,
} from "./theme.js";

const CAST_W = 128;
const ACTOR_W = 48;
const ROW_TITLE_W = 190;

const ACTOR_COLORS = ["#2563eb", "#0ea5e9", "#0284c7", "#1d4ed8", "#38bdf8", "#075985"];

const DOC_KEY = "openblueprint-doc";

function isValidDoc(data) {
  return data && Array.isArray(data.phases) && Array.isArray(data.actorGroups);
}

// A cell can hold two "faces": a future-state and a current-state version.
// Older cells stored a single flat content object — treat that as the future.
function splitFaces(raw) {
  const c = raw || {};
  if (c.future !== undefined || c.current !== undefined) {
    return { future: c.future || {}, current: c.current || {} };
  }
  return { future: c, current: {} };
}

function loadDoc() {
  try {
    const raw = localStorage.getItem(DOC_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (isValidDoc(data)) {
        // The corner went from a static "Actors / Lanes" label to an optional
        // high-level description; clear the old default so the new prompt shows.
        if (data.cornerLabel === "Actors / Lanes") data.cornerLabel = "";
        return data;
      }
    }
  } catch {}
  return null;
}

/* Drag handle. Only this element is draggable so inputs stay usable. */
function Grip({ onStart, onEnd, title, className }) {
  return (
    <span
      className={`grip ${className || ""}`}
      draggable
      title={title || "Drag to reorder"}
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", "");
        onStart();
      }}
      onDragEnd={onEnd}
      onClick={(e) => e.stopPropagation()}
    >
      ⠿
    </span>
  );
}

/* Visual drop indicator bar. */
function DropBar({ active, after, axis }) {
  if (!active) return null;
  return <span className={`dropbar ${axis} ${after ? "after" : "before"}`} />;
}

/* Color palette picker popover. */
function ThemePanel({
  theme,
  onChange,
  onApplyPreset,
  onReset,
  selectedPresetId,
  customPresets,
  onAddPreset,
  onDeletePreset,
  onClose,
}) {
  const set = (patch) => onChange({ ...theme, ...patch });
  const light = theme.gradient ? theme.secondary : "#ffffff";
  const primaryRef = useRef(null);

  const handleAdd = () => {
    onAddPreset();
    // Pop the native color wheel right away so the new palette can be dialed in.
    primaryRef.current?.click();
  };

  const editingCustom = !!selectedPresetId;

  return (
    <>
      <div className="panel-backdrop" onClick={onClose} />
      <div className="theme-panel" role="dialog" aria-label="Color palette">
        <div className="theme-panel-head">
          <strong>Color palette</strong>
          <button className="mini danger" title="Close" onClick={onClose}>
            ×
          </button>
        </div>

        <div className="panel-hint">
          {editingCustom
            ? "Editing your saved palette — tweak the colors below."
            : "Pick colors below, or tap a swatch. Use + to create your own."}
        </div>

        <label className="theme-row">
          <span>Primary</span>
          <span className="swatch-input">
            <input
              ref={primaryRef}
              type="color"
              value={theme.primary}
              onChange={(e) => set({ primary: e.target.value })}
            />
            <input
              type="text"
              className="hex"
              value={theme.primary}
              onChange={(e) => set({ primary: e.target.value })}
            />
          </span>
        </label>

        <label className={`theme-row ${theme.gradient ? "" : "disabled"}`}>
          <span>Secondary</span>
          <span className="swatch-input">
            <input
              type="color"
              value={theme.secondary}
              disabled={!theme.gradient}
              onChange={(e) => set({ secondary: e.target.value })}
            />
            <input
              type="text"
              className="hex"
              value={theme.secondary}
              disabled={!theme.gradient}
              onChange={(e) => set({ secondary: e.target.value })}
            />
          </span>
        </label>

        <label className="theme-toggle">
          <input
            type="checkbox"
            checked={theme.gradient}
            onChange={(e) => set({ gradient: e.target.checked })}
          />
          <span>Gradient between the two colors</span>
        </label>

        <div className="gradient-caption">Current palette</div>
        <div
          className="gradient-preview"
          style={{ background: `linear-gradient(90deg, ${theme.primary}, ${light})` }}
        />

        <div className="presets-label">Presets</div>
        <div className="presets">
          {THEME_PRESETS.map((p) => (
            <button
              key={p.name}
              className="preset"
              title={p.name}
              style={{ background: `linear-gradient(120deg, ${p.primary}, ${p.secondary})` }}
              onClick={() => onApplyPreset(p, false)}
            />
          ))}
        </div>

        <div className="presets-label">Your palettes</div>
        <div className="presets">
          {customPresets.map((p) => (
            <div
              key={p.id}
              className={`preset-wrap ${p.id === selectedPresetId ? "selected" : ""}`}
            >
              <button
                className="preset"
                title={p.name}
                style={{ background: `linear-gradient(120deg, ${p.primary}, ${p.secondary})` }}
                onClick={() => onApplyPreset(p, true)}
              />
              <button
                className="preset-del"
                title={`Delete "${p.name}"`}
                onClick={() => onDeletePreset(p.id)}
              >
                ×
              </button>
            </div>
          ))}
          <button
            className="preset preset-add"
            title="Create a new palette and pick its colors"
            onClick={handleAdd}
          >
            +
          </button>
        </div>

        <button className="btn btn-ghost reset" onClick={onReset}>
          Reset to default
        </button>
      </div>
    </>
  );
}

/* Small inline-editable text field that looks like a label. */
function Editable({ value, onChange, onCommit, placeholder, className, coalesceKey, multiline, style }) {
  const Tag = multiline ? "textarea" : "input";
  return (
    <Tag
      className={`editable ${className || ""}`}
      value={value}
      placeholder={placeholder}
      style={style}
      rows={multiline ? 1 : undefined}
      onChange={(e) => onChange(e.target.value, coalesceKey)}
      onBlur={onCommit}
      onClick={(e) => e.stopPropagation()}
    />
  );
}

export default function App() {
  const { state, set, undo, redo, breakCoalesce, canUndo, canRedo } = useHistory(
    () => loadDoc() || createInitialState()
  );

  // Theme lives outside undo history and persists across reloads.
  const [theme, setTheme] = useState(() => {
    try {
      const saved = localStorage.getItem("blueprint-theme");
      if (saved) return { ...DEFAULT_THEME, ...JSON.parse(saved) };
    } catch {}
    return DEFAULT_THEME;
  });
  const [showTheme, setShowTheme] = useState(false);
  useEffect(() => {
    try {
      localStorage.setItem("blueprint-theme", JSON.stringify(theme));
    } catch {}
  }, [theme]);

  // User-saved custom palettes (persisted).
  const [customPresets, setCustomPresets] = useState(() => {
    try {
      const s = localStorage.getItem("blueprint-custom-presets");
      if (s) return JSON.parse(s);
    } catch {}
    return [];
  });
  useEffect(() => {
    try {
      localStorage.setItem("blueprint-custom-presets", JSON.stringify(customPresets));
    } catch {}
  }, [customPresets]);

  // Which saved palette (if any) the color wheels are currently editing.
  const [selectedPresetId, setSelectedPresetId] = useState(null);

  const addPreset = () => {
    const id = uid("preset");
    setCustomPresets((p) => [
      ...p,
      {
        id,
        name: `Custom ${p.length + 1}`,
        primary: theme.primary,
        secondary: theme.gradient ? theme.secondary : theme.primary,
        gradient: theme.gradient,
      },
    ]);
    setSelectedPresetId(id);
  };

  const deletePreset = (id) => {
    setCustomPresets((p) => p.filter((x) => x.id !== id));
    setSelectedPresetId((cur) => (cur === id ? null : cur));
  };

  // Editing the wheels updates the theme, and writes through to the selected swatch.
  const handleColorChange = (next) => {
    setTheme(next);
    if (selectedPresetId) {
      setCustomPresets((list) =>
        list.map((p) =>
          p.id === selectedPresetId
            ? {
                ...p,
                primary: next.primary,
                secondary: next.gradient ? next.secondary : next.primary,
                gradient: next.gradient,
              }
            : p
        )
      );
    }
  };

  const applyPreset = (preset, custom) => {
    setSelectedPresetId(custom ? preset.id : null);
    setTheme({
      primary: preset.primary,
      secondary: preset.secondary,
      gradient: preset.gradient !== false,
    });
  };

  const resetTheme = () => {
    setSelectedPresetId(null);
    setTheme({ ...DEFAULT_THEME });
  };

  const themeVars = useMemo(() => buildThemeVars(theme), [theme]);

  // ---- saving: best-effort autosave to localStorage + file export/import ----
  // Autosave is a convenience only; the durable copy is the exported .obp.json
  // (Save / Open). localStorage can fill up with embedded media, so failures
  // here are silently ignored.
  useEffect(() => {
    const t = setTimeout(() => {
      try {
        localStorage.setItem(DOC_KEY, JSON.stringify(state));
      } catch {
        // Storage quota exceeded (large embedded media) — rely on file Save.
      }
    }, 500);
    return () => clearTimeout(t);
  }, [state]);

  const fileRef = useRef(null);

  const exportDoc = () => {
    const name =
      (state.title || "openblueprint").trim().replace(/[^\w-]+/g, "-").toLowerCase() ||
      "openblueprint";
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${name}.obp.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const importDoc = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(String(reader.result));
        if (!isValidDoc(data)) throw new Error("invalid");
        set(() => data);
      } catch {
        window.alert("Sorry — that doesn't look like an OpenBlueprint (.obp.json) file.");
      }
    };
    reader.readAsText(file);
    e.target.value = "";
  };

  // ---- future / current state flip (which side each cell shows) ----
  // View-only state: not part of the saved doc or undo history.
  const [cellSides, setCellSides] = useState({});
  const sideOf = (key) => cellSides[key] || "future";
  const flipCell = (key) =>
    setCellSides((s) => ({ ...s, [key]: sideOf(key) === "future" ? "current" : "future" }));

  // ---- actor profile (avatar / stock icon / persona description) ----
  const [profileId, setProfileId] = useState(null);
  const [solvesView, setSolvesView] = useState(null); // read-only "solves for" in present mode
  const avatarFileRef = useRef(null);
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file || !profileId) return;
    const dataUrl = await imageFileToDataUrl(file, 512);
    updateActorGroup(profileId, { avatarUrl: dataUrl, icon: "" });
    e.target.value = "";
  };
  useEffect(() => {
    if (!profileId) return;
    const onKey = (e) => e.key === "Escape" && setProfileId(null);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [profileId]);
  useEffect(() => {
    if (!solvesView) return;
    const onKey = (e) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        setSolvesView(null);
      }
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [solvesView]);

  // ---- image lightbox (2D gallery mirroring the grid) ----
  const [lightbox, setLightbox] = useState(null); // { r, c } selected coords
  const selRef = useRef(null);

  // Collect every cell that has content on *either* state (so you can flip
  // future/current in present mode without the tile vanishing), carrying the
  // real cell dimensions + actor persona needed for the cinematic view.
  const faceHasContent = (f) =>
    (f.text != null && f.text !== "") || f.imageUrl || f.videoUrl || f.linkUrl;

  const getGallery = () => {
    const cells = [];
    flatRows.forEach((rf, r) => {
      flatSubs.forEach((cf, c) => {
        const k = `${rf.row.id}|${cf.sub.id}`;
        const faces = splitFaces(state.cells[k]);
        if (!faceHasContent(faces.future) && !faceHasContent(faces.current)) return;
        const side = sideOf(k);
        cells.push({
          r,
          c,
          key: k,
          content: faces[side] || {},
          side,
          hasOther: faceHasContent(side === "future" ? faces.current : faces.future),
          width: cf.sub.width ?? DEFAULT_COL_WIDTH,
          height: rf.row.height,
          rowName: rf.row.title,
          phaseName: cf.phase.name,
          subName: cf.sub.name,
          accent: gColor(rf.gi),
          groupId: rf.group.id,
          groupName: rf.group.name,
          groupAvatar: rf.group.avatarUrl,
          groupIcon: rf.group.icon,
          groupDesc: rf.group.description,
        });
      });
    });
    return { cells, nCols: flatSubs.length, nRows: flatRows.length };
  };

  const openLightbox = (key) => {
    const { cells } = getGallery();
    const hit = cells.find((x) => x.key === key);
    if (hit) setLightbox({ r: hit.r, c: hit.c });
  };
  const openPresent = () => {
    const { cells } = getGallery();
    if (cells.length) setLightbox({ r: cells[0].r, c: cells[0].c });
  };
  const lbClose = () => setLightbox(null);

  // Move selection across (dc) within a row or vertically (dr) to nearby rows.
  const moveSel = (dr, dc) =>
    setLightbox((cur) => {
      if (!cur) return cur;
      const { cells } = getGallery();
      if (dc !== 0) {
        const row = cells.filter((x) => x.r === cur.r).sort((a, b) => a.c - b.c);
        const cands =
          dc > 0 ? row.filter((x) => x.c > cur.c) : row.filter((x) => x.c < cur.c).reverse();
        return cands.length ? { r: cands[0].r, c: cands[0].c } : cur;
      }
      const rows = [...new Set(cells.map((x) => x.r))].sort((a, b) => a - b);
      const cand = dr > 0 ? rows.filter((r) => r > cur.r) : rows.filter((r) => r < cur.r).reverse();
      if (!cand.length) return cur;
      const inRow = cells
        .filter((x) => x.r === cand[0])
        .sort((a, b) => Math.abs(a.c - cur.c) - Math.abs(b.c - cur.c));
      return { r: cand[0], c: inRow[0].c };
    });

  useEffect(() => {
    if (!lightbox) return;
    const onKey = (e) => {
      if (e.key === "Escape") lbClose();
      else if (e.key === "ArrowRight") { e.preventDefault(); moveSel(0, 1); }
      else if (e.key === "ArrowLeft") { e.preventDefault(); moveSel(0, -1); }
      else if (e.key === "ArrowUp") { e.preventDefault(); moveSel(-1, 0); }
      else if (e.key === "ArrowDown") { e.preventDefault(); moveSel(1, 0); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [lightbox]);

  // Smoothly slide the selected tile to center whenever selection changes.
  useEffect(() => {
    if (lightbox && selRef.current) {
      selRef.current.scrollIntoView({ behavior: "smooth", block: "center", inline: "center" });
    }
  }, [lightbox]);

  // ---- derived flat layout ----
  const flatSubs = useMemo(() => {
    const arr = [];
    state.phases.forEach((phase, pi) => {
      phase.subPhases.forEach((sub) => arr.push({ phase, pi, sub }));
    });
    return arr;
  }, [state.phases]);

  const flatRows = useMemo(() => {
    const arr = [];
    state.actorGroups.forEach((group, gi) => {
      group.rows.forEach((row) => arr.push({ group, gi, row }));
    });
    return arr;
  }, [state.actorGroups]);

  const groupCount = state.actorGroups.length;
  const gColor = (gi) => actorColor(gi, groupCount, theme);

  const totalCols = flatSubs.length;
  const rowTitleWidth = state.rowTitleWidth ?? ROW_TITLE_W;
  const gridTemplateColumns = `${CAST_W}px ${ACTOR_W}px ${rowTitleWidth}px ${flatSubs
    .map((f) => `${f.sub.width ?? DEFAULT_COL_WIDTH}px`)
    .join(" ")}`;
  const gridTemplateRows = `auto auto ${flatRows.map((f) => `${f.row.height}px`).join(" ")}`;

  // ---- mutation helpers ----
  const mutate = (fn, coalesceKey) =>
    set((prev) => {
      const draft = structuredClone(prev);
      fn(draft);
      return draft;
    }, coalesceKey);

  // Phases
  const removePhase = (phaseId) =>
    mutate((d) => {
      if (d.phases.length <= 1) return;
      d.phases = d.phases.filter((p) => p.id !== phaseId);
    });

  const renamePhase = (phaseId, name) =>
    mutate((d) => {
      const p = d.phases.find((p) => p.id === phaseId);
      if (p) p.name = name;
    }, `phase-${phaseId}`);

  const addPhaseAfter = (phaseId) =>
    mutate((d) => {
      const idx = d.phases.findIndex((p) => p.id === phaseId);
      const np = {
        id: uid("phase"),
        name: "New Phase",
        subPhases: [
          { id: uid("sub"), name: "Step 1", width: DEFAULT_COL_WIDTH },
          { id: uid("sub"), name: "Step 2", width: DEFAULT_COL_WIDTH },
          { id: uid("sub"), name: "Step 3", width: DEFAULT_COL_WIDTH },
        ],
      };
      d.phases.splice(idx + 1, 0, np);
    });

  const addStepAfter = (phaseId, subId) =>
    mutate((d) => {
      const p = d.phases.find((p) => p.id === phaseId);
      if (!p) return;
      const idx = p.subPhases.findIndex((s) => s.id === subId);
      p.subPhases.splice(idx + 1, 0, {
        id: uid("sub"),
        name: "New Step",
        width: DEFAULT_COL_WIDTH,
      });
    });

  const removeSubPhase = (phaseId, subId) =>
    mutate((d) => {
      const p = d.phases.find((p) => p.id === phaseId);
      if (p && p.subPhases.length > 1)
        p.subPhases = p.subPhases.filter((s) => s.id !== subId);
    });

  const renameSubPhase = (phaseId, subId, name) =>
    mutate((d) => {
      const p = d.phases.find((p) => p.id === phaseId);
      const s = p?.subPhases.find((s) => s.id === subId);
      if (s) s.name = name;
    }, `sub-${subId}`);

  // Actor groups
  const removeActorGroup = (groupId) =>
    mutate((d) => {
      if (d.actorGroups.length <= 1) return;
      d.actorGroups = d.actorGroups.filter((g) => g.id !== groupId);
    });

  const renameActorGroup = (groupId, name) =>
    mutate((d) => {
      const g = d.actorGroups.find((g) => g.id === groupId);
      if (g) g.name = name;
    }, `actor-${groupId}`);

  const updateActorGroup = (groupId, patch, coalesceKey) =>
    mutate((d) => {
      const g = d.actorGroups.find((g) => g.id === groupId);
      if (g) Object.assign(g, patch);
    }, coalesceKey);

  // Rows
  const addActorGroupAfter = (groupId) =>
    mutate((d) => {
      const idx = d.actorGroups.findIndex((g) => g.id === groupId);
      const color = ACTOR_COLORS[d.actorGroups.length % ACTOR_COLORS.length];
      d.actorGroups.splice(idx + 1, 0, {
        id: uid("actor"),
        name: "New Actor",
        color,
        rows: [{ id: uid("row"), title: "New Row", height: 120 }],
      });
    });

  const addRowAfter = (groupId, rowId) =>
    mutate((d) => {
      const g = d.actorGroups.find((g) => g.id === groupId);
      if (!g) return;
      const idx = g.rows.findIndex((r) => r.id === rowId);
      g.rows.splice(idx + 1, 0, { id: uid("row"), title: "New Row", height: 120 });
    });

  const removeRow = (groupId, rowId) =>
    mutate((d) => {
      const g = d.actorGroups.find((g) => g.id === groupId);
      if (g && g.rows.length > 1) g.rows = g.rows.filter((r) => r.id !== rowId);
    });

  const renameRow = (groupId, rowId, title) =>
    mutate((d) => {
      const g = d.actorGroups.find((g) => g.id === groupId);
      const r = g?.rows.find((r) => r.id === rowId);
      if (r) r.title = title;
    }, `row-${rowId}`);

  const setRowHeight = (rowId, height) =>
    mutate((d) => {
      for (const g of d.actorGroups) {
        const r = g.rows.find((r) => r.id === rowId);
        if (r) {
          r.height = Math.max(60, height);
          break;
        }
      }
    }, `rowh-${rowId}`);

  const setColWidth = (subId, width) =>
    mutate((d) => {
      for (const p of d.phases) {
        const s = p.subPhases.find((s) => s.id === subId);
        if (s) {
          s.width = Math.max(120, width);
          break;
        }
      }
    }, `colw-${subId}`);

  const setRowTitleWidth = (width) =>
    mutate((d) => {
      d.rowTitleWidth = Math.max(120, width);
    }, "rowtitlew");

  // Cells
  const cellKey = (rowId, subId) => `${rowId}|${subId}`;
  const setFace = (rowId, subId, side, faceContent, coalesceKey) =>
    mutate((d) => {
      const k = cellKey(rowId, subId);
      const faces = splitFaces(d.cells[k]);
      faces[side] = faceContent;
      d.cells[k] = faces;
    }, coalesceKey);

  // Update the "solves for" rationale on a specific cell face (used by present mode).
  const setSolves = (key, side, patch) =>
    mutate((d) => {
      const faces = splitFaces(d.cells[key]);
      const cur = faces[side] || {};
      faces[side] = { ...cur, solves: { ...(cur.solves || {}), ...patch } };
      d.cells[key] = faces;
    }, `solves-${key}-${side}`);

  const setTitle = (title) =>
    mutate((d) => {
      d.title = title;
    }, "title");

  const setCornerLabel = (label) =>
    mutate((d) => {
      d.cornerLabel = label;
    }, "corner");

  const setCornerImage = (dataUrl) =>
    mutate((d) => {
      d.cornerImage = dataUrl;
    }, null);

  const cornerImgRef = useRef(null);
  const handleCornerImage = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const dataUrl = await imageFileToDataUrl(file, 800);
    setCornerImage(dataUrl);
    e.target.value = "";
  };

  // ---- drag & drop reordering ----
  const [drag, setDrag] = useState(null); // { kind, id }
  const [dropHint, setDropHint] = useState(null); // { kind, id, after }

  const arrayMove = (arr, srcId, destId, after) => {
    const srcIdx = arr.findIndex((x) => x.id === srcId);
    if (srcIdx < 0) return;
    const [item] = arr.splice(srcIdx, 1);
    let destIdx = arr.findIndex((x) => x.id === destId);
    if (destIdx < 0) {
      arr.splice(srcIdx, 0, item);
      return;
    }
    if (after) destIdx++;
    arr.splice(destIdx, 0, item);
  };

  // Move a row, possibly across actor groups.
  const reorderRows = (d, srcId, destId, after) => {
    let item = null;
    for (const g of d.actorGroups) {
      const idx = g.rows.findIndex((r) => r.id === srcId);
      if (idx >= 0) {
        item = g.rows.splice(idx, 1)[0];
        break;
      }
    }
    if (!item) return;
    for (const g of d.actorGroups) {
      let idx = g.rows.findIndex((r) => r.id === destId);
      if (idx >= 0) {
        if (after) idx++;
        g.rows.splice(idx, 0, item);
        return;
      }
    }
  };

  // Move a sub-phase column, possibly across phases.
  const reorderSubs = (d, srcId, destId, after) => {
    let item = null;
    for (const p of d.phases) {
      const idx = p.subPhases.findIndex((s) => s.id === srcId);
      if (idx >= 0) {
        item = p.subPhases.splice(idx, 1)[0];
        break;
      }
    }
    if (!item) return;
    for (const p of d.phases) {
      let idx = p.subPhases.findIndex((s) => s.id === destId);
      if (idx >= 0) {
        if (after) idx++;
        p.subPhases.splice(idx, 0, item);
        return;
      }
    }
  };

  const doReorder = (kind, srcId, destId, after) => {
    if (srcId === destId) return;
    mutate((d) => {
      if (kind === "row") reorderRows(d, srcId, destId, after);
      else if (kind === "sub") reorderSubs(d, srcId, destId, after);
      else if (kind === "phase") arrayMove(d.phases, srcId, destId, after);
      else if (kind === "actor") arrayMove(d.actorGroups, srcId, destId, after);
    });
  };

  // Returns onDragOver/onDrop handlers for a drop target of a given kind.
  const dropProps = (kind, id, axis) => ({
    onDragOver: (e) => {
      if (!drag || drag.kind !== kind) return;
      e.preventDefault();
      const r = e.currentTarget.getBoundingClientRect();
      const after =
        axis === "y"
          ? e.clientY > r.top + r.height / 2
          : e.clientX > r.left + r.width / 2;
      if (!dropHint || dropHint.id !== id || dropHint.after !== after || dropHint.kind !== kind)
        setDropHint({ kind, id, after });
    },
    onDrop: (e) => {
      if (!drag || drag.kind !== kind) return;
      e.preventDefault();
      doReorder(kind, drag.id, id, dropHint?.after ?? false);
      setDrag(null);
      setDropHint(null);
    },
  });

  const gripProps = (kind, id) => ({
    onStart: () => setDrag({ kind, id }),
    onEnd: () => {
      setDrag(null);
      setDropHint(null);
    },
  });

  const isDragging = (kind, id) => drag && drag.kind === kind && drag.id === id;
  const hintFor = (kind, id) =>
    dropHint && dropHint.kind === kind && dropHint.id === id ? dropHint : null;

  // ---- row resize via drag ----
  const dragRef = useRef(null);
  const startResize = (e, rowId, startHeight) => {
    e.preventDefault();
    dragRef.current = { rowId, startY: e.clientY, startHeight };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      setRowHeight(d.rowId, d.startHeight + (ev.clientY - d.startY));
    };
    const onUp = () => {
      dragRef.current = null;
      breakCoalesce();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResizeCol = (e, subId, startWidth) => {
    e.preventDefault();
    e.stopPropagation();
    dragRef.current = { subId, startX: e.clientX, startWidth };
    const onMove = (ev) => {
      const d = dragRef.current;
      if (!d) return;
      setColWidth(d.subId, d.startWidth + (ev.clientX - d.startX));
    };
    const onUp = () => {
      dragRef.current = null;
      breakCoalesce();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  const startResizeRowTitle = (e, startWidth) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const onMove = (ev) => setRowTitleWidth(startWidth + (ev.clientX - startX));
    const onUp = () => {
      breakCoalesce();
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
  };

  // ---- render ----
  return (
    <div className="app" style={themeVars}>
      <header
        className="topbar"
        style={{ color: readableText(mix(theme.primary, theme.gradient ? theme.secondary : theme.primary, 0.25)) }}
      >
        <div className="brand">
          <Editable
            value={state.title}
            onChange={setTitle}
            onCommit={breakCoalesce}
            placeholder="OpenBlueprint"
            className="title-input"
            coalesceKey="title"
          />
        </div>
        <div className="toolbar">
          <button className="btn" onClick={undo} disabled={!canUndo} title="Undo (⌘Z)">
            ↶ Undo
          </button>
          <button className="btn" onClick={redo} disabled={!canRedo} title="Redo (⌘⇧Z)">
            ↷ Redo
          </button>
          <span className="divider" />
          <button
            className="btn btn-present"
            onClick={openPresent}
            title="Present mode — view the blueprint full-screen with edit controls hidden"
          >
            ▶ Present
          </button>
          <span className="divider" />
          <button className="btn" onClick={exportDoc} title="Download this blueprint as a file you can re-open or share">
            ⬇ Save
          </button>
          <button className="btn" onClick={() => fileRef.current?.click()} title="Open a saved .obp.json blueprint">
            ⬆ Open
          </button>
          <input
            ref={fileRef}
            type="file"
            accept="application/json,.json"
            hidden
            onChange={importDoc}
          />
          <span className="divider" />
          <div className="theme-anchor">
            <button
              className="btn"
              onClick={() => setShowTheme((s) => !s)}
              title="Color palette"
            >
              <span className="theme-dot" style={{ background: theme.primary }} />
              <span className="theme-dot" style={{ background: theme.gradient ? theme.secondary : theme.primary }} />
              Palette
            </button>
            {showTheme && (
              <ThemePanel
                theme={theme}
                onChange={handleColorChange}
                onApplyPreset={applyPreset}
                onReset={resetTheme}
                selectedPresetId={selectedPresetId}
                customPresets={customPresets}
                onAddPreset={addPreset}
                onDeletePreset={deletePreset}
                onClose={() => setShowTheme(false)}
              />
            )}
          </div>
        </div>
      </header>

      <div className="board-scroll">
        <div className="grid" style={{ gridTemplateColumns, gridTemplateRows }}>
          {/* corner: optional anchor image + high-level blueprint description */}
          <div
            className="corner"
            style={{ gridColumn: "2 / 4", gridRow: "1 / 3", color: readableText(themeVars["--blue-900"]) }}
          >
            {state.cornerImage ? (
              <div className="corner-img-wrap">
                <img className="corner-img" src={state.cornerImage} alt="" />
                <div className="corner-img-actions">
                  <button
                    className="corner-img-btn"
                    title="Replace image"
                    onClick={() => cornerImgRef.current?.click()}
                  >
                    ⟳
                  </button>
                  <button
                    className="corner-img-btn"
                    title="Remove image"
                    onClick={() => setCornerImage("")}
                  >
                    ×
                  </button>
                </div>
              </div>
            ) : (
              <button
                className="corner-img-add"
                title="Add an anchor image"
                onClick={() => cornerImgRef.current?.click()}
              >
                + Image
              </button>
            )}
            <Editable
              value={state.cornerLabel ?? ""}
              onChange={setCornerLabel}
              onCommit={breakCoalesce}
              placeholder="Describe this blueprint at a high level…"
              className="corner-label"
              coalesceKey="corner"
              multiline
            />
            <input
              ref={cornerImgRef}
              type="file"
              accept="image/*"
              hidden
              onChange={handleCornerImage}
            />
          </div>

          {/* phase headers */}
          {(() => {
            const cells = [];
            let flatIndex = 0;
            state.phases.forEach((phase) => {
              const span = phase.subPhases.length;
              const start = 4 + flatIndex;
              // Each phase is a slice of the primary->secondary ramp, sized by
              // its column span so the whole header reads as one continuous fade.
              let phaseStyle = { gridRow: 1, gridColumn: `${start} / ${start + Math.max(span, 1)}` };
              if (theme.gradient && totalCols > 0) {
                const t0 = flatIndex / totalCols;
                const t1 = (flatIndex + span) / totalCols;
                const cA = mix(theme.primary, theme.secondary, t0);
                const cB = mix(theme.primary, theme.secondary, t1);
                const mid = mix(theme.primary, theme.secondary, (t0 + t1) / 2);
                phaseStyle = {
                  ...phaseStyle,
                  background: `linear-gradient(120deg, ${cA}, ${cB})`,
                  color: readableText(mid),
                };
              }
              cells.push(
                <div
                  key={phase.id}
                  className={`phase-head ${isDragging("phase", phase.id) ? "dragging" : ""}`}
                  style={phaseStyle}
                  {...dropProps("phase", phase.id, "x")}
                >
                  <DropBar axis="x" active={!!hintFor("phase", phase.id)} after={hintFor("phase", phase.id)?.after} />
                  <Grip {...gripProps("phase", phase.id)} title="Drag phase left / right" />
                  <Editable
                    value={phase.name}
                    onChange={(v) => renamePhase(phase.id, v)}
                    onCommit={breakCoalesce}
                    placeholder="Phase"
                    className="phase-name"
                    coalesceKey={`phase-${phase.id}`}
                  />
                  <div className="phase-actions">
                    <button className="mini" title="Add phase" onClick={() => addPhaseAfter(phase.id)}>
                      +
                    </button>
                    <button
                      className="mini danger"
                      title="Delete phase"
                      onClick={() => removePhase(phase.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
              flatIndex += span;
            });
            return cells;
          })()}

          {/* sub-phase headers */}
          {flatSubs.map((f, i) => (
            <div
              key={f.sub.id}
              className={`sub-head ${isDragging("sub", f.sub.id) ? "dragging" : ""}`}
              style={{ gridRow: 2, gridColumn: 4 + i }}
              {...dropProps("sub", f.sub.id, "x")}
            >
              <DropBar axis="x" active={!!hintFor("sub", f.sub.id)} after={hintFor("sub", f.sub.id)?.after} />
              <Grip {...gripProps("sub", f.sub.id)} title="Drag column left / right" />
              <Editable
                value={f.sub.name}
                onChange={(v) => renameSubPhase(f.phase.id, f.sub.id, v)}
                onCommit={breakCoalesce}
                placeholder="Step"
                className="sub-name"
                coalesceKey={`sub-${f.sub.id}`}
              />
              <div className="sub-actions">
                <button
                  className="mini"
                  title="Add step"
                  onClick={() => addStepAfter(f.phase.id, f.sub.id)}
                >
                  +
                </button>
                <button
                  className="mini danger"
                  title="Delete step"
                  onClick={() => removeSubPhase(f.phase.id, f.sub.id)}
                >
                  ×
                </button>
              </div>
              <div
                className="col-resize"
                title="Drag to resize column width"
                onMouseDown={(e) =>
                  startResizeCol(e, f.sub.id, f.sub.width ?? DEFAULT_COL_WIDTH)
                }
              />
            </div>
          ))}

          {/* actor group labels (vertical) */}
          {(() => {
            const out = [];
            let flatRowIndex = 0;
            state.actorGroups.forEach((group, gi) => {
              const span = group.rows.length;
              const start = 3 + flatRowIndex;
              const rowSpan = `${start} / ${start + Math.max(span, 1)}`;
              out.push(
                <button
                  key={`cast-${group.id}`}
                  className="cast-card"
                  style={{ gridColumn: 1, gridRow: rowSpan, "--accent": gColor(gi) }}
                  title="Open actor profile — photo, icon & description"
                  onClick={() => setProfileId(group.id)}
                >
                  <span className="cast-avatar">
                    {group.avatarUrl ? (
                      <img src={group.avatarUrl} alt="" />
                    ) : (
                      <ActorIcon
                        kind={group.icon || "user"}
                        className={`cast-avatar-icon ${group.icon ? "" : "placeholder"}`}
                      />
                    )}
                  </span>
                  <span className="cast-name">{group.name || "Actor"}</span>
                  <span className="cast-desc">
                    {group.description ? (
                      group.description
                    ) : (
                      <span className="cast-hint">+ add description</span>
                    )}
                  </span>
                </button>
              );
              out.push(
                <div
                  key={group.id}
                  className={`actor-label ${isDragging("actor", group.id) ? "dragging" : ""}`}
                  style={{
                    gridColumn: 2,
                    gridRow: rowSpan,
                    "--accent": gColor(gi),
                    color: readableText(gColor(gi)),
                  }}
                  {...dropProps("actor", group.id, "y")}
                >
                  <DropBar axis="y" active={!!hintFor("actor", group.id)} after={hintFor("actor", group.id)?.after} />
                  <Grip {...gripProps("actor", group.id)} title="Drag actor group up / down" className="grip-actor" />
                  <div className="actor-label-inner">
                    <Editable
                      value={group.name}
                      onChange={(v) => renameActorGroup(group.id, v)}
                      onCommit={breakCoalesce}
                      placeholder="Actor"
                      className="actor-name"
                      coalesceKey={`actor-${group.id}`}
                    />
                  </div>
                  <div className="actor-actions">
                    <button className="mini" title="Add actor group" onClick={() => addActorGroupAfter(group.id)}>
                      +
                    </button>
                    <button
                      className="mini danger"
                      title="Delete actor group"
                      onClick={() => removeActorGroup(group.id)}
                    >
                      ×
                    </button>
                  </div>
                </div>
              );
              flatRowIndex += span;
            });
            return out;
          })()}

          {/* row titles */}
          {flatRows.map((f, j) => (
            <div
              key={f.row.id}
              className={`row-title ${isDragging("row", f.row.id) ? "dragging" : ""}`}
              style={{ gridColumn: 3, gridRow: 3 + j, "--accent": gColor(f.gi) }}
              {...dropProps("row", f.row.id, "y")}
            >
              <DropBar axis="y" active={!!hintFor("row", f.row.id)} after={hintFor("row", f.row.id)?.after} />
              <Grip {...gripProps("row", f.row.id)} title="Drag row up / down" />
              <span className="row-icon" title="This lane accepts text, images and links">
                ✎
              </span>
              <Editable
                value={f.row.title}
                onChange={(v) => renameRow(f.group.id, f.row.id, v)}
                onCommit={breakCoalesce}
                placeholder="Row title"
                className="row-title-input"
                coalesceKey={`row-${f.row.id}`}
                multiline
              />
              <div className="row-actions">
                <button
                  className="mini"
                  title="Add row"
                  onClick={() => addRowAfter(f.group.id, f.row.id)}
                >
                  +
                </button>
                <button
                  className="mini danger"
                  title="Delete row"
                  onClick={() => removeRow(f.group.id, f.row.id)}
                >
                  ×
                </button>
              </div>
              <div
                className="row-resize"
                title="Drag to resize row height"
                onMouseDown={(e) => startResize(e, f.row.id, f.row.height)}
              />
              <div
                className="col-resize"
                title="Drag to resize this column"
                onMouseDown={(e) => startResizeRowTitle(e, rowTitleWidth)}
              />
            </div>
          ))}

          {/* content cells */}
          {flatRows.map((rf, j) =>
            flatSubs.map((cf, i) => {
              const key = `${rf.row.id}|${cf.sub.id}`;
              const faces = splitFaces(state.cells[key]);
              const side = sideOf(key);
              return (
                <div
                  key={key}
                  className="cell-wrap"
                  style={{ gridColumn: 4 + i, gridRow: 3 + j }}
                >
                  <div className={`cell-flip ${side === "current" ? "flipped" : ""}`}>
                    <div className="cell-face cell-face-front">
                      <Cell
                        accent={gColor(rf.gi)}
                        content={faces.future}
                        stateLabel="Future"
                        onFlip={() => flipCell(key)}
                        onChange={(content, ck) =>
                          setFace(rf.row.id, cf.sub.id, "future", content, ck ? `cell-${key}-f-${ck}` : null)
                        }
                        onCommit={breakCoalesce}
                        onImageClick={() => openLightbox(key)}
                      />
                    </div>
                    <div className="cell-face cell-face-back">
                      <Cell
                        accent={gColor(rf.gi)}
                        content={faces.current}
                        stateLabel="Current"
                        onFlip={() => flipCell(key)}
                        onChange={(content, ck) =>
                          setFace(rf.row.id, cf.sub.id, "current", content, ck ? `cell-${key}-c-${ck}` : null)
                        }
                        onCommit={breakCoalesce}
                        onImageClick={() => openLightbox(key)}
                      />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>

      <footer className="footer">
        <span className="footer-brand">
          OpenBlueprint by{" "}
          <a
            className="footer-link"
            href="https://x.com/h1ndman"
            target="_blank"
            rel="noreferrer"
          >
            h1ndman
          </a>
        </span>
        <span className="footer-meta">Open source · MIT</span>
      </footer>

      {lightbox &&
        (() => {
          const { cells } = getGallery();
          const SCALE = 2.6;
          const ACTOR_COL = 280;
          const colTemplate = flatSubs
            .map((f) => `${(f.sub.width ?? DEFAULT_COL_WIDTH) * SCALE}px`)
            .join(" ");
          const rowTemplate = flatRows.map((f) => `${f.row.height * SCALE}px`).join(" ");
          const focus = cells.find((x) => x.r === lightbox.r && x.c === lightbox.c) || cells[0];
          // Actor lane ranges so each persona card spans its group's rows.
          const groupRanges = [];
          let gStart = 0;
          state.actorGroups.forEach((g, gi) => {
            const sp = g.rows.length;
            groupRanges.push({ group: g, gi, start: gStart, span: sp });
            gStart += sp;
          });
          return (
            <div className="lightbox" onClick={lbClose}>
              <button className="lb-close" onClick={lbClose} title="Close (Esc)">
                ×
              </button>
              <div className="lb-scroll" onClick={(e) => e.stopPropagation()}>
                <div
                  className="lb-grid"
                  style={{
                    gridTemplateColumns: `${ACTOR_COL}px ${colTemplate}`,
                    gridTemplateRows: rowTemplate,
                  }}
                >
                  {groupRanges.map((gr) => {
                    const g = gr.group;
                    const on = focus && focus.groupId === g.id;
                    return (
                      <div
                        key={`actor-${g.id}`}
                        className={`lb-actor-cell ${on ? "sel" : ""}`}
                        style={{
                          gridColumn: 1,
                          gridRow: `${gr.start + 1} / ${gr.start + 1 + Math.max(gr.span, 1)}`,
                        }}
                      >
                        <div
                          className="lb-actor"
                          style={{ "--accent": gColor(gr.gi) }}
                          onClick={(e) => {
                            e.stopPropagation();
                            setProfileId(g.id);
                          }}
                          title="Open actor profile"
                        >
                          <div className="lb-actor-avatar">
                            {g.avatarUrl ? (
                              <img src={g.avatarUrl} alt="" />
                            ) : (
                              <ActorIcon kind={g.icon || "user"} className="lb-actor-icon" />
                            )}
                          </div>
                          <div className="lb-actor-meta">
                            <div className="lb-actor-name">{g.name || "Actor"}</div>
                            {g.description && <p className="lb-actor-desc">{g.description}</p>}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {cells.map((cell) => {
                    const sel = cell.r === lightbox.r && cell.c === lightbox.c;
                    const ct = cell.content;
                    const empty = !faceHasContent(ct);
                    return (
                      <div
                        key={cell.key}
                        ref={sel ? selRef : null}
                        className={`lb-tile ${sel ? "sel" : ""}`}
                        style={{ gridColumn: cell.c + 2, gridRow: cell.r + 1 }}
                        onClick={() => setLightbox({ r: cell.r, c: cell.c })}
                      >
                        <div className="lb-card" style={{ "--accent": cell.accent }}>
                          <div className="lb-media">
                            {ct.imageUrl && <img className="lb-img" src={ct.imageUrl} alt="" />}
                            {ct.videoUrl && (
                              <video
                                className="lb-video"
                                src={ct.videoUrl}
                                controls
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            {ct.text != null && ct.text !== "" && (
                              <p className={`lb-text size-${ct.textSize || "m"}`}>{ct.text}</p>
                            )}
                            {ct.linkUrl && isDirectVideo(ct.linkUrl) && (
                              <video
                                className="lb-video"
                                src={ct.linkUrl}
                                controls
                                preload="metadata"
                                onClick={(e) => e.stopPropagation()}
                              />
                            )}
                            {ct.linkUrl && !isDirectVideo(ct.linkUrl) && isVideoLink(ct.linkUrl) && (
                              <a
                                className="cell-videolink lb-videolink"
                                href={ct.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                title={ct.linkUrl}
                                onClick={(e) => e.stopPropagation()}
                                style={
                                  youTubeThumb(ct.linkUrl)
                                    ? { backgroundImage: `url(${youTubeThumb(ct.linkUrl)})` }
                                    : undefined
                                }
                              >
                                <span className="cell-videolink-play">▶</span>
                                <span className="cell-videolink-label">
                                  {ct.linkLabel || ct.linkUrl}
                                </span>
                              </a>
                            )}
                            {ct.linkUrl && !isVideoLink(ct.linkUrl) && (
                              <a
                                className="lb-link"
                                href={ct.linkUrl}
                                target="_blank"
                                rel="noreferrer"
                                onClick={(e) => e.stopPropagation()}
                              >
                                🔗 {ct.linkLabel || ct.linkUrl}
                              </a>
                            )}
                            {empty && <span className="lb-empty">no {cell.side}-state content</span>}
                          </div>
                          <div className="lb-caption">
                            <span className="lb-cap-step">
                              {cell.phaseName} · {cell.subName}
                            </span>
                            {(cell.hasOther || !empty) && (
                              <button
                                className={`lb-flip ${cell.side === "current" ? "current" : ""}`}
                                title="Toggle future / current state"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  flipCell(cell.key);
                                }}
                              >
                                {cell.side === "current" ? "Current" : "Future"} ⇄
                              </button>
                            )}
                            {!empty && (
                              <button
                                className={`lb-solves ${
                                  ct.solves &&
                                  (ct.solves.customer || ct.solves.business || ct.solves.kpis)
                                    ? "filled"
                                    : ""
                                }`}
                                title="Solves for — customer & business problems and KPIs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSolvesView({ key: cell.key, side: cell.side });
                                }}
                              >
                                ◇ Solves for
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="lb-hint">← → across · ↑ ↓ rows · click ⇄ to flip · Esc</div>
            </div>
          );
        })()}

      {solvesView &&
        (() => {
          const close = () => {
            breakCoalesce();
            setSolvesView(null);
          };
          const solves =
            (splitFaces(state.cells[solvesView.key])[solvesView.side] || {}).solves || {};
          return (
            <div className="solves-overlay" onClick={close}>
              <div className="solves-card" onClick={(e) => e.stopPropagation()}>
                <div className="solves-head">
                  <span className="solves-title">◇ Solves for</span>
                  <button className="solves-close" title="Close" onClick={close}>
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
                      onChange={(e) =>
                        setSolves(solvesView.key, solvesView.side, { [field]: e.target.value })
                      }
                      onBlur={breakCoalesce}
                    />
                  </label>
                ))}
              </div>
            </div>
          );
        })()}

      {profileId &&
        (() => {
          const gi = state.actorGroups.findIndex((g) => g.id === profileId);
          const g = state.actorGroups[gi];
          if (!g) return null;
          return (
            <div className="profile-overlay" onClick={() => setProfileId(null)}>
              <div
                className="profile-card"
                style={{ "--accent": gColor(gi) }}
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  className="profile-close"
                  onClick={() => setProfileId(null)}
                  title="Close (Esc)"
                >
                  ×
                </button>
                <div className="profile-head">
                  <div className="profile-avatar">
                    {g.avatarUrl ? (
                      <img src={g.avatarUrl} alt="" />
                    ) : (
                      <ActorIcon kind={g.icon || "user"} className="profile-avatar-icon" />
                    )}
                  </div>
                  <input
                    className="profile-name"
                    value={g.name}
                    placeholder="Actor name"
                    onChange={(e) => updateActorGroup(g.id, { name: e.target.value }, `actor-${g.id}`)}
                    onBlur={breakCoalesce}
                  />
                </div>

                <div className="profile-controls">
                  <button className="profile-btn" onClick={() => avatarFileRef.current?.click()}>
                    ⬆ Photo
                  </button>
                  {ACTOR_ICONS.map(([kind, label]) => (
                    <button
                      key={kind}
                      className={`profile-btn ${!g.avatarUrl && g.icon === kind ? "active" : ""}`}
                      onClick={() => updateActorGroup(g.id, { icon: kind, avatarUrl: "" })}
                    >
                      <ActorIcon kind={kind} className="profile-btn-icon" />
                      {label}
                    </button>
                  ))}
                  {(g.avatarUrl || g.icon) && (
                    <button
                      className="profile-btn danger"
                      onClick={() => updateActorGroup(g.id, { avatarUrl: "", icon: "" })}
                    >
                      Remove
                    </button>
                  )}
                </div>

                <textarea
                  className="profile-desc"
                  value={g.description || ""}
                  placeholder="Describe this actor — who they are, their goals, context, pain points and responsibilities…"
                  onChange={(e) => updateActorGroup(g.id, { description: e.target.value }, `desc-${g.id}`)}
                  onBlur={breakCoalesce}
                />
              </div>
              <input
                ref={avatarFileRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleAvatarUpload}
              />
            </div>
          );
        })()}
    </div>
  );
}
