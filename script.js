(function () {
  "use strict";
  var debugBox = document.getElementById("debugBox");
  function debug(msg) {
    if (debugBox) debugBox.textContent = msg || "";
  }
  window.onerror = function (message, source, lineno, colno) {
    debug("JS ERROR: " + message + " @ " + lineno + ":" + colno);
    return false;
  };
  function esc(s) {
    s = s === undefined || s === null ? "" : String(s);
    return s
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }
  function parseCSV(t) {
    var rows = [], row = [];
    var cur = "", q = false;
    for (var i = 0; i < t.length; i++) {
      var c = t[i], n = t[i + 1];
      if (c === '"' && q && n === '"') { cur += '"'; i++; }
      else if (c === '"') { q = !q; }
      else if (c === "," && !q) { row.push(cur); cur = ""; }
      else if ((c === "\n" || c === "\r") && !q) {
        if (cur || row.length) { row.push(cur); rows.push(row.slice()); }
        row.length = 0; cur = "";
      } else { cur += c; }
    }
    if (cur || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }
  function sameData(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
  var cacheHeaders = {};
  function xhrCached(url, cb) {
    var r = new XMLHttpRequest();
    r.open("GET", url, true);
    r.timeout = 25000;
    var ch = cacheHeaders[url];
    if (ch && ch.etag) {
      try { r.setRequestHeader("If-None-Match", ch.etag); } catch (_) {}
    }
    if (ch && ch.lastModified) {
      try { r.setRequestHeader("If-Modified-Since", ch.lastModified); } catch (_) {}
    }
    r.onload = function () {
      if (r.status === 304) return cb(null, null, r, true);
      if (r.status >= 200 && r.status < 300) {
        var et = r.getResponseHeader("ETag");
        var lm = r.getResponseHeader("Last-Modified");
        cacheHeaders[url] = cacheHeaders[url] || {};
        if (et) cacheHeaders[url].etag = et;
        if (lm) cacheHeaders[url].lastModified = lm;
        return cb(null, r.responseText, r, false);
      }
      cb("HTTP " + r.status, null, r, false);
    };

    r.onerror = r.ontimeout = function () {
      cb("NETWORK/TIMEOUT", null, r, false);
    };
    r.send();
  }
  function tickClock() {
    var d = new Date();
    function pad(n) { return n < 10 ? "0" + n : "" + n; }
    var timeEl = document.getElementById("timeLocal");
    var dateEl = document.getElementById("dateLocal");
    if (timeEl) timeEl.textContent = pad(d.getHours()) + ":" + pad(d.getMinutes()) + ":" + pad(d.getSeconds());
    if (dateEl) dateEl.textContent = d.toDateString();
  }
  setInterval(tickClock, 1000);
  tickClock();
function loadWeather() {
  var el = document.getElementById("weatherDubai");
  if (!el) return;
  var url =
    "https://api.open-meteo.com/v1/forecast?latitude=25.2048&longitude=55.2708&current=temperature_2m";
  xhr(url + "&t=" + Date.now(), function (err, res) {
    if (err) {
      el.textContent = "--";
      return;
    }
    try {
      var j = JSON.parse(res);
      el.textContent = Math.round(j.current.temperature_2m) + "°C";
    } catch (e) {
      el.textContent = "--";
    }
  });
}
loadWeather();
setInterval(loadWeather, 10 * 60 * 1000);
  var TABLE_REFRESH_MS    = 2 * 60 * 1000;  
  var MANIFEST_REFRESH_MS = 3 * 60 * 60 * 1000;
  var MEDIA_PATH = "media/shared/";
  var MANIFEST_URL = MEDIA_PATH + "manifest.json";
  var frame = document.getElementById("mediaFrame");
  var statusEl = document.getElementById("mediaStatus");
  var logoFallback = document.getElementById("mediaLogoFallback");

  function setMediaStatus(t) {
    if (statusEl) statusEl.textContent = t || "";
  }
  function showLogoFallback() { if (logoFallback) logoFallback.style.opacity = "1"; }
  function hideLogoFallback() { if (logoFallback) logoFallback.style.opacity = "0"; }
  function ensureImageLayer(id) {
    var img = document.getElementById(id);
    if (img) return img;
    img = document.createElement("img");
    img.id = id;
    img.decoding = "async";
    img.loading = "eager";
    img.referrerPolicy = "no-referrer";
    img.style.position = "absolute";
    img.style.left = "0";
    img.style.top = "0";
    img.style.right = "0";
    img.style.bottom = "0";
    img.style.width = "100%";
    img.style.height = "100%";
    img.style.objectFit = "contain";
    img.style.background = "#000";
    img.style.opacity = "0";
    img.style.transition = "opacity 650ms ease";
    img.style.willChange = "opacity";
    if (frame) frame.appendChild(img);
    return img;
  }
  var imgA = ensureImageLayer("mediaImgA");
  var imgB = ensureImageLayer("mediaImgB");
  var imgAOnTop = true;
  function topImg()  { return imgAOnTop ? imgA : imgB; }
  function backImg() { return imgAOnTop ? imgB : imgA; }
  var playlist = [];
  var timeline = [];
  var totalCycleMs = 0;
  var serverOffsetMs = 0;
  function updateServerOffsetFromResponse(resp) {
    try {
      var d = resp && resp.getResponseHeader && resp.getResponseHeader("Date");
      if (!d) return;
      var serverNow = new Date(d).getTime();
      if (!serverNow || isNaN(serverNow)) return;
      serverOffsetMs = serverNow - Date.now();
    } catch (_) {}
  }
  function syncedNowMs() {
    return Date.now() + serverOffsetMs;
  }
  var VIDEO_SECONDS = {
    "02.mp4": 68,
    "04.mp4": 7,
    "05.mp4": 9,
    "06.mp4": 27,
    "11.mp4": 220,
    "12.mp4": 29,
    "15.mp4": 29,
    "16.mp4": 35,
    "17.mp4": 62,
    "18.mp4": 23,
    "19.mp4": 35,
    "21.mp4": 76
  };
  function mediaUrl(src) { return MEDIA_PATH + src; }
  var nextTimer = null;
  function clearNext() {
    if (nextTimer) { clearTimeout(nextTimer); nextTimer = null; }
  }
  function scheduleNext(ms) {
    clearNext();
    nextTimer = setTimeout(function () {
      playFromSyncedClock();
    }, ms);
  }
  function removeVideo() {
    if (!frame) return;
    var vids = frame.getElementsByTagName("video");
    if (vids && vids[0]) {
      try { vids[0].pause(); } catch (_) {}
      try { vids[0].removeAttribute("src"); } catch (_) {}
      try { vids[0].load(); } catch (_) {}
      if (vids[0].parentNode) vids[0].parentNode.removeChild(vids[0]);
    }
  }
  function buildTimeline(items) {
    timeline = [];
    totalCycleMs = 0;
    for (var i = 0; i < items.length; i++) {
      var it = items[i];
      if (!it || !it.type || !it.src) continue;
      var durMs = 0;
      if (it.type === "image") {
        var s = (it.duration || 15);
        if (s < 3) s = 3;
        durMs = s * 1000;
      } else if (it.type === "video") {
        var vs = VIDEO_SECONDS[it.src];
        if (!vs) vs = 30;
        durMs = vs * 1000;
      } else {
        continue;
      }
      timeline.push({ type: it.type, src: it.src, durMs: durMs });
      totalCycleMs += durMs;
    }
    if (totalCycleMs < 1) totalCycleMs = 1;
  }
  function findPosition(posMs) {
    var t = posMs % totalCycleMs;
    for (var i = 0; i < timeline.length; i++) {
      var d = timeline[i].durMs;
      if (t < d) return { index: i, offset: t };
      t -= d;
    }
    return { index: 0, offset: 0 };
  }
  function swapToImage(src, onReady) {
    var back = backImg();
    var front = topImg();
    back.onload = back.onerror = null;
    var done = false;
    var IMAGE_TIMEOUT_MS = 12000;
    var hang = setTimeout(function () {
      if (done) return;
      done = true;
      setMediaStatus("Image timeout, skipping…");
      if (onReady) onReady(false);
    }, IMAGE_TIMEOUT_MS);
    back.style.opacity = "0";
    back.src = "";
    back.onload = function () {
      if (done) return;
      done = true;
      clearTimeout(hang);
      back.style.opacity = "1";
      front.style.opacity = "0";
      imgAOnTop = !imgAOnTop;
      if (onReady) onReady(true);
    };
    back.onerror = function () {
      if (done) return;
      done = true;
      clearTimeout(hang);
      if (onReady) onReady(false);
    };
    back.src = mediaUrl(src);
  }
  function playImageSynced(src, remainingMs) {
    hideLogoFallback();
    removeVideo();
    setMediaStatus("Loading image…");
    swapToImage(src, function (ok) {
      if (!ok) {
        setMediaStatus("Image failed, skipping…");
        scheduleNext(700);
        return;
      }
      setMediaStatus("");
      scheduleNext(Math.max(800, remainingMs));
    });
  }
  function playVideoSynced(src, offsetMs, remainingMs) {
    hideLogoFallback();
    removeVideo();
    setMediaStatus("Loading video…");
    var v = document.createElement("video");
    v.src = mediaUrl(src);
    v.autoplay = true;
    v.muted = true;
    v.playsInline = true;
    v.preload = "metadata";
    v.setAttribute("webkit-playsinline", "true");
    v.setAttribute("playsinline", "true");
    v.style.position = "absolute";
    v.style.left = "0";
    v.style.top = "0";
    v.style.right = "0";
    v.style.bottom = "0";
    v.style.width = "100%";
    v.style.height = "100%";
    v.style.objectFit = "cover";
    v.style.background = "#000";
    if (frame) frame.appendChild(v);
    var started = false;
    var lastT = -1;
    var stallAt = Date.now();
    var waitingSince = 0;
    function failVideo(msg) {
      setMediaStatus(msg || "Video error, skipping…");
      removeVideo();
      scheduleNext(900);
    }
    v.onloadedmetadata = function () {
      try {
        var sec = offsetMs / 1000;
        if (isFinite(v.duration) && sec > 0 && sec < v.duration - 0.2) {
          v.currentTime = sec;
        }
      } catch (_) {}
      try {
        var p = v.play();
        if (p && p.catch) p.catch(function () { failVideo("Autoplay blocked"); });
      } catch (e) {
        failVideo("Play failed");
      }
    };
    v.ontimeupdate = function () {
      if (v.currentTime !== lastT) {
        lastT = v.currentTime;
        started = true;
        stallAt = Date.now();
        waitingSince = 0;
        setMediaStatus("");
      }
      if (Date.now() - stallAt > 45000) {
        failVideo("Video froze, skipping…");
      }
    };
    v.onwaiting = function () {
      if (!waitingSince) waitingSince = Date.now();
      setTimeout(function () {
        if (waitingSince && Date.now() - waitingSince > 2000) {
          setMediaStatus("Buffering…");
        }
      }, 2100);
      setTimeout(function () {
        if (waitingSince && Date.now() - waitingSince > 20000) {
          failVideo("Buffering too long, skipping…");
        }
      }, 20500);
    };
    v.onended = function () {
      removeVideo();
      scheduleNext(600);
    };
    v.onerror = function () {
      failVideo("Video error, skipping…");
    };
    scheduleNext(Math.max(1500, remainingMs));
  }
  function playFromSyncedClock() {
    clearNext();
    if (!timeline.length) {
      showLogoFallback();
      setMediaStatus("No media found (manifest empty)");
      return;
    }
    var now = syncedNowMs();
    var pos = findPosition(now);
    var item = timeline[pos.index];
    if (!item) {
      scheduleNext(800);
      return;
    }
    var remainingMs = Math.max(1000, item.durMs - pos.offset);
    if (item.type === "image") {
      playImageSynced(item.src, remainingMs);
    } else if (item.type === "video") {
      playVideoSynced(item.src, pos.offset, remainingMs);
    } else {
      scheduleNext(800);
    }
  }
  function loadManifest(silent) {
    if (!silent) setMediaStatus("Loading media…");
    xhrCached(MANIFEST_URL, function (err, res, resp, notModified) {
      if (err) {
        if (!silent) setMediaStatus("Manifest offline (" + err + ")");
        showLogoFallback();
        return;
      }
      updateServerOffsetFromResponse(resp);
      if (notModified) {
        if (!silent) setMediaStatus("");
        playFromSyncedClock();
        return;
      }
      try {
        var j = JSON.parse(res || "{}");
        var items = (j && j.items) ? j.items : [];
        playlist = items || [];
        buildTimeline(playlist);
        if (!timeline.length) {
          showLogoFallback();
          setMediaStatus("No media found (manifest empty)");
          return;
        }
        showLogoFallback();
        playFromSyncedClock();
      } catch (e) {
        if (!silent) setMediaStatus("Manifest JSON error");
        showLogoFallback();
      }
    });
  }
  showLogoFallback();
  loadManifest(false);
  setInterval(function () { loadManifest(true); }, MANIFEST_REFRESH_MS);
  var CSV_PROGRESS =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdGlXzRbnJ7Kp0LjgnChldEReAe3sVm2oeOOOYpHY0uEKjdx3nN8yFO2WRGrUIDgx1VRmUb9nLncrs/pub?gid=2111665249&single=true&output=csv";
  var CSV_REVISIT =
    "https://docs.google.com/spreadsheets/d/e/2PACX-1vTdGlXzRbnJ7Kp0LjgnChldEReAe3sVm2oeOOOYpHY0uEKjdx3nN8yFO2WRGrUIDgx1VRmUb9nLncrs/pub?gid=1864837152&single=true&output=csv";
  var progressBody = document.getElementById("progressBody");
  var revisitBody  = document.getElementById("revisitBody");
  var boardMeta    = document.getElementById("boardMeta");
  var revisitMeta  = document.getElementById("revisitMeta");
  var progressData = [];
  var revisitData  = [];
  var progressPage = 0;
  var revisitPage  = 0;
  var PROGRESS_ROWS_PER_PAGE = 9;
  var REVISIT_ROWS_PER_PAGE  = 9;
  var PAGE_SWITCH_MS = 4000;
  var progressTimer = null;
  var revisitTimer  = null;
  function stopPaging() {
    if (progressTimer) { clearInterval(progressTimer); progressTimer = null; }
    if (revisitTimer)  { clearInterval(revisitTimer);  revisitTimer  = null; }
  }
  function renderProgress() {
    if (!progressBody) return;
    if (!progressData.length) {
      progressBody.innerHTML =
        '<tr><td colspan="5" class="muted">No cars in progress</td></tr>';
      if (boardMeta) boardMeta.textContent = "Live · 0";
      return;
    }
    var pages = Math.ceil(progressData.length / PROGRESS_ROWS_PER_PAGE);
    if (progressPage >= pages) progressPage = 0;
    var start = progressPage * PROGRESS_ROWS_PER_PAGE;
    var slice = progressData.slice(start, start + PROGRESS_ROWS_PER_PAGE);
    var html = "";
    for (var i = 0; i < slice.length; i++) {
      var r = slice[i];
      html += "<tr>" +
        "<td>" + esc(r.customer) + "</td>" +
        "<td>" + esc(r.model)    + "</td>" +
        "<td>" + esc(r.year)     + "</td>" +
        "<td>" + esc(r.chassis)  + "</td>" +
        "<td>" + esc(r.film)     + "</td>" +
      "</tr>";
    }
    progressBody.innerHTML = html;
    if (boardMeta)
      boardMeta.textContent =
        "Live · " + progressData.length + " · Page " + (progressPage + 1) + "/" + pages;
    progressPage++;
  }
  function renderRevisit() {
    if (!revisitBody) return;
    if (!revisitData.length) {
      revisitBody.innerHTML =
        '<tr><td colspan="4" class="muted">No bookings today</td></tr>';
      if (revisitMeta) revisitMeta.textContent = "Live · 0";
      return;
    }
    var pages = Math.ceil(revisitData.length / REVISIT_ROWS_PER_PAGE);
    if (revisitPage >= pages) revisitPage = 0;
    var start = revisitPage * REVISIT_ROWS_PER_PAGE;
    var slice = revisitData.slice(start, start + REVISIT_ROWS_PER_PAGE);
    var html = "";
    for (var i = 0; i < slice.length; i++) {
      var r = slice[i];
      html += "<tr>" +
        "<td>" + esc(r.status) + "</td>" +
        "<td>" + esc(r.name)   + "</td>" +
        "<td>" + esc(r.car)    + "</td>" +
        "<td>" + esc(r.color)  + "</td>" +
      "</tr>";
    }
    revisitBody.innerHTML = html;
    if (revisitMeta)
      revisitMeta.textContent =
        "Live · " + revisitData.length + " · Page " + (revisitPage + 1) + "/" + pages;
    revisitPage++;
  }
  function startPaging() {
    stopPaging();
    renderProgress();
    renderRevisit();
    progressTimer = setInterval(renderProgress, PAGE_SWITCH_MS);
    revisitTimer  = setInterval(renderRevisit,  PAGE_SWITCH_MS);
  }

  function loadProgress() {
    if (boardMeta) boardMeta.textContent = "Updating…";
    xhrCached(CSV_PROGRESS, function (err, res, _resp, notModified) {
      if (err) { if (boardMeta) boardMeta.textContent = "Offline"; return; }
      if (notModified) { if (boardMeta) boardMeta.textContent = "Live · " + progressData.length; return; }
      try {
        var rows = parseCSV(res || "").slice(1);
        var data = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          var customer = (r[4]  || "").trim();
          var model    = (r[6]  || "").trim();
          var year     = (r[8]  || "").trim();
          var chassis  = (r[9]  || "").trim();
          var film     = (r[10] || "").trim();
          if (!customer) continue;
          data.push({ customer: customer, model: model, year: year, chassis: chassis, film: film });
        }
        if (!sameData(progressData, data)) {
          progressData = data;
          progressPage = 0;
          startPaging();
        }
        if (boardMeta) boardMeta.textContent = "Live · " + progressData.length;
      } catch (e) {
        if (boardMeta) boardMeta.textContent = "Error";
      }
    });
  }
  function loadRevisit() {
    if (revisitMeta) revisitMeta.textContent = "Updating…";
    xhrCached(CSV_REVISIT, function (err, res, _resp, notModified) {
      if (err) { if (revisitMeta) revisitMeta.textContent = "Offline"; return; }
      if (notModified) { if (revisitMeta) revisitMeta.textContent = "Live · " + revisitData.length; return; }
      try {
        var rows = parseCSV(res || "").slice(1);
        var data = [];
        for (var i = 0; i < rows.length; i++) {
          var r = rows[i];
          var status = (r[0] || "").trim(); // A
          var name   = (r[3] || "").trim(); // D
          var car    = (r[5] || "").trim(); // F
          var color  = (r[6] || "").trim(); // G
          if (!name) continue;
          data.push({ status: status, name: name, car: car, color: color });
        }
        if (!sameData(revisitData, data)) {
          revisitData = data;
          revisitPage = 0;
          startPaging();
        }
        if (revisitMeta) revisitMeta.textContent = "Live · " + revisitData.length;
      } catch (e) {
        if (revisitMeta) revisitMeta.textContent = "Error";
      }
    });
  }
  var refreshBtn = document.getElementById("refreshBtn");
  if (refreshBtn) {
    refreshBtn.onclick = function () {
      loadManifest(false);
      loadProgress();
      loadRevisit();
    };
  }
  loadProgress();
  loadRevisit();
  startPaging();
  setInterval(loadProgress, TABLE_REFRESH_MS);
  setInterval(loadRevisit,  TABLE_REFRESH_MS);
  debug("Ready ✓");
})();

