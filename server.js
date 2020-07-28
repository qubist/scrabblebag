// server.js

const bagfile = require('./bag')
const scrabbleLetters = bagfile.scrabbleLetters

const WebSocket = require('ws')

const wss = new WebSocket.Server({ port: 8080 })

const HAND_SIZE = 7

// hash of gameId : connection-list pairs
var connections = {}

// current game state
var gameState

wss.on('connection', ws => {
  console.log('Incoming connection!')
  // console.log(`Incoming connection: ${JSON.stringify(ws)}`)

  ws.on('message', message => {
    var msg = JSON.parse(message)
    console.log(`Recived message => ${message}`) // log text of the message
    var game
    var updatedGame
    switch(msg.type) {
      case 'join':
        // add this connection to the list of people to update for the game it connected to
        gameId = msg.id
        // if the game has no connection list, make it
        if (!connections[gameId]) {
          connections[gameId] = []
        }
        // push this connection onto this game's connection list
        connections[gameId].push(ws)
        console.log(`Someone joined game ${gameId}!`)
        console.log('Connections: ', connections)

        // if this is the first connection ever, create the new game
        // if (Object.keys(connections).length === 1) {
        if (typeof getGame() === "undefined") {
          sendUpdateToAll(newGame()) // create new game, send it out,
          setGame(newGame()) // and save it
        } else {
          sendUpdateToAll(getGame()) // get game and send it out
        }
        break;
      case 'play':
        letter = msg.letter // get the letter that was played
        player = msg.player
        console.log(`Player ${player} is trying to play letter ${letter}!`)

        // send out an update with the updated game as defined by the transform function
        game = getGame() // grab the game
        updatedGame = transformGame(msg, game) // apply the move to it
        sendUpdateToAll(updatedGame) // send out update with transformed game
        setGame(updatedGame) // save transformed game
        break;
      case 'draw':
        player = msg.player
        console.log(`Player ${player} is trying to draw!`)
        game = getGame()
        updatedGame = transformGame(msg, game) // apply the draw to the game
        sendUpdateToAll(updatedGame)
        setGame(updatedGame)
        break;
      case 'reset':
        console.log('Someone reset the game')
        setGame(newGame())
        console.log(getGame()) // doesn't have fresh bag
        sendUpdateToAll(getGame())
        break;
    }
  })
  // remove connection from connections hash when connection is closed
  ws.on('close', () => {
    console.log('Someone left, removing them from connections')
    var connectionsList = connections['1'] // FIXME: currently hardcoded to only work with the one game
    listRemove(connectionsList, ws)
    console.log('Connections: ', connections)
  })
})

function makeGame(id, player_table, bag) {
  return { type: 'game', id: id, players: player_table, bag: bag }
}

function newGame() {
  return makeGame(1, {'Player 1':[], 'Player 2':[]}, newBag())
}

function newBag() {
  // make a new copy of the imported scrabbleLetters constant each time we create a new bag, using spread operator
  return [...scrabbleLetters]
}

function setGame(game) {
  gameState = game
}

function getGame() {
  return gameState
}

// from: https://stackoverflow.com/questions/5915096
function get_random(list) {
  return list[Math.floor((Math.random()*list.length))];
}

// helper function to remove item from list
function listRemove(list, item) {
  const index = list.indexOf(item)
  list.splice(index, 1)
}

// takes a message (must be play or draw) and a game and returns the result of the play or draw, after making sure it's legal
function transformGame(msg, game) {
  console.log('transforming game with message:', msg)
  var id = game.id
  var player_table = game.players
  var bag = game.bag

  if (msg.type === 'play') {
    var player = msg.player
    var letter = msg.letter
    var hand = player_table[player]

    // check that the letter being played is in the player's hand
    // and remove it from the hand
    if (hand.includes(letter)) {
      listRemove(hand, letter)
    } else {
      console.log('Letter played wasn\'t in the hand! Not changing anything:', game)
      // ERROR, letter wasn't in hand!
    }
    return game
    // replace it in the hand with a new letter from the bag
  } else if (msg.type === 'draw') {
    var player = msg.player
    var hand = player_table[player]
    // check that the player's hand isn't too big
    if (hand.length === HAND_SIZE) {
      console.log('Hand was too big, so you can\'t draw!')
      // ERROR, hand limit reached
    } else if (bag.length === 0) {
      console.log('No tiles left in bag, so you can\'t draw!')
      // ERROR, bag empty
    } else {
      const choice = get_random(bag)
      listRemove(bag, choice)
      hand.push(choice)
    }
    // because I've mutated the hand data I don't have to recreate the game object, I just return it!
    return game
  } else {
    // ERROR, msg wasn't play or draw!
    // don't change anything
    console.log('message ', msg, ' wasn\'t play or draw, can\'t transform a game with it!')
    return game // don't change anything
  }
}

function sendUpdate(ws, game) {
  var updateObject = { type: 'update', game: game}
  ws.send(JSON.stringify(updateObject));
}

// takes a game and uses the connections list to send an update to each ws in the connection list for that game
function sendUpdateToAll(game) {
  var connectionsList = connections[game.id]
  connectionsList.forEach((connection, i) => {
    sendUpdate(connection, game)
  })
}
