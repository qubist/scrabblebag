var socket = new WebSocket("ws://localhost:8080")

// what to do every time we get a incoming message (usually a game-state update)
socket.onmessage = function (event) {
  var msg = JSON.parse(event.data) // convert message
  console.log(msg) // print out the message for debugging

  // do something with the message depending on its type
  switch(msg.type) {
    case 'update':
      game = msg.game
      // update game board with new game info
      writeBag(game)
      writeHands(game)
      break;
    }
}

socket.onopen = function () {
  sendJoin(1)
}

// send someone joining a game
function sendJoin(gameID) {
  var joinObject = { type: 'join', id: gameID }
  socket.send(JSON.stringify(joinObject))
}

// send a play object of a letter by a player
function sendPlay(letter, player) {
  var playObject = { type: 'play', letter: letter, player: player}
  socket.send(JSON.stringify(playObject))
}

function sendDraw(player) {
  var drawObject = { type: 'draw', player: player }
  socket.send(JSON.stringify(drawObject))
}

function sendReset() {
  var resetObject = { type: 'reset' }
  socket.send(JSON.stringify(resetObject))
}

function writeBag(game) {
  // bag element of the webpage
  bagE = document.getElementById('bag')

  // console.log(game.bag)
  var result = ''
  game.bag.forEach((tile, i) => {
    result = result + tile + ', '
  })
  result = result.substring(0, result.length - 2) // remove final ', '

  bagE.textContent = result
}

function writeHands(game) {
  // iterate through dictionary of players and write each one's hand
  for (const [name, hand] of Object.entries(game.players)) {
    console.log('writing hand:', name, hand)
    writeHand(game, name)
  }
}

// player is player name as a string: needs to be converted to element-id format.
function writeHand(game, playerName) {
  const handElementId = playerNameToHandId(playerName)
  // hand element of the webpage:
  handE = document.getElementById(handElementId)

  var result = 'Hand:   ' // two extra spaces here so they get cut off when removing final ', ' later.
  game.players[playerName].forEach((letter, i) => {
    result += letter + ', '
  });
  result = result.substring(0, result.length - 2) // remove final ', '
  handE.textContent = result
}

function playerNameToHandId(name) {
  return name.replace(' ', '_') + '-hand'
}
