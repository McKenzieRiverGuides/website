/* On-site editor, part 1 (every page; tiny). Does nothing for visitors.
   - /admin/ page: confirms the sign-in (live site: Cloudflare Access already asked for the emailed code;
     local preview: a pretend sign-in where any email and any 6-digit code work).
   - Once an admin is signed in (remembered in this browser), loads the editor: admin-editor.js + admin.css.
   Live vs preview: the preview is any localhost address. Nothing in the preview is ever saved to the website. */
(function () {
  var KEY = "mrga-admin";
  var h = location.hostname;
  var PREVIEW = h === "localhost" || h === "127.0.0.1" || h === "[::1]" || /\.localhost$/.test(h);
  var me = document.currentScript;
  var V = (me && me.getAttribute("data-v")) || "";

  function read() { try { return JSON.parse(localStorage.getItem(KEY) || "null"); } catch (e) { return null; } }
  function write(v) { try { v ? localStorage.setItem(KEY, JSON.stringify(v)) : localStorage.removeItem(KEY); } catch (e) {} }

  var A = window.MRGA_ADMIN = {
    preview: PREVIEW,
    version: V,
    user: read(),
    signIn: function (email) { A.user = { email: email, preview: PREVIEW }; write(A.user); },
    signOut: function () {
      write(null);
      try { localStorage.removeItem("mrga-admin-preview-changes"); } catch (e) {}
      // Live: end the Cloudflare Access sign-in too
      location.href = PREVIEW ? "/news/" : "/cdn-cgi/access/logout";
    },
    forget: function () { A.user = null; write(null); },
  };

  // ---------------------------------------------------------------- /admin/ page
  var box = document.querySelector("[data-admin-signin]");
  if (box) {
    var show = function (step) {
      box.querySelector(".adm-checking").hidden = true;
      box.querySelectorAll("[data-step]").forEach(function (el) { el.hidden = el.getAttribute("data-step") !== step; });
      var first = box.querySelector('[data-step="' + step + '"] input');
      if (first) first.focus();
    };
    var done = function (email) {
      box.querySelectorAll("[data-email]").forEach(function (el) { el.textContent = email; });
      box.querySelectorAll("[data-preview-only]").forEach(function (el) { el.hidden = !PREVIEW; });
      show("done");
    };
    box.addEventListener("click", function (e) {
      if (e.target.closest("[data-signout]")) A.signOut();
      if (e.target.closest("[data-back]")) show("email");
    });

    if (PREVIEW) {
      var emailForm = box.querySelector('[data-step="email"]'), codeForm = box.querySelector('[data-step="code"]');
      emailForm.addEventListener("submit", function (e) {
        e.preventDefault();
        codeForm.querySelector("[data-email]").textContent = emailForm.querySelector("input").value.trim();
        show("code");
      });
      codeForm.addEventListener("submit", function (e) {
        e.preventDefault();
        A.signIn(emailForm.querySelector("input").value.trim().toLowerCase());
        done(A.user.email);
      });
      if (A.user) done(A.user.email); else show("email");
    } else {
      // Live: this page only opens after Cloudflare Access; ask the editor function who signed in
      fetch("/api/admin/me", { credentials: "same-origin", redirect: "manual" })
        .then(function (r) { return r.ok ? r.json() : null; })
        .then(function (u) {
          if (u && u.email) { A.signIn(u.email); done(u.email); }
          else { A.forget(); show("failed"); }
        })
        .catch(function () { A.forget(); show("failed"); });
    }
  }

  // ---------------------------------------------------------------- load the editor for signed-in admins
  if (!A.user || box) return;
  var css = document.createElement("link");
  css.rel = "stylesheet";
  css.href = "/assets/css/admin.css?v=" + V;
  document.head.appendChild(css);
  var js = document.createElement("script");
  js.src = "/assets/js/admin-editor.js?v=" + V;
  document.body.appendChild(js);
})();
