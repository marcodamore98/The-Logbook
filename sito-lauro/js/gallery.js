// Filtri e lightbox della galleria
(function () {
  var list = document.getElementById('gallery');
  if (!list) return;
  var items = Array.prototype.slice.call(list.children);
  var filters = document.querySelectorAll('.filters button');
  var dlg = document.getElementById('lightbox');
  var img = document.getElementById('lb-img');
  var title = document.getElementById('lb-title');
  var count = document.getElementById('lb-count');
  var current = 0;
  var opener = null;

  function visible() { return items.filter(function (li) { return !li.hidden; }); }

  filters.forEach(function (b) {
    b.addEventListener('click', function () {
      var f = b.getAttribute('data-filter');
      filters.forEach(function (x) { x.setAttribute('aria-pressed', String(x === b)); });
      items.forEach(function (li) { li.hidden = f !== 'all' && li.getAttribute('data-kind') !== f; });
    });
  });

  function show(i) {
    var v = visible();
    if (!v.length) return;
    current = (i + v.length) % v.length;
    var btn = v[current].querySelector('button');
    img.src = btn.getAttribute('data-full');
    img.alt = btn.getAttribute('data-alt');
    
    
    title.textContent = btn.getAttribute('data-title');
    count.textContent = (current + 1) + ' / ' + v.length;
  }

  function open(btn) {
    var v = visible();
    opener = btn;
    var idx = v.indexOf(btn.closest('li'));
    show(idx < 0 ? 0 : idx);
    if (typeof dlg.showModal === 'function') dlg.showModal(); else dlg.setAttribute('open', '');
    document.documentElement.style.overflow = 'hidden';
  }

  function close() {
    if (typeof dlg.close === 'function') dlg.close(); else dlg.removeAttribute('open');
  }

  dlg.addEventListener('close', function () {
    document.documentElement.style.overflow = '';
    img.removeAttribute('src');
    if (opener) opener.focus();
  });

  list.addEventListener('click', function (e) {
    var b = e.target.closest('button[data-full]');
    if (b) open(b);
  });
  document.getElementById('lb-close').addEventListener('click', close);
  document.getElementById('lb-prev').addEventListener('click', function () { show(current - 1); });
  document.getElementById('lb-next').addEventListener('click', function () { show(current + 1); });
  // click sullo sfondo scuro chiude
  dlg.addEventListener('click', function (e) { if (e.target === dlg || e.target.classList.contains('lb-stage') || e.target.classList.contains('lb-img')) close(); });
  dlg.addEventListener('keydown', function (e) {
    if (e.key === 'ArrowLeft') show(current - 1);
    if (e.key === 'ArrowRight') show(current + 1);
  });

  // swipe su touch
  var x0 = null;
  dlg.addEventListener('touchstart', function (e) { x0 = e.touches[0].clientX; }, { passive: true });
  dlg.addEventListener('touchend', function (e) {
    if (x0 === null) return;
    var dx = e.changedTouches[0].clientX - x0;
    if (Math.abs(dx) > 50) show(current + (dx < 0 ? 1 : -1));
    x0 = null;
  });
})();
