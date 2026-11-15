// 試作の区画。fixed は最初から置いてあって壊せない物（倉庫の口）。
// requests は上から順にこなす。unlock は達成すると開く建物、opens は開く区画。

export const districts = [
  {
    id: 'd0',
    name: '区0 工房の入口',
    intro: '倉庫から出てくる木材を、製材機で板にして納める。',
    w: 20, h: 14,
    blocked: [[9, 5], [10, 5], [9, 6], [10, 6], [10, 7], [4, 11], [5, 11], [15, 2]],
    fixed: [
      { id: 'source', x: 0, y: 6, dir: 0, item: 'wood' },
      { id: 'sink', x: 19, y: 6, dir: 0 },
    ],
    base: ['belt', 'saw'],
    limits: {},
    requests: [
      { text: '板を毎分30個、納める', targets: { plank: 30 }, unlock: ['splitter'], reward: '分岐（ベルトを分ける）' },
      { text: '板を毎分90個、納める', targets: { plank: 90 }, unlock: [], opens: 'd1', reward: '次の区画「炉の間」' },
    ],
  },
  {
    id: 'd1',
    name: '区1 炉の間',
    intro: '竜炉の熱は、ベルトを流れる鉱石にも効く。熱の中を3マス進んだ鉱石は溶ける。',
    w: 20, h: 14,
    blocked: [[6, 0], [7, 0], [13, 6], [13, 7], [14, 7], [3, 12], [4, 12], [4, 13], [17, 12]],
    fixed: [
      { id: 'source', x: 0, y: 6, dir: 0, item: 'ore' },
      { id: 'sink', x: 19, y: 3, dir: 0 },
      { id: 'sink', x: 19, y: 10, dir: 0 },
    ],
    base: ['belt', 'splitter', 'crusher'],
    limits: { furnace: 1 },
    requests: [
      { text: '鉱石粉を毎分30個、納める', targets: { dust: 30 }, unlock: ['furnace', 'caster'], reward: '竜炉（熱の範囲）と鋳型台' },
      { text: '金属板を毎分30個、納める', targets: { plate: 30 }, unlock: [], reward: '（試作ではなし）' },
      { text: '金属板を毎分60個と、鉱石粉を毎分30個、同時に納める', targets: { plate: 60, dust: 30 }, unlock: [], reward: '試作はここまで' },
    ],
  },
];

export default districts;
