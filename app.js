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

const state = {
  activeDocId: null,
  activePdf: null,
  zoomMode: "fit-width",
  zoomScale: 1,
  scrollByDoc: {},
  renderingToken: 0,
  lastKnownViewerWidth: 0,
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

function debounce(fn, delay = 180) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
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

  const savedScroll = preserveScroll ? viewerMain.scrollTop : 0;
  state.renderingToken += 1;
  const token = state.renderingToken;

  await renderPdfPages(state.activePdf, token);

  if (token !== state.renderingToken) return;
  viewerMain.scrollTop = savedScroll;
}

async function loadDocument(docId, preserveScroll = false) {
  if (!docs[docId]) return;

  if (state.activeDocId && viewerView.classList.contains("is-active")) {
    state.scrollByDoc[state.activeDocId] = viewerMain.scrollTop;
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
      viewerMain.scrollTop = state.scrollByDoc[docId] || 0;
    } else {
      viewerMain.scrollTop = 0;
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
  state.zoomScale = Math.min(Math.max(nextScale, 0.5), 3);
  updateZoomLabel();
  rerenderActivePdf(true);
}

const rerenderOnResize = debounce(() => {
  if (!state.activePdf || !viewerView.classList.contains("is-active")) return;
  if (state.zoomMode !== "fit-width") return;

  const currentWidth = getAvailableWidth();
  const widthDelta = Math.abs(currentWidth - state.lastKnownViewerWidth);

  if (widthDelta < 4) return;

  rerenderActivePdf(true);
}, 220);

document.querySelectorAll(".open-doc").forEach((button) => {
  button.addEventListener("click", () => {
    switchToViewer(button.dataset.docId);
  });
});

backBtn.addEventListener("click", () => {
  if (state.activeDocId) {
    state.scrollByDoc[state.activeDocId] = viewerMain.scrollTop;
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

setView(false);
updateZoomLabel();
