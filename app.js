import * as pdfjsLib from "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.min.mjs";

pdfjsLib.GlobalWorkerOptions.workerSrc =
  "https://cdn.jsdelivr.net/npm/pdfjs-dist@4.6.82/build/pdf.worker.min.mjs";

const docs = {
  "first-floor": {
    title: "First Floor",
    description: "Housekeeping SOP for first floor",
    url: "./Housekeeping%20SOP%201st%20floor%20NOV%202025.pdf",
  },
  "second-floor": {
    title: "Second Floor",
    description: "Housekeeping SOP for second floor",
    url: "./Housekeeping%20SOP%202nd%20floor%20NOV%202025.pdf",
  },
};

const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const PINCH_RERENDER_THRESHOLD = 0.1;

const state = {
  activeDocId: null,
  activePdf: null,
  zoomMode: "fit-width",
  zoomScale: 1,
  scrollByDoc: {},
  renderingToken: 0,
  lastKnownViewerWidth: 0,
  lastKnownWindowWidth: window.innerWidth,
  isUserScrolling: false,
  pendingResizeRerender: false,
  lastScrollAt: 0,
  rerenderInFlight: false,
  activePointers: new Map(),
  pinch: null,
};

const homeView = document.getElementById("home-view");
const viewerView = document.getElementById("viewer-view");
const backBtn = document.getElementById("back-home");
const docSwitcher = document.getElementById("doc-switcher");
const titleEl = document.getElementById("viewer-title");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const pagesEl = document.getElementById("pdf-pages");
const zoomOutBtn = document.getElementById("zoom-out");
const zoomInBtn = document.getElementById("zoom-in");
const fitWidthBtn = document.getElementById("fit-width");
const zoomIndicator = document.getElementById("zoom-indicator");
const viewerMain = document.getElementById("main-content");
let scrollIdleTimer;

function debounce(fn, delay = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

function clampZoom(scale) {
  return Math.min(Math.max(scale, MIN_ZOOM), MAX_ZOOM);
}

function saveCurrentScrollPosition() {
  if (!state.activeDocId) return;
  state.scrollByDoc[state.activeDocId] = {
    top: viewerMain.scrollTop,
    left: viewerMain.scrollLeft,
  };
}

function restoreScrollPosition(scroll = { top: 0, left: 0 }) {
  viewerMain.scrollTop = scroll.top || 0;
  viewerMain.scrollLeft = scroll.left || 0;
}

function setView(showViewer) {
  homeView.classList.toggle("is-active", !showViewer);
  viewerView.classList.toggle("is-active", showViewer);
  viewerView.setAttribute("aria-hidden", String(!showViewer));
}

function getAvailableWidth() {
  return pagesEl.clientWidth || window.innerWidth - 24;
}

function updateZoomLabel() {
  zoomIndicator.textContent = `${Math.round(state.zoomScale * 100)}%`;
}

function getPointerDistance() {
  const points = [...state.activePointers.values()];
  if (points.length < 2) return 0;
  const [a, b] = points;
  return Math.hypot(a.x - b.x, a.y - b.y);
}

async function renderPdfPages(pdfDoc, token) {
  pagesEl.innerHTML = "";
  const containerWidth = getAvailableWidth();
  state.lastKnownViewerWidth = containerWidth;

  for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum += 1) {
    if (token !== state.renderingToken) return;

    const page = await pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: 1 });

    const scale =
      state.zoomMode === "fit-width" ? containerWidth / viewport.width : state.zoomScale;

    if (state.zoomMode === "fit-width") {
      state.zoomScale = scale;
      updateZoomLabel();
    }

    const scaledViewport = page.getViewport({ scale });
    const pageWrap = document.createElement("article");
    pageWrap.className = "pdf-page";
    pageWrap.setAttribute("aria-label", `Page ${pageNum}`);

    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { alpha: false });

    const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);
    canvas.width = Math.floor(scaledViewport.width * pixelRatio);
    canvas.height = Math.floor(scaledViewport.height * pixelRatio);
    canvas.style.width = `${Math.floor(scaledViewport.width)}px`;
    canvas.style.height = `${Math.floor(scaledViewport.height)}px`;

    context.setTransform(pixelRatio, 0, 0, pixelRatio, 0, 0);

    await page.render({
      canvasContext: context,
      viewport: scaledViewport,
    }).promise;

    pageWrap.appendChild(canvas);
    pagesEl.appendChild(pageWrap);
  }
}

async function rerenderActivePdf(preserveScroll = true) {
  if (!state.activePdf) return;
  if (state.rerenderInFlight) return;

  const savedScroll = preserveScroll
    ? { top: viewerMain.scrollTop, left: viewerMain.scrollLeft }
    : { top: 0, left: 0 };

  state.renderingToken += 1;
  const token = state.renderingToken;
  state.rerenderInFlight = true;

  try {
    await renderPdfPages(state.activePdf, token);

    if (token !== state.renderingToken) return;
    restoreScrollPosition(savedScroll);
  } finally {
    state.rerenderInFlight = false;
  }
}

function requestRerenderAfterScroll() {
  if (!state.activePdf || !viewerView.classList.contains("is-active")) return;
  if (state.zoomMode !== "fit-width") return;
  if (state.rerenderInFlight) return;

  if (state.isUserScrolling) {
    state.pendingResizeRerender = true;
    return;
  }

  // Mobile browsers can emit resize events while the URL bar collapses during
  // scrolling. Delay rerender to avoid a visible full-page refresh effect.
  if (Date.now() - state.lastScrollAt < 600) {
    state.pendingResizeRerender = true;
    return;
  }

  state.pendingResizeRerender = false;
  rerenderActivePdf(true);
}

async function loadDocument(docId, preserveScroll = false) {
  if (!docs[docId]) return;

  if (state.activeDocId && viewerView.classList.contains("is-active")) {
    saveCurrentScrollPosition();
  }

  state.activeDocId = docId;
  state.renderingToken += 1;
  const token = state.renderingToken;

  titleEl.textContent = docs[docId].title;
  docSwitcher.value = docId;
  loadingState.hidden = false;
  errorState.hidden = true;
  pagesEl.innerHTML = "";

  try {
    const loadingTask = pdfjsLib.getDocument(docs[docId].url);
    const pdfDoc = await loadingTask.promise;

    if (token !== state.renderingToken) return;

    state.activePdf = pdfDoc;
    await renderPdfPages(pdfDoc, token);

    if (preserveScroll) {
      restoreScrollPosition(state.scrollByDoc[docId] || { top: 0, left: 0 });
    } else {
      restoreScrollPosition({ top: 0, left: 0 });
    }

    loadingState.hidden = true;
  } catch (error) {
    console.error("PDF load failed", error);
    if (token !== state.renderingToken) return;
    loadingState.hidden = true;
    errorState.hidden = false;
  }
}

function switchToViewer(docId) {
  setView(true);
  viewerMain.focus();
  loadDocument(docId);
}

function setManualZoom(nextScale) {
  if (!state.activePdf) return;
  state.zoomMode = "manual";
  state.zoomScale = clampZoom(nextScale);
  updateZoomLabel();
  rerenderActivePdf(true);
}

function applyPinchZoom(nextScale) {
  if (!state.activePdf) return;
  state.zoomMode = "manual";
  state.zoomScale = clampZoom(nextScale);
  updateZoomLabel();
}

function maybeRerenderForPinch(force = false) {
  if (!state.pinch) return;
  const delta = Math.abs(state.zoomScale - state.pinch.lastRenderedScale);
  if (force || delta >= PINCH_RERENDER_THRESHOLD) {
    state.pinch.lastRenderedScale = state.zoomScale;
    rerenderActivePdf(true);
  }
}

function onPointerDown(event) {
  if (event.pointerType !== "touch") return;
  state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (state.activePointers.size === 2 && state.activePdf) {
    const startDistance = getPointerDistance();
    if (startDistance > 0) {
      state.pinch = {
        startDistance,
        startScale: state.zoomMode === "fit-width" ? state.zoomScale : state.zoomScale,
        lastRenderedScale: state.zoomScale,
      };
    }
  }
}

function onPointerMove(event) {
  if (event.pointerType !== "touch") return;
  if (!state.activePointers.has(event.pointerId)) return;

  state.activePointers.set(event.pointerId, { x: event.clientX, y: event.clientY });

  if (state.activePointers.size >= 2 && state.pinch) {
    event.preventDefault();
    const currentDistance = getPointerDistance();
    if (currentDistance <= 0) return;

    const scaleFactor = currentDistance / state.pinch.startDistance;
    applyPinchZoom(state.pinch.startScale * scaleFactor);
    maybeRerenderForPinch(false);
  }
}

function onPointerEnd(event) {
  state.activePointers.delete(event.pointerId);

  if (state.activePointers.size < 2 && state.pinch) {
    maybeRerenderForPinch(true);
    state.pinch = null;
  }
}

const rerenderOnResize = debounce(() => {
  if (!state.activePdf || !viewerView.classList.contains("is-active")) return;
  if (state.zoomMode !== "fit-width") return;

  const widthDeltaFromWindow = Math.abs(window.innerWidth - state.lastKnownWindowWidth);
  if (widthDeltaFromWindow < 24) return;

  state.lastKnownWindowWidth = window.innerWidth;

  const currentWidth = getAvailableWidth();
  const widthDelta = Math.abs(currentWidth - state.lastKnownViewerWidth);

  if (widthDelta < 4) return;

  requestRerenderAfterScroll();
}, 220);

const markScrolling = () => {
  state.isUserScrolling = true;
  state.lastScrollAt = Date.now();
  clearTimeout(scrollIdleTimer);
  scrollIdleTimer = setTimeout(() => {
    state.isUserScrolling = false;
    if (state.pendingResizeRerender) {
      requestRerenderAfterScroll();
    }
  }, 140);
};

document.querySelectorAll(".open-doc").forEach((button) => {
  button.addEventListener("click", () => {
    switchToViewer(button.dataset.docId);
  });
});

backBtn.addEventListener("click", () => {
  if (state.activeDocId) {
    saveCurrentScrollPosition();
  }
  setView(false);
});

docSwitcher.addEventListener("change", (event) => {
  loadDocument(event.target.value, true);
});

zoomInBtn.addEventListener("click", () => setManualZoom(state.zoomScale + 0.1));
zoomOutBtn.addEventListener("click", () => setManualZoom(state.zoomScale - 0.1));
fitWidthBtn.addEventListener("click", () => {
  state.zoomMode = "fit-width";
  rerenderActivePdf(true);
});

window.addEventListener("resize", rerenderOnResize);
window.addEventListener("orientationchange", rerenderOnResize);
viewerMain.addEventListener("scroll", markScrolling, { passive: true });
viewerMain.addEventListener("pointerdown", onPointerDown, { passive: true });
viewerMain.addEventListener("pointermove", onPointerMove, { passive: false });
viewerMain.addEventListener("pointerup", onPointerEnd, { passive: true });
viewerMain.addEventListener("pointercancel", onPointerEnd, { passive: true });

// Prevent browser pull-to-refresh / viewport pinch behaviors while interacting
// with the in-app PDF viewport. We handle two-finger zoom ourselves.
viewerMain.addEventListener(
  "touchmove",
  (event) => {
    if (event.touches.length > 1) {
      event.preventDefault();
    }
  },
  { passive: false }
);

setView(false);
updateZoomLabel();
