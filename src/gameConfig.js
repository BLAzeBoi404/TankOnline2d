// Режими для локальної гри проти ботів
export const MODES = [
  {
    id: 'training',
    label: 'Тренування',
    description: 'Один повільний бот для розігріву.',
    botCount: 1,
    botSpeed: 90,
    botBulletSpeed: 220,
    botFireDelay: 1.2,
    botFireRange: 480,
    botHp: 70,
    damagePerHit: 15,
  },
  {
    id: 'arena',
    label: 'Арена',
    description: 'Два боти трохи швидші, нормальний режим.',
    botCount: 2,
    botSpeed: 120,
    botBulletSpeed: 260,
    botFireDelay: 1.0,
    botFireRange: 520,
    botHp: 80,
    damagePerHit: 18,
  },
  {
    id: 'hardcore',
    label: 'Хардкор',
    description: 'Три агресивних боти, для справжнього челенджу.',
    botCount: 3,
    botSpeed: 150,
    botBulletSpeed: 300,
    botFireDelay: 0.85,
    botFireRange: 550,
    botHp: 90,
    damagePerHit: 22,
  },
]

// Карти: статична арена і процедурний лабіринт
export const MAPS = [
  {
    id: 'open',
    label: 'Відкрита арена',
    kind: 'static',
    width: 1280,
    height: 640,
    obstacles: [
      { x: 540, y: 150, width: 180, height: 140 },
      { x: 260, y: 120, width: 140, height: 80 },
      { x: 860, y: 360, width: 200, height: 90 },
      { x: 460, y: 420, width: 240, height: 60 },
      { x: 960, y: 180, width: 120, height: 70 },
      { x: 200, y: 360, width: 150, height: 70 },
    ],
    playerSpawn: { x: 140, y: 260 },
    botSpawns: [
      { x: 1040, y: 140 },
      { x: 1040, y: 420 },
      { x: 900, y: 80 },
    ],
  },
  {
    id: 'maze',
    label: 'Процедурний лабіринт',
    kind: 'maze',
    width: 1280,
    height: 640,
    cellSize: 40,
  },
]
