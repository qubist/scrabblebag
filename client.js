var socket = new WebSocket(`ws://${window.location.hostname}:8080`)

// what to do every time we get a incoming message (usually a game-state update)
socket.onmessage = function (event) {
  var msg = JSON.parse(event.data) // convert message
  console.log(msg) // print out the message for debugging

  // do something with the message depending on its type
  switch(msg.type) {
    case 'update':
      game = msg.game
      // update page with new game info
      renderBag(game)
      renderNames(game)
      renderHands(game)
      hidePlayers(game.numPlayers)
      renderButtons(game)
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

socket.onclose = function () {
  alert("test")
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

// send a play object of an array of letters by a player
// takes only letters and play but sends object containing game ID
function sendPlay(letters, player) {
  var playObject = { type: 'play', letters: letters, player: player, id: window.location.pathname.substring(1) }
  socket.send(JSON.stringify(playObject))
}

// takes only play but sends object containing game ID
function sendDraw(player) {
  var drawObject = { type: 'draw', player: player, id: window.location.pathname.substring(1) }
  socket.send(JSON.stringify(drawObject))
}

// { type: 'changeName',
//   player: (str) the player whose name is being changed,
//   newName: (str) the new name }
//
// Example - { type: 'changeName', player: 'Player 1', newName: 'X Æ A-Xii'}
function sendChangeName(player, newName) {
  var changeNameObject = { type: 'changeName', player: player, newName: newName}
  socket.send(JSON.stringify(changeNameObject))
}

function changeName(player, newName) {

  console.log(`trying to change name of ${player} to ${newName}`)
  // Do nothing if:
  //   - they clicked cancel
  //   - new name is same as old name
  //   - new name is blank
  //   - new name has a _ in it (not allowed)
  if (newName != null &&
      newName !== player &&
      newName !== '' &&
      !(newName.includes('_'))) {
    sendChangeName(player, newName)
  } else {
    console.log('Prompt was cancelled or had invalid name (same as old name, blank, or contained underscore)')
  }
}

function renderBag(game) {
  // bag element of the webpage
  bagE = document.getElementById('bag')

  var result = ''
  game.bag.forEach((tile, i) => {
    const toAdd = ((tile === ' ') ? "BLANK" : tile) // ternary operator: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Operators/Conditional_Operator
    result += toAdd + ', '
  })
  result = result.substring(0, result.length - 2) // remove final ', '

  bagE.textContent = result

  // put the number of tiles left in the title of bag
  document.getElementById('bag-button').textContent = `Bag: ${game.bag.length}`
}

function renderHands(game) {
  // iterate through dictionary of players and render each one's hand
  for (const [name, hand] of game.players) {
    console.log('rendering hand:', name, hand)
    renderHand(game, name)
  }
}

function renderNames(game) {
  const playerButtons = document.getElementsByClassName('player-button')
  // change HTMLcollection into array so we can use .entries() to enumerate it
  const playerButtonsArray = [...playerButtons]
  // get list of names from game object
  const names = game.players.map(player => player[0])
  for (const [i, playerButton] of playerButtonsArray.entries()) {
    // make sure the id of the hand element matches the name in the game object (this is for name changes)
    const oldName = playerButton.textContent
    const newName = names[i]
    if (oldName !== newName) {
      document.getElementById(playerNameToHandId(oldName)).id = playerNameToHandId(newName)
    }
    // change the text content of the player button to the new name
    playerButton.textContent = newName
  }
}

function renderButtons(game) {
  // render all buttons except play buttons
  const actionButtons = document.getElementsByClassName('action-button')
  for (const actionButton of actionButtons) {
    // all buttons start as disabled, undisabled them
    actionButton.disabled = false
    // make Play button grey out when there's nothing selected
    // & make Draw button grey out when there's no tiles left in the bag
    const playerName = actionButton.parentElement.previousElementSibling.textContent // get player name
    const hand = getHand(game.players, playerName) // get player hand
    switch (actionButton.value) {
      case 'Play':
        // handled in the renderPlayButtons() function so it can be called
        // without game parameter
        break
      case 'Draw':
        // grey out if no tiles left or hand full
        actionButton.disabled = (hand.length === 7 || game.bag.length === 0)
        break
      case 'Change name':
        // always show :,)
        break
      default:
        console.log(`ERR: Some other button called ${actionButton.value} is here for some reason!`)
    }
  }
  // then render play buttos
  renderPlayButtons()

}

function renderPlayButtons() {
  const actionButtons = document.getElementsByClassName('action-button')
  for (const actionButton of actionButtons) {
    if (actionButton.value === 'Play') {
      const playerName = actionButton.parentElement.previousElementSibling.textContent // get player name
      actionButton.disabled = false
      const handE = document.getElementById(playerNameToHandId(playerName))
      // count tiles in hand that are selected
      var numSelected = 0
      for (const tile of handE.children) {
        if (tile.className.split(/\s+/).includes('selected')) {
          numSelected += 1
        }
      }
      actionButton.disabled = (numSelected === 0)
    }
  }

}

// set a tile in a hand as selected
function setSelected(id) {
  document.getElementById(id).classList.toggle('selected')
  renderPlayButtons()
}

function clearSelected(playerName) {
  for (const child of document.getElementById(playerNameToHandId(playerName)).children) {
    child.classList.remove('selected')
    renderPlayButtons()
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

// returns the hand of the specified player from the specified playerTable
function getHand(playerTable, player) {
  for (const [playerName, hand] of playerTable) {
    if (playerName === player) {
      return hand
    }
  }
  console.log('ERR: requested player wasn\'t in player table')
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
    tile.style.display = 'block'
  }

  // put each letter in the hand onto a tile
  const hand = getHand(game.players, playerName)
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

// use this later to show the score of the tiles so they look realistic
function letterScore(letter) {
  return {' ':'','A':'1','B':'3','C':'3','D':'2','E':'1','F':'4','G':'2',
  'H':'4','I':'1','J':'8','K':'5','L':'1','M':'3','N':'1','O':'1','P':'3',
  'Q':'10', 'R':'1','S':'1','T':'1','U':'1','V':'4','W':'4','X':'8','Y':'4',
  'Z':'1'}[letter]
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
      console.log('Some kinda error. Ya can\'t have 1 or more than 4 players..')
  }
  for (const className of toHide) {
    for (const element of document.getElementsByClassName(className)) {
      element.style.display = 'none'
    }
  }
}
