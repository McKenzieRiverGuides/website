/* MRGA shared script: phone menu + helpers for reading the public directory sheet. */
(function () {
  var b = document.body, btn = b.querySelector(".menu-btn"), panel = document.getElementById("menuPanel");
  if (btn && panel) btn.addEventListener("click", function () {
    var open = panel.classList.toggle("open");
    b.classList.toggle("menu-open", open);
    btn.setAttribute("aria-expanded", open);
    btn.textContent = open ? "Close" : "Menu";
  });
})();

/* Public directory sheet ("MRGA Directory – Public (website)"), read as CSV. Same parser as src/_data/directory.js. */
window.MRGA = window.MRGA || {};
MRGA.SHEET_ID = "186En2Teq58HH3EeufoKBbKtzYxZ5xnfdvxa9OvzV780";
MRGA.sheet = function (tab) {
  return fetch("https://docs.google.com/spreadsheets/d/" + MRGA.SHEET_ID + "/gviz/tq?tqx=out:csv&headers=1&sheet=" + encodeURIComponent(tab))
    .then(function (r) { if (!r.ok) throw r.status; return r.text(); })
    .then(function (csv) {
      var rows = [], row = [], f = "", q = false;
      for (var i = 0; i < csv.length; i++) {
        var c = csv[i];
        if (q) { if (c === '"' && csv[i + 1] === '"') { f += '"'; i++; } else if (c === '"') q = false; else f += c; }
        else if (c === '"') q = true;
        else if (c === ",") { row.push(f); f = ""; }
        else if (c === "\n") { row.push(f); rows.push(row); row = []; f = ""; }
        else if (c !== "\r") f += c;
      }
      if (f || row.length) { row.push(f); rows.push(row); }
      var head = rows.shift().map(function (h) { return h.trim(); });
      return rows.map(function (r) {
        var o = {}; head.forEach(function (h, j) { if (h) o[h] = (r[j] || "").trim(); }); return o;
      }).filter(function (o) { return Object.keys(o).some(function (k) { return o[k]; }); });
    });
};
MRGA.esc = function (s) { return String(s).replace(/[&<>"']/g, function (c) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]; }); };
/* Data baked into the page at build time: <script type="application/json" id="...">. */
MRGA.baked = function (id) { var el = document.getElementById(id); try { return el ? JSON.parse(el.textContent) : null; } catch (e) { return null; } };
/* Hide events whose date has passed since the last build. */
document.querySelectorAll("[data-event-date]").forEach(function (el) {
  if (new Date(el.getAttribute("data-event-date") + "T23:59:59") < new Date()) el.hidden = true;
});
document.querySelectorAll("[data-events]").forEach(function (box) {
  if (!box.querySelector("[data-event]:not([hidden])")) box.hidden = true;
});
