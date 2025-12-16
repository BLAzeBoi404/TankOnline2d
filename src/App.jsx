import React, { useState } from 'react'
import MainMenu from './components/MainMenu.jsx'
import GameScreen from './components/GameScreen.jsx'

function App() {
  const [screen, setScreen] = useState('menu')
  const [gameConfig, setGameConfig] = useState(null)

  const handleStartGame = (config) => {
    setGameConfig(config)
    setScreen('game')
  }

  const handleBackToMenu = () => {
    setGameConfig(null)
    setScreen('menu')
  }

  return (
    <div className="app-root">
      <h1 className="game-title">NEON MAYHEM ARENA</h1>
      {screen === 'menu' && <MainMenu onStartGame={handleStartGame} />}
      {screen === 'game' && (
        <GameScreen config={gameConfig} onExit={handleBackToMenu} />
      )}
    </div>
  )
}

export default App
