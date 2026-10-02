const dropzone   = document.getElementById("dropzone");
const fileInput  = document.getElementById("fileInput");
const dropContent= document.getElementById("dropContent");
const preview    = document.getElementById("preview");
const calcBtn    = document.getElementById("calcBtn");
const resetBtn   = document.getElementById("resetBtn");
const resultBox  = document.getElementById("resultBox");
const resultText = document.getElementById("resultText");
const loader     = document.getElementById("loader");
const loaderText = document.getElementById("loaderText");

let selectedFile  = null;
let pendingResult = null; // pre-flight promise, starts on image load

// ── File input ──────────────────────────────────────────────────

dropzone.addEventListener("click", () => fileInput.click());
fileInput.addEventListener("change", () => {
  if (fileInput.files[0]) loadFile(fileInput.files[0]);
});

dropzone.addEventListener("dragover",  (e) => { e.preventDefault(); dropzone.classList.add("drag-over"); });
dropzone.addEventListener("dragleave", ()  => dropzone.classList.remove("drag-over"));
dropzone.addEventListener("drop", (e) => {
  e.preventDefault();
  dropzone.classList.remove("drag-over");
  const file = e.dataTransfer.files[0];
  if (file && file.type.startsWith("image/")) loadFile(file);
});

document.addEventListener("paste", (e) => {
  const file = [...e.clipboardData.items]
    .find(i => i.type.startsWith("image/"))
    ?.getAsFile();
  if (file) loadFile(file);
});

function loadFile(file) {
  selectedFile = file;
  preview.src = URL.createObjectURL(file);
  preview.hidden = false;
  dropContent.hidden = true;
  calcBtn.disabled = false;
  resetBtn.hidden = false;
  resultBox.hidden = true;

  // Fire the API call immediately — don't wait for the user to click.
  // By the time they click Calculate, the result is likely already ready.
  pendingResult = sendToServer(file);
}

function sendToServer(file) {
  const form = new FormData();
  form.append("image", file);
  return fetch("/calculate", { method: "POST", body: form })
    .then(res => res.json());
}

// ── Loading animation ───────────────────────────────────────────

const LOADING_STEPS = [
  "Scanning stat values...",
  "Identifying flame bonuses...",
  "Computing score...",
];
let loadingTimer = null;

function startLoader() {
  let i = 0;
  loaderText.textContent = LOADING_STEPS[0];
  loader.hidden = false;
  loadingTimer = setInterval(() => {
    i = (i + 1) % LOADING_STEPS.length;
    loaderText.textContent = LOADING_STEPS[i];
  }, 1600);
}

function stopLoader() {
  clearInterval(loadingTimer);
  loadingTimer = null;
  loader.hidden = true;
}

// ── Calculate ───────────────────────────────────────────────────

calcBtn.addEventListener("click", async () => {
  if (!selectedFile || !pendingResult) return;
  calcBtn.disabled = true;
  startLoader();
  resultBox.hidden = true;

  try {
    const data = await pendingResult; // instant if pre-flight already resolved
    resultText.textContent = data.result || data.error;
    resultBox.hidden = false;
  } catch {
    resultText.textContent = "Error connecting to server.";
    resultBox.hidden = false;
  } finally {
    stopLoader();
    calcBtn.disabled = false;
  }
});

// ── Reset ───────────────────────────────────────────────────────

resetBtn.addEventListener("click", () => {
  selectedFile  = null;
  pendingResult = null;
  preview.hidden = true;
  preview.src = "";
  dropContent.hidden = false;
  calcBtn.disabled = true;
  resetBtn.hidden = true;
  resultBox.hidden = true;
  fileInput.value = "";
});
