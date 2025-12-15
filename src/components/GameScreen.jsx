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

function drawPickup(ctx, pickup) {
  const colors = {
    heal: '#22c55e',
    rapid: '#0ea5e9',
    shield: '#a855f7',
  }
  ctx.save()
  ctx.translate(pickup.x, pickup.y)
  ctx.rotate(performance.now() * 0.002)
  ctx.fillStyle = colors[pickup.type] || '#e5e7eb'
  ctx.globalAlpha = 0.9
  ctx.beginPath()
  ctx.moveTo(0, -pickup.radius)
  ctx.lineTo(pickup.radius, pickup.radius)
  ctx.lineTo(-pickup.radius, pickup.radius)
  ctx.closePath()
  ctx.fill()
  ctx.restore()
}

function drawScene(ctx, world) {
  if (!world || !ctx) return
  const {
    map,
    players,
    bots,
    bullets,
    enemyBullets,
    running,
    particles = [],
    pickups = [],
    cameraShake = 0,
  } = world
  const { width, height, obstacles } = map

  ctx.clearRect(0, 0, width, height)

  const gradient = ctx.createLinearGradient(0, 0, width, height)
  gradient.addColorStop(0, '#020617')
  gradient.addColorStop(0.5, '#0f172a')
  gradient.addColorStop(1, '#020617')
  ctx.fillStyle = gradient
  ctx.fillRect(0, 0, width, height)

  ctx.save()
  if (cameraShake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * cameraShake,
      (Math.random() - 0.5) * cameraShake,
    )
  }

  ctx.strokeStyle = 'rgba(59, 130, 246, 0.22)'
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
    const obGradient = ctx.createLinearGradient(ob.x, ob.y, ob.x, ob.y + ob.height)
    obGradient.addColorStop(0, 'rgba(59,130,246,0.16)')
    obGradient.addColorStop(1, 'rgba(15,23,42,0.95)')
    ctx.fillStyle = obGradient
    drawRoundedRect(ctx, ob.x + 2, ob.y + 2, ob.width - 4, ob.height - 4, 12)
    ctx.strokeStyle = 'rgba(148,163,184,0.25)'
    ctx.strokeRect(ob.x + 1, ob.y + 1, ob.width - 2, ob.height - 2)
  }

  for (const pickup of pickups) {
    drawPickup(ctx, pickup)
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
    for (const b of bullets) {
      ctx.fillStyle = b.color || '#e5e7eb'
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (enemyBullets) {
    for (const b of enemyBullets) {
      ctx.fillStyle = b.color || '#fb7185'
      ctx.beginPath()
      ctx.arc(b.x, b.y, b.radius, 0, Math.PI * 2)
      ctx.fill()
    }
  }

  if (particles) {
    for (const p of particles) {
      ctx.fillStyle = p.color
      ctx.globalAlpha = p.life
      ctx.beginPath()
      ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2)
      ctx.fill()
      ctx.globalAlpha = 1
    }
  }

  ctx.restore()

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
  const [hud, setHud] = useState({
    hp: 100,
    maxHp: 100,
    score: 0,
    time: 0,
    streak: 0,
    buffs: {},
  })
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
      speed: 210,
      maxHp: 120,
      hp: 110,
      dirX: 1,
      dirY: 0,
      fireCooldown: 0,
      fireDelay: 0.25,
      bulletSpeed: 400,
      dashCooldown: 0,
      dashTimer: 0,
      rapidFireDuration: 0,
      shieldDuration: 0,
      trailTimer: 0,
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
      particles: [],
      pickups: [],
      running: true,
      elapsed: 0,
      score: 0,
      streak: 0,
      streakTimer: 0,
      cameraShake: 0,
      pickupTimer: 5.5,
    }

    setHud({
      hp: player.hp,
      maxHp: player.maxHp,
      score: 0,
      time: 0,
      streak: 0,
      buffs: {},
    })
    setStatus('running')

    function rectsOverlap(a, b) {
      return (
        a.x < b.x + b.width &&
        a.x + a.width > b.x &&
        a.y < b.y + b.height &&
        a.y + a.height > b.y
      )
    }

    function addParticles(x, y, color, spread = 36, count = 8) {
      for (let i = 0; i < count; i++) {
        const angle = Math.random() * Math.PI * 2
        const speed = Math.random() * spread + 40
        world.particles.push({
          x,
          y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          radius: 2 + Math.random() * 2,
          life: 1,
          color,
        })
      }
    }

    function trySpawnPickup() {
      if (world.pickups.length >= 3) return
      const types = ['heal', 'rapid', 'shield']
      for (let i = 0; i < 20; i++) {
        const x = 80 + Math.random() * (map.width - 160)
        const y = 80 + Math.random() * (map.height - 160)
        const radius = 12
        const candidate = { x, y, radius, type: types[Math.floor(Math.random() * types.length)] }
        let blocked = false
        for (const ob of map.obstacles) {
          const rect = {
            x: ob.x,
            y: ob.y,
            width: ob.width,
            height: ob.height,
          }
          if (rectsOverlap({
            x: candidate.x - radius,
            y: candidate.y - radius,
            width: radius * 2,
            height: radius * 2,
          }, rect)) {
            blocked = true
            break
          }
        }
        if (!blocked) {
          world.pickups.push(candidate)
          break
        }
      }
    }

    function update(dt) {
      if (!world.running) return
      const { map, bots, bullets, enemyBullets } = world
      const obstacles = map.obstacles
      const keys = keysRef.current

      world.elapsed += dt
      world.cameraShake = Math.max(0, world.cameraShake - dt * 22)
      world.pickupTimer -= dt
      if (world.pickupTimer <= 0) {
        trySpawnPickup()
        world.pickupTimer = 8 + Math.random() * 5
      }

      for (let i = world.particles.length - 1; i >= 0; i--) {
        const p = world.particles[i]
        p.life -= dt * 0.9
        p.x += p.vx * dt
        p.y += p.vy * dt
        p.vx *= 0.98
        p.vy *= 0.98
        if (p.life <= 0) world.particles.splice(i, 1)
      }

      player.dashCooldown = Math.max(0, player.dashCooldown - dt)
      player.dashTimer = Math.max(0, player.dashTimer - dt)
      player.rapidFireDuration = Math.max(0, player.rapidFireDuration - dt)
      player.shieldDuration = Math.max(0, player.shieldDuration - dt)

      let mx = 0
      let my = 0
      if (keys['KeyW'] || keys['ArrowUp']) my -= 1
      if (keys['KeyS'] || keys['ArrowDown']) my += 1
      if (keys['KeyA'] || keys['ArrowLeft']) mx -= 1
      if (keys['KeyD'] || keys['ArrowRight']) mx += 1

      const wantsDash = keys['ShiftLeft'] || keys['ShiftRight']

      if (wantsDash && player.dashCooldown <= 0 && (mx !== 0 || my !== 0)) {
        player.dashTimer = 0.22
        player.dashCooldown = 2.6
        addParticles(player.x + player.width / 2, player.y + player.height / 2, '#38bdf8', 80, 14)
      }

      const baseSpeed = player.speed * (player.dashTimer > 0 ? 2.8 : 1)

      if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my) || 1
        mx /= len
        my /= len
        player.dirX = mx
        player.dirY = my

        let nx = player.x + mx * baseSpeed * dt
        let ny = player.y + my * baseSpeed * dt
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
      const fireDelay = player.fireDelay * (player.rapidFireDuration > 0 ? 0.55 : 1)
      if ((keys['Space'] || keys['Enter']) && player.fireCooldown <= 0) {
        const len = Math.hypot(player.dirX, player.dirY) || 1
        const dx = len === 0 ? 1 : player.dirX / len
        const dy = len === 0 ? 0 : player.dirY / len
        bullets.push({
          x: player.x + player.width / 2,
          y: player.y + player.height / 2,
          radius: player.rapidFireDuration > 0 ? 5 : 4,
          vx: dx * player.bulletSpeed * (player.rapidFireDuration > 0 ? 1.15 : 1),
          vy: dy * player.bulletSpeed * (player.rapidFireDuration > 0 ? 1.15 : 1),
          color: player.rapidFireDuration > 0 ? '#7dd3fc' : '#e5e7eb',
        })
        addParticles(
          player.x + player.width / 2,
          player.y + player.height / 2,
          player.rapidFireDuration > 0 ? '#bae6fd' : '#c7d2fe',
          50,
          6,
        )
        player.fireCooldown = fireDelay
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
            color: '#fb7185',
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
            bot.hp -= 36
            world.cameraShake = Math.max(world.cameraShake, 9)
            addParticles(box.x + box.width / 2, box.y + box.height / 2, '#f472b6', 70, 10)
            if (bot.hp <= 0) {
              world.score += 1 + Math.max(0, world.streak)
              world.streak += 1
              world.streakTimer = 3.6
              const spawn =
                map.botSpawns[Math.floor(Math.random() * map.botSpawns.length)]
              bot.x = spawn.x
              bot.y = spawn.y
              bot.hp = bot.maxHp
              addParticles(bot.x + bot.width / 2, bot.y + bot.height / 2, '#fb7185', 90, 14)
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
          const dmg = mode.damagePerHit * (player.shieldDuration > 0 ? 0.55 : 1)
          player.hp -= dmg
          world.cameraShake = Math.max(world.cameraShake, player.shieldDuration > 0 ? 5 : 11)
          addParticles(box.x + box.width / 2, box.y + box.height / 2, '#fda4af', 80, 12)
          if (player.hp <= 0) {
            player.hp = 0
            world.running = false
            setStatus('dead')
          }
          return true
        }
        return false
      })

      world.streakTimer = Math.max(0, world.streakTimer - dt)
      if (world.streakTimer === 0) {
        world.streak = 0
      }

      for (let i = world.pickups.length - 1; i >= 0; i--) {
        const p = world.pickups[i]
        const dx = player.x + player.width / 2 - p.x
        const dy = player.y + player.height / 2 - p.y
        if (Math.hypot(dx, dy) < p.radius + 16) {
          if (p.type === 'heal') {
            player.hp = Math.min(player.maxHp, player.hp + 35)
          } else if (p.type === 'rapid') {
            player.rapidFireDuration = Math.max(player.rapidFireDuration, 7)
          } else if (p.type === 'shield') {
            player.shieldDuration = Math.max(player.shieldDuration, 6)
          }
          addParticles(p.x, p.y, '#c084fc', 100, 16)
          world.pickups.splice(i, 1)
        }
      }

      setHud({
        hp: player.hp,
        maxHp: player.maxHp,
        score: world.score,
        time: world.elapsed,
        streak: world.streak,
        buffs: {
          shield: player.shieldDuration,
          rapid: player.rapidFireDuration,
          dash: player.dashCooldown,
        },
      })
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

  const hpMax = hud.maxHp || 100
  const hpRatio = Math.max(0, Math.min(1, hud.hp / hpMax))

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
            <span className="hud-value small">{hud.hp.toFixed(0)} / {hpMax}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Серія</span>
            <span className="hud-value">x{hud.streak + 1}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Бонуси</span>
            <span className="hud-value">
              Щит: {Math.max(0, hud.buffs?.shield || 0).toFixed(1)}с ·
              Вогонь: {Math.max(0, hud.buffs?.rapid || 0).toFixed(1)}с
            </span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Ривок</span>
            <span className="hud-value">
              {hud.buffs?.dash > 0
                ? `Кд: ${hud.buffs.dash.toFixed(1)}с`
                : 'Готовий (Shift)'}
            </span>
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
          WASD / стрілки — рух, Space / Enter — стріляти, Shift — ривок, збирай неонові підбори.
          Esc — вийти в меню
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
