// Tiny confetti burst — no dependencies, ~60 lines.
// Creates a full-screen canvas, fires winter-colored particles, removes itself.
export function burstConfetti({ count = 150, duration = 2600 } = {}) {
  try {
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const canvas = document.createElement('canvas');
    canvas.className = 'confetti-canvas';
    canvas.setAttribute('aria-hidden', 'true');
    document.body.appendChild(canvas);
    const ctx = canvas.getContext('2d');
    const resize = () => { canvas.width = innerWidth; canvas.height = innerHeight; };
    resize();
    addEventListener('resize', resize, { once: true });

    const colors = ['#7dd3fc', '#38bdf8', '#34d399', '#fbbf24', '#f87171', '#ffffff', '#a3e635'];
    const parts = Array.from({ length: count }, () => ({
      x: innerWidth / 2 + (Math.random() - 0.5) * innerWidth * 0.35,
      y: innerHeight * 0.32,
      vx: (Math.random() - 0.5) * 11,
      vy: -Math.random() * 11 - 3,
      s: 5 + Math.random() * 6,
      r: Math.random() * Math.PI,
      vr: (Math.random() - 0.5) * 0.3,
      c: colors[(Math.random() * colors.length) | 0],
      round: Math.random() < 0.35,
    }));

    const start = performance.now();
    (function frame(now) {
      const elapsed = now - start;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      for (const p of parts) {
        p.vy += 0.32; p.vx *= 0.99;
        p.x += p.vx; p.y += p.vy; p.r += p.vr;
        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.r);
        ctx.fillStyle = p.c;
        ctx.globalAlpha = Math.max(0, 1 - elapsed / duration);
        if (p.round) { ctx.beginPath(); ctx.arc(0, 0, p.s / 2, 0, 7); ctx.fill(); }
        else ctx.fillRect(-p.s / 2, -p.s / 3, p.s, p.s * 0.66);
        ctx.restore();
      }
      if (elapsed < duration) requestAnimationFrame(frame);
      else { removeEventListener('resize', resize); canvas.remove(); }
    })(start);
  } catch { /* confetti is decorative — never break the app */ }
}
