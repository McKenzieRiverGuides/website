/* Live USGS readings. Vida: 30 days of flow, temp, height (+ latest water quality).
   Along the river: 7 days of flow and temp for each mainstem gauge. */
(function () {
  var VIDA = "14162500";
  /* Only gauges NOAA forecasts (user, 2026-11-19). [USGS id, name, place, NOAA forecast point] */
  var GAUGES = [
    ["14158850", "McKenzie below Trail Bridge Dam", "Near Belknap Springs", "TRBO3"],
    ["14162500", "McKenzie near Vida", "Main gauge", "VIDO3"],
    ["14163900", "McKenzie near Walterville", "Walterville", "MCZO3"]
  ];
  /* USGS Water Data API (api.waterdata.usgs.gov): much faster than the old waterservices.usgs.gov
     (0.2-0.7 s vs 5-25 s). latest-continuous = newest reading per parameter; continuous = history (CSV, small). */
  var OGC = "https://api.waterdata.usgs.gov/ogcapi/v0/collections/";
  var id = function (s) { return "USGS-" + s; };
  var toF = function (code, v) { return code === "00010" ? v * 9 / 5 + 32 : v; };
  function latest(sites, codes) {
    return fetch(OGC + "latest-continuous/items?f=json&limit=500&skipGeometry=true&monitoring_location_id=" + sites.map(id).join(",") + "&parameter_code=" + codes.join(","))
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (d) {
        var out = {};
        (d.features || []).forEach(function (f) {
          var p = f.properties, site = p.monitoring_location_id.replace("USGS-", ""), v = parseFloat(p.value);
          if (isNaN(v) || v <= -999) return;
          var pt = { t: new Date(p.time), v: toF(p.parameter_code, v) };
          out[site] = out[site] || {};
          if (!out[site][p.parameter_code] || out[site][p.parameter_code].t < pt.t) out[site][p.parameter_code] = pt;
        });
        return out;
      });
  }
  function history(site, codes, nDays) {
    var start = new Date(Date.now() - nDays * 864e5).toISOString().replace(/\.\d+Z$/, "Z");
    return fetch(OGC + "continuous/items?f=csv&limit=10000&skipGeometry=true&properties=time,value,parameter_code&monitoring_location_id=" + id(site) + "&parameter_code=" + codes.join(",") + "&datetime=" + start + "/..")
      .then(function (r) { if (!r.ok) throw r.status; return r.text(); })
      .then(function (csv) {
        var rows = csv.trim().split(/\r?\n/), head = rows.shift().split(","), ti = head.indexOf("time"), vi = head.indexOf("value"), ci = head.indexOf("parameter_code"), out = {};
        rows.forEach(function (line) {
          var c = line.split(","), v = parseFloat(c[vi]);
          if (isNaN(v) || v <= -999) return;
          (out[c[ci]] = out[c[ci]] || []).push({ t: new Date(c[ti].replace(" ", "T")), v: toF(c[ci], v) });
        });
        for (var k in out) out[k].sort(function (a, b) { return a.t - b.t; });
        return out;
      });
  }
  var METRIC = {
    "00060": { name: "Flow", unit: " cfs", fmt: function (v) { return Math.round(v).toLocaleString(); } },
    "00010": { name: "Water temp", unit: "°F", fmt: function (v) { return Math.round(v); } },
    "00065": { name: "Gauge height", unit: " ft", fmt: function (v) { return v.toFixed(2); } }
  };
  var $ = function (id) { return document.getElementById(id); };
  var set = function (id, t) { var el = $(id); if (el) el.textContent = t; };
  var whenFmt = function (t) { return t.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" }); };

  var last = function (s) { return s && s[s.length - 1]; };
  /* flow change over the last 24 hours */
  function trend(s) {
    var p = last(s); if (!p) return null;
    var ago = p.t - 864e5, prev = null;
    for (var i = s.length - 1; i >= 0; i--) if (s[i].t <= ago) { prev = s[i]; break; }
    if (!prev) return null;
    var ch = (p.v - prev.v) / prev.v;
    return Math.abs(ch) < 0.05 ? ["→", "Steady"] : ch > 0 ? ["↑", "Rising"] : ["↓", "Dropping"];
  }

  /* ---------- 1. Newest readings for every gauge in one fast call (fills the top of the page first) ---------- */
  var vida = null, metric = "00060", days = 7;
  var WQ = ["00060", "00010", "00065", "63680", "00300", "00400"];
  latest(GAUGES.map(function (g) { return g[0]; }), WQ)
    .then(function (now) {
      var v = now[VIDA] || {}, f = v["00060"], t = v["00010"], h = v["00065"];
      if (f) set("v-flow", METRIC["00060"].fmt(f.v));
      if (t) set("v-temp", METRIC["00010"].fmt(t.v) + "°F");
      if (h) set("v-height", METRIC["00065"].fmt(h.v) + " ft");
      if (v["63680"]) set("v-turb", v["63680"].v.toFixed(1) + " FNU");
      if (v["00300"]) set("v-do", v["00300"].v.toFixed(1) + " mg/L");
      if (v["00400"]) set("v-ph", v["00400"].v.toFixed(1));
      var w = f || t || h;
      set("v-updated", "Live from USGS · NOAA forecast" + (w ? " · Updated " + whenFmt(w.t) : ""));
      GAUGES.forEach(function (g) {
        var s = now[g[0]] || {}, card = $("g" + g[0]);
        if (s["00060"]) card.querySelector(".f").textContent = METRIC["00060"].fmt(s["00060"].v);
        if (s["00010"]) card.querySelector(".t").textContent = METRIC["00010"].fmt(s["00010"].v) + "°F";
        if (!s["00060"] && !s["00010"]) card.querySelector(".tr").textContent = "No recent reading";
      });
    })
    .catch(function () { set("v-updated", "Live readings are slow or unavailable right now. Check USGS for current data."); });

  /* ---------- 2. Vida history for the chart (30 days, about 25 KB) ---------- */
  var vidaHist = history(VIDA, ["00060", "00010", "00065"], 30);
  vidaHist
    .then(function (h) {
      vida = h;
      var tr = trend(vida["00060"]);
      if (tr) set("v-trend", tr[0] + " " + tr[1]);
      draw();
    })
    .catch(function () { $("c-msg").hidden = false; set("c-msg", "Readings are unavailable right now. Try again in a few minutes."); });

  function pick(group, attr, cb) {
    $(group).addEventListener("click", function (e) {
      var b = e.target.closest("button"); if (!b) return;
      $(group).querySelectorAll("button").forEach(function (x) { x.setAttribute("aria-pressed", x === b); });
      cb(b.dataset[attr]); draw();
    });
  }
  pick("metric", "m", function (v) { metric = v; });
  pick("range", "d", function (v) { days = +v; });

  var NS = "http://www.w3.org/2000/svg";
  function el(name, attrs, parent) {
    var n = document.createElementNS(NS, name);
    for (var k in attrs) n.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(n);
    return n;
  }
  function niceTicks(lo, hi, n) {
    var span = hi - lo || Math.abs(hi) || 1, step = Math.pow(10, Math.floor(Math.log10(span / n))), e = span / n / step;
    step *= e >= 5 ? 10 : e >= 2 ? 5 : e >= 1 ? 2 : 1;
    var a = Math.floor(lo / step) * step, b = Math.ceil(hi / step) * step, out = [];
    for (var v = a; v <= b + step / 2; v += step) out.push(+v.toFixed(6));
    return out;
  }

  /* NOAA forecast (Northwest River Forecast Center, via the National Water Prediction Service).
     Stage in ft = gauge height; flow comes in kcfs. */
  var fc = {}, fcIssued = null, fcCache = {};
  function noaa(lid) {
    return fcCache[lid] = fcCache[lid] || fetch("https://api.water.noaa.gov/nwps/v1/gauges/" + lid + "/stageflow")
      .then(function (r) { if (!r.ok) throw r.status; return r.json(); })
      .then(function (d) {
        var f = d.forecast || {}, rows = (f.data || []).filter(function (p) { return p.primary > -999; });
        return {
          issued: f.issuedTime ? new Date(f.issuedTime) : null,
          "00065": rows.map(function (p) { return { t: new Date(p.validTime), v: p.primary, f: 1 }; }),
          "00060": rows.filter(function (p) { return p.secondary > -999; }).map(function (p) { return { t: new Date(p.validTime), v: p.secondary * 1000, f: 1 }; })
        };
      });
  }
  noaa("VIDO3").then(function (f) {
    fc = f; fcIssued = f.issued;
    if (fcIssued) set("fc-issued", "Forecast: NOAA, issued " + whenFmt(fcIssued) + ".");
    draw();
  }).catch(function () {});

  function draw() {
    var M = METRIC[metric], span = days === 1 ? "24 hours" : days + " days";
    if (!vida) { set("c-title", M.name + " near Vida, last " + span); return; }
    var box = $("chart"), old = box.querySelector("svg"); if (old) old.remove();
    $("tip").style.opacity = 0;
    var all = vida[metric] || [], now = all.length ? last(all).t : new Date(), start = now - days * 864e5;
    var pts = all.filter(function (p) { return p.t >= start; });
    /* forecast: 2 days ahead on the 24-hour view, 6 on the 7-day view (puts today just right of centre), 7 on 30 days */
    var ahead = (days === 1 ? 2 : days === 7 ? 6 : 7) * 864e5;
    var fpts = (fc[metric] || []).filter(function (p) { return p.t > now && p.t <= +now + ahead; });
    var hasFc = fpts.length > 0, end = hasFc ? last(fpts).t : now;
    set("c-title", M.name + " near Vida, last " + span + (hasFc ? " and NOAA forecast" : ""));
    $("legend").hidden = !hasFc;
    if (pts.length < 2) { $("c-msg").hidden = false; set("c-msg", "This gauge has no " + M.name.toLowerCase() + " readings for this period."); table([]); return; }
    $("c-msg").hidden = true;

    var W = box.clientWidth, H = box.clientHeight, L = 52, R = 8, T = 22, B = 26;
    var both = pts.concat(fpts), vs = both.map(function (p) { return p.v; }), lo = Math.min.apply(0, vs), hi = Math.max.apply(0, vs);
    var pad = (hi - lo) * 0.1 || Math.abs(hi) * 0.05 || 1;
    var ticks = niceTicks(lo - pad, hi + pad, 4), y0 = ticks[0], y1 = ticks[ticks.length - 1];
    var x = function (t) { return L + (t - start) / (end - start) * (W - L - R); };
    var y = function (v) { return T + (1 - (v - y0) / (y1 - y0)) * (H - T - B); };

    var svg = el("svg", { viewBox: "0 0 " + W + " " + H, role: "img", "aria-label": M.name + " near Vida over the last " + span + ", from " + M.fmt(Math.min.apply(0, pts.map(function (p) { return p.v; }))) + " to " + M.fmt(Math.max.apply(0, pts.map(function (p) { return p.v; }))) + M.unit + (hasFc ? ". NOAA forecasts " + M.fmt(last(fpts).v) + M.unit + " by " + whenFmt(last(fpts).t) : "") });
    if (hasFc) el("rect", { x: x(now), y: T, width: x(end) - x(now), height: H - T - B, fill: "rgba(181,101,43,.07)" }, svg);
    var g = el("g", { class: "grid" }, svg);
    ticks.forEach(function (v) {
      el("line", { x1: L, x2: W - R, y1: y(v), y2: y(v) }, g);
      el("text", { x: L - 8, y: y(v) + 4, "text-anchor": "end" }, svg).textContent = M.fmt(v);
    });
    /* x labels: day + hour on the 24-hour view, dates otherwise */
    var stepMs = days === 1 ? 12 * 36e5 : days === 7 ? 864e5 : 7 * 864e5, first = new Date(start);
    if (days === 1) first.setMinutes(0, 0, 0), first.setHours(Math.ceil(first.getHours() / 12) * 12); else first.setHours(24, 0, 0, 0);
    var lastX = -1e9;
    for (var t = +first; t <= end; t += stepMs) {
      var lab = days === 1 ? (new Date(t).getHours() ? "Noon" : new Date(t).toLocaleDateString([], { weekday: "short" })) : new Date(t).toLocaleDateString([], { month: "short", day: "numeric" });
      var tx = x(t); if (tx < L + 20 || tx > W - R - 20 || tx - lastX < (days === 1 ? 84 : 64)) continue; lastX = tx;
      el("text", { x: tx, y: H - 6, "text-anchor": "middle" }, svg).textContent = lab;
    }
    var path = function (a) { return a.map(function (p, i) { return (i ? "L" : "M") + x(p.t).toFixed(1) + " " + y(p.v).toFixed(1); }).join(""); };
    var line = path(pts);
    el("path", { d: line + "L" + x(last(pts).t).toFixed(1) + " " + (H - B) + "L" + x(pts[0].t).toFixed(1) + " " + (H - B) + "Z", fill: "rgba(45,90,85,.10)" }, svg);
    el("path", { d: line, fill: "none", stroke: "#2d5a55", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
    if (hasFc) {
      el("path", { d: path([last(pts)].concat(fpts)), fill: "none", stroke: "#b5652b", "stroke-width": 2, "stroke-linejoin": "round" }, svg);
      /* today line */
      el("line", { x1: x(now), x2: x(now), y1: T - 6, y2: H - B, stroke: "#1c2422", "stroke-width": 1.5, "stroke-dasharray": "2 4", "stroke-linecap": "round" }, svg);
      el("text", { x: x(now) - 6, y: T - 10, "text-anchor": "end", style: "font-weight:600;fill:#1c2422" }, svg).textContent = "Now";
      el("text", { x: x(now) + 6, y: T - 10, "text-anchor": "start", style: "font-weight:600;fill:#94501f" }, svg).textContent = "Forecast →";
    }
    var cross = el("line", { y1: T, y2: H - B, stroke: "#1c2422", "stroke-width": 1, opacity: 0 }, svg);
    var dot = el("circle", { r: 5, fill: "#2d5a55", stroke: "#fff", "stroke-width": 2, opacity: 0 }, svg);
    var hit = el("rect", { class: "hit", x: L, y: 0, width: W - L - R, height: H }, svg);
    box.insertBefore(svg, box.firstChild);

    var tip = $("tip");
    function show(cx) {
      var tt = start + (cx - L) / (W - L - R) * (end - start), lo2 = 0, hi2 = both.length - 1;
      while (hi2 - lo2 > 1) { var mid = (lo2 + hi2) >> 1; if (both[mid].t < tt) lo2 = mid; else hi2 = mid; }
      var p = Math.abs(both[lo2].t - tt) < Math.abs(both[hi2].t - tt) ? both[lo2] : both[hi2], px = x(p.t), py = y(p.v);
      cross.setAttribute("x1", px); cross.setAttribute("x2", px); cross.setAttribute("opacity", .35);
      dot.setAttribute("cx", px); dot.setAttribute("cy", py); dot.setAttribute("fill", p.f ? "#b5652b" : "#2d5a55"); dot.setAttribute("opacity", 1);
      tip.innerHTML = "<b>" + M.fmt(p.v) + M.unit + "</b>" + (p.f ? "Forecast · " : "") + whenFmt(p.t);
      tip.style.left = Math.min(Math.max(px, 80), W - 80) + "px"; tip.style.top = (py - 62 < 0 ? py + 16 : py - 62) + "px"; tip.style.opacity = 1;
    }
    function hide() { cross.setAttribute("opacity", 0); dot.setAttribute("opacity", 0); tip.style.opacity = 0; }
    var pos = function (e) { var r = svg.getBoundingClientRect(), c = e.touches ? e.touches[0] : e; return (c.clientX - r.left) * W / r.width; };
    hit.addEventListener("mousemove", function (e) { show(pos(e)); });
    hit.addEventListener("touchmove", function (e) { show(pos(e)); }, { passive: true });
    hit.addEventListener("mouseleave", hide); hit.addEventListener("touchend", hide);
    table(both);
  }

  /* table view: one row per day (per 3 hours for 24h), newest first; forecast rows marked */
  function table(pts) {
    var M = METRIC[metric], groups = {}, keys = [];
    set("t-when", days === 1 ? "Time" : "Day");
    pts.forEach(function (p) {
      var d = new Date(p.t); if (days === 1) d.setMinutes(0, 0, 0), d.setHours(Math.floor(d.getHours() / 3) * 3); else d.setHours(0, 0, 0, 0);
      var k = (p.f ? "f" : "o") + (+d); if (!groups[k]) { groups[k] = []; keys.push(k); } groups[k].push(p.v);
    });
    $("t-body").innerHTML = keys.reverse().map(function (k) {
      var a = groups[k], avg = a.reduce(function (s, v) { return s + v; }, 0) / a.length, when = new Date(+k.slice(1)), isF = k[0] === "f";
      var lab = days === 1 ? when.toLocaleString([], { weekday: "short", hour: "numeric" }) : when.toLocaleDateString([], { weekday: "short", month: "short", day: "numeric" });
      return "<tr" + (isF ? ' class="fc"' : "") + "><td>" + lab + (isF ? ' <span class="fc-tag">Forecast</span>' : "") + "</td><td>" + M.fmt(Math.min.apply(0, a)) + M.unit + "</td><td>" + M.fmt(avg) + M.unit + "</td><td>" + M.fmt(Math.max.apply(0, a)) + M.unit + "</td></tr>";
    }).join("");
  }
  var rt; window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(draw, 150); });

  /* ---------- 3. Along the river: each card loads its own 7-day line when it scrolls near view ---------- */
  var wrap = $("gauges");
  wrap.innerHTML = GAUGES.map(function (g) {
    return '<div class="gc' + (g[0] === VIDA ? " featured" : "") + '" id="g' + g[0] + '" data-site="' + g[0] + '"><span class="where">' + g[2] + '</span><h3>' + g[1] + '</h3>' +
      '<div class="vals"><div><b class="f">—</b> <span>cfs</span></div><div><b class="t">—</b> <span>water</span></div></div>' +
      '<div class="spark-wrap"><span class="spin sm" aria-hidden="true"></span><svg class="spark" viewBox="0 0 300 44" preserveAspectRatio="none" aria-hidden="true"><rect class="fcband" y="0" height="44" fill="rgba(181,101,43,.08)" width="0"/><line class="nowl" y1="0" y2="44" stroke="#1c2422" stroke-width="1" stroke-dasharray="2 3" vector-effect="non-scaling-stroke" opacity="0"/><path class="obs" fill="none" stroke="#2d5a55" stroke-width="2" vector-effect="non-scaling-stroke"/><path class="fcp" fill="none" stroke="#b5652b" stroke-width="2" vector-effect="non-scaling-stroke"/></svg></div>' +
      '<div class="spark-cap"><span>Last 7 days</span><span class="fc-lab"></span></div>' +
      '<div class="row"><span class="tr"></span><a href="https://waterdata.usgs.gov/monitoring-location/' + g[0] + '/" target="_blank" rel="noopener">USGS ' + g[0] + ' ↗</a></div></div>';
  }).join("");

  function sparkFill(site, pts, fpts) {
    var card = $("g" + site); if (!card) return;
    card.querySelector(".spark-wrap").classList.add("done");
    var week = pts.filter(function (p) { return p.t >= Date.now() - 7 * 864e5; });
    var tr = trend(week), trEl = card.querySelector(".tr");
    if (tr) trEl.textContent = tr[0] + " " + tr[1]; else if (!week.length) trEl.textContent = trEl.textContent || "No recent flow line";
    if (week.length < 2) return;
    var now = last(week).t;
    fpts = (fpts || []).filter(function (p) { return p.t > now; });
    var both = week.concat(fpts), vs = both.map(function (p) { return p.v; }), lo = Math.min.apply(0, vs), hi = Math.max.apply(0, vs),
        span = Math.max(hi - lo, hi * 0.2) || 1, base = (hi + lo) / 2 - span / 2, t0 = week[0].t, end = fpts.length ? last(fpts).t : now, dt = (end - t0) || 1;
    var X = function (t) { return (t - t0) / dt * 300; }, Y = function (v) { return 40 - (v - base) / span * 36; };
    var line = function (a) { return a.map(function (p, i) { return (i ? "L" : "M") + X(p.t).toFixed(1) + " " + Y(p.v).toFixed(1); }).join(" "); };
    card.querySelector(".spark path.obs").setAttribute("d", line(week));
    if (fpts.length) {
      var nx = X(now).toFixed(1);
      card.querySelector(".spark path.fcp").setAttribute("d", line([last(week)].concat(fpts)));
      var nl = card.querySelector(".spark .nowl"); nl.setAttribute("x1", nx); nl.setAttribute("x2", nx); nl.setAttribute("opacity", ".6");
      var band = card.querySelector(".spark .fcband"); band.setAttribute("x", nx); band.setAttribute("width", (300 - nx).toFixed(1));
      card.querySelector(".fc-lab").textContent = "NOAA forecast to " + last(fpts).t.toLocaleDateString([], { month: "short", day: "numeric" }) + " →";
    }
    card.querySelector(".spark").setAttribute("aria-label", "Flow, last 7 days" + (fpts.length ? ", then NOAA forecast to " + whenFmt(last(fpts).t) + ": " + Math.round(last(fpts).v).toLocaleString() + " cfs" : ""));
  }
  function loadCard(card) {
    var site = card.dataset.site, g = GAUGES.filter(function (x) { return x[0] === site; })[0];
    var hist = site === VIDA ? vidaHist : history(site, ["00060"], 7);
    var fcst = noaa(g[3]).then(function (f) { return f["00060"]; }, function () { return []; });
    Promise.all([hist, fcst])
      .then(function (r) { sparkFill(site, r[0]["00060"] || [], r[1]); })
      .catch(function () { card.querySelector(".spark-wrap").classList.add("done"); card.querySelector(".tr").textContent = "Flow line unavailable"; });
  }
  var cards = wrap.querySelectorAll(".gc");
  if ("IntersectionObserver" in window) {
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); loadCard(e.target); } });
    }, { rootMargin: "400px 0px" });
    cards.forEach(function (c) { io.observe(c); });
  } else cards.forEach(loadCard);
})();
