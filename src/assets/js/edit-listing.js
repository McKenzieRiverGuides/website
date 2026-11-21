/* Edit your listing: talks to the "MRGA Guide Editor" Apps Script web app.
   The emailed link only opens on pages listed in that script's EDIT_PAGES allowlist (see AGENTS.md).
   ?demo shows the editor with a made-up guide so the page can be checked without signing in. */
var EDITOR_API = "https://script.google.com/macros/s/AKfycbzmNTYTz5LIjdLwQSVzPWJOhQcTnpocAAtFQa8vMQlH2jJge_zvlLEeplJOLdWuE_TI/exec";

(function () {
  var esc = MRGA.esc, token = "", options = [], guide = null, demo = /[?&]demo\b/.test(location.search);
  var $ = function (id) { return document.getElementById(id); };

  function msg(el, kind, text) { $(el).innerHTML = text ? '<div class="msg ' + kind + '" role="' + (kind === "err" ? "alert" : "status") + '">' + esc(text) + "</div>" : ""; }
  function api(body) {
    if (!EDITOR_API) return Promise.reject(new Error("The editor isn't connected yet."));
    return fetch(EDITOR_API, { method: "POST", body: JSON.stringify(body) })   // text/plain: no CORS preflight
      .then(function (r) { return r.json(); })
      .then(function (d) { if (!d.ok) throw new Error(d.error); return d; });
  }

  /* Step 1 */
  $("requestForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var email = $("email").value.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return msg("requestMsg", "err", "Please enter a valid email address.");
    var b = this.querySelector("button"); b.disabled = true; b.textContent = "Sending…";
    api({ action: "request", email: email, page: location.origin + location.pathname })
      .then(function (d) { msg("requestMsg", "ok", d.message); })
      .catch(function (err) { msg("requestMsg", "err", err.message); })
      .then(function () { b.disabled = false; b.textContent = "Email me a link"; });
  });

  /* Step 2 */
  function readForm() {
    return {
      business: $("f-business").value.trim(), link: $("f-link").value.trim(), phone: $("f-phone").value.trim(),
      publicEmail: $("f-email").value.trim(), bio: $("f-bio").value.trim(),
      specialty: [].map.call(document.querySelectorAll("#f-specialty input:checked"), function (c) { return c.value; })
    };
  }
  function renderPreview() {
    var f = readForm(), links = [];
    if (f.phone) links.push("<a>" + esc(f.phone) + "</a>");
    if (f.link) links.push("<a>" + esc(f.link.replace(/^https?:\/\/(www\.)?/i, "").replace(/\/$/, "")) + " ↗</a>");
    $("preview").innerHTML = '<div class="gcard-top"><span class="mono" aria-hidden="true">' + esc((guide.first[0] || "") + (guide.last[0] || "")) + "</span><div>" +
      "<h3>" + esc(guide.first + " " + guide.last) + "</h3>" + (f.business ? '<p class="biz">' + esc(f.business) + "</p>" : "") + "</div></div>" +
      (guide.life ? '<span class="badge">Life member</span>' : "") +
      (f.specialty.length ? '<p class="specs">' + esc(f.specialty.join(" · ")) + "</p>" : "") +
      (links.length ? '<div class="gcard-links">' + links.join("") + "</div>" : "");
  }
  function showEditor(g, opts) {
    guide = g; options = opts.slice();
    g.specialty.forEach(function (s) { if (options.indexOf(s) < 0) options.push(s); });   // keep anything not in the list
    $("editName").textContent = g.first + " " + g.last;
    $("f-business").value = g.business || ""; $("f-link").value = g.link || ""; $("f-phone").value = g.phone || "";
    $("f-email").value = g.publicEmail || "";
    $("f-bio").value = g.bio || "";
    $("f-specialty").innerHTML = options.map(function (o) {
      return '<label class="check"><input type="checkbox" value="' + esc(o) + '"' + (g.specialty.indexOf(o) > -1 ? " checked" : "") + "> " + esc(o) + "</label>";
    }).join("");
    $("stepRequest").hidden = true; $("stepEdit").hidden = false;
    renderPreview();
  }
  $("editForm").addEventListener("input", renderPreview);
  $("editForm").addEventListener("submit", function (e) {
    e.preventDefault();
    var b = $("saveBtn"); b.disabled = true; b.textContent = "Saving…";
    var done = function () { b.disabled = false; b.textContent = "Save changes"; };
    var pe = $("f-email").value.trim();
    if (pe && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(pe)) { msg("editMsg", "err", "That email address doesn't look right. Example: you@example.com"); done(); return; }
    if (demo) { msg("editMsg", "ok", "Demo only: nothing was saved. In the real editor your listing updates on the website within a few minutes."); done(); return; }
    api({ action: "save", token: token, fields: readForm() })
      .then(function (d) { msg("editMsg", "ok", d.message); })
      .catch(function (err) { msg("editMsg", "err", err.message); })
      .then(done);
  });

  /* Arriving from the emailed link: #<token>. Take it out of the address bar right away. */
  var h = location.hash.slice(1);
  if (/^[a-f0-9]{64}$/.test(h)) {
    token = h; history.replaceState(null, "", location.pathname + location.search);
    $("stepRequest").hidden = true;
    api({ action: "load", token: token })
      .then(function (d) { showEditor(d.guide, d.specialtyOptions); })
      .catch(function (err) { $("stepRequest").hidden = false; msg("requestMsg", "err", err.message); });
  } else if (demo) {
    showEditor({ first: "Sample", last: "Guide", business: "Sample Guide Service", link: "https://example.com", phone: "541-555-0123", publicEmail: "", bio: "", life: false,
      specialty: ["McKenzie River", "Drift boat"] },
      ["National Forest McKenzie", "McKenzie River", "Willamette", "Drift boat", "Fly fishing", "Scenic tours", "White water rafting"]);
  }
})();
