// A finger-drawing surface on a <canvas>: pen, eraser, sticker stamps, undo.

export function createPad(canvas, { color = '#2d2440', size = 7, onChange = () => {} } = {}) {
  const ctx = canvas.getContext('2d');
  const s = { color, size, mode: 'pen', sticker: null, stickerSize: 120 };
  const history = [];
  let drawing = false;
  let last = null;

  const at = e => {
    const r = canvas.getBoundingClientRect();
    return {
      x: (e.clientX - r.left) * canvas.width / r.width,
      y: (e.clientY - r.top) * canvas.height / r.height,
    };
  };

  const remember = () => {
    try {
      history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));
      if (history.length > 6) history.shift();
    } catch { /* out of memory: skip undo for this stroke */ }
  };

  const stroke = (a, b) => {
    const erasing = s.mode === 'eraser';
    ctx.globalCompositeOperation = erasing ? 'destination-out' : 'source-over';
    ctx.strokeStyle = s.color;
    ctx.lineWidth = erasing ? s.size * 3 : s.size;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
  };

  const stamp = p => {
    ctx.globalCompositeOperation = 'source-over';
    ctx.font = `${s.stickerSize}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(s.sticker, p.x, p.y);
  };

  canvas.addEventListener('pointerdown', e => {
    e.preventDefault();
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
    remember();
    const p = at(e);
    if (s.mode === 'sticker' && s.sticker) { stamp(p); onChange(); return; }
    drawing = true;
    last = p;
    stroke(p, p);
  });

  canvas.addEventListener('pointermove', e => {
    if (!drawing) return;
    const p = at(e);
    stroke(last, p);
    last = p;
  });

  const finish = () => {
    if (!drawing) return;
    drawing = false;
    onChange();
  };
  canvas.addEventListener('pointerup', finish);
  canvas.addEventListener('pointercancel', finish);

  return {
    set(options) { Object.assign(s, options); },
    undo() {
      const prev = history.pop();
      if (prev) { ctx.putImageData(prev, 0, 0); onChange(); }
    },
    clear() {
      remember();
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      onChange();
    },
    load(dataUrl) {
      const img = new Image();
      img.onload = () => ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      img.src = dataUrl;
    },
    toDataURL() { return canvas.toDataURL('image/png'); },
  };
}
