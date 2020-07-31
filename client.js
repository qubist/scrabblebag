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
      renderBag(game)
      renderHands(game)
      hidePlayers(game.numPlayers)
      // FIXME: there's a Flicker Of Unupdated Content because of this code
      break
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
  var code, i, len
  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i)
    if (!(code > 64 && code < 91)) { // upper alpha (A-Z)
      return false
    }
  }
  return true
}

function isAlpha(str) {
  var code, i, len
  for (i = 0, len = str.length; i < len; i++) {
    code = str.charCodeAt(i)
    if ((!(code > 64 && code < 91)) &&
      (!(code > 96 && code < 123))) { // upper alpha (A-Z)
      return false
    }
  }
  return true
}

// helper function to detect if there are any lowercase letters in a string
function hasLower(str) {
  var code, i, len
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
    // do nothing
  } else if (hasLower(pathAfterSlash) && isAlpha(pathAfterSlash) && pathAfterSlash.length === 9) {
    // if the path looks valid and has a lowercase letter, reload to the uppercase'd version
    window.location.assign(`http://${window.location.hostname}/${pathAfterSlash.toUpperCase()}`)
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

function sendNewGameRequest(numPlayers) {
  console.log(`Sending newGameRequest for ${numPlayers} players!`)
  socket.send(JSON.stringify( { type: 'newGameRequest', numPlayers: numPlayers } ))
}

// send someone joining a game
function sendJoin(gameId) {
  var joinObject = { type: 'join', id: gameId }
  socket.send(JSON.stringify(joinObject))
}

// send a play object of a letter by a player
// takes only letter and play but sends object containing game ID
function sendPlay(letter, player) {
  letter = letter.toUpperCase()
  var playObject = { type: 'play', letter: letter, player: player, id: window.location.pathname.substring(1) }
  socket.send(JSON.stringify(playObject))
}

// sends multiple plays for each letter in an array
function playMultiple(letterList, player) {
  for (const letter of letterList) {
    sendPlay(letter, player)
  }
}

// takes only play but sends object containing game ID
function sendDraw(player) {
  var drawObject = { type: 'draw', player: player, id: window.location.pathname.substring(1) }
  socket.send(JSON.stringify(drawObject))
}

function sendReset() {
  var resetObject = { type: 'reset' }
  socket.send(JSON.stringify(resetObject))
}

function renderBag(game) {
  // bag element of the webpage
  bagE = document.getElementById('bag')

  var result = ''
  game.bag.forEach((tile, i) => {
    result = result + tile + ', '
  })
  result = result.substring(0, result.length - 2) // remove final ', '

  bagE.textContent = result

  // put the number of tiles left in the title of bag
  document.getElementById('bag-button').textContent = `Bag: ${game.bag.length}`
}

function renderHands(game) {
  // iterate through dictionary of players and render each one's hand
  for (const [name, hand] of Object.entries(game.players)) {
    console.log('writing hand:', name, hand)
    renderHand(game, name)
  }
}

// set a tile in a hand as selected
function setSelected(id) {
  document.getElementById(id).classList.toggle('selected')
}

function clearSelected(playerName) {
  for (const child of document.getElementById(playerNameToHandId(playerName)).children) {
    child.classList.remove('selected')
  }
}

// returns the selected letters from a specified player's hand as an array
function getSelected(playerName) {
  var result = []
  for (const child of document.getElementById(playerNameToHandId(playerName)).children) {
    if (child.classList.contains('selected')) {
      result.push(child.textContent)
    }
  }
  return result
}

// player is player name as a string: needs to be converted to element-id format.
function renderHand(game, playerName) {
  const handElementId = playerNameToHandId(playerName)
  // hand element of the webpage
  const handE = document.getElementById(handElementId)
  // colection of the tiles of the hand
  const tiles = handE.children

  // clear all the tile labels and show them all
  for (const tile of tiles) { // i miss python <3
    tile.textContent = ''
    tile.style.display = "block"
  }

  // put each letter in the hand onto a tile
  const hand = game.players[playerName]
  // hand.forEach((letter, i) => {
  for (const [i, letter] of hand.entries()) {
    handE.children[i].textContent = letter
  }

  // hide the tiles with no letter on them
  for (const tile of tiles) {
    if (tile.textContent === '') {
      // hide that shit
      tile.style.display = 'none'
    }
  }

}

function playerNameToHandId(name) {
  return name.replace(' ', '_') + '-hand'
}

// hides sections of the page to only show number of players specified
// takes an int number of players to keep around
function hidePlayers(numPlayers) {
  var toHide = [] // list of classes to hide
  switch(numPlayers) {
    case 2:
      toHide = ["P3", "P4"]
      break
    case 3:
      toHide = ["P4"]
      break
    case 4:
      // keep it empty
      break
    default:
      console.log("Some kinda error. Ya can't have 1 or more than 4 players..")
  }
  for (const className of toHide) {
    for (const element of document.getElementsByClassName(className)) {
      element.style.display = "none"
    }
  }
}
