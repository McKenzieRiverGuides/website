/* Find a Guide: the list is already in the page (baked at build time from the public sheet).
   This adds search + Specialty chips, then quietly refreshes from the live sheet.
   Sheet columns (Guides tab): First Name, Last Name, Business, Link, Phone, Life Member, Specialty. Never show town. */
(function () {
  var grid = document.getElementById("grid"), count = document.getElementById("count"),
      q = document.getElementById("q"), chipsEl = document.getElementById("chips"),
      guides = MRGA.baked("guides-data") || [], active = null, esc = MRGA.esc;

  function specs(g) { return (g["Specialty"] || "").split(/[,;]/).map(function (s) { return s.trim(); }).filter(Boolean); }
  function host(url) { try { return new URL(/^https?:/i.test(url) ? url : "https://" + url).hostname.replace(/^www\./, ""); } catch (e) { return "Website"; } }
  function href(url) { return /^https?:/i.test(url) ? url : "https://" + url; }

  /* Keep in step with src/_includes/partials/gcard.njk */
  function card(g) {
    var name = (g["First Name"] + " " + g["Last Name"]).trim(),
        ini = ((g["First Name"] || "")[0] || "") + ((g["Last Name"] || "")[0] || ""),
        sp = specs(g), links = [];
    if (g.Phone) links.push('<a href="tel:' + esc(g.Phone.replace(/[^\d+]/g, "")) + '">' + esc(g.Phone) + "</a>");
    if (g.Link) links.push('<a href="' + esc(href(g.Link)) + '" target="_blank" rel="noopener">' + esc(host(g.Link)) + " ↗</a>");
    return '<article class="gcard"><div class="gcard-top"><span class="mono" aria-hidden="true">' + esc(ini) + "</span><div>" +
      "<h3>" + esc(name) + "</h3>" + (g.Business ? '<p class="biz">' + esc(g.Business) + "</p>" : "") + "</div></div>" +
      (/^y/i.test(g["Life Member"]) ? '<span class="badge">Life member</span>' : "") +
      (sp.length ? '<p class="specs">' + esc(sp.join(" · ")) + "</p>" : "") +
      (links.length ? '<div class="gcard-links">' + links.join("") + "</div>" : "") + "</article>";
  }

  function render() {
    var term = q.value.trim().toLowerCase();
    var list = guides.filter(function (g) {
      var hay = [g["First Name"], g["Last Name"], g.Business, g.Specialty].join(" ").toLowerCase();
      return (!term || hay.indexOf(term) > -1) && (!active || specs(g).indexOf(active) > -1);
    });
    grid.classList.remove("skeleton");
    grid.innerHTML = list.length ? list.map(card).join("") :
      '<p class="empty" style="grid-column:1/-1">No guides match “' + esc(q.value) + '”. Try a different name.</p>';
    count.textContent = list.length === guides.length ? guides.length + " active guides" : list.length + " of " + guides.length + " guides";
  }

  function buildChips() {
    var all = {};
    guides.forEach(function (g) { specs(g).forEach(function (s) { all[s] = 1; }); });
    var keys = Object.keys(all).sort();
    if (keys.indexOf(active) < 0) active = null;
    chipsEl.hidden = !keys.length;
    chipsEl.innerHTML = keys.map(function (k) { return '<button class="chip" type="button" aria-pressed="' + (k === active) + '">' + esc(k) + "</button>"; }).join("");
  }
  chipsEl.addEventListener("click", function (e) {
    var c = e.target.closest(".chip"); if (!c) return;
    active = c.getAttribute("aria-pressed") === "true" ? null : c.textContent;
    chipsEl.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c && active ? "true" : "false"); });
    render();
  });
  q.addEventListener("input", function () { if (guides.length) render(); });

  var sorted = function (rows) {
    return rows.filter(function (g) { return g["First Name"] || g["Last Name"]; })
      .sort(function (a, b) { return (a["Last Name"] + a["First Name"]).localeCompare(b["Last Name"] + b["First Name"]); });
  };
  var cols = ["First Name", "Last Name", "Business", "Link", "Phone", "Life Member", "Specialty"];
  var key = function (rows) { return JSON.stringify(rows.map(function (g) { return cols.map(function (c) { return g[c] || ""; }); })); };
  MRGA.sheet("Guides").then(function (rows) {
    rows = sorted(rows);
    if (key(rows) === key(guides)) return;          // nothing changed since the build
    guides = rows; buildChips(); render();
  }).catch(function () {
    if (guides.length) return;                      // keep the built-in list
    grid.classList.remove("skeleton");
    grid.innerHTML = '<p class="empty" style="grid-column:1/-1">The guide list couldn’t load right now. Please try again shortly.</p>';
    count.textContent = "";
  });
})();
