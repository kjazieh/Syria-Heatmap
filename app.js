const paletteStops = {
  red: ["#fee2e2", "#7f1d1d"],
  blue: ["#dbeafe", "#1e3a8a"],
  green: ["#dcfce7", "#14532d"],
  orange: ["#ffedd5", "#7c2d12"],
  purple: ["#f3e8ff", "#581c87"],
  yellow: ["#fef9c3", "#854d0e"]
};

const governorateOrder = [
  "Aleppo",
  "Damascus",
  "Rural Damascus",
  "Dar'a",
  "Quneitra",
  "As-Sweida",
  "Homs",
  "Hama",
  "Tartous",
  "Lattakia",
  "Idleb",
  "Ar-Raqqa",
  "Deir-ez-Zor",
  "Al-Hasakeh"
];

const governorateArabic = {
  "Aleppo": "\u062d\u0644\u0628",
  "Damascus": "\u062f\u0645\u0634\u0642",
  "Rural Damascus": "\u0631\u064a\u0641 \u062f\u0645\u0634\u0642",
  "Dar'a": "\u062f\u0631\u0639\u0627",
  "Quneitra": "\u0627\u0644\u0642\u0646\u064a\u0637\u0631\u0629",
  "As-Sweida": "\u0627\u0644\u0633\u0648\u064a\u062f\u0627\u0621",
  "Homs": "\u062d\u0645\u0635",
  "Hama": "\u062d\u0645\u0627\u0629",
  "Tartous": "\u0637\u0631\u0637\u0648\u0633",
  "Lattakia": "\u0627\u0644\u0644\u0627\u0630\u0642\u064a\u0629",
  "Idleb": "\u0625\u062f\u0644\u0628",
  "Ar-Raqqa": "\u0627\u0644\u0631\u0642\u0629",
  "Deir-ez-Zor": "\u062f\u064a\u0631 \u0627\u0644\u0632\u0648\u0631",
  "Al-Hasakeh": "\u0627\u0644\u062d\u0633\u0643\u0629"
};

const state = {
  geojson: null,
  values: {},
  layer: null,
  map: null,
  labelLayer: null,
  defaultBounds: null,
  lastAppliedAt: null
};

function setStatus(message, type = "error") {
  const status = document.getElementById("status");
  if (!message) {
    status.hidden = true;
    status.textContent = "";
    status.className = "status";
    return;
  }
  status.hidden = false;
  status.textContent = message;
  status.className = `status status-${type}`;
}

function hexToRgb(hex) {
  const normalized = hex.replace("#", "");
  return {
    r: parseInt(normalized.slice(0, 2), 16),
    g: parseInt(normalized.slice(2, 4), 16),
    b: parseInt(normalized.slice(4, 6), 16)
  };
}

function rgbToHex({ r, g, b }) {
  const toHex = (v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0");
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
}

function interpolateColor(startHex, endHex, t) {
  const a = hexToRgb(startHex);
  const b = hexToRgb(endHex);
  return rgbToHex({
    r: a.r + (b.r - a.r) * t,
    g: a.g + (b.g - a.g) * t,
    b: a.b + (b.b - a.b) * t
  });
}

function normalize(value, min, max) {
  if (max === min) {
    return value > 0 ? 1 : 0;
  }
  return (value - min) / (max - min);
}

function formatNumber(value) {
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2
  }).format(value);
}

function formatTimestamp(date) {
  return date.toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function updateGeneratedAt() {
  const label = document.getElementById("generatedAt");
  if (!label) {
    return;
  }
  const stamp = state.lastAppliedAt || new Date();
  label.textContent = `Last updated: ${formatTimestamp(stamp)}`;
}

function getAllValues() {
  return governorateOrder.map((name) => Number(state.values[name] ?? 0));
}

function createInputs(names) {
  const container = document.getElementById("inputs");
  container.innerHTML = "";

  names.forEach((name) => {
    state.values[name] = 0;

    const wrapper = document.createElement("div");
    wrapper.className = "field";

    const label = document.createElement("label");
    label.htmlFor = `val-${name}`;
    label.textContent = getEnglishName(name);

    const input = document.createElement("input");
    input.type = "number";
    input.id = `val-${name}`;
    input.step = "any";
    input.value = "0";
    input.dataset.name = name;

    input.addEventListener("input", (event) => {
      const n = Number(event.target.value);
      state.values[name] = Number.isFinite(n) ? n : 0;
      updateUrlState();
      if (document.getElementById("showValues").checked) {
        rebuildMapLabels();
      }
    });

    wrapper.append(label, input);
    container.appendChild(wrapper);
  });
}

function styleFeature(feature) {
  const name = feature.properties.shapeName;
  const value = Number(state.values[name] ?? 0);
  const palette = document.getElementById("palette").value;
  const [light, dark] = paletteStops[palette];

  const allValues = Object.values(state.values).map(Number);
  const min = Math.min(...allValues);
  const max = Math.max(...allValues);
  const t = normalize(value, min, max);

  return {
    color: "#1f2937",
    weight: 1,
    fillColor: interpolateColor(light, dark, t),
    fillOpacity: 0.9
  };
}

function updateLegend() {
  const values = getAllValues();
  const min = Math.min(...values);
  const max = Math.max(...values);
  const palette = document.getElementById("palette").value;
  const [light, dark] = paletteStops[palette];

  const legend = document.getElementById("legend");
  document.getElementById("legendRange").textContent = `${formatNumber(min)} to ${formatNumber(max)}`;
  document.getElementById("legendBar").style.background = `linear-gradient(90deg, ${light}, ${dark})`;

  const ticks = document.getElementById("legendTicks");
  ticks.innerHTML = "";
  const tickCount = 5;
  for (let i = 0; i < tickCount; i += 1) {
    const t = tickCount === 1 ? 0 : i / (tickCount - 1);
    const value = min + (max - min) * t;
    const tick = document.createElement("span");
    tick.textContent = formatNumber(value);
    ticks.appendChild(tick);
  }
  legend.hidden = false;
}

function applyHeatmap() {
  if (!state.layer) {
    return;
  }
  state.layer.setStyle(styleFeature);
  updateLegend();
  state.lastAppliedAt = new Date();
  updateGeneratedAt();
  updateUrlState();
}

function getGovernorateLabel(name, mode) {
  const arabic = governorateArabic[name] || name;
  const english = getEnglishName(name);
  if (mode === "ar") {
    return arabic;
  }
  if (mode === "both") {
    return `${english} / ${arabic}`;
  }
  return english;
}

function getEnglishName(name) {
  if (name === "Idleb") {
    return "Idlib";
  }
  return name;
}

function getLabelCoordinate(name, center) {
  // Move Damascus label slightly north so it does not cover the small polygon.
  if (name === "Damascus") {
    return L.latLng(center.lat + 0.15, center.lng);
  }
  return center;
}

function buildLabelHtml(name, mode, showValues) {
  const label = getGovernorateLabel(name, mode);
  const value = state.values[name] ?? 0;
  if (!showValues) {
    return `<span class="gov-label"><span class="gov-name">${label}</span></span>`;
  }
  return `<span class="gov-label"><span class="gov-name">${label}</span><span class="gov-value">${value}</span></span>`;
}

function rebuildMapLabels() {
  if (!state.map || !state.geojson) {
    return;
  }

  if (state.labelLayer) {
    state.labelLayer.clearLayers();
  } else {
    state.labelLayer = L.layerGroup().addTo(state.map);
  }

  const showNames = document.getElementById("showNames").checked;
  if (!showNames) {
    return;
  }

  const mode = document.getElementById("labelMode").value;
  const showValues = document.getElementById("showValues").checked;
  state.geojson.features.forEach((feature) => {
    const name = feature.properties.shapeName;
    const center = L.geoJSON(feature).getBounds().getCenter();
    const labelCenter = getLabelCoordinate(name, center);
    const labelHtml = buildLabelHtml(name, mode, showValues);
    const marker = L.marker(labelCenter, {
      interactive: false,
      icon: L.divIcon({
        className: "gov-label-wrapper",
        html: labelHtml
      })
    });
    state.labelLayer.addLayer(marker);
  });
}

function updateLabelControlState() {
  const showNames = document.getElementById("showNames").checked;
  document.getElementById("labelMode").disabled = !showNames;
  document.getElementById("showValues").disabled = !showNames;
}

function updateUrlState() {
  const params = new URLSearchParams();
  params.set("palette", document.getElementById("palette").value);
  params.set("showNames", document.getElementById("showNames").checked ? "1" : "0");
  params.set("labelMode", document.getElementById("labelMode").value);
  params.set("showValues", document.getElementById("showValues").checked ? "1" : "0");
  params.set("exportPreset", document.getElementById("exportPreset").value);
  params.set("values", getAllValues().join(","));

  const nextUrl = `${window.location.pathname}?${params.toString()}`;
  window.history.replaceState({}, "", nextUrl);
}

function applyUrlState() {
  const params = new URLSearchParams(window.location.search);
  const palette = params.get("palette");
  const showNames = params.get("showNames");
  const labelMode = params.get("labelMode");
  const showValues = params.get("showValues");
  const exportPreset = params.get("exportPreset");
  const values = params.get("values");

  if (palette && paletteStops[palette]) {
    document.getElementById("palette").value = palette;
  }
  if (showNames === "0" || showNames === "1") {
    document.getElementById("showNames").checked = showNames === "1";
  }
  if (labelMode && ["en", "ar", "both"].includes(labelMode)) {
    document.getElementById("labelMode").value = labelMode;
  }
  if (showValues === "0" || showValues === "1") {
    document.getElementById("showValues").checked = showValues === "1";
  }
  if (exportPreset && ["map_legend", "map_only", "map_legend_meta"].includes(exportPreset)) {
    document.getElementById("exportPreset").value = exportPreset;
  }

  if (values) {
    const parsed = values.split(",").map((item) => Number(item));
    governorateOrder.forEach((name, idx) => {
      const num = parsed[idx];
      if (Number.isFinite(num)) {
        state.values[name] = num;
        const input = document.getElementById(`val-${name}`);
        if (input) {
          input.value = String(num);
        }
      }
    });
  }
}

async function copyShareLink() {
  updateUrlState();
  try {
    await navigator.clipboard.writeText(window.location.href);
    setStatus("Share link copied to clipboard.", "success");
  } catch (error) {
    setStatus("Could not copy link. Please copy the URL from your browser.", "info");
  }
}

async function exportMapAsPng() {
  if (typeof html2canvas === "undefined") {
    setStatus("Export library failed to load. Ensure html2canvas.min.js is in this folder.");
    return;
  }

  const exportBtn = document.getElementById("exportBtn");
  const exportPreset = document.getElementById("exportPreset").value;
  const mapEl = document.getElementById("map");
  const legendEl = document.getElementById("legend");
  const mapWrap = document.querySelector(".map-wrap");
  if (!mapEl) {
    setStatus("Export failed: map area was not found.");
    return;
  }
  if (!mapWrap) {
    setStatus("Export failed: map wrapper was not found.");
    return;
  }

  const originalLabel = exportBtn.textContent;
  exportBtn.disabled = true;
  exportBtn.textContent = "Exporting...";
  setStatus("Preparing high-quality PNG export...", "info");
  const styleBackups = [];
  const hiddenControls = [];

  try {
    const setTempStyle = (el, prop, value) => {
      if (!el) {
        return;
      }
      styleBackups.push({ el, prop, value: el.style[prop] });
      el.style[prop] = value;
    };

    setTempStyle(mapWrap, "background", "#ffffff");
    const includeLegend = exportPreset !== "map_only" && legendEl && !legendEl.hidden;
    setTempStyle(mapWrap, "gap", includeLegend ? "0px" : mapWrap.style.gap || "12px");
    setTempStyle(mapEl, "border", "0");
    setTempStyle(mapEl, "borderRadius", "0");
    if (includeLegend) {
      setTempStyle(legendEl, "border", "0");
      setTempStyle(legendEl, "borderRadius", "0");
      setTempStyle(legendEl, "boxShadow", "none");
      setTempStyle(legendEl, "margin", "0");
    } else if (legendEl) {
      setTempStyle(legendEl, "display", "none");
    }

    mapWrap.querySelectorAll(".leaflet-control-container").forEach((el) => {
      hiddenControls.push({ el, display: el.style.display });
      el.style.display = "none";
    });

    const wrapRect = mapWrap.getBoundingClientRect();
    const mapRect = mapEl.getBoundingClientRect();
    const legendRect = includeLegend ? legendEl.getBoundingClientRect() : mapRect;
    const left = Math.min(mapRect.left, legendRect.left);
    const top = Math.min(mapRect.top, legendRect.top);
    const right = Math.max(mapRect.right, legendRect.right);
    const bottom = Math.max(mapRect.bottom, legendRect.bottom);

    const scale = Math.max(2, Math.min(4, window.devicePixelRatio * 2));
    const fullCanvas = await html2canvas(mapWrap, {
      backgroundColor: "#ffffff",
      scale,
      useCORS: true,
      logging: false
    });

    const cropX = Math.max(0, Math.round((left - wrapRect.left) * scale));
    const cropY = Math.max(0, Math.round((top - wrapRect.top) * scale));
    const cropWidth = Math.max(1, Math.round((right - left) * scale));
    const cropHeight = Math.max(1, Math.round((bottom - top) * scale));

    const outputCanvas = document.createElement("canvas");
    outputCanvas.width = cropWidth;
    outputCanvas.height = cropHeight;
    const ctx = outputCanvas.getContext("2d");
    ctx.drawImage(
      fullCanvas,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    let finalCanvas = outputCanvas;
    if (exportPreset === "map_legend_meta") {
      const headerHeight = Math.max(70, Math.round(70 * (scale / 2)));
      const metaCanvas = document.createElement("canvas");
      metaCanvas.width = outputCanvas.width;
      metaCanvas.height = outputCanvas.height + headerHeight;
      const metaCtx = metaCanvas.getContext("2d");
      metaCtx.fillStyle = "#ffffff";
      metaCtx.fillRect(0, 0, metaCanvas.width, metaCanvas.height);
      metaCtx.fillStyle = "#0f172a";
      metaCtx.font = `${Math.round(20 * (scale / 2))}px Segoe UI`;
      metaCtx.fillText("Syria Governorate Heatmap", Math.round(18 * (scale / 2)), Math.round(30 * (scale / 2)));
      metaCtx.fillStyle = "#475569";
      metaCtx.font = `${Math.round(13 * (scale / 2))}px Segoe UI`;
      metaCtx.fillText(`Generated: ${formatTimestamp(new Date())}`, Math.round(18 * (scale / 2)), Math.round(52 * (scale / 2)));
      metaCtx.drawImage(outputCanvas, 0, headerHeight);
      finalCanvas = metaCanvas;
    }

    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const link = document.createElement("a");
    link.href = finalCanvas.toDataURL("image/png");
    link.download = `syria-heatmap-${stamp}.png`;
    link.click();
    setStatus("PNG export completed.", "success");
  } catch (error) {
    console.error("PNG export failed:", error);
    setStatus("PNG export failed. Please try again.");
  } finally {
    styleBackups.reverse().forEach(({ el, prop, value }) => {
      el.style[prop] = value;
    });
    hiddenControls.forEach(({ el, display }) => {
      el.style.display = display;
    });
    exportBtn.disabled = false;
    exportBtn.textContent = originalLabel;
  }
}

function attachInteractions(layer) {
  layer.on({
    mouseover: (event) => {
      event.target.setStyle({ weight: 2, color: "#111827" });
      event.target.bringToFront();
    },
    mouseout: () => {
      state.layer.resetStyle();
      applyHeatmap();
    }
  });
}

function addResetZoomControl() {
  if (!state.map) {
    return;
  }

  const ResetZoomControl = L.Control.extend({
    options: { position: "topleft" },
    onAdd: () => {
      const container = L.DomUtil.create("div", "leaflet-bar leaflet-control");
      const button = L.DomUtil.create("a", "", container);
      button.href = "#";
      button.title = "Reset zoom";
      button.setAttribute("aria-label", "Reset zoom");
      button.innerHTML = "&#8634;";
      button.style.fontSize = "18px";
      button.style.lineHeight = "26px";

      L.DomEvent.disableClickPropagation(container);
      L.DomEvent.on(button, "click", (event) => {
        L.DomEvent.preventDefault(event);
        if (state.defaultBounds) {
          state.map.fitBounds(state.defaultBounds, { padding: [10, 10] });
        }
      });

      return container;
    }
  });

  state.map.addControl(new ResetZoomControl());
}

function init() {
  createInputs(governorateOrder);
  applyUrlState();
  updateGeneratedAt();

  if (typeof L === "undefined") {
    setStatus("Map library failed to load. Ensure leaflet.js and leaflet.css are in this folder.");
    return;
  }

  const data = window.SYRIA_ADM1;
  if (!data || !Array.isArray(data.features)) {
    setStatus("Syria boundary data failed to load. Ensure syria-adm1.js is in this folder.");
    return;
  }

  setStatus("");
  state.geojson = data;

  const map = L.map("map", {
    zoomControl: true,
    attributionControl: false,
    preferCanvas: true,
    scrollWheelZoom: false
  });
  state.map = map;

  state.layer = L.geoJSON(data, {
    style: styleFeature,
    onEachFeature: (feature, layer) => {
      const name = feature.properties.shapeName;
      layer.bindTooltip(`${getEnglishName(name)}: ${state.values[name] ?? 0}`, { sticky: true });
      attachInteractions(layer);
    }
  }).addTo(map);

  state.defaultBounds = state.layer.getBounds();
  map.fitBounds(state.defaultBounds, { padding: [10, 10] });
  addResetZoomControl();
  updateLabelControlState();
  rebuildMapLabels();

  document.getElementById("applyBtn").addEventListener("click", () => {
    state.layer.eachLayer((layer) => {
      const name = layer.feature.properties.shapeName;
      layer.setTooltipContent(`${getEnglishName(name)}: ${state.values[name] ?? 0}`);
    });
    applyHeatmap();
    rebuildMapLabels();
  });

  document.getElementById("resetBtn").addEventListener("click", () => {
    document.querySelectorAll("#inputs input").forEach((input) => {
      input.value = "0";
      state.values[input.dataset.name] = 0;
    });
    applyHeatmap();
    rebuildMapLabels();
  });

  document.getElementById("palette").addEventListener("change", applyHeatmap);
  document.getElementById("labelMode").addEventListener("change", rebuildMapLabels);
  document.getElementById("showValues").addEventListener("change", rebuildMapLabels);
  document.getElementById("copyLinkBtn").addEventListener("click", copyShareLink);
  document.getElementById("exportBtn").addEventListener("click", exportMapAsPng);
  document.getElementById("exportPreset").addEventListener("change", updateUrlState);
  document.getElementById("showNames").addEventListener("change", () => {
    updateLabelControlState();
    rebuildMapLabels();
    updateUrlState();
  });
  document.getElementById("labelMode").addEventListener("change", updateUrlState);
  document.getElementById("showValues").addEventListener("change", updateUrlState);
  document.getElementById("palette").addEventListener("change", updateUrlState);

  applyHeatmap();
}

init();
