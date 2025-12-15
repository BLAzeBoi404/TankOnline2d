import React, { useState } from 'react'
import { MODES, MAPS } from '../gameConfig.js'

function MainMenu({ onStartGame }) {
  const [gameType, setGameType] = useState('local') // local / online
  const [modeId, setModeId] = useState(MODES[0].id)
  const [mapId, setMapId] = useState(MAPS[0].id)
  const [serverUrl, setServerUrl] = useState('ws://localhost:3001')

  const handleStart = () => {
    onStartGame({ gameType, modeId, mapId, serverUrl })
  }

  return (
    <div className="menu">
      {/* Тип гри */}
      <div className="menu-card">
        <h2>Тип гри</h2>
        <p className="menu-subtitle">
          Локально проти ботів або онлайн-бій 1v1 з другом.
          Новий буст: ривок Shift, підбори й неонова арена.
        </p>
        <div className="menu-options menu-options--row">
          <button
            className={`menu-option menu-option--small ${
              gameType === 'local' ? 'menu-option--active' : ''
            }`}
            onClick={() => setGameType('local')}
          >
            <div className="menu-option-title">Локально</div>
            <div className="menu-option-desc">Гра проти ботів на цьому ПК.</div>
          </button>

          <button
            className={`menu-option menu-option--small ${
              gameType === 'online' ? 'menu-option--active' : ''
            }`}
            onClick={() => setGameType('online')}
          >
            <div className="menu-option-title">Онлайн 1v1</div>
            <div className="menu-option-desc">
              Двоє гравців через WebSocket-сервер.
            </div>
          </button>
        </div>
      </div>

      {/* Режим гри для локального */}
      {gameType === 'local' && (
        <div className="menu-card">
          <h2>Режим гри</h2>
          <p className="menu-subtitle">Складність, темп та кількість ботів.</p>
          <div className="menu-options">
            {MODES.map((mode) => (
              <button
                key={mode.id}
                className={`menu-option ${
                  modeId === mode.id ? 'menu-option--active' : ''
                }`}
                onClick={() => setModeId(mode.id)}
              >
                <div className="menu-option-title">{mode.label}</div>
                <div className="menu-option-desc">{mode.description}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Карта */}
      <div className="menu-card">
        <h2>Карта</h2>
        <p className="menu-subtitle">
          Для лабіринту кожна битва генерує новий варіант.
        </p>
        <div className="menu-options menu-options--row">
          {MAPS.map((map) => (
            <button
              key={map.id}
              className={`menu-option ${
                mapId === map.id ? 'menu-option--active' : ''
              }`}
              onClick={() => setMapId(map.id)}
            >
              <div className="menu-option-title">{map.label}</div>
              <div className="menu-option-desc">
                {map.kind === 'maze'
                  ? 'Динамічний лабіринт, багато кутів.'
                  : 'Відкрита арена з перешкодами.'}
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Сервер для онлайн-режима */}
      {gameType === 'online' && (
        <div className="menu-card">
          <h2>Сервер</h2>
          <p className="menu-subtitle">
            Запусти server.js. Друг вказує той самий URL.
          </p>
          <input
            className="menu-input"
            value={serverUrl}
            onChange={(e) => setServerUrl(e.target.value)}
          />
        </div>
      )}

      {/* Кнопка старт */}
      <div className="menu-footer">
        <button className="primary-btn" onClick={handleStart}>
          Почати гру
        </button>
        <div className="menu-hint">
          Локально: WASD + Space • Онлайн: перший підключений — P1 (хост).
        </div>
      </div>
    </div>
  )
}

export default MainMenu
