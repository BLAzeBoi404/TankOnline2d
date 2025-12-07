// Простий WebSocket-сервер для онлайн-режиму 1v1
// Запуск: node server.js

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 3001 })

let p1 = null
let p2 = null

function broadcastRole(ws, role) {
  ws.send(JSON.stringify({ type: 'role', role }))
}

wss.on('connection', (ws) => {
  let assignedRole = 'spectator'

  if (!p1) {
    p1 = ws
    assignedRole = 'p1'
  } else if (!p2) {
    p2 = ws
    assignedRole = 'p2'
  }

  broadcastRole(ws, assignedRole)

  ws.on('message', (data) => {
    let msg
    try {
      msg = JSON.parse(data.toString())
    } catch {
      return
    }

    if (msg.type === 'input' && ws === p2 && p1) {
      p1.send(
        JSON.stringify({
          type: 'input',
          from: 'p2',
          input: msg.input,
        }),
      )
      return
    }

    if (msg.type === 'state' && ws === p1) {
      if (p2 && p2.readyState === WebSocket.OPEN) {
        p2.send(JSON.stringify({ type: 'state', state: msg.state }))
      }
      return
    }

    if (msg.type === 'end' && ws === p1) {
      if (p2 && p2.readyState === WebSocket.OPEN) {
        p2.send(JSON.stringify({ type: 'end' }))
      }
      return
    }
  })

  ws.on('close', () => {
    if (ws === p1) p1 = null
    if (ws === p2) p2 = null
  })
})

console.log('WebSocket server running on ws://localhost:3001')
