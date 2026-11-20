/* News & Stories: category chips filter the post cards (a post can be in several categories). */
(function () {
  var f = document.querySelector(".filters"); if (!f) return;
  f.addEventListener("click", function (e) {
    var c = e.target.closest(".chip"); if (!c) return;
    f.querySelectorAll(".chip").forEach(function (x) { x.setAttribute("aria-pressed", x === c); });
    var cat = c.textContent;
    document.querySelectorAll(".pcard").forEach(function (p) {
      p.hidden = cat !== "All" && (p.getAttribute("data-cats") || "").split("|").indexOf(cat) < 0;
    });
  });
})();
