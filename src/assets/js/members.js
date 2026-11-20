/* Members & supporters: the list is already in the page (baked at build time); this quietly refreshes it
   from the live sheet. Members tab columns: Name ("Last, First"), Retired Guide, Life Member, Honorary Member.
   Retired guides first, then everyone else as associate members. Keep in step with src/members.njk. */
(function () {
  var out = document.getElementById("lists"), esc = MRGA.esc, baked = MRGA.baked("members-data") || [];
  function yes(v) { return /^y/i.test(v || ""); }
  function display(n) { var p = n.split(","); return p.length > 1 ? (p.slice(1).join(",").trim() + " " + p[0].trim()) : n; }
  function li(m) {
    var tags = [];
    if (yes(m["Life Member"])) tags.push("Life");
    if (yes(m["Honorary Member"])) tags.push("Honorary");
    return "<li>" + esc(display(m.Name)) + tags.map(function (t) { return '<span class="tag">' + t + "</span>"; }).join("") + "</li>";
  }
  function list(ms, letters) {
    var html = "", last = "";
    ms.forEach(function (m) {
      var L = m.Name.charAt(0).toUpperCase();
      if (letters && L !== last) { html += '<li class="letter" aria-hidden="true">' + esc(L) + "</li>"; last = L; }
      html += li(m);
    });
    return '<ul class="names">' + html + "</ul>";
  }
  var cols = ["Name", "Retired Guide", "Life Member", "Honorary Member"];
  var key = function (rows) { return JSON.stringify(rows.map(function (m) { return cols.map(function (c) { return m[c] || ""; }); })); };
  MRGA.sheet("Members").then(function (rows) {
    rows = rows.filter(function (m) { return m.Name; }).sort(function (a, b) { return a.Name.localeCompare(b.Name); });
    if (key(rows) === key(baked)) return;            // nothing changed since the build
    var retired = rows.filter(function (m) { return yes(m["Retired Guide"]); }),
        assoc = rows.filter(function (m) { return !yes(m["Retired Guide"]); });
    out.innerHTML =
      (retired.length ? '<div class="name-group"><span class="eyebrow">' + retired.length + ' retired guides</span><h2>Retired guides</h2>' +
        '<p>Guides who spent their careers on the McKenzie and remain part of the association.</p>' + list(retired, false) + "</div>" : "") +
      '<div class="name-group"><span class="eyebrow">' + assoc.length + ' associate members</span><h2>Associate members</h2>' +
        '<p>Friends of the river who support the association. Thank you.</p>' + list(assoc, true) + "</div>";
  }).catch(function () {
    if (!baked.length) out.innerHTML = '<p class="empty">The member list couldn’t load right now. Please try again shortly.</p>';
  });
})();
