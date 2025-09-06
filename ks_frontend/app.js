// -------- Globals ----------
let LANG = localStorage.getItem("ks_lang") || "en";
let L10N = {};
let DATA = {};
let charts = {};

// -------- Utilities ----------
const $ = (q) => document.querySelector(q);
const $$ = (q) => document.querySelectorAll(q);

function money(v) { return `₹ ${v}/qtl`; }

function t(key) {
  // finds text in L10N[LANG] by "a.b.c" path
  const parts = key.split(".");
  let cur = L10N[LANG];
  for (const p of parts) {
    if (!cur) return key;
    cur = cur[p];
  }
  return cur ?? key;
}

// voice: pick a best-matching voice for language
function getVoiceFor(lang) {
  const voices = speechSynthesis.getVoices();
  const prefer = lang === "hi" ? "hi" : lang === "mr" ? "mr" : "en";
  let voice = voices.find(v => v.lang.toLowerCase().startsWith(prefer));
  if (!voice) voice = voices.find(v => v.lang.toLowerCase().includes("en"));
  return voice || null;
}

function speak(text, lang=LANG) {
  // break into sentences → add gentle pauses
  const chunks = String(text).split(/(?<=[।.!?])\s+/);
  for (const c of chunks) {
    const u = new SpeechSynthesisUtterance(c);
    u.lang = lang === "hi" ? "hi-IN" : lang === "mr" ? "mr-IN" : "en-IN";
    const voice = getVoiceFor(lang);
    if (voice) u.voice = voice;
    u.rate = 0.92;  // slower, more natural
    u.pitch = 1.05;
    u.volume = 1;
    speechSynthesis.speak(u);
  }
}

// ----- Navigation -----
function showScreen(name) {
  $$(".screen").forEach(s => s.classList.add("d-none"));
  $(`#screen-${name}`).classList.remove("d-none");
  // highlight tab
  $$(".tab").forEach(b => b.classList.toggle("active", b.dataset.screen === name));
}

function setLang(newLang) {
  LANG = newLang;
  localStorage.setItem("ks_lang", LANG);
  $("#langSelect").value = LANG;
  applyTranslations();
  renderAll();
}

// ----- Renderers -----
function applyTranslations() {
  // text nodes with data-i18n
  $$("[data-i18n]").forEach(el => el.textContent = t(el.dataset.i18n));
}

function renderTop() {
  $("#topWeather").textContent = "28°C";
  $("#topMandi").textContent = money(DATA.mandi.current);
  $("#greet").textContent = {
    en: "Good Morning, Farmer!",
    hi: "नमस्ते किसान भाई!",
    mr: "नमस्कार शेतकरी मित्रांनो!"
  }[LANG];
}

function renderWeather() {
  const wrap = $("#weatherPills");
  wrap.innerHTML = "";
  DATA.weather.forEach(w => {
    const d = document.createElement("div");
    d.className = "pill";
    d.textContent = `${w.day} ${w.temp}`;
    wrap.appendChild(d);
  });
}

function cropName(id) {
  return t(`cropNames.${id}`) || id;
}

function renderMandi() {
  $("#mandiBig").textContent = money(DATA.mandi.current);
}

function renderTips() {
  const wrap = $("#tipsWrap"); wrap.innerHTML = "";
  t("tips").forEach(text => {
    const row = document.createElement("div");
    row.className = "tip";
    row.innerHTML = `<div class="tip-text">${text}</div>
                     <button class="listen">🎧 ${t("voice")}</button>`;
    row.querySelector(".listen").onclick = () => speak(text, LANG);
    wrap.appendChild(row);
  });
}

function renderRecommended() {
  const recWrap = $("#recommendedWrap");
  recWrap.innerHTML = "";
  DATA.crops.slice(0,4).forEach(c => {
    const chip = document.createElement("button");
    chip.className = "chip-item";
    chip.innerHTML = `${cropName(c.id)} • ${c.season[0].toUpperCase()+c.season.slice(1)} • ${c.water}`;
    chip.onclick = () => openCrop(c);
    recWrap.appendChild(chip);
  });
}

function renderCrops() {
  const grid = $("#allCrops"); grid.innerHTML = "";
  DATA.crops.forEach(c => {
    const card = document.createElement("div");
    card.className = "card crop";
    card.innerHTML = `
      <div class="crop-title">${cropName(c.id)}</div>
      <div class="crop-sub">${c.season[0].toUpperCase()+c.season.slice(1)} • ${c.water}</div>
    `;
    card.onclick = () => openCrop(c);
    grid.appendChild(card);
  });
}

function renderVendors() {
  const list = $("#vendorsList"); list.innerHTML = "";
  DATA.vendors.forEach(v => {
    const item = document.createElement("div");
    item.className = "list-item";
    item.innerHTML = `
      <div>
        <div class="title">${v.name}</div>
        <div class="list-meta">${v.category} • ${v.location} • <a href="tel:${v.phone.replace(/\s/g,'')}">${v.phone}</a></div>
      </div>
      <div><span class="badge ${v.verified?'ok':'warn'}">${v.verified?'✅ Verified':'⚠ Unverified'}</span></div>
    `;
    list.appendChild(item);
  });
}

function renderAnalytics() {
  // Mandi chart
  const m = DATA.mandi.trend;
  const ctx1 = $("#chartMandi").getContext("2d");
  if (charts.mandi) charts.mandi.destroy();
  charts.mandi = new Chart(ctx1, {
    type: "line",
    data: { labels: m.months, datasets: [{ label: "₹/qtl", data: m.values, tension:.35 }]},
    options: { responsive: true, plugins: { legend:{display:true}}, scales:{ y:{ beginAtZero:false } } }
  });

  // Climate chart
  const c = DATA.climate;
  const ctx2 = $("#chartClimate").getContext("2d");
  if (charts.climate) charts.climate.destroy();
  charts.climate = new Chart(ctx2, {
    type: "bar",
    data: {
      labels: c.months,
      datasets: [
        { type:"bar", label:"Rainfall (mm)", data:c.rainfall },
        { type:"line", label:"Temp (°C)", data:c.temp, tension:.35 }
      ]
    },
    options: { responsive: true, scales:{ y:{ beginAtZero:true } } }
  });
}

// Crop modal
function openCrop(c) {
  const L = L10N[LANG].labels;
  $("#cropTitle").textContent = cropName(c.id);
  const companions = (c.companions || []).map(id => cropName(id)).join(", ");

  $("#cropBody").innerHTML = `
    <div class="kv"><div class="k">${L.season}</div><div class="v">${c.season}</div></div>
    <div class="kv"><div class="k">${L.water}</div><div class="v">${c.water}</div></div>
    <div class="kv"><div class="k">${L.soil}</div><div class="v">${c.soil}</div></div>
    <div class="kv"><div class="k">${L.sowing}</div><div class="v">${c.sowing}</div></div>
    <div class="kv"><div class="k">${L.harvest}</div><div class="v">${c.harvest}</div></div>
    <div class="kv"><div class="k">${L.yield}</div><div class="v">${c.yield}</div></div>
    <div class="kv"><div class="k">${L.companions}</div><div class="v">${companions || "-"}</div></div>
  `;
  $("#cropModal").showModal();
}

// ----- Init -----
async function loadJSON(path) {
  const res = await fetch(path);
  return await res.json();
}

async function boot() {
  try {
    [DATA, L10N] = await Promise.all([
      loadJSON("./dummy/data.json"),
      loadJSON("./dummy/lang.json")
    ]);
  } catch(e) {
    console.error("Failed to load JSON", e);
    alert("Could not load data files. Please ensure dummy/data.json and dummy/lang.json exist.");
    return;
  }

  // language init
  $("#langSelect").value = LANG;
  applyTranslations();
  renderAll();

  // greet & ask language (once per session)
  if (!sessionStorage.getItem("greeted")) {
    sessionStorage.setItem("greeted", "yes");
    const greetText = {
      en: "Welcome to KrishiSaathi. Say your language — English, Hindi or Marathi.",
      hi: "कृषि साथी में आपका स्वागत है। अपनी भाषा बोलें — हिंदी, इंग्लिश या मराठी।",
      mr: "कृषी साथीमध्ये स्वागत. तुमची भाषा सांगा — हिंदी, इंग्लिश किंवा मराठी."
    }[LANG];
    speak(greetText, LANG);

    // simple speech-recognition (browser supported only)
    if ("webkitSpeechRecognition" in window) {
      const rec = new webkitSpeechRecognition();
      rec.lang = "en-IN";
      rec.onresult = (ev) => {
        const said = ev.results[0][0].transcript.toLowerCase();
        if (said.includes("hindi")) setLang("hi");
        else if (said.includes("marathi") || said.includes("marathi")) setLang("mr");
        else setLang("en");
      };
      rec.start();
    }
  }

  // handlers
  $("#btnViewTrends").onclick = () => { showScreen("analytics"); window.scrollTo(0,0); };
  $("#btnVoice").onclick = () => speak(t("tips").join(" "), LANG);
  $("#btnRefresh").onclick = () => { renderAll(); speak({en:"Refreshed.",hi:"रीफ्रेश हो गया।",mr:"रिफ्रेश झाले."}[LANG]); };
  $("#langSelect").onchange = (e)=> setLang(e.target.value);

  $$(".tab").forEach(btn => btn.onclick = () => showScreen(btn.dataset.screen));
  $("#closeModal").onclick = $("#modalCloseBtn").onclick = ()=> $("#cropModal").close();
}

function renderAll(){
  renderTop();
  renderWeather();
  renderMandi();
  renderTips();
  renderRecommended();
  renderCrops();
  renderVendors();
  renderAnalytics();
}

document.addEventListener("DOMContentLoaded", boot);
