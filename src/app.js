/* App-only code (GitHub Pages build): offline cache and the Install button. The artifact build leaves this out. */
window.GARAGE_APP = (function () {
  var deferred = null, slot = null;
  function standalone() { return (window.matchMedia && matchMedia('(display-mode: standalone)').matches) || navigator.standalone === true; }
  function draw() {
    if (!slot) return;
    if (standalone()) { slot.innerHTML = ''; return; }
    if (deferred) {
      slot.innerHTML = '<button class="btn small" id="installBtn">Install app</button>';
      slot.querySelector('#installBtn').addEventListener('click', function () {
        var d = deferred; deferred = null;
        d.prompt();
        d.userChoice.then(draw, draw);
      });
    } else if (/iphone|ipad|ipod/i.test(navigator.userAgent)) {
      slot.innerHTML = '<p>To install on iPhone or iPad, tap Share, then Add to Home Screen.</p>';
    } else {
      slot.innerHTML = '';
    }
  }
  window.addEventListener('beforeinstallprompt', function (e) { e.preventDefault(); deferred = e; draw(); });
  window.addEventListener('appinstalled', function () { deferred = null; draw(); });
  if ('serviceWorker' in navigator && /^https?:$/.test(location.protocol)) {
    window.addEventListener('load', function () { navigator.serviceWorker.register('sw.js').catch(function () {}); });
  }
  return { rail: function (el) { slot = el; draw(); } };
})();
