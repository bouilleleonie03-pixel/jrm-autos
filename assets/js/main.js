/* JRM AUTOS — scripts du site (aucune dépendance, aucun traceur) */
(function () {
  "use strict";
  var doc = document.documentElement;
  doc.classList.remove("no-js");

  /* ---------- En-tête : passage en fond plein au défilement ---------- */
  var header = document.querySelector(".site-header");
  function onScroll() {
    if (!header) return;
    header.classList.toggle("is-solid", window.scrollY > 40);
  }
  onScroll();
  window.addEventListener("scroll", onScroll, { passive: true });

  /* ---------- Menu mobile ---------- */
  var toggle = document.querySelector(".nav-toggle");
  if (toggle) {
    toggle.addEventListener("click", function () {
      var open = document.body.classList.toggle("nav-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
      toggle.setAttribute("aria-label", open ? "Fermer le menu" : "Ouvrir le menu");
    });
    document.querySelectorAll(".main-nav a").forEach(function (a) {
      a.addEventListener("click", function () {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
      });
    });
    document.addEventListener("keydown", function (e) {
      if (e.key === "Escape" && document.body.classList.contains("nav-open")) {
        document.body.classList.remove("nav-open");
        toggle.setAttribute("aria-expanded", "false");
        toggle.focus();
      }
    });
  }

  /* ---------- Apparition au défilement ---------- */
  var reveals = document.querySelectorAll(".reveal");
  if ("IntersectionObserver" in window && reveals.length) {
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("is-in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px -8% 0px", threshold: 0.08 });
    reveals.forEach(function (el) { io.observe(el); });
  } else {
    reveals.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ---------- Horaires : jour courant + ouvert / fermé (heure de Paris) ---------- */
  // 0 = dimanche … 6 = samedi ; plages en minutes
  var SCHEDULE = {
    1: [[510, 720], [840, 1110]],
    2: [[510, 720], [840, 1110]],
    3: [[510, 720], [840, 1110]],
    4: [[510, 720], [840, 1110]],
    5: [[510, 720], [840, 1080]],
    6: [], 0: []
  };
  function parisNow() {
    try {
      var parts = new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/Paris", weekday: "short", hour: "2-digit", minute: "2-digit", hour12: false
      }).formatToParts(new Date());
      var map = {};
      parts.forEach(function (p) { map[p.type] = p.value; });
      var days = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
      return { day: days[map.weekday], min: (parseInt(map.hour, 10) % 24) * 60 + parseInt(map.minute, 10) };
    } catch (e) {
      var d = new Date();
      return { day: d.getDay(), min: d.getHours() * 60 + d.getMinutes() };
    }
  }
  var now = parisNow();
  document.querySelectorAll('[data-day="' + now.day + '"]').forEach(function (row) { row.classList.add("is-today"); });
  document.querySelectorAll(".open-status").forEach(function (el) {
    var slots = SCHEDULE[now.day] || [];
    var open = slots.some(function (s) { return now.min >= s[0] && now.min < s[1]; });
    el.classList.add(open ? "is-open" : "is-closed");
    el.textContent = open ? "Ouvert en ce moment" : "Fermé actuellement";
  });

  /* ---------- Carte Google Maps : chargée seulement après clic ---------- */
  document.querySelectorAll("[data-map-load]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var box = btn.closest(".map-box");
      if (!box) return;
      var iframe = document.createElement("iframe");
      iframe.src = box.getAttribute("data-map-src");
      iframe.title = "Plan d'accès JRM Autos — 482 avenue des Coteaux, Le Pian-sur-Garonne";
      iframe.loading = "lazy";
      iframe.referrerPolicy = "no-referrer-when-downgrade";
      iframe.allowFullscreen = true;
      box.appendChild(iframe);
      var consent = box.querySelector(".map-consent");
      if (consent) consent.remove();
    });
  });

  /* ---------- Galerie : filtres ---------- */
  var filterBtns = document.querySelectorAll(".filter-btn");
  filterBtns.forEach(function (btn) {
    btn.addEventListener("click", function () {
      var f = btn.getAttribute("data-filter");
      filterBtns.forEach(function (b) { b.classList.toggle("is-active", b === btn); b.setAttribute("aria-pressed", b === btn ? "true" : "false"); });
      document.querySelectorAll(".gallery-item").forEach(function (it) {
        var cats = (it.getAttribute("data-cat") || "").split(" ");
        it.classList.toggle("is-hidden", f !== "all" && cats.indexOf(f) === -1);
      });
    });
  });

  /* ---------- Galerie : visionneuse ---------- */
  var items = Array.prototype.slice.call(document.querySelectorAll(".gallery-item"));
  if (items.length) {
    var lb = document.createElement("div");
    lb.className = "lightbox";
    lb.setAttribute("role", "dialog");
    lb.setAttribute("aria-modal", "true");
    lb.setAttribute("aria-label", "Visionneuse photo");
    var ico = function (d) { return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="' + d + '"/></svg>'; };
    lb.innerHTML =
      '<button class="lb-btn lb-close" type="button" aria-label="Fermer">' + ico("M6 6l12 12M18 6L6 18") + "</button>" +
      '<button class="lb-btn lb-prev" type="button" aria-label="Photo précédente">' + ico("M15 5l-7 7 7 7") + "</button>" +
      '<figure><img alt=""><figcaption></figcaption></figure>' +
      '<button class="lb-btn lb-next" type="button" aria-label="Photo suivante">' + ico("M9 5l7 7-7 7") + "</button>";
    document.body.appendChild(lb);
    var lbImg = lb.querySelector("img"), lbCap = lb.querySelector("figcaption"), current = 0, lastFocus = null;
    var visible = function () { return items.filter(function (i) { return !i.classList.contains("is-hidden"); }); };
    function show(idx) {
      var list = visible();
      if (!list.length) return;
      current = (idx + list.length) % list.length;
      var it = list[current];
      lbImg.src = it.getAttribute("data-full");
      lbImg.alt = it.querySelector("img").alt;
      lbCap.textContent = it.getAttribute("data-caption") || "";
    }
    function open(it) {
      lastFocus = document.activeElement;
      show(visible().indexOf(it));
      lb.classList.add("is-open");
      document.body.style.overflow = "hidden";
      lb.querySelector(".lb-close").focus();
    }
    function close() {
      lb.classList.remove("is-open");
      document.body.style.overflow = "";
      if (lastFocus) lastFocus.focus();
    }
    items.forEach(function (it) { it.addEventListener("click", function () { open(it); }); });
    lb.querySelector(".lb-close").addEventListener("click", close);
    lb.querySelector(".lb-prev").addEventListener("click", function () { show(current - 1); });
    lb.querySelector(".lb-next").addEventListener("click", function () { show(current + 1); });
    lb.addEventListener("click", function (e) { if (e.target === lb) close(); });
    document.addEventListener("keydown", function (e) {
      if (!lb.classList.contains("is-open")) return;
      if (e.key === "Escape") close();
      if (e.key === "ArrowLeft") show(current - 1);
      if (e.key === "ArrowRight") show(current + 1);
    });
  }

  /* ---------- Navigation prestations : section active ---------- */
  var navLinks = document.querySelectorAll(".service-nav a");
  if (navLinks.length && "IntersectionObserver" in window) {
    var secIO = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) {
          navLinks.forEach(function (l) { l.classList.toggle("is-active", l.getAttribute("href") === "#" + en.target.id); });
        }
      });
    }, { rootMargin: "-40% 0px -55% 0px" });
    document.querySelectorAll(".service-detail[id]").forEach(function (s) { secIO.observe(s); });
  }

  /* ---------- Formulaire de contact ---------- */
  var form = document.getElementById("contact-form");
  if (form) {
    var ts = form.querySelector('input[name="_ts"]');
    if (ts) ts.value = String(Math.floor(Date.now() / 1000));

    // Pré-remplissage du type de demande via ?objet=…
    var params = new URLSearchParams(window.location.search);
    var objet = params.get("objet");
    var sel = form.querySelector('select[name="objet"]');
    if (objet && sel) {
      Array.prototype.forEach.call(sel.options, function (o) { if (o.value === objet) sel.value = objet; });
    }

    // Dates : pas de date passée, retour ≥ départ
    function todayStr() {
      var d = new Date();
      return d.getFullYear() + "-" + String(d.getMonth() + 1).padStart(2, "0") + "-" + String(d.getDate()).padStart(2, "0");
    }
    var dDep = form.querySelector('input[name="date_depart"]');
    var dRet = form.querySelector('input[name="date_retour"]');
    if (dDep) dDep.min = todayStr();
    if (dRet) dRet.min = todayStr();
    if (dDep && dRet) {
      dDep.addEventListener("change", function () {
        dRet.min = dDep.value || todayStr();
        if (dRet.value && dRet.value < dDep.value) dRet.value = dDep.value;
      });
    }

    var msg = form.querySelector(".form-msg");
    var submit = form.querySelector('button[type="submit"]');

    function setError(field, on) {
      var wrap = field.closest(".field");
      if (wrap) wrap.classList.toggle("has-error", on);
    }
    function validate() {
      var ok = true;
      form.querySelectorAll("[required]").forEach(function (f) {
        var bad = f.type === "checkbox" ? !f.checked : !f.value.trim();
        if (!bad && f.type === "email") bad = !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.value.trim());
        if (!bad && f.name === "telephone") bad = f.value.replace(/[^\d]/g, "").length < 10;
        if (!bad && f.name === "date_depart") bad = f.value < todayStr();
        if (!bad && f.name === "date_retour") {
          var dep = form.querySelector('input[name="date_depart"]');
          bad = dep && dep.value && f.value < dep.value;
        }
        setError(f, bad);
        if (bad) ok = false;
      });
      return ok;
    }
    form.addEventListener("input", function (e) {
      if (e.target.closest(".field.has-error")) setError(e.target, false);
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      msg.className = "form-msg";
      if (!validate()) {
        msg.textContent = "Merci de vérifier les champs indiqués en rouge.";
        msg.classList.add("is-ko");
        var first = form.querySelector(".has-error input, .has-error select, .has-error textarea");
        if (first) first.focus();
        return;
      }
      submit.disabled = true;
      var label = submit.innerHTML;
      submit.textContent = "Envoi en cours…";
      fetch(form.action, {
        method: "POST",
        body: new FormData(form),
        headers: { "Accept": "application/json" }
      })
        .then(function (r) { return r.json().catch(function () { return { ok: false }; }); })
        .then(function (data) {
          if (data && data.ok) {
            form.reset();
            if (ts) ts.value = String(Math.floor(Date.now() / 1000));
            msg.textContent = form.getAttribute("data-success") || "Merci ! Votre demande a bien été envoyée. Le garage vous recontacte au plus vite.";
            msg.classList.add("is-ok");
          } else {
            msg.textContent = (data && data.message) || "L'envoi n'a pas abouti. Vous pouvez nous appeler au 05 56 63 03 84.";
            msg.classList.add("is-ko");
          }
        })
        .catch(function () {
          msg.textContent = "Connexion impossible. Vous pouvez nous appeler au 05 56 63 03 84 ou écrire à jrm.autos33@gmail.com.";
          msg.classList.add("is-ko");
        })
        .then(function () {
          submit.disabled = false;
          submit.innerHTML = label;
          msg.setAttribute("tabindex", "-1");
          msg.focus();
        });
    });
  }

  /* ---------- Année du pied de page ---------- */
  document.querySelectorAll("[data-year]").forEach(function (el) { el.textContent = new Date().getFullYear(); });
})();
