// 機械の絵の共通の道具（machines.js と art2.js が使う）
export const OUT = '#2b2118';

// 色を明るく（k>0）・暗く（k<0）する
export function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16);
  const t = k > 0 ? 255 : 0, a = Math.abs(k);
  const f = (v) => Math.round(v + (t - v) * a);
  return `rgb(${f(n >> 16)},${f((n >> 8) & 255)},${f(n & 255)})`;
}

// ドットで描く道具
export function pen(ctx, ox, oy, s) {
  const r = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * s, oy + y * s, w * s, h * s); };
  // 塗った円（中心は .5 でもよい）
  const disc = (cx, cy, rad, c) => {
    for (let y = Math.floor(cy - rad); y <= Math.ceil(cy + rad); y++) {
      const dy = y + 0.5 - cy, q = rad * rad - dy * dy;
      if (q < 0) continue;
      const dx = Math.sqrt(q), x0 = Math.round(cx - dx), x1 = Math.round(cx + dx);
      if (x1 > x0) r(x0, y, x1 - x0, 1, c);
    }
  };
  const line = (x0, y0, x1, y1, c) => {
    const n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0));
    for (let i = 0; i <= n; i++) r(Math.round(x0 + ((x1 - x0) * i) / (n || 1)), Math.round(y0 + ((y1 - y0) * i) / (n || 1)), 1, 1, c);
  };
  return { r, disc, line, px: (x, y, c) => r(x, y, 1, 1, c) };
}

// 台：縁取り、上と左は明るく、下と右は暗く。wood は板の継ぎ目、rivets は四隅の鋲
export function base(d, gw, gh, body, { wood = false, rivets = false } = {}) {
  d.r(1, 1, gw - 2, gh - 2, OUT);
  d.r(2, 2, gw - 4, gh - 4, body);
  if (wood) {
    for (let y = 7; y < gh - 3; y += 6) d.r(3, y, gw - 6, 1, shade(body, -0.22));
    for (let y = 4; y < gh - 3; y += 6) for (let x = 6 + (y % 12 ? 0 : 7); x < gw - 4; x += 14) d.px(x, y, shade(body, 0.18));
  }
  d.r(2, 2, gw - 4, 1, shade(body, 0.35));
  d.r(2, 3, 1, gh - 5, shade(body, 0.18));
  d.r(2, gh - 3, gw - 4, 1, shade(body, -0.35));
  d.r(gw - 3, 3, 1, gh - 5, shade(body, -0.2));
  if (rivets) {
    for (const [x, y] of [[4, 4], [gw - 6, 4], [4, gh - 6], [gw - 6, gh - 6]]) {
      d.r(x, y, 2, 2, shade(body, -0.45));
      d.px(x, y, shade(body, 0.45));
    }
  }
}

