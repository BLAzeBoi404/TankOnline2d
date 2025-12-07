import React, {
  useEffect,
  useRef,
  useState,
  useCallback,
} from 'react'
import { MODES, MAPS } from '../gameConfig.js'

function drawRoundedRect(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2)
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.lineTo(x + w - r, y)
  ctx.quadraticCurveTo(x + w, y, x + w, y + r)
  ctx.lineTo(x + w, y + h - r)
  ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h)
  ctx.lineTo(x + r, y + h)
  ctx.quadraticCurveTo(x, y + h, x, y + h - r)
  ctx.lineTo(x, y + r)
  ctx.quadraticCurveTo(x, y, x + r, y)
  ctx.closePath()
  ctx.fill()
}

function drawTank(ctx, t) {
  const { x, y, width, height, baseColor, turretColor, dirX, dirY } = t
  const cx = x + width / 2
  const cy = y + height / 2

  ctx.fillStyle = '#020617'
  drawRoundedRect(ctx, x - 2, y + 2, width + 4, height - 4, 8)

  ctx.fillStyle = baseColor
  drawRoundedRect(ctx, x, y, width, height, 8)

  ctx.fillStyle = turretColor
  ctx.beginPath()
  ctx.arc(cx, cy, Math.min(width, height) * 0.32, 0, Math.PI * 2)
  ctx.fill()

  const angle = Math.atan2(dirY || 0, dirX || 1)
  ctx.save()
  ctx.translate(cx, cy)
  ctx.rotate(angle)
  ctx.fillRect(width * 0.2, -3, width * 0.55, 6)
  ctx.restore()
}

function drawScene(ctx, world) {
  if (!world || !ctx) return
  const { map, players, bots, bullets, enemyBullets, running } = world
  const { width, height, obstacles } = map

  ctx.clearRect(0, 0, width, height)

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#020617')
  gradient.addColorStop(1, '#000000')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.strokeStyle = 'rgba(30, 64, 175, 0.38)'
  ctx.lineWidth = 1
  const grid = 40
  for (let x = grid; x < width; x += grid) {
    ctx.beginPath()
    ctx.moveTo(x, 0)
    ctx.lineTo(x, height)
    ctx.stroke()
  }
  for (let y = grid; y < height; y += grid) {
    ctx.beginPath()
    ctx.moveTo(0, y)
    ctx.lineTo(width, y)
    ctx.stroke()
  }

  for (const ob of obstacles) {
    ctx.fillStyle = '#02091f'
    drawRoundedRect(ctx, ob.x + 2, ob.y + 2, ob.width - 4, ob.height - 4, 12)
    ctx.strokeStyle = 'rgba(15, 23, 42, 0.9)'
    ctx.strokeRect(ob.x + 1, ob.y + 1, ob.width - 2, ob.height - 2)
  }

  if (players) {
    for (const p of players) {
      if (p.hp <= 0) continue
      drawTank(ctx, p)
    }
  }

  if (bots) {
    for (const b of bots) {
      if (b.hp <= 0) continue
      drawTank(ctx, b)
      const barW = b.width
      const hpR = b.hp / b.maxHp
      ctx.fillStyle = '#111827'
      ctx.fillRect(b.x, b.y - 6, barW, 4)
      ctx.fillStyle = '#fb7185'
      ctx.fillRect(b.x, b.y - 6, barW * hpR, 4)
    }
  }

  if (bullets) {
    ctx.fillStyle = '#e5e7eb'
    for (const b of bullets) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (enemyBullets) {
    ctx.fillStyle = '#fb7185'
    for (const b of enemyBullets) {
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (!running) {
    ctx.fillStyle = 'rgba(15, 23, 42, 0.78)'
    ctx.fillRect(0, 0, width, height)
    ctx.fillStyle = '#e5e7eb'
    ctx.textAlign = 'center'
    ctx.font =
      '26px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
    ctx.fillText('Гру завершено', width / 2, height / 2 - 10)
  }
}

function buildMazeMap(template) {
  const cell = template.cellSize || 40
  let cols = Math.floor(template.width / cell)
  let rows = Math.floor(template.height / cell)
  if (cols % 2 === 0) cols -= 1
  if (rows % 2 === 0) rows -= 1

  const grid = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => 1),
  )
  const dirs = [
    [1, 0],
    [-1, 0],
    [0, 1],
    [0, -1],
  ]

  function shuffle(a) {
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1))
      ;[a[i], a[j]] = [a[j], a[i]]
    }
    return a
  }

  function carve(x, y) {
    grid[y][x] = 0
    const shuffled = shuffle(dirs.slice())
    for (const [dx, dy] of shuffled) {
      const nx = x + dx * 2
      const ny = y + dy * 2
      if (nx <= 0 || ny <= 0 || nx >= cols - 1 || ny >= rows - 1) continue
      if (grid[ny][nx] === 1) {
        grid[y + dy][x + dx] = 0
        carve(nx, ny)
      }
    }
  }

  carve(1, 1)

  for (let i = 0; i < 50; i++) {
    const x = 1 + Math.floor(Math.random() * (cols - 2))
    const y = 1 + Math.floor(Math.random() * (rows - 2))
    if (grid[y][x] === 1) grid[y][x] = 0
  }

  const obstacles = []
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (grid[y][x] === 1) {
        obstacles.push({
          x: x * cell,
          y: y * cell,
          width: cell,
          height: cell,
        })
      }
    }
  }

  const paths = []
  for (let y = 1; y < rows - 1; y++) {
    for (let x = 1; x < cols - 1; x++) {
      if (grid[y][x] === 0) paths.push({ x, y })
    }
  }

  function closest(target) {
    let best = paths[0]
    let bestD = Infinity
    for (const c of paths) {
      const d = Math.hypot(c.x - target.x, c.y - target.y)
      if (d < bestD) {
        best = c
        bestD = d
      }
    }
    return best
  }

  const pCell = closest({ x: 1, y: rows - 2 })
  const eCells = [
    closest({ x: cols - 2, y: 1 }),
    closest({ x: cols - 2, y: rows - 2 }),
    closest({ x: Math.floor(cols / 2), y: 1 }),
  ]

  const off = 8
  const playerSpawn = { x: pCell.x * cell + off, y: pCell.y * cell + off }
  const botSpawns = eCells.map((c) => ({
    x: c.x * cell + off,
    y: c.y * cell + off,
  }))

  return {
    id: template.id,
    label: template.label,
    kind: template.kind,
    width: cols * cell,
    height: rows * cell,
    obstacles,
    playerSpawn,
    botSpawns,
  }
}

function prepareMap(mapId) {
  const base = MAPS.find((m) => m.id === mapId) || MAPS[0]
  if (base.kind === 'maze') return buildMazeMap(base)
  return base
}

function LocalBotGame({ config, onExit }) {
  const canvasRef = useRef(null)
  const keysRef = useRef({})
  const animRef = useRef(null)
  const [hud, setHud] = useState({ hp: 100, score: 0, time: 0 })
  const [status, setStatus] = useState('running')
  const [restartId, setRestartId] = useState(0)

  const handleExit = useCallback(() => {
    onExit && onExit()
  }, [onExit])

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Escape') {
        handleExit()
        return
      }
      keysRef.current[e.code] = true
    }
    const up = (e) => {
      keysRef.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [handleExit])

  useEffect(() => {
    const mode = MODES.find((m) => m.id === config?.modeId) || MODES[0]
    const map = prepareMap(config?.mapId)

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = map.width
    canvas.height = map.height

    const player = {
      id: 1,
      x: map.playerSpawn.x,
      y: map.playerSpawn.y,
      width: 32,
      height: 32,
      baseColor: '#22c55e',
      turretColor: '#4ade80',
      speed: 190,
      hp: 100,
      dirX: 1,
      dirY: 0,
      fireCooldown: 0,
      fireDelay: 0.25,
      bulletSpeed: 380,
    }

    const bots = []
    for (let i = 0; i < mode.botCount; i++) {
      const spawn = map.botSpawns[i % map.botSpawns.length]
      bots.push({
        id: i + 100,
        x: spawn.x,
        y: spawn.y,
        width: 32,
        height: 32,
        baseColor: '#fb7185',
        turretColor: '#fecaca',
        speed: mode.botSpeed,
        hp: mode.botHp,
        maxHp: mode.botHp,
        fireCooldown: Math.random() * mode.botFireDelay,
      })
    }

    const bullets = []
    const enemyBullets = []

    const world = {
      map,
      players: [player],
      bots,
      bullets,
      enemyBullets,
      running: true,
      elapsed: 0,
      score: 0,
    }

    setHud({ hp: player.hp, score: 0, time: 0 })
    setStatus('running')

    function rectsOverlap(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      )
    }

    function update(dt) {
      if (!world.running) return
      const { map, bots, bullets, enemyBullets } = world
      const obstacles = map.obstacles
      const keys = keysRef.current

      world.elapsed += dt

      let mx = 0
      let my = 0
      if (keys['KeyW'] || keys['ArrowUp']) my -= 1
      if (keys['KeyS'] || keys['ArrowDown']) my += 1
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my) || 1
        mx /= len
        my /= len
        player.dirX = mx
        player.dirY = my

        let nx = player.x + mx * player.speed * dt
        let ny = player.y + my * player.speed * dt
        const future = { x: nx, y: ny, width: player.width, height: player.height }

        if (future.x < 0) future.x = 0
        if (future.y < 0) future.y = 0
        if (future.x + future.width > map.width)
          future.x = map.width - future.width
        if (future.y + future.height > map.height)
          future.y = map.height - future.height

        let blocked = false
        for (const ob of obstacles) {
          if (rectsOverlap(future, ob)) {
            blocked = true
            break
          }
        }
        if (!blocked) {
          player.x = future.x
          player.y = future.y
        }
      }

      player.fireCooldown -= dt
      if ((keys['Space'] || keys['Enter']) && player.fireCooldown <= 0) {
        const len = Math.hypot(player.dirX, player.dirY) || 1
        const dx = len === 0 ? 1 : player.dirX / len
        const dy = len === 0 ? 0 : player.dirY / len
        bullets.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          radius: 4,
          vx: dx * player.bulletSpeed,
          vy: dy * player.bulletSpeed,
        })
        player.fireCooldown = player.fireDelay
      }

      for (const bot of bots) {
        if (bot.hp <= 0) continue
        const dx = player.x - bot.x
        const dy = player.y - bot.y
        const dist = Math.hypot(dx, dy) || 1
        const dirX = dx / dist
        const dirY = dy / dist

        const targetDist = 210
        if (dist > targetDist) {
          let nx = bot.x + dirX * bot.speed * dt
          let ny = bot.y + dirY * bot.speed * dt
          const future = { x: nx, y: ny, width: bot.width, height: bot.height }

          if (future.x < 0) future.x = 0
          if (future.y < 0) future.y = 0
          if (future.x + future.width > map.width)
            future.x = map.width - future.width
          if (future.y + future.height > map.height)
            future.y = map.height - future.height

          let blocked = false
          for (const ob of obstacles) {
            if (rectsOverlap(future, ob)) {
              blocked = true
              break
            }
          }
          if (!blocked) {
            bot.x = future.x
            bot.y = future.y
          }
        }

        bot.fireCooldown -= dt
        if (bot.fireCooldown <= 0 && dist < mode.botFireRange) {
          enemyBullets.push({
            x: bot.x + bot.width / 2,
            y: bot.y + bot.height / 2,
            radius: 4,
            vx: (dx / dist) * mode.botBulletSpeed,
            vy: (dy / dist) * mode.botBulletSpeed,
          })
          bot.fireCooldown = mode.botFireDelay * (0.7 + Math.random() * 0.6)
        }
      }

      function updateBullets(arr, hitFn) {
        for (let i = arr.length - 1; i >= 0; i--) {
          const b = arr[i]
          b.x += b.vx * dt
          b.y += b.vy * dt

          if (
            b.x < -20 ||
            b.y < -20 ||
            b.x > map.width + 20 ||
            b.y > map.height + 20
          ) {
            arr.splice(i, 1)
            continue
          }

          const box = {
            x: b.x - b.radius,
            y: b.y - b.radius,
            width: b.radius * 2,
            height: b.radius * 2,
          }

          let blocked = false
          for (const ob of obstacles) {
            if (rectsOverlap(box, ob)) {
              blocked = true
              break
            }
          }
          if (blocked) {
            arr.splice(i, 1)
            continue
          }

          if (hitFn(box)) {
            arr.splice(i, 1)
          }
        }
      }

      updateBullets(bullets, (box) => {
        for (const bot of bots) {
          if (bot.hp <= 0) continue
          const target = {
            x: bot.x,
            y: bot.y,
            width: bot.width,
            height: bot.height,
          }
          if (rectsOverlap(box, target)) {
            bot.hp -= 35
            if (bot.hp <= 0) {
              world.score += 1
              const spawn =
                map.botSpawns[Math.floor(Math.random() * map.botSpawns.length)]
              bot.x = spawn.x
              bot.y = spawn.y
              bot.hp = bot.maxHp
            }
            return true
          }
        }
        return false
      })

      updateBullets(enemyBullets, (box) => {
        const target = {
          x: player.x,
          y: player.y,
          width: player.width,
          height: player.height,
        }
        if (rectsOverlap(box, target)) {
          player.hp -= mode.damagePerHit
          if (player.hp <= 0) {
            player.hp = 0
            world.running = false
            setStatus('dead')
          }
          return true
        }
        return false
      })

      setHud({ hp: player.hp, score: world.score, time: world.elapsed })
    }

    function frame() {
      const now = performance.now()
      if (!frame.lastTime) frame.lastTime = now
      const dt = (now - frame.lastTime) / 1000
      frame.lastTime = now

      update(dt)
      drawScene(ctx, world)

      animRef.current = requestAnimationFrame(frame)
    }
    animRef.current = requestAnimationFrame(frame)

    return () => {
      if (animRef.current) cancelAnimationFrame(animRef.current)
    }
  }, [config, restartId])

  const hpRatio = Math.max(0, Math.min(1, hud.hp / 100))

  return (
    <div className="game-screen">
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} className="game-canvas" />
        <div className="hud hud-overlay">
          <div className="hud-pill">
            <span className="hud-label">Режим</span>
            <span className="hud-value">
              {MODES.find((m) => m.id === config?.modeId)?.label || '—'}
            </span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Карта</span>
            <span className="hud-value">
              {MAPS.find((m) => m.id === config?.mapId)?.label || '—'}
            </span>
          </div>
          <div className="hud-pill hud-pill--hp">
            <span className="hud-label">HP</span>
            <div className="hud-bar">
              <div
                className="hud-bar-fill"
                style={{ width: hpRatio * 100 + '%' }}
              />
            </div>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Очки</span>
            <span className="hud-value">{hud.score}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Час</span>
            <span className="hud-value">{hud.time.toFixed(1)} c</span>
          </div>
          <button className="hud-exit-btn" onClick={handleExit}>
            Вийти в меню
          </button>
        </div>

        <div className="controls-hint">
          WASD / стрілки — рух, Space / Enter — стріляти, Esc — вийти в меню
        </div>

        {status === 'dead' && (
          <div className="overlay">
            <div className="overlay-card">
              <h2>Поразка</h2>
              <p>Твої очки: {hud.score}</p>
              <div className="overlay-actions">
                <button onClick={handleExit}>Вийти в меню</button>
                <button onClick={() => setRestartId((id) => id + 1)}>
                  Грати ще раз
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const PVP_MAP = {
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
  p1Spawn: { x: 160, y: 260 },
  p2Spawn: { x: 980, y: 260 },
}

function OnlinePvPGame({ config, onExit }) {
  const canvasRef = useRef(null)
  const wsRef = useRef(null)
  const keysRef = useRef({})
  const remoteInputRef = useRef({
    up: false,
    down: false,
    left: false,
    right: false,
    fire: false,
  })
  const clientWorldRef = useRef(null)
  const hostAnimRef = useRef(null)
  const clientAnimRef = useRef(null)
  const [role, setRole] = useState(null)
  const roleRef = useRef(null)
  const [connStatus, setConnStatus] = useState('connecting')
  const [hud, setHud] = useState({ p1hp: 100, p2hp: 100, time: 0 })
  const [status, setStatus] = useState('waiting')

  const handleExit = useCallback(() => {
    onExit && onExit()
  }, [onExit])

  useEffect(() => {
    const down = (e) => {
      if (e.code === 'Escape') {
        handleExit()
        return
      }
      keysRef.current[e.code] = true
    }
    const up = (e) => {
      keysRef.current[e.code] = false
    }
    window.addEventListener('keydown', down)
    window.addEventListener('keyup', up)
    return () => {
      window.removeEventListener('keydown', down)
      window.removeEventListener('keyup', up)
    }
  }, [handleExit])

  useEffect(() => {
    const url = config?.serverUrl || 'ws://localhost:3001'
    let ws
    try {
      ws = new WebSocket(url)
    } catch {
      setConnStatus('error')
      return
    }
    wsRef.current = ws

    ws.onopen = () => {
      setConnStatus('connected')
      setStatus('waiting')
    }

    ws.onmessage = (ev) => {
      let msg
      try {
        msg = JSON.parse(ev.data)
      } catch {
        return
      }

      if (msg.type === 'role') {
        setRole(msg.role)
        roleRef.current = msg.role
        if (msg.role === 'p1') setStatus('running')
        return
      }

      if (msg.type === 'input') {
        if (roleRef.current === 'p1' && msg.from === 'p2') {
          remoteInputRef.current = msg.input || remoteInputRef.current
        }
        return
      }

      if (msg.type === 'state') {
        if (roleRef.current === 'p2' || roleRef.current === 'spectator') {
          clientWorldRef.current = msg.state
          if (msg.state && msg.state.meta) {
            setHud({
              p1hp: msg.state.meta.p1hp,
              p2hp: msg.state.meta.p2hp,
              time: msg.state.meta.time,
            })
          }
          setStatus(msg.state && msg.state.running ? 'running' : 'ended')
        }
        return
      }

      if (msg.type === 'end') {
        setStatus('ended')
      }
    }

    ws.onerror = () => setConnStatus('error')
    ws.onclose = () => setConnStatus('closed')

    return () => {
      ws.close()
    }
  }, [config])

  useEffect(() => {
    if (role !== 'p2') return
    if (!wsRef.current) return

    const id = setInterval(() => {
      const k = keysRef.current
      const input = {
        up: k['ArrowUp'],
        down: k['ArrowDown'],
        left: k['ArrowLeft'],
        right: k['ArrowRight'],
        fire: k['Enter'] || k['Numpad0'],
      }
      try {
        wsRef.current.send(JSON.stringify({ type: 'input', input }))
      } catch {}
    }, 40)

    return () => clearInterval(id)
  }, [role])

  useEffect(() => {
    if (role !== 'p1') return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = PVP_MAP.width
    canvas.height = PVP_MAP.height

    const p1 = {
      id: 1,
      x: PVP_MAP.p1Spawn.x,
      y: PVP_MAP.p1Spawn.y,
      width: 32,
      height: 32,
      baseColor: '#22c55e',
      turretColor: '#4ade80',
      speed: 200,
      hp: 100,
      dirX: 1,
      dirY: 0,
      fireCooldown: 0,
      fireDelay: 0.25,
      bulletSpeed: 380,
    }

    const p2 = {
      id: 2,
      x: PVP_MAP.p2Spawn.x,
      y: PVP_MAP.p2Spawn.y,
      width: 32,
      height: 32,
      baseColor: '#38bdf8',
      turretColor: '#bae6fd',
      speed: 200,
      hp: 100,
      dirX: -1,
      dirY: 0,
      fireCooldown: 0,
      fireDelay: 0.25,
      bulletSpeed: 380,
    }

    const world = {
      map: {
        width: PVP_MAP.width,
        height: PVP_MAP.height,
        obstacles: PVP_MAP.obstacles,
      },
      players: [p1, p2],
      bullets: [],
      running: true,
      elapsed: 0,
    }

    setHud({ p1hp: 100, p2hp: 100, time: 0 })
    setStatus('running')

    function rectsOverlap(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      )
    }

    function movePlayer(player, input, dt) {
      let mx = 0
      let my = 0
      if (input.up) my -= 1
      if (input.down) my += 1
      if (input.left) mx -= 1
      if (input.right) mx += 1

      const { map } = world
      const obstacles = map.obstacles

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my) || 1
        mx /= len
        my /= len
        player.dirX = mx
        player.dirY = my

        let nx = player.x + mx * player.speed * dt
        let ny = player.y + my * player.speed * dt
        const future = { x: nx, y: ny, width: player.width, height: player.height }

        if (future.x < 0) future.x = 0
        if (future.y < 0) future.y = 0
        if (future.x + future.width > map.width)
          future.x = map.width - future.width
        if (future.y + future.height > map.height)
          future.y = map.height - future.height

        let blocked = false
        for (const ob of obstacles) {
          if (rectsOverlap(future, ob)) {
            blocked = true
            break
          }
        }
        if (!blocked) {
          player.x = future.x
          player.y = future.y
        }
      }
    }

    function spawnBullet(player, arr) {
      const len = Math.hypot(player.dirX, player.dirY) || 1
      const dx = len === 0 ? 1 : player.dirX / len
      const dy = len === 0 ? 0 : player.dirY / len
      arr.push({
        owner: player.id,
        x: player.x + player.width / 2,
        y: player.y + player.height / 2,
        radius: 4,
        vx: dx * player.bulletSpeed,
        vy: dy * player.bulletSpeed,
      })
    }

    function update(dt) {
      if (!world.running) return

      const k = keysRef.current
      world.elapsed += dt

      const inputP1 = {
        up: k['KeyW'],
        down: k['KeyS'],
        left: k['KeyA'],
        right: k['KeyD'],
        fire: k['Space'],
      }
      const inputP2 = remoteInputRef.current

      movePlayer(p1, inputP1, dt)
      movePlayer(p2, inputP2, dt)

      p1.fireCooldown -= dt
      p2.fireCooldown -= dt
      if (inputP1.fire && p1.fireCooldown <= 0) {
        spawnBullet(p1, world.bullets)
        p1.fireCooldown = p1.fireDelay
      }
      if (inputP2.fire && p2.fireCooldown <= 0) {
        spawnBullet(p2, world.bullets)
        p2.fireCooldown = p2.fireDelay
      }

      const { map } = world
      const obstacles = map.obstacles
      const bullets = world.bullets

      for (let i = bullets.length - 1; i >= 0; i--) {
        const b = bullets[i]
        b.x += b.vx * dt
        b.y += b.vy * dt

        if (
          b.x < -20 ||
          b.y < -20 ||
          b.x > map.width + 20 ||
          b.y > map.height + 20
        ) {
          bullets.splice(i, 1)
          continue
        }

        const box = {
          x: b.x - b.radius,
          y: b.y - b.radius,
          width: b.radius * 2,
          height: b.radius * 2,
        }

        let blocked = false
        for (const ob of obstacles) {
          if (rectsOverlap(box, ob)) {
            blocked = true
            break
          }
        }
        if (blocked) {
          bullets.splice(i, 1)
          continue
        }

        const targets = [p1, p2]
        for (const t of targets) {
          if (t.id === b.owner) continue
          const rect = {
            x: t.x,
            y: t.y,
            width: t.width,
            height: t.height,
          }
          if (rectsOverlap(box, rect)) {
            t.hp -= 25
            if (t.hp < 0) t.hp = 0
            bullets.splice(i, 1)
            break
          }
        }
      }

      const finished = p1.hp <= 0 || p2.hp <= 0
      if (finished) {
        world.running = false
        setStatus('ended')
        try {
          wsRef.current &&
            wsRef.current.send(JSON.stringify({ type: 'end' }))
        } catch {}
      }

      setHud({ p1hp: p1.hp, p2hp: p2.hp, time: world.elapsed })

      const state = {
        map: world.map,
        players: [p1, p2].map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          baseColor: p.baseColor,
          turretColor: p.turretColor,
          dirX: p.dirX,
          dirY: p.dirY,
          hp: p.hp,
          maxHp: 100,
        })),
        bullets: bullets.map((b) => ({
          x: b.x,
          y: b.y,
          radius: b.radius,
        })),
        meta: {
          p1hp: p1.hp,
          p2hp: p2.hp,
          time: world.elapsed,
        },
        running: world.running,
      }

      try {
        wsRef.current &&
          wsRef.current.send(JSON.stringify({ type: 'state', state }))
      } catch {}
    }

    function frame() {
      const now = performance.now()
      if (!frame.lastTime) frame.lastTime = now
      const dt = (now - frame.lastTime) / 1000
      frame.lastTime = now

      update(dt)
      drawScene(ctx, {
        map: world.map,
        players: [p1, p2],
        bots: [],
        bullets: world.bullets,
        enemyBullets: [],
        running: world.running,
      })

      hostAnimRef.current = requestAnimationFrame(frame)
    }
    hostAnimRef.current = requestAnimationFrame(frame)

    return () => {
      if (hostAnimRef.current) cancelAnimationFrame(hostAnimRef.current)
    }
  }, [role])

  useEffect(() => {
    if (role === 'p1') return

    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    canvas.width = PVP_MAP.width
    canvas.height = PVP_MAP.height

    function frame() {
      const world = clientWorldRef.current

      if (world) {
        drawScene(ctx, {
          map: world.map,
          players: world.players,
          bots: [],
          bullets: world.bullets,
          enemyBullets: [],
          running: world.running ?? true,
        })
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height)

        const gradient = ctx.createLinearGradient(
          0,
          0,
          canvas.width,
          canvas.height,
        )
        gradient.addColorStop(0, '#020617')
        gradient.addColorStop(1, '#000000')
        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvas.width, canvas.height)

        ctx.fillStyle = '#e5e7eb'
        ctx.font =
          '18px system-ui, -apple-system, BlinkMacSystemFont, sans-serif'
        ctx.textAlign = 'center'
        ctx.fillText('Очікування хоста...', canvas.width / 2, canvas.height / 2)
      }

      clientAnimRef.current = requestAnimationFrame(frame)
    }
    clientAnimRef.current = requestAnimationFrame(frame)

    return () => {
      if (clientAnimRef.current) cancelAnimationFrame(clientAnimRef.current)
    }
  }, [role])

  const hp1 = Math.max(0, Math.min(100, hud.p1hp))
  const hp2 = Math.max(0, Math.min(100, hud.p2hp))

  return (
    <div className="game-screen">
      <div className="canvas-wrapper">
        <canvas ref={canvasRef} className="game-canvas" />
        <div className="hud hud-overlay">
          <div className="hud-pill">
            <span className="hud-label">Режим</span>
            <span className="hud-value">Онлайн 1v1</span>
          </div>
          <div className="hud-pill hud-pill--hp">
            <span className="hud-label">HP P1</span>
            <div className="hud-bar">
              <div className="hud-bar-fill" style={{ width: hp1 + '%' }} />
            </div>
          </div>
          <div className="hud-pill hud-pill--hp">
            <span className="hud-label">HP P2</span>
            <div className="hud-bar">
              <div
                className="hud-bar-fill hud-bar-fill--p2"
                style={{ width: hp2 + '%' }}
              />
            </div>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Час</span>
            <span className="hud-value">{hud.time.toFixed(1)} c</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Статус</span>
            <span className="hud-value">
              {connStatus === 'connected'
                ? role
                  ? status === 'running'
                    ? role === 'p1'
                      ? 'Ти P1 (хост)'
                      : 'Ти P2'
                    : 'Гру завершено'
                  : 'Очікування ролі...'
                : connStatus === 'connecting'
                ? "З'єднання..."
                : 'Помилка з’єднання'}
            </span>
          </div>
          <button className="hud-exit-btn" onClick={handleExit}>
            Вийти в меню
          </button>
        </div>
        <div className="controls-hint">
          P1: WASD + Space • P2: стрілки + Enter • Esc — вихід у меню
        </div>
      </div>
    </div>
  )
}

function GameScreen({ config, onExit }) {
  if (config?.gameType === 'online') {
    return <OnlinePvPGame config={config} onExit={onExit} />
  }
  return <LocalBotGame config={config} onExit={onExit} />
}

export default GameScreen
