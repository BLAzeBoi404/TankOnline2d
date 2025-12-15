import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MAPS, MODES } from '../gameConfig.js'

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

function createArenaScene(Phaser, map, mode, onHud) {
  const playerMaxHp = 130

  function createTexture(scene, key, base, accent) {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(base, 1)
    g.fillRoundedRect(0, 0, 32, 32, 8)
    g.fillStyle(accent, 1)
    g.fillCircle(16, 16, 7)
    g.fillRect(16, 13, 10, 6)
    g.generateTexture(key, 32, 32)
    g.destroy()
  }

  function createPickupTexture(scene, key, color) {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(color, 1)
    g.beginPath()
    g.moveTo(12, 0)
    g.lineTo(24, 12)
    g.lineTo(12, 24)
    g.lineTo(0, 12)
    g.closePath()
    g.fill()
    g.generateTexture(key, 24, 24)
    g.destroy()
  }

  function createBulletTexture(scene, key, color) {
    if (scene.textures.exists(key)) return
    const g = scene.make.graphics({ x: 0, y: 0, add: false })
    g.fillStyle(color, 1)
    g.fillCircle(4, 4, 4)
    g.generateTexture(key, 8, 8)
    g.destroy()
  }

  return class ArenaScene extends Phaser.Scene {
    constructor() {
      super('ArenaScene')
      this.player = null
      this.bots = []
      this.pickups = null
      this.bullets = null
      this.enemyBullets = null
      this.streak = 0
      this.streakTimer = 0
      this.hudTimer = 0
      this.rapidTimer = 0
      this.shieldTimer = 0
      this.dashCd = 0
      this.dashTime = 0
      this.running = true
    }

    preload() {}

    create() {
      this.cameras.main.setBackgroundColor('#030712')
      createTexture(this, 'tank-green', 0x16a34a, 0x22c55e)
      createTexture(this, 'tank-red', 0xbe123c, 0xfb7185)
      createTexture(this, 'tank-blue', 0x0ea5e9, 0x38bdf8)
      createPickupTexture(this, 'p-heal', 0x22c55e)
      createPickupTexture(this, 'p-rapid', 0x0ea5e9)
      createPickupTexture(this, 'p-shield', 0xa855f7)
      createBulletTexture(this, 'b-friendly', 0xe5e7eb)
      createBulletTexture(this, 'b-enemy', 0xfb7185)

      this.physics.world.setBounds(0, 0, map.width, map.height)

      const obstacleGroup = this.physics.add.staticGroup()
      map.obstacles.forEach((ob) => {
        const block = this.add.rectangle(
          ob.x + ob.width / 2,
          ob.y + ob.height / 2,
          ob.width,
          ob.height,
          0x0b1224,
          0.9,
        )
        obstacleGroup.add(block)
      })

      this.player = this.physics.add.sprite(
        map.playerSpawn.x + 16,
        map.playerSpawn.y + 16,
        'tank-green',
      )
      this.player.setCollideWorldBounds(true)
      this.player.setDataEnabled()
      this.player.data.set('hp', 120)

      this.cursors = this.input.keyboard.addKeys({
        up: 'W',
        down: 'S',
        left: 'A',
        right: 'D',
        fire: 'SPACE',
        dash: 'SHIFT',
      })

      this.bots = []
      const botSpawns = map.botSpawns.length ? map.botSpawns : [map.playerSpawn]
      for (let i = 0; i < mode.botCount; i++) {
        const spawn = botSpawns[i % botSpawns.length]
        const bot = this.physics.add.sprite(spawn.x + 16, spawn.y + 16, 'tank-red')
        bot.setCollideWorldBounds(true)
        bot.setDataEnabled()
        bot.data.set('hp', mode.botHp)
        bot.data.set('cooldown', Math.random())
        this.bots.push(bot)
      }

      this.bullets = this.physics.add.group()
      this.enemyBullets = this.physics.add.group()
      this.pickups = this.physics.add.group()

      this.physics.add.collider(this.player, obstacleGroup)
      this.physics.add.collider(this.bots, obstacleGroup)
      this.physics.add.collider(this.bots, this.bots)

      this.physics.add.overlap(this.bullets, obstacleGroup, (b) => b.destroy())
      this.physics.add.overlap(this.enemyBullets, obstacleGroup, (b) => b.destroy())

      this.physics.add.overlap(this.bullets, this.bots, (bullet, bot) => {
        bullet.destroy()
        if (!this.running) return
        let hp = bot.data.get('hp')
        hp -= 36
        bot.data.set('hp', hp)
        this.cameras.main.shake(80, 0.003)
        if (hp <= 0) {
          const spawn = botSpawns[Math.floor(Math.random() * botSpawns.length)]
          bot.setPosition(spawn.x + 16, spawn.y + 16)
          bot.data.set('hp', mode.botHp)
          this.streak += 1
          this.streakTimer = 3.5
          this.events.emit('score', 1 + Math.max(0, this.streak - 1))
        }
      })

      this.physics.add.overlap(this.enemyBullets, this.player, (bullet) => {
        bullet.destroy()
        if (!this.running) return
        const dmg = mode.damagePerHit * (this.shieldTimer > 0 ? 0.55 : 1)
        let hp = this.player.data.get('hp') - dmg
        this.player.data.set('hp', hp)
        this.cameras.main.shake(120, this.shieldTimer > 0 ? 0.002 : 0.004)
        if (hp <= 0) {
          this.player.data.set('hp', 0)
          this.running = false
          this.events.emit('dead')
        }
      })

      this.physics.add.overlap(this.player, this.pickups, (player, pickup) => {
        const type = pickup.getData('type')
        if (type === 'heal') {
          const hp = Math.min(playerMaxHp, this.player.data.get('hp') + 40)
          this.player.data.set('hp', hp)
        } else if (type === 'rapid') {
          this.rapidTimer = Math.max(this.rapidTimer, 7)
        } else if (type === 'shield') {
          this.shieldTimer = Math.max(this.shieldTimer, 6)
        }
        pickup.destroy()
      })

      this.time.addEvent({
        delay: 7000,
        loop: true,
        callback: () => this.spawnPickup(),
      })

      this.events.on('score', (add) => {
        if (!this.score) this.score = 0
        this.score += add
      })

      this.score = 0
    }

    spawnPickup() {
      if (!this.pickups || this.pickups.countActive(true) >= 3) return
      const types = ['heal', 'rapid', 'shield']
      for (let i = 0; i < 20; i++) {
        const x = 60 + Math.random() * (map.width - 120)
        const y = 60 + Math.random() * (map.height - 120)
        const type = types[Math.floor(Math.random() * types.length)]
        const key = type === 'heal' ? 'p-heal' : type === 'rapid' ? 'p-rapid' : 'p-shield'
        const pickup = this.pickups.create(x, y, key)
        pickup.setData('type', type)
        pickup.setCircle(10)
        pickup.setBounce(0)
        pickup.setImmovable(true)
        const blocked = this.physics.overlapRect(x, y, 24, 24).some((o) => o.gameObject && o.gameObject !== pickup)
        if (!blocked) return
        pickup.destroy()
      }
    }

    tryFire(owner, speed, group, textureKey) {
      const now = this.time.now
      const last = owner.getData('lastShot') || 0
      const delay = owner.getData('fireDelay') || 250
      if (now - last < delay) return
      owner.setData('lastShot', now)
      const angle = owner.getData('angle') || 0
      const bullet = group.create(owner.x, owner.y, textureKey)
      this.physics.velocityFromRotation(angle, speed, bullet.body.velocity)
      bullet.setCircle(4)
      bullet.setCollideWorldBounds(false)
    }

    update(time, deltaMs) {
      const dt = deltaMs / 1000
      if (!this.running) return
      this.streakTimer = Math.max(0, this.streakTimer - dt)
      if (this.streakTimer === 0) this.streak = 0
      this.rapidTimer = Math.max(0, this.rapidTimer - dt)
      this.shieldTimer = Math.max(0, this.shieldTimer - dt)
      this.dashCd = Math.max(0, this.dashCd - dt)
      this.dashTime = Math.max(0, this.dashTime - dt)

      const speed = (this.dashTime > 0 ? 650 : 230)
      const move = { x: 0, y: 0 }
      if (this.cursors.left.isDown) move.x -= 1
      if (this.cursors.right.isDown) move.x += 1
      if (this.cursors.up.isDown) move.y -= 1
      if (this.cursors.down.isDown) move.y += 1

      if (move.x !== 0 || move.y !== 0) {
        const len = Math.hypot(move.x, move.y) || 1
        move.x /= len
        move.y /= len
        const angle = Math.atan2(move.y, move.x)
        this.player.setData('angle', angle)
        this.player.body.setVelocity(move.x * speed, move.y * speed)
      } else {
        this.player.body.setVelocity(0)
      }

      if (this.cursors.dash.isDown && this.dashCd <= 0 && (move.x || move.y)) {
        this.dashCd = 2.5
        this.dashTime = 0.22
      }

      const fireDelay = this.rapidTimer > 0 ? 140 : 250
      this.player.setData('fireDelay', fireDelay)
      if (this.cursors.fire.isDown) {
        this.tryFire(this.player, this.rapidTimer > 0 ? 520 : 420, this.bullets, 'b-friendly')
      }

      const playerVec = new Phaser.Math.Vector2(this.player.x, this.player.y)
      const botSpeed = mode.botSpeed
      this.bots.forEach((bot) => {
        if (!bot.active) return
        const hp = bot.data.get('hp')
        if (hp <= 0) return
        const dir = playerVec.clone().subtract(bot)
        const dist = dir.length() || 1
        dir.normalize()
        bot.setData('angle', Math.atan2(dir.y, dir.x))
        const targetDist = 210
        if (dist > targetDist) {
          bot.body.setVelocity(dir.x * botSpeed, dir.y * botSpeed)
        } else {
          bot.body.setVelocity(0)
        }
        const cd = bot.data.get('cooldown') - dt
        if (cd <= 0 && dist < mode.botFireRange) {
          bot.data.set('cooldown', mode.botFireDelay * (0.7 + Math.random() * 0.6))
          this.tryFire(bot, mode.botBulletSpeed, this.enemyBullets, 'b-enemy')
        } else {
          bot.data.set('cooldown', cd)
        }
      })

      this.hudTimer += dt
      if (this.hudTimer > 0.08) {
        this.hudTimer = 0
        onHud({
          hp: this.player.data.get('hp'),
          maxHp: playerMaxHp,
          score: this.score || 0,
          time: time / 1000,
          streak: this.streak,
          buffs: {
            shield: this.shieldTimer,
            rapid: this.rapidTimer,
            dash: this.dashCd,
          },
          status: this.running ? 'running' : 'dead',
        })
      }
    }
  }
}

function LocalPhaserGame({ config, onExit }) {
  const containerRef = useRef(null)
  const gameRef = useRef(null)
  const [hud, setHud] = useState({ hp: 120, maxHp: 130, score: 0, time: 0, streak: 0, buffs: {} })
  const [status, setStatus] = useState('running')
  const [restartId, setRestartId] = useState(0)

  const map = useMemo(() => prepareMap(config?.mapId), [config?.mapId])
  const mode = useMemo(
    () => MODES.find((m) => m.id === config?.modeId) || MODES[0],
    [config?.modeId],
  )

  const handleExit = useCallback(() => {
    onExit && onExit()
  }, [onExit])

  useEffect(() => {
    const onKey = (e) => {
      if (e.code === 'Escape') handleExit()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [handleExit])

  useEffect(() => {
    let destroyed = false
    let sceneClass = null

    async function boot() {
      const Phaser = (await import('https://esm.sh/phaser@3.80.1')).default
      if (destroyed) return
      sceneClass = createArenaScene(Phaser, map, mode, (data) => {
        setHud((prev) => ({ ...prev, ...data }))
        if (data.status === 'dead') setStatus('dead')
      })

      gameRef.current = new Phaser.Game({
        type: Phaser.AUTO,
        width: map.width,
        height: map.height,
        parent: containerRef.current,
        backgroundColor: '#020617',
        physics: {
          default: 'arcade',
          arcade: {
            gravity: { y: 0 },
            debug: false,
          },
        },
        scene: [sceneClass],
      })
    }

    boot()

    return () => {
      destroyed = true
      if (gameRef.current) {
        gameRef.current.destroy(true)
        gameRef.current = null
      }
    }
  }, [map, mode, restartId])

  const hpRatio = Math.max(0, Math.min(1, hud.hp / (hud.maxHp || 1)))

  return (
    <div className="game-screen">
      <div className="canvas-wrapper">
        <div ref={containerRef} className="phaser-stage" />
        <div className="hud hud-overlay">
          <div className="hud-pill">
            <span className="hud-label">Режим</span>
            <span className="hud-value">{mode.label}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Карта</span>
            <span className="hud-value">{map.label}</span>
          </div>
          <div className="hud-pill hud-pill--hp">
            <span className="hud-label">HP</span>
            <div className="hud-bar">
              <div className="hud-bar-fill" style={{ width: hpRatio * 100 + '%' }} />
            </div>
            <span className="hud-value small">{hud.hp?.toFixed?.(0)} / {hud.maxHp}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Серія</span>
            <span className="hud-value">x{hud.streak + 1}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Бонуси</span>
            <span className="hud-value">
              Щит: {Math.max(0, hud.buffs?.shield || 0).toFixed(1)}с · Вогонь: {Math.max(0, hud.buffs?.rapid || 0).toFixed(1)}с
            </span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Ривок</span>
            <span className="hud-value">
              {hud.buffs?.dash > 0 ? `Кд: ${hud.buffs.dash.toFixed(1)}с` : 'Готовий (Shift)'}
            </span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Очки</span>
            <span className="hud-value">{hud.score}</span>
          </div>
          <div className="hud-pill">
            <span className="hud-label">Час</span>
            <span className="hud-value">{hud.time?.toFixed?.(1)} c</span>
          </div>
          <button className="hud-exit-btn" onClick={handleExit}>
            Вийти в меню
          </button>
        </div>

        <div className="controls-hint">
          WASD — рух, Space — стріляти, Shift — ривок. Підбирай щит/швидкостріл/хіл. Esc — вихід у меню.
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

function OnlinePlaceholder({ onExit }) {
  return (
    <div className="game-screen">
      <div className="canvas-wrapper">
        <div className="overlay">
          <div className="overlay-card">
            <h2>Онлайн-режим тимчасово вимкнено</h2>
            <p>Поточна Phaser-версія охоплює локальний Gun Mayhem experience. Повернись у меню.</p>
            <div className="overlay-actions">
              <button onClick={onExit}>Вийти в меню</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function GameScreen({ config, onExit }) {
  if (config?.gameType === 'online') {
    return <OnlinePlaceholder onExit={onExit} />
  }
  return <LocalPhaserGame config={config} onExit={onExit} />
}

export default GameScreen
