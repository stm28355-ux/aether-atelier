// 盤面を canvas に描く。見た目は仮（色と形だけ）。
import { DX, DY, BELT_TICKS, canPlace, fieldActive } from '../core/sim.js';

export const CELL = 40;
const C = CELL;
const BODY = { saw: '#b98f5a', crusher: '#8e8a84', caster: '#7d8fa3', furnace: '#c2452d' };
const LAMP = { working: '#3f8a4d', waiting: '#d9a514', blocked: '#c0392b', 'no-field': '#c0392b', 'no-recipe': '#999' };
const LABEL = { waiting: '材料待ち', blocked: '出口づまり', 'no-field': '範囲の外' };

function arrow(ctx, cx, cy, dir, size, color) {
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate((dir * Math.PI) / 2);
  ctx.beginPath();
  ctx.moveTo(-size * 0.5, -size * 0.6);
  ctx.lineTo(size * 0.5, 0);
  ctx.lineTo(-size * 0.5, size * 0.6);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  ctx.stroke();
  ctx.restore();
}

function frontEdge(ctx, e, color) {
  const x = e.x * C, y = e.y * C, w = e.w * C, h = e.h * C;
  ctx.fillStyle = color;
  if (e.dir === 0) ctx.fillRect(x + w - 6, y + 6, 4, h - 12);
  else if (e.dir === 1) ctx.fillRect(x + 6, y + h - 6, w - 12, 4);
  else if (e.dir === 2) ctx.fillRect(x + 2, y + 6, 4, h - 12);
  else ctx.fillRect(x + 6, y + 2, w - 12, 4);
  const cx = x + w / 2 + DX[e.dir] * (w / 2 - 14), cy = y + h / 2 + DY[e.dir] * (h / 2 - 14);
  arrow(ctx, cx, cy, e.dir, 9, color);
}

function drawEnt(ctx, world, e) {
  const { data } = world;
  const x = e.x * C, y = e.y * C, w = e.w * C, h = e.h * C;
  const cx = x + w / 2, cy = y + h / 2;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  if (e.kind === 'belt') {
    ctx.fillStyle = '#9b958c';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    arrow(ctx, cx, cy, e.dir, 10, '#c9c3b8');
  } else if (e.kind === 'splitter') {
    ctx.fillStyle = '#5f7391';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    for (const d of [e.dir, (e.dir + 3) & 3, (e.dir + 1) & 3]) arrow(ctx, cx + DX[d] * 11, cy + DY[d] * 11, d, 6, '#dfe7f2');
  } else if (e.kind === 'source' || e.kind === 'sink') {
    ctx.fillStyle = '#4a4036';
    ctx.fillRect(x + 1, y + 1, C - 2, C - 2);
    ctx.fillStyle = '#f4efe6';
    ctx.font = '600 12px system-ui, sans-serif';
    if (e.kind === 'source') {
      ctx.fillText('出す', cx, cy - 8);
      ctx.fillStyle = data.items[e.item].color;
      ctx.beginPath(); ctx.arc(cx - 6, cy + 9, 6, 0, 7); ctx.fill();
      arrow(ctx, cx + 9, cy + 9, e.dir, 7, '#f4efe6');
    } else ctx.fillText('納める', cx, cy);
  } else {
    ctx.fillStyle = BODY[e.id] || '#aaa';
    ctx.beginPath(); ctx.roundRect(x + 2, y + 2, w - 4, h - 4, 6); ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '600 13px system-ui, sans-serif';
    ctx.fillText(data.buildings[e.id].name, cx, cy - (e.kind === 'machine' ? 8 : 0));
    if (e.kind === 'machine') {
      frontEdge(ctx, e, '#fff3d6');
      ctx.fillStyle = LAMP[e.status];
      ctx.beginPath(); ctx.arc(x + 11, y + 11, 5, 0, 7); ctx.fill();
      ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5; ctx.stroke();
      if (LABEL[e.status]) {
        ctx.fillStyle = '#fff';
        ctx.font = '11px system-ui, sans-serif';
        ctx.fillText(LABEL[e.status], cx, cy + 9);
      }
      const r = data.recipes[e.recipe];
      if (r && e.left > 0) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(x + 10, y + h - 13, w - 20, 4);
        ctx.fillStyle = '#fff3d6';
        ctx.fillRect(x + 10, y + h - 13, (w - 20) * (1 - e.left / r.ticks), 4);
      }
    }
  }
}

function drawItem(ctx, world, h, alpha) {
  const it = h.item;
  const tx = (h.x + 0.5) * C, ty = (h.y + 0.5) * C;
  let fx = tx, fy = ty;
  const from = h.lastFrom;
  if (from) {
    // 来た方向の、となりのマスの中心から進んでくる
    fx = Math.max(from.x, Math.min(from.x + from.w - 1, h.x)) * C + C / 2;
    fy = Math.max(from.y, Math.min(from.y + from.h - 1, h.y)) * C + C / 2;
  }
  const f = Math.min(1, (it.p + (it.p < BELT_TICKS ? alpha : 0)) / BELT_TICKS);
  ctx.fillStyle = world.data.items[it.t].color;
  ctx.beginPath();
  ctx.arc(fx + (tx - fx) * f, fy + (ty - fy) * f, 9, 0, 7);
  ctx.fill();
  ctx.strokeStyle = 'rgba(0,0,0,0.55)';
  ctx.lineWidth = 1.5;
  ctx.stroke();
}

export function draw(ctx, world, ui, def, overLimit) {
  const W = world.w * C, H = world.h * C;
  ctx.clearRect(0, 0, W, H);
  ctx.fillStyle = '#f4efe6';
  ctx.fillRect(0, 0, W, H);
  // 範囲
  for (let y = 0; y < world.h; y++) for (let x = 0; x < world.w; x++) {
    if (fieldActive(world, 'heat', x, y)) { ctx.fillStyle = 'rgba(255,110,30,0.22)'; ctx.fillRect(x * C, y * C, C, C); }
    if (fieldActive(world, 'cold', x, y)) { ctx.fillStyle = 'rgba(60,150,255,0.22)'; ctx.fillRect(x * C, y * C, C, C); }
    if (world.blocked[y * world.w + x]) {
      ctx.fillStyle = '#b9ae9c';
      ctx.beginPath(); ctx.roundRect(x * C + 4, y * C + 4, C - 8, C - 8, 10); ctx.fill();
    }
  }
  ctx.strokeStyle = 'rgba(90,70,40,0.12)';
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 1; x < world.w; x++) { ctx.moveTo(x * C + 0.5, 0); ctx.lineTo(x * C + 0.5, H); }
  for (let y = 1; y < world.h; y++) { ctx.moveTo(0, y * C + 0.5); ctx.lineTo(W, y * C + 0.5); }
  ctx.stroke();

  for (const e of world.ents) drawEnt(ctx, world, e);
  for (const e of world.ents) if ((e.kind === 'belt' || e.kind === 'splitter') && e.item) drawItem(ctx, world, e, ui.alpha);

  // これから置く物の影
  if (ui.tool && ui.hover) {
    const b = world.data.buildings[ui.tool];
    const { x, y } = ui.hover;
    const ok = canPlace(world, ui.tool, x, y).ok && !overLimit(ui.tool);
    if (b.kind === 'emitter') {
      const r = b.radius;
      ctx.fillStyle = 'rgba(255,110,30,0.18)';
      ctx.fillRect((x - r) * C, (y - r) * C, (b.w + 2 * r) * C, (b.h + 2 * r) * C);
      ctx.strokeStyle = '#d2571a';
      ctx.setLineDash([6, 4]);
      ctx.strokeRect((x - r) * C + 1, (y - r) * C + 1, (b.w + 2 * r) * C - 2, (b.h + 2 * r) * C - 2);
      ctx.setLineDash([]);
    }
    ctx.fillStyle = ok ? 'rgba(63,138,77,0.35)' : 'rgba(192,57,43,0.35)';
    ctx.fillRect(x * C, y * C, b.w * C, b.h * C);
    ctx.strokeStyle = ok ? '#3f8a4d' : '#c0392b';
    ctx.lineWidth = 2;
    ctx.strokeRect(x * C + 1, y * C + 1, b.w * C - 2, b.h * C - 2);
    const ghost = { x, y, w: b.w, h: b.h, dir: ui.dir };
    if (b.kind === 'machine') frontEdge(ctx, ghost, '#2b2118');
    else if (b.kind === 'belt' || b.kind === 'splitter') arrow(ctx, x * C + C / 2, y * C + C / 2, ui.dir, 10, '#2b2118');
  }
}
