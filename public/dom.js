// Tiny dependency-free DOM helpers shared by the router (app.js) and the
// voyage view (voyage.js). Extracted verbatim from the original app.js so both
// views build DOM the same way.

export const $ = (sel, root = document) => root.querySelector(sel);

/**
 * Create an element. attrs supports: class, html, text, on<Event> handlers,
 * and any other attribute (true => boolean attribute). Children are flattened;
 * null/false are skipped; strings become text nodes.
 */
export function el(tag, attrs = {}, ...kids) {
  const node = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (v == null || v === false) continue;
    if (k === 'class') node.className = v;
    else if (k === 'html') node.innerHTML = v;
    else if (k === 'text') node.textContent = v;
    else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
    else node.setAttribute(k, v === true ? '' : v);
  }
  for (const kid of kids.flat()) {
    if (kid == null || kid === false) continue;
    node.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
  }
  return node;
}

export function clear(node) {
  while (node && node.firstChild) node.removeChild(node.firstChild);
}

let toastTimer;
export function toast(msg, isError = false) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = `toast show${isError ? ' error' : ''}`;
  t.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { t.classList.remove('show'); }, 3800);
}

export function setBusy(busy) {
  $('#live-pill')?.classList.toggle('busy', busy);
  $('.page')?.classList.toggle('busy', busy);
}
