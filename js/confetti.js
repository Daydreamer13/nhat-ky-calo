// confetti.js — một chùm hoa giấy ngắn khi có điều đáng mừng. Tự dọn sau khi rơi xong.

export function confetti({ colors = ["#f59", "#fc3", "#6c6", "#69f"], count = 90, duration = 2200 } = {}) {
  if (window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const c = document.createElement("canvas");
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = window.innerWidth, H = window.innerHeight;
  c.width = W * dpr; c.height = H * dpr;
  c.setAttribute("aria-hidden", "true");
  c.style.cssText = "position:fixed;inset:0;width:100%;height:100%;pointer-events:none;z-index:9999";
  document.body.appendChild(c);
  const g = c.getContext("2d");
  g.scale(dpr, dpr);

  const rnd = (a, b) => a + Math.random() * (b - a);
  const parts = Array.from({ length: count }, (_, i) => {
    const fromLeft = i % 2 === 0;
    const angle = fromLeft ? rnd(-1.25, -0.55) : rnd(-2.6, -1.9); // bắn chéo từ hai góc dưới lên giữa
    const speed = rnd(9, 17) * Math.min(1.25, Math.max(0.8, H / 800));
    return {
      x: fromLeft ? rnd(-10, W * 0.12) : rnd(W * 0.88, W + 10),
      y: H * rnd(0.78, 0.92),
      vx: Math.cos(angle) * speed, vy: Math.sin(angle) * speed,
      w: rnd(6, 11), h: rnd(8, 15), rot: rnd(0, 6.28), vr: rnd(-0.25, 0.25),
      color: colors[i % colors.length], round: i % 5 === 0, tilt: rnd(0, 6.28),
    };
  });

  const t0 = performance.now();
  let last = t0;
  function frame(now) {
    const dt = Math.min(2.2, (now - last) / 16.67);
    last = now;
    const life = (now - t0) / duration;
    g.clearRect(0, 0, W, H);
    for (const p of parts) {
      p.vy += 0.34 * dt; p.vx *= 0.992; p.vy *= 0.992;
      p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt; p.tilt += 0.12 * dt;
      g.save();
      g.globalAlpha = life > 0.72 ? Math.max(0, 1 - (life - 0.72) / 0.28) : 1;
      g.translate(p.x, p.y); g.rotate(p.rot); g.scale(1, Math.cos(p.tilt));
      g.fillStyle = p.color;
      if (p.round) { g.beginPath(); g.arc(0, 0, p.w / 2, 0, 6.2832); g.fill(); }
      else g.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      g.restore();
    }
    if (life < 1) requestAnimationFrame(frame);
    else c.remove();
  }
  requestAnimationFrame(frame);
}
