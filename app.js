const docs = {
  "first-floor": {
    title: "First Floor",
    url: "./Housekeeping%20SOP%201st%20floor%20NOV%202025.pdf",
  },
  "second-floor": {
    title: "Second Floor",
    url: "./Housekeeping%20SOP%202nd%20floor%20NOV%202025.pdf",
  },
};

const state = {
  activeDocId: null,
};

const homeView = document.getElementById("home-view");
const viewerView = document.getElementById("viewer-view");
const backBtn = document.getElementById("back-home");
const docSwitcher = document.getElementById("doc-switcher");
const titleEl = document.getElementById("viewer-title");
const loadingState = document.getElementById("loading-state");
const errorState = document.getElementById("error-state");
const viewerMain = document.getElementById("main-content");
const pdfFrame = document.getElementById("pdf-frame");
const openExternal = document.getElementById("open-external");
const downloadPdf = document.getElementById("download-pdf");

function bindEvent(element, eventName, callback) {
  if (!element) {
    console.warn(`Skipped binding ${eventName}: target element is missing.`);
    return;
  }

  element.addEventListener(eventName, callback);
}

function setView(showViewer) {
  if (!homeView || !viewerView) return;

  homeView.classList.toggle("is-active", !showViewer);
  viewerView.classList.toggle("is-active", showViewer);
  viewerView.setAttribute("aria-hidden", String(!showViewer));
}

function setViewerLinks(url, title) {
  if (!openExternal || !downloadPdf) return;

  openExternal.href = url;
  downloadPdf.href = url;
  downloadPdf.setAttribute("download", `${title}.pdf`);
}

function showLoading() {
  if (loadingState) loadingState.hidden = false;
  if (errorState) errorState.hidden = true;
}

function showError() {
  if (loadingState) loadingState.hidden = true;
  if (errorState) errorState.hidden = false;
}

function showViewerReady() {
  if (loadingState) loadingState.hidden = true;
  if (errorState) errorState.hidden = true;
}

function loadDocument(docId) {
  const doc = docs[docId];
  if (!doc || !pdfFrame) return;

  state.activeDocId = docId;
  if (titleEl) titleEl.textContent = doc.title;
  if (docSwitcher) docSwitcher.value = docId;

  showLoading();
  setViewerLinks(doc.url, doc.title);

  const onLoad = () => {
    showViewerReady();
    pdfFrame.removeEventListener("load", onLoad);
    pdfFrame.removeEventListener("error", onError);
  };

  const onError = () => {
    showError();
    pdfFrame.removeEventListener("load", onLoad);
    pdfFrame.removeEventListener("error", onError);
  };

  pdfFrame.addEventListener("load", onLoad, { once: true });
  pdfFrame.addEventListener("error", onError, { once: true });
  pdfFrame.src = doc.url;
}

function switchToViewer(docId) {
  setView(true);
  if (viewerMain) viewerMain.focus();
  loadDocument(docId);
}

document.querySelectorAll(".open-doc").forEach((button) => {
  bindEvent(button, "click", () => {
    switchToViewer(button.dataset.docId);
  });
});

bindEvent(backBtn, "click", () => {
  setView(false);
});

bindEvent(docSwitcher, "change", (event) => {
  loadDocument(event.target.value);
});

setView(false);
