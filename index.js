var socket = new WebSocket(`ws://${window.location.hostname}:8080`)

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
    case 'newGameResponse':
      id = msg.id
      // reload the page to the new game's url
      // href always has a trailing slash
      window.location.assign(`${window.location.href}${id}`)
    }
}

// helper function to check if a string contains only uppercase letters
// from: https://stackoverflow.com/questions/4434076
function isALPHA(str) {
  var code, i, len;
  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i)
    if (!(code > 64 && code < 91)) { // upper alpha (A-Z)
      return false
    }
  }
  return true
}

// helper function to detect if there are any lowercase letters in a string
function hasLower(str) {
  var code, i, len;
  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i)
    if (code > 96 && code < 123) { // lower alpha (a-z)
      return true
    }
  }
  return false
}


socket.onopen = function () {
  const path = window.location.pathname
  const pathAfterSlash = path.substring(1)

  if (path === '/') { // if on homepage
    sendNewGameRequest() // send a new game request to get us into a game!
  } else if (hasLower(pathAfterSlash)) {
    // if the path has a lowercase letter, reload to the uppercase'd version
    window.location.assign(`${window.location.href}${pathAfterSlash.toUpperCase()}`)
  } else {
    // otherwise, we've got an uppercase maybe game ID
    // check that maybeGameId is correct (9 letters and uppercase alpha)
    const maybeGameId = pathAfterSlash
    console.log('maybeGameId: ', maybeGameId)
    if (maybeGameId.length === 9 && isALPHA(maybeGameId)) {
      // it's valid, but might or might not correspond to an existing game. Send the join which will check before joining
      const gameId = maybeGameId
      sendJoin(gameId)
    }
    // if it's not the right length/contains special characters, just do nothing
  }
}

function sendNewGameRequest() {
  console.log('Sending newGameRequest!')
  socket.send(JSON.stringify( { type: 'newGameRequest' } ))
}

// send someone joining a game
function sendJoin(gameId) {
  var joinObject = { type: 'join', id: gameId }
  socket.send(JSON.stringify(joinObject))
}

// send a play object of a letter by a player
function sendPlay(letter, player) {
  letter = letter.toUpperCase()
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

  // put the number of tiles left in the title of bag
  document.getElementById('bag-button').textContent = `Bag: ${game.bag.length}`
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
