/* On-site editor, part 2: loaded by admin.js only when an admin is signed in.
   Adds "New post" / "New event" buttons on News & Stories, Edit / Delete on every post and event card, and a
   form that slides in from the side. Saves go to /api/admin/* (functions/api/admin/[[path]].js), which writes the
   same Markdown files Pages CMS writes; the website rebuilds and shows the change in about 3 minutes.
   Local preview (localhost): nothing is saved. Changes are kept in this browser only, shown on the page with a
   "Preview" tag, and the file that WOULD be saved is shown after each save. */
(function () {
  var A = window.MRGA_ADMIN;
  if (!A || !A.user) return;
  var PREVIEW = A.preview;
  var CHANGES_KEY = "mrga-admin-preview-changes";
  var DEFAULT_CATS = ["on the river", "River Management", "Community Event", "Events on the River", "River Clean-up"];

  // ---------------------------------------------------------------- small helpers
  function el(tag, attrs, kids) {
    var n = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === "text") n.textContent = attrs[k];
      else if (k === "html") n.innerHTML = attrs[k];
      else if (k.slice(0, 2) === "on") n.addEventListener(k.slice(2), attrs[k]);
      else if (attrs[k] === true) n.setAttribute(k, "");
      else if (attrs[k] !== false && attrs[k] != null) n.setAttribute(k, attrs[k]);
    });
    (kids || []).forEach(function (k) { if (k) n.appendChild(typeof k === "string" ? document.createTextNode(k) : k); });
    return n;
  }
  function slugify(s) {
    return String(s || "").normalize("NFKD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/['’‘`]/g, "")
      .replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80).replace(/-+$/, "") || "untitled";
  }
  function today() { var d = new Date(); return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2) + "-" + ("0" + d.getDate()).slice(-2); }
  function rid() { return Math.random().toString(36).slice(2, 8); }
  function loadScript(src) {
    return new Promise(function (ok, bad) { var s = el("script", { src: src }); s.onload = ok; s.onerror = bad; document.head.appendChild(s); });
  }
  var libs = null;
  function needLibs() {
    libs = libs || Promise.all([loadScript("/assets/vendor/marked.js"), loadScript("/assets/vendor/turndown.js")]);
    return libs;
  }
  var markedReady = false;
  function mdToHtml(md) {
    if (!window.marked) return "";
    if (!markedReady) {
      // Like the website, a web address typed as plain text stays plain text (not turned into a link)
      window.marked.use({ tokenizer: { url: function (src) {
        var m = /^(?:https?:\/\/|www\.)[^\s<]*[^\s<?!.,:;*_~)'"]/i.exec(src);
        return m ? { type: "text", raw: m[0], text: m[0] } : undefined;
      } } });
      markedReady = true;
    }
    return window.marked.parse(String(md || ""));
  }
  var td = null;
  function htmlToMd(html) {
    if (!td) {
      td = new window.TurndownService({ headingStyle: "atx", bulletListMarker: "-", emDelimiter: "*", codeBlockStyle: "fenced" });
      td.remove(["script", "style"]);
      // Write lists as "- item" / "1. item" (like the existing posts), not "-   item"
      td.addRule("listItem", { filter: "li", replacement: function (text, node, o) {
        text = text.replace(/^\n+/, "").replace(/\n+$/, "\n").replace(/\n/gm, "\n  ");
        var p = node.parentNode, prefix = o.bulletListMarker + " ";
        if (p.nodeName === "OL") { var start = p.getAttribute("start"); prefix = ((start ? +start : 1) + Array.prototype.indexOf.call(p.children, node)) + ". "; }
        return prefix + text + (node.nextSibling && !/\n$/.test(text) ? "\n" : "");
      } });
    }
    return td.turndown(html).replace(/\n[ \t]+\n/g, "\n\n").replace(/\n{3,}/g, "\n\n").trim();
  }
  function readChanges() { try { return JSON.parse(localStorage.getItem(CHANGES_KEY) || "{}"); } catch (e) { return {}; } }
  function writeChanges(c) { try { localStorage.setItem(CHANGES_KEY, JSON.stringify(c)); } catch (e) {} }

  // Everything already on the website (built into /admin/content.json): drafts, and the preview's form data
  var content = fetch("/admin/content.json?v=" + A.version).then(function (r) { return r.json(); })
    .catch(function () { return { posts: [], events: [] }; });
  function knownItem(type, path) {
    return content.then(function (c) { return (c[type] || []).filter(function (x) { return x.path === path; })[0] || null; });
  }

  // ---------------------------------------------------------------- talking to the website (or pretending to)
  function signedOut() {
    A.forget();
    toast("Your admin sign-in has ended. Sign in again from “Admin sign in” at the bottom of any page.", true);
    document.querySelectorAll(".adm-tools,.adm-bar,.adm-new,.adm-drafts").forEach(function (n) { n.remove(); });
  }
  function call(method, route, body) {
    return fetch("/api/admin/" + route, {
      method: method, credentials: "same-origin", redirect: "manual",
      headers: body ? { "Content-Type": "application/json" } : {},
      body: body ? JSON.stringify(body) : undefined,
    }).then(function (r) {
      if (r.type === "opaqueredirect" || r.status === 401 || r.status === 403) { signedOut(); throw new Error("Please sign in again."); }
      return r.json().catch(function () { return {}; }).then(function (d) {
        if (!r.ok) throw new Error(d.error || "The website didn't answer. Nothing was saved. Try again in a minute.");
        return d;
      });
    });
  }
  var api = PREVIEW ? {
    get: function (type, path) {
      var ch = readChanges()[path];
      if (ch && !ch.deleted) return Promise.resolve({ path: path, fields: ch.fields, body: ch.body || "", sha: "preview" });
      return knownItem(type, path).then(function (it) {
        if (!it) throw new Error("Couldn't find that item.");
        return { path: path, fields: it.fields, body: it.body || "", sha: "preview" };
      });
    },
    save: function (req) {
      return content.then(function (c) {
        var path = req.path;
        if (!path) {
          var dir = req.type === "posts" ? "src/posts/" : "src/events/";
          var base = dir + (req.type === "posts" ? req.fields.date + "-" : "") + slugify(req.fields.title);
          var taken = (c[req.type] || []).map(function (x) { return x.path; }).concat(Object.keys(readChanges()));
          path = base + ".md";
          for (var n = 2; taken.indexOf(path) >= 0; n++) path = base + "-" + n + ".md";
        }
        var all = readChanges();
        all[path] = { type: req.type, fields: req.fields, body: req.body, isNew: !req.path || (all[req.path] && all[req.path].isNew) };
        writeChanges(all);
        return { path: path, url: itemUrl(req.type, path), file: previewFile(req.type, path, req) };
      });
    },
    del: function (type, path) {
      var all = readChanges();
      if (all[path] && all[path].isNew) delete all[path]; else all[path] = { type: type, deleted: true };
      writeChanges(all);
      return Promise.resolve({ ok: true });
    },
  } : {
    get: function (type, path) { return call("GET", "item?type=" + type + "&path=" + encodeURIComponent(path)); },
    save: function (req) { return call("POST", "save", req); },
    del: function (type, path, sha) { return call("POST", "delete", { type: type, path: path, sha: sha }); },
  };
  function itemUrl(type, path) {
    return type === "posts" ? "/news/" + path.split("/").pop().replace(/\.md$/, "").replace(/^\d{4}-\d{2}-\d{2}-/, "") + "/" : "/news/#events";
  }
  // What the file would look like (preview only; the real file is put together by the save function)
  function previewFile(type, path, req) {
    var dir = type === "posts" ? "/images/posts/" + itemUrl(type, path).split("/")[2] : "/images/events";
    var fix = function (s) { return String(s || "").replace(/upload:/g, dir + "/"); };
    var lines = Object.keys(req.fields).filter(function (k) {
      var v = req.fields[k]; return !(v === "" || v === false || (Array.isArray(v) && !v.length));
    }).map(function (k) {
      var v = req.fields[k];
      if (k === "cover") v = fix(v);
      return k + ": " + (/date$/.test(k) || typeof v === "boolean" ? v : JSON.stringify(v));
    });
    var photos = (req.uploads || []).map(function (u) { return "src" + dir + "/" + u.name; });
    return { path: path, text: "---\n" + lines.join("\n") + "\n---\n" + fix(req.body || ""), photos: photos };
  }

  // ---------------------------------------------------------------- messages
  var toastBox = null;
  function toast(msg, sticky, extra) {
    if (!toastBox) { toastBox = el("div", { class: "adm-toasts", "aria-live": "polite" }); document.body.appendChild(toastBox); }
    var t = el("div", { class: "adm-toast" }, [el("p", { text: msg }), extra || null,
      el("button", { type: "button", class: "adm-x", "aria-label": "Close", text: "×", onclick: function () { t.remove(); } })]);
    toastBox.appendChild(t);
    if (!sticky && !extra) setTimeout(function () { t.remove(); }, 7000);
  }

  // ---------------------------------------------------------------- admin bar (bottom of every page)
  var bar = el("div", { class: "adm-bar", role: "region", "aria-label": "Admin" }, [
    el("span", { class: "adm-who" }, [el("strong", { text: "Admin" }), " " + A.user.email]),
    PREVIEW ? el("span", { class: "adm-preview-tag", text: "Preview mode", title: "Nothing is saved to the website in the preview" }) : null,
    location.pathname.indexOf("/news/") !== 0 ? el("a", { href: "/news/", text: "News & Stories" }) : null,
    PREVIEW && Object.keys(readChanges()).length ? el("button", { type: "button", text: "Undo preview changes", onclick: function () {
      if (confirm("Remove all the changes you made in the preview? (Nothing was saved to the website.)")) { writeChanges({}); location.reload(); }
    } }) : null,
    el("button", { type: "button", text: "Sign out", onclick: function () { A.signOut(); } }),
  ]);
  document.body.appendChild(bar);
  document.body.classList.add("adm-on");

  // Live: make sure the Cloudflare sign-in is still good
  if (!PREVIEW) call("GET", "me").catch(function () {});

  // ---------------------------------------------------------------- buttons on the page
  function typeOf(path) { return path.indexOf("src/events/") === 0 ? "events" : "posts"; }
  function addTools(node) {
    if (node.querySelector(":scope > .adm-tools")) return;
    var path = node.getAttribute("data-item"), type = typeOf(path);
    var label = type === "posts" ? "post" : "event";
    var stop = function (fn) { return function (e) { e.preventDefault(); e.stopPropagation(); fn(); }; };
    var tools = el("div", { class: "adm-tools" }, [
      el("button", { type: "button", text: "Edit", "aria-label": "Edit this " + label, onclick: stop(function () { openForm(type, path); }) }),
      el("button", { type: "button", class: "adm-del", text: "Delete", "aria-label": "Delete this " + label, onclick: stop(function () { removeItem(type, path, node); }) }),
    ]);
    var head = node.matches("article") ? node.querySelector(".article-head .wrap") : node;
    head.appendChild(tools);
  }
  function addAllTools() { document.querySelectorAll("[data-item]").forEach(addTools); }

  document.querySelectorAll("[data-admin-new]").forEach(function (slot) {
    var type = slot.getAttribute("data-admin-new");
    slot.hidden = false;
    slot.appendChild(el("button", {
      type: "button", class: "btn adm-new " + (type === "posts" ? "btn-cedar" : "btn-line"),
      text: type === "posts" ? "+ New post" : "+ New event", onclick: function () { openForm(type, null); },
    }));
  });

  // Drafts aren't on the website, so list them for admins on News & Stories
  function showDrafts() {
    var grid = document.querySelector(".post-grid");
    if (!grid) return;
    content.then(function (c) {
      var ch = readChanges();
      var drafts = c.posts.filter(function (p) { var x = ch[p.path]; return x ? !x.deleted && x.fields.draft : p.fields.draft; });
      Object.keys(ch).forEach(function (path) { var x = ch[path]; if (x.isNew && x.type === "posts" && x.fields.draft) drafts.push({ path: path, fields: x.fields }); });
      var old = document.querySelector(".adm-drafts"); if (old) old.remove();
      if (!drafts.length) return;
      var box = el("div", { class: "adm-drafts" }, [el("h2", { text: "Drafts" }), el("p", { text: "Only admins see these. Untick “Draft” to put a post on the website." })]);
      var ul = el("ul");
      drafts.forEach(function (d) {
        var li = el("li", { "data-item": d.path }, [el("span", { text: d.fields.title || "(no headline)" })]);
        ul.appendChild(li); addTools(li);
      });
      box.appendChild(ul);
      grid.parentNode.insertBefore(box, grid);
    });
  }

  // ---------------------------------------------------------------- show changes on the page
  // Preview: every change kept in this browser. Live: the change just saved (the website catches up in ~3 min).
  function applyChange(path, ch) {
    var type = ch.type || typeOf(path);
    var nodes = document.querySelectorAll('[data-item="' + path + '"]');
    if (ch.deleted) {
      nodes.forEach(function (n) {
        if (n.matches("article")) { n.classList.add("adm-gone"); n.insertBefore(el("p", { class: "adm-banner", text: "This post has been deleted." }), n.firstChild); }
        else n.remove();
      });
      return;
    }
    var f = ch.fields || {};
    var tag = PREVIEW ? "Preview" : "Saved · live in ~3 min";
    if (!nodes.length && ch.isNew) {
      if (type === "posts" && !f.draft) {
        var grid = document.querySelector(".post-grid");
        if (grid) {
          var card = el("a", { class: "pcard", href: itemUrl(type, path), "data-item": path, "data-cats": (f.categories || []).join("|") });
          grid.insertBefore(card, grid.firstChild);
          nodes = [card];
        }
      } else if (type === "events") {
        var list = document.querySelector(".ev-cards");
        if (list) {
          var li = el("li", { class: "ev", "data-item": path }, [el("div", { class: "ev-date", "aria-hidden": "true" }), el("div", { class: "ev-body" })]);
          list.insertBefore(li, list.firstChild);
          nodes = [li];
        }
      }
    }
    nodes.forEach(function (n) {
      if (n.closest(".adm-drafts")) return;
      if (type === "posts" && f.draft && !n.matches("article")) { n.remove(); return; }
      if (n.matches(".pcard")) {
        n.innerHTML = "";
        n.appendChild(f.cover ? el("img", { class: "cover", src: shownSrc(f.cover), alt: "" }) : el("div", { class: "ph" }));
        if (f.categories && f.categories.length) n.appendChild(el("span", { class: "cat", text: f.categories[0] }));
        n.appendChild(el("h3", { text: f.title }));
        if (f.summary) n.appendChild(el("p", { text: f.summary }));
        n.appendChild(el("time", { text: monthYear(f.date) }));
      } else if (n.matches(".feature")) {
        var h = n.querySelector("h2"); if (h) h.textContent = f.title;
        var ps = n.querySelectorAll("div > p"); if (ps[0] && !ps[0].querySelector(".btn")) ps[0].textContent = f.summary || "";
        var img = n.querySelector("img.cover"); if (img && f.cover) img.src = shownSrc(f.cover);
        var t = n.querySelector("time"); if (t) t.textContent = monthYear(f.date);
      } else if (n.matches("article")) {
        var h1 = n.querySelector("h1"); if (h1) h1.textContent = f.title;
        var prose = n.querySelector(".prose");
        if (prose && ch.body != null) needLibs().then(function () { prose.innerHTML = mdToHtml(String(ch.body).replace(/upload:[\w.-]+/g, function (m) { return uploadSrc[m] || ""; })); });
        if (f.draft) n.insertBefore(el("p", { class: "adm-banner", text: "Draft: this post is hidden from the website." }), n.firstChild);
      } else if (n.matches(".ev")) {
        var d = f.event_date ? new Date(f.event_date + "T12:00:00") : null;
        var date = n.querySelector(".ev-date");
        date.innerHTML = "";
        date.appendChild(el("span", { class: "m", text: d ? d.toLocaleDateString("en-US", { month: "short" }) : "Date" }));
        date.appendChild(el("span", { class: "d" + (d ? "" : " tba"), text: d ? String(d.getDate()) : "TBA" }));
        var body = n.querySelector(".ev-body");
        body.innerHTML = "";
        if (f.members_only) body.appendChild(el("span", { class: "ev-tag", text: "Members only" }));
        body.appendChild(el("h3", { text: f.title }));
        body.appendChild(el("p", { class: "ev-when", text: d ? d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric" }) + (f.time ? " · " + f.time : "") : (f.when || "Date to come") }));
        if (f.place) body.appendChild(el("p", { class: "ev-place", text: f.place }));
        if (f.description) body.appendChild(el("p", { class: "ev-desc", text: f.description }));
      }
      var old = n.querySelector(".adm-changed"); if (old) old.remove();
      (n.matches("article") ? n.querySelector(".article-head .wrap") : n).appendChild(el("span", { class: "adm-changed", text: tag }));
      n.querySelectorAll(":scope > .adm-tools").forEach(function (x) { x.remove(); });
      addTools(n);
    });
  }
  // New photos only exist in this browser until saved
  var uploadSrc = {};
  function shownSrc(v) { return /^upload:/.test(v) ? uploadSrc[v] || "" : v; }
  function monthYear(d) { return d ? new Date(d + "T12:00:00").toLocaleDateString("en-US", { month: "long", year: "numeric" }) : ""; }

  addAllTools();
  if (PREVIEW) { var ch0 = readChanges(); Object.keys(ch0).forEach(function (p) { applyChange(p, ch0[p]); }); }
  showDrafts();

  // ---------------------------------------------------------------- delete
  function removeItem(type, path, node) {
    var name = (node.querySelector("h1,h2,h3,span") || {}).textContent || "this item";
    var msg = "Delete “" + name.trim() + "”?\n\n" + (PREVIEW
      ? "Preview: nothing on the website is deleted."
      : "It disappears from the website in about 3 minutes. (It can still be brought back from the website's history if needed.)");
    if (!confirm(msg)) return;
    var sha = null;
    (PREVIEW ? Promise.resolve() : api.get(type, path).then(function (it) { sha = it.sha; }))
      .then(function () { return api.del(type, path, sha); })
      .then(function () {
        applyChange(path, { type: type, deleted: true });
        showDrafts();
        toast(PREVIEW ? "Deleted in the preview only. Nothing on the website changed." : "Deleted. It will be gone from the website in about 3 minutes.");
        if (node.matches("article") && !PREVIEW) setTimeout(function () { location.href = "/news/"; }, 2500);
      })
      .catch(function (e) { toast(e.message, true); });
  }

  // ---------------------------------------------------------------- the form
  var drawer = null;
  function openForm(type, path) {
    if (drawer) return;
    var loading = path ? api.get(type, path) : Promise.resolve(null);
    Promise.all([loading, type === "posts" ? needLibs() : null, content]).then(function (r) {
      buildForm(type, path, r[0], r[2]);
    }).catch(function (e) { toast(e.message || "Couldn't open that item.", true); });
  }

  function buildForm(type, path, item, c) {
    var isPost = type === "posts";
    var f = item ? item.fields : isPost
      ? { title: "", date: today(), author: "Leah Helfrich", cover: "", summary: "", categories: [], draft: false }
      : { title: "", event_date: "", when: "", time: "", place: "", members_only: false, description: "" };
    var uploads = {}; // name → base64 (new photos for this save)
    var dirty = false;
    var lastFocus = document.activeElement;

    var form = el("form", { class: "adm-form", novalidate: true });
    form.addEventListener("input", function () { dirty = true; });
    var err = el("p", { class: "adm-error", role: "alert", hidden: true });

    function field(label, input, hint) {
      var id = "adm-" + rid();
      input.id = id;
      return el("div", { class: "adm-field" }, [el("label", { for: id, text: label }), input, hint ? el("p", { class: "adm-hint", text: hint }) : null]);
    }
    function text(name, attrs) { return el("input", Object.assign({ type: "text", name: name, value: f[name] || "" }, attrs || {})); }
    function area(name, rows) { var t = el("textarea", { name: name, rows: rows || 3 }); t.value = f[name] || ""; return t; }
    function check(name, label, hint) {
      var box = el("input", { type: "checkbox", name: name, checked: !!f[name] });
      return el("div", { class: "adm-field adm-check" }, [el("label", {}, [box, " " + label]), hint ? el("p", { class: "adm-hint", text: hint }) : null]);
    }

    // ---- photo picker (cover)
    var cover = f.cover || "";
    var coverBox = el("div", { class: "adm-photo" });
    var coverInput = el("input", { type: "file", accept: "image/*", hidden: true });
    function drawCover() {
      coverBox.innerHTML = "";
      if (cover) {
        coverBox.appendChild(el("img", { src: shownSrc(cover), alt: "Cover photo" }));
        coverBox.appendChild(el("div", { class: "adm-photo-btns" }, [
          el("button", { type: "button", class: "adm-small", text: "Change photo", onclick: function () { coverInput.click(); } }),
          el("button", { type: "button", class: "adm-small", text: "Remove photo", onclick: function () { cover = ""; dirty = true; drawCover(); } }),
        ]));
      } else {
        coverBox.appendChild(el("button", { type: "button", class: "adm-drop", onclick: function () { coverInput.click(); } }, [
          el("strong", { text: "Choose a cover photo" }), el("span", { text: "A landscape photo works best. Big photos are shrunk for the web automatically." })]));
      }
    }
    coverInput.addEventListener("change", function () {
      var file = coverInput.files[0]; coverInput.value = "";
      if (!file) return;
      shrink(file).then(function (dataUrl) {
        var name = "cover-" + rid() + ".jpg";
        uploads[name] = dataUrl.split(",")[1];
        cover = "upload:" + name; uploadSrc[cover] = dataUrl; dirty = true; drawCover();
      }).catch(function (e) { showError(e.message); });
    });

    // ---- categories (pick any, or add a new one)
    var cats = (f.categories || []).slice();
    var known = DEFAULT_CATS.slice();
    (c.posts || []).forEach(function (p) { (p.fields.categories || []).forEach(function (x) { if (known.indexOf(x) < 0) known.push(x); }); });
    cats.forEach(function (x) { if (known.indexOf(x) < 0) known.push(x); });
    var catBox = el("div", { class: "adm-cats", role: "group", "aria-label": "Categories" });
    var newCat = el("input", { type: "text", placeholder: "New category", "aria-label": "New category" });
    function drawCats() {
      catBox.innerHTML = "";
      known.forEach(function (x) {
        catBox.appendChild(el("button", { type: "button", class: "chip", "aria-pressed": String(cats.indexOf(x) >= 0), text: x, onclick: function () {
          var i = cats.indexOf(x); if (i >= 0) cats.splice(i, 1); else cats.push(x); dirty = true; drawCats();
        } }));
      });
    }
    function addCat() {
      var v = newCat.value.trim(); if (!v) return;
      if (known.indexOf(v) < 0) known.push(v);
      if (cats.indexOf(v) < 0) cats.push(v);
      newCat.value = ""; dirty = true; drawCats();
    }
    newCat.addEventListener("keydown", function (e) { if (e.key === "Enter") { e.preventDefault(); addCat(); } });

    // ---- the story: formatted text (saved as Markdown, like Pages CMS)
    var story = el("div", { class: "adm-rich prose", contenteditable: "true", role: "textbox", "aria-multiline": "true", "aria-label": "Story" });
    story.innerHTML = item && item.body ? mdToHtml(item.body) : "<p><br></p>";
    story.addEventListener("input", function () { dirty = true; });
    story.addEventListener("paste", function (e) {
      // Paste as plain text (keeps Word/email formatting junk out); a blank line starts a new paragraph
      var t = (e.clipboardData || window.clipboardData).getData("text/plain");
      if (!t) return;
      e.preventDefault();
      var html = t.replace(/\r/g, "").split(/\n\s*\n/).map(function (p) {
        return "<p>" + p.replace(/[&<>]/g, function (ch) { return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[ch]; }).replace(/\n/g, "<br>") + "</p>";
      }).join("");
      document.execCommand("insertHTML", false, html);
    });
    var storyPhoto = el("input", { type: "file", accept: "image/*", hidden: true });
    var savedRange = null;
    story.addEventListener("blur", function () { var s = getSelection(); if (s.rangeCount) savedRange = s.getRangeAt(0); });
    function restore() { story.focus(); if (savedRange) { var s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } }
    function cmd(name, val) { return function () { restore(); document.execCommand(name, false, val); dirty = true; }; }
    function tb(label, title, fn) { return el("button", { type: "button", title: title, "aria-label": title, html: label, onmousedown: function (e) { e.preventDefault(); }, onclick: fn }); }
    var toolbar = el("div", { class: "adm-toolbar", role: "toolbar", "aria-label": "Formatting" }, [
      tb("<b>B</b>", "Bold", cmd("bold")),
      tb("<i>I</i>", "Italic", cmd("italic")),
      tb("Heading", "Heading", function () {
        restore();
        var b = getSelection().anchorNode; b = b && (b.nodeType === 1 ? b : b.parentNode);
        document.execCommand("formatBlock", false, b && b.closest("h2") ? "p" : "h2"); dirty = true;
      }),
      tb("• List", "Bulleted list", cmd("insertUnorderedList")),
      tb("1. List", "Numbered list", cmd("insertOrderedList")),
      tb("Link", "Link", function () {
        restore();
        var u = prompt("Web address for the link (for example https://www.oregonsboat.org):");
        if (!u) return;
        if (!/^(https?:|mailto:|\/)/i.test(u)) u = "https://" + u;
        if (getSelection().isCollapsed) document.execCommand("insertHTML", false, '<a href="' + u.replace(/"/g, "%22") + '">' + u.replace(/</g, "&lt;") + "</a>");
        else document.execCommand("createLink", false, u);
        dirty = true;
      }),
      tb("Photo", "Add a photo here", function () { storyPhoto.click(); }),
    ]);
    storyPhoto.addEventListener("change", function () {
      var file = storyPhoto.files[0]; storyPhoto.value = "";
      if (!file) return;
      shrink(file).then(function (dataUrl) {
        var name = "photo-" + rid() + ".jpg";
        uploads[name] = dataUrl.split(",")[1]; uploadSrc["upload:" + name] = dataUrl;
        restore();
        document.execCommand("insertHTML", false, '<img src="' + dataUrl + '" data-upload="' + name + '" alt=""><p><br></p>');
        dirty = true;
      }).catch(function (e) { showError(e.message); });
    });

    // ---- lay out the fields
    var title = text("title", { required: true, autocomplete: "off" });
    var parts;
    if (isPost) {
      drawCover(); drawCats();
      parts = [
        field("Headline", title),
        el("div", { class: "adm-row" }, [field("Date", text("date", { type: "date", required: true }), "The website shows the month and year."), field("Written by", text("author"))]),
        el("div", { class: "adm-field" }, [el("span", { class: "adm-label", text: "Cover photo" }), coverBox, coverInput]),
        field("Short summary", area("summary", 3), "One or two sentences for the News page and the homepage."),
        el("div", { class: "adm-field" }, [el("span", { class: "adm-label", text: "Categories" }), catBox,
          el("div", { class: "adm-addcat" }, [newCat, el("button", { type: "button", class: "adm-small", text: "Add", onclick: addCat })]),
          el("p", { class: "adm-hint", text: "Used for the filter buttons on the News page. Pick one or more." })]),
        el("div", { class: "adm-field" }, [el("span", { class: "adm-label", text: "Story" }), toolbar, story, storyPhoto]),
        check("draft", "Draft (hide from the website)", "Drafts are only listed for admins, under “Drafts” on News & Stories."),
      ];
    } else {
      parts = [
        field("Event name", title),
        el("div", { class: "adm-row" }, [field("Date", text("event_date", { type: "date" }), "Leave empty if the date isn't set yet."), field("Time (optional)", text("time", { placeholder: "6 PM" }))]),
        field("When (if no date yet)", text("when", { placeholder: "April 2027, date to come" })),
        field("Place", text("place")),
        check("members_only", "Members only", "For events only members can attend, like the annual dinner & auction."),
        field("Description", area("description", 4)),
      ];
    }

    var saveBtn = el("button", { type: "submit", class: "btn btn-cedar", text: item ? "Save changes" : isPost ? "Post" : "Add event" });
    var head = el("div", { class: "adm-head" }, [
      el("h2", { id: "adm-form-title", text: (item ? "Edit " : "New ") + (isPost ? "post" : "event") }),
      PREVIEW ? el("span", { class: "adm-preview-tag", text: "Preview: nothing is saved" }) : null,
      el("button", { type: "button", class: "adm-x", "aria-label": "Close", text: "×", onclick: function () { close(); } }),
    ]);
    form.appendChild(head);
    var bodyWrap = el("div", { class: "adm-body" }, [err].concat(parts));
    form.appendChild(bodyWrap);
    form.appendChild(el("div", { class: "adm-foot" }, [
      el("button", { type: "button", class: "btn btn-line", text: "Cancel", onclick: function () { close(); } }), saveBtn]));

    drawer = el("div", { class: "adm-drawer", role: "dialog", "aria-modal": "true", "aria-labelledby": "adm-form-title" }, [
      el("div", { class: "adm-shade", onclick: function () { close(); } }), form]);
    document.body.appendChild(drawer);
    document.body.classList.add("adm-lock");
    setTimeout(function () { title.focus(); }, 30);
    drawer.addEventListener("keydown", function (e) { if (e.key === "Escape") { e.preventDefault(); close(); } });

    function showError(m) { err.textContent = m; err.hidden = false; bodyWrap.scrollTop = 0; }
    function close(force) {
      if (!force && dirty && !confirm("Close without saving? Your changes will be lost.")) return;
      drawer.remove(); drawer = null;
      document.body.classList.remove("adm-lock");
      if (lastFocus && lastFocus.focus) lastFocus.focus();
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      err.hidden = true;
      var v = {};
      form.querySelectorAll("[name]").forEach(function (i) { v[i.name] = i.type === "checkbox" ? i.checked : i.value.trim(); });
      if (!v.title) return showError(isPost ? "Please fill in the headline." : "Please fill in the event name.");
      var body = "";
      if (isPost) {
        if (!v.date) return showError("Please fill in the date.");
        v.cover = cover; v.categories = cats;
        // Work on a copy in a separate, inactive document so the browser doesn't try to load "upload:" photo addresses
        var copy = document.implementation.createHTMLDocument("").importNode(story, true);
        copy.querySelectorAll("img[data-upload]").forEach(function (img) { img.setAttribute("src", "upload:" + img.getAttribute("data-upload")); img.removeAttribute("data-upload"); });
        // Empty paragraphs (left by pressing Enter twice or after a photo) aren't saved
        copy.querySelectorAll("p,div,h2,h3").forEach(function (p) { if (!p.textContent.trim() && !p.querySelector("img")) p.remove(); });
        body = htmlToMd(copy.innerHTML);
      }
      // Only send photos still in use
      var used = Object.keys(uploads).filter(function (n) { return v.cover === "upload:" + n || body.indexOf("upload:" + n) >= 0; })
        .map(function (n) { return { name: n, data: uploads[n] }; });
      saveBtn.disabled = true; saveBtn.textContent = "Saving…";
      api.save({ type: type, path: path, sha: item && item.sha, fields: v, body: body, uploads: used }).then(function (r) {
        close(true);
        applyChange(r.path, { type: type, fields: v, body: body, isNew: !path });
        showDrafts();
        if (PREVIEW) {
          toast("Preview only: nothing was saved to the website. On the live site, this would be on the website in about 3 minutes.", true,
            el("details", {}, [el("summary", { text: "Show the file that would be saved" }),
              el("p", { class: "adm-hint", text: r.file.path + (r.file.photos.length ? " + " + r.file.photos.length + " photo(s)" : "") }),
              el("pre", { text: r.file.text })]));
        } else {
          toast((path ? "Saved." : isPost ? "Posted." : "Event added.") + " It will be on the website in about 3 minutes.");
        }
      }).catch(function (e2) {
        saveBtn.disabled = false; saveBtn.textContent = item ? "Save changes" : isPost ? "Post" : "Add event";
        showError(e2.message);
      });
    });
  }

  // Shrink a photo in the browser before saving: at most 1600 px on the long side, JPEG
  function shrink(file) {
    return new Promise(function (ok, bad) {
      if (file.size > 40 * 1024 * 1024) return bad(new Error("That photo is too large (over 40 MB)."));
      var img = new Image(), url = URL.createObjectURL(file);
      img.onload = function () {
        var s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
        var cv = document.createElement("canvas");
        cv.width = Math.round(img.naturalWidth * s); cv.height = Math.round(img.naturalHeight * s);
        var cx = cv.getContext("2d"); cx.fillStyle = "#fff"; cx.fillRect(0, 0, cv.width, cv.height);
        cx.drawImage(img, 0, 0, cv.width, cv.height);
        URL.revokeObjectURL(url);
        ok(cv.toDataURL("image/jpeg", 0.82));
      };
      img.onerror = function () {
        URL.revokeObjectURL(url);
        bad(new Error("This photo can't be opened here. Use a JPG or PNG. (iPhone photos: in Settings → Camera → Formats choose “Most Compatible”, or use Safari.)"));
      };
      img.src = url;
    });
  }
})();
