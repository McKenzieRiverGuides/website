/* Homepage: hero slideshow, festival video, river gauge card, member counts. */
/* Hero slideshow of historic photos: crossfades every 7 s with a slow zoom; loads each next photo just before it shows.
   With a single photo it simply zooms slowly. Pause button; no auto-advance for reduced-motion users. */
(function () {
  var slides = [].slice.call(document.querySelectorAll(".hist-photo")), cap = document.getElementById("histCap"), btn = document.getElementById("heroToggle");
  slides.forEach(function (im) { if (im.dataset.pos) im.style.objectPosition = im.dataset.pos; });
  if (slides.length < 2) { if (slides[0]) slides[0].classList.add("solo"); return; }
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  var i = 0, timer = null, HOLD = 7000;
  function prep(im) { if (!im.getAttribute("src") && im.dataset.src) im.src = im.dataset.src; }
  function go() {
    var cur = slides[i]; i = (i + 1) % slides.length; var nxt = slides[i];
    prep(nxt); prep(slides[(i + 1) % slides.length]);
    nxt.classList.remove("on", "out"); void nxt.offsetWidth; nxt.classList.add("on");
    setTimeout(function () { cur.classList.add("out"); cur.classList.remove("on"); }, 1700);
    cap.style.opacity = 0; setTimeout(function () { cap.textContent = nxt.dataset.cap || ""; cap.style.opacity = 1; }, 800);
  }
  function start() { clearInterval(timer); timer = setInterval(go, HOLD); }
  btn.hidden = false;
  btn.addEventListener("click", function () {
    if (timer) { clearInterval(timer); timer = null; btn.textContent = "▶"; btn.setAttribute("aria-label", "Play slideshow"); }
    else { go(); start(); btn.textContent = "❚❚"; btn.setAttribute("aria-label", "Pause slideshow"); }
  });
  window.addEventListener("load", function () { prep(slides[1]); start(); });
})();

/* Festival background video: loads only when the section comes near the screen, plays while visible,
   pause button for everyone, still image only for people who prefer reduced motion. */
(function () {
  var v = document.getElementById("festVideo"), b = document.getElementById("vidToggle");
  if (!v) return;
  var userPaused = false, loaded = false;
  function show(playing) { b.textContent = playing ? "❚❚" : "▶"; b.setAttribute("aria-label", (playing ? "Pause" : "Play") + " background video"); }
  if (window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches) { show(false); b.hidden = true; return; }
  function load() { if (loaded) return; loaded = true; v.querySelectorAll("source").forEach(function (s) { s.src = s.dataset.src; }); v.load(); }
  function play() { var p = v.play(); show(true); if (p) p.catch(function () { show(false); }); }
  var io = new IntersectionObserver(function (es) {
    es.forEach(function (e) {
      if (e.isIntersecting) { load(); if (!userPaused) play(); } else { v.pause(); }
    });
  }, { rootMargin: "200px 0px" });
  io.observe(v.parentElement);
  b.addEventListener("click", function () { userPaused = !v.paused; if (v.paused) { load(); play(); } else { v.pause(); show(false); } });
})();

/* Live river readings from USGS gauge 14162500 (McKenzie River near Vida), via the fast USGS Water Data API:
   newest numbers first, then the 7-day flow line. */
(function () {
  var OGC = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/", SITE = "USGS-14162500";
  function set(id, text) { var el = document.getElementById(id); if (el) el.textContent = text; }
  var wrapEl = document.getElementById("g-spark-wrap");
  fetch(OGC + "latest-continuous/items?f=json&limit=50&skipGeometry=true&monitoring_location_id=" + SITE + "&parameter_code=00060,00010,00065")
    .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
    .then(function (d) {
      var v = {};
      (d.features || []).forEach(function (f) { var p = f.properties, n = parseFloat(p.value); if (!isNaN(n) && n > -999) v[p.parameter_code] = { t: new Date(p.time), v: n }; });
      if (v["00060"]) set("g-flow", Math.round(v["00060"].v).toLocaleString());
      if (v["00010"]) set("g-temp", Math.round(v["00010"].v * 9 / 5 + 32) + "°F");
      if (v["00065"]) set("g-height", v["00065"].v.toFixed(2) + " ft");
      var when = v["00060"] || v["00010"] || v["00065"];
      set("g-updated", when ? "USGS gauge · updated " + when.t.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }) : "USGS gauge 14162500");
    })
    .catch(function () { set("g-updated", "Live readings are slow or unavailable right now. See USGS for current data."); });

  var start = new Date(Date.now() - 7 * 864e5).toISOString().replace(/\.\d+Z$/, "Z");
  fetch(OGC + "continuous/items?f=csv&limit=10000&skipGeometry=true&properties=time,value&monitoring_location_id=" + SITE + "&parameter_code=00060&datetime=" + start + "/..")
    .then(function (r) { if (!r.ok) throw r.status; return r.text(); })
    .then(function (csv) {
      var rows = csv.trim().split(/\r?\n/), head = rows.shift().split(","), ti = head.indexOf("time"), vi = head.indexOf("value");
      var pts = rows.map(function (l) { var c = l.split(","); return { t: new Date(c[ti].replace(" ", "T")), v: parseFloat(c[vi]) }; })
        .filter(function (p) { return !isNaN(p.v) && p.v > -999; }).sort(function (a, b) { return a.t - b.t; });
      if (pts.length > 1) {
        var vs = pts.map(function (p) { return p.v; }), lo = Math.min.apply(0, vs), hi = Math.max.apply(0, vs), span = hi - lo || 1;
        var t0 = pts[0].t, dt = (pts[pts.length - 1].t - t0) || 1;
        document.querySelector("#g-spark path").setAttribute("d", pts.map(function (p, i) { return (i ? "L" : "M") + ((p.t - t0) / dt * 300).toFixed(1) + " " + (52 - (p.v - lo) / span * 48).toFixed(1); }).join(" "));
      }
    })
    .catch(function () {})
    .then(function () { if (wrapEl) wrapEl.classList.add("done"); });
})();

/* Guide and member counts: baked in at build time from the public directory sheet, refreshed quietly from the live sheet. */
(function () {
  document.querySelectorAll("[data-count]").forEach(function (el) {
    var tab = el.getAttribute("data-count");
    MRGA.sheet(tab).then(function (rows) {
      rows = rows.filter(function (r) { return tab === "Guides" ? (r["First Name"] || r["Last Name"]) : r.Name; });
      if (rows.length) el.textContent = rows.length;
    }).catch(function () {});
  });
})();
