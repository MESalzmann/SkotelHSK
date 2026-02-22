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

function setView(showViewer) {
  homeView.classList.toggle("is-active", !showViewer);
  viewerView.classList.toggle("is-active", showViewer);
  viewerView.setAttribute("aria-hidden", String(!showViewer));
}

function setViewerLinks(url, title) {
  openExternal.href = url;
  downloadPdf.href = url;
  downloadPdf.setAttribute("download", `${title}.pdf`);
}

function loadDocument(docId) {
  const doc = docs[docId];
  if (!doc) return;

  state.activeDocId = docId;
  titleEl.textContent = doc.title;
  docSwitcher.value = docId;
  loadingState.hidden = false;
  errorState.hidden = true;

  setViewerLinks(doc.url, doc.title);

  pdfFrame.src = doc.url;
}

pdfFrame.addEventListener("load", () => {
  loadingState.hidden = true;
  errorState.hidden = true;
});

pdfFrame.addEventListener("error", () => {
  loadingState.hidden = true;
  errorState.hidden = false;
});

function switchToViewer(docId) {
  setView(true);
  viewerMain.focus();
  loadDocument(docId);
}

document.querySelectorAll(".open-doc").forEach((button) => {
  button.addEventListener("click", () => {
    switchToViewer(button.dataset.docId);
  });
});

backBtn.addEventListener("click", () => {
  setView(false);
});

docSwitcher.addEventListener("change", (event) => {
  loadDocument(event.target.value);
});

setView(false);
