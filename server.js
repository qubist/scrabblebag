// server.js

const bagfile = require('./bag')
const scrabbleLetters = bagfile.scrabbleLetters
// const wordsfile = require('./words9')
// const nineLetterWords = wordsfile.nineLetterWords
const scrabbleWordsfile = require('./scrabblewords9')
const nineLetterScrabbleWords = scrabbleWordsfile.nineLetterScrabbleWords

const WebSocket = require('ws')
const wss = new WebSocket.Server({ port: 8080 })

const storage = require('node-persist')

const HAND_SIZE = 7
const DICTIONARY = nineLetterScrabbleWords

// hash of gameId : connection-list pairs
var connections = {}

async function run() {
  await storage.init()
  console.log('Storage set up!')
  wss.on('connection', ws => {
    console.log('Incoming connection!')
    // console.log(`Incoming connection: ${JSON.stringify(ws)}`)

    ws.on('message', async message => { // this anonymous function needs to be async so getGame and saveGame inside it can work
      var msg = JSON.parse(message)
      console.log(`Recived message => ${message}`) // log text of the message
      var game
      var updatedGame
      switch(msg.type) {
        case 'join':
          // Incoming join. Enroll the user to recieve updates about the game.

          // because of the newGameRequest/Response system, this will only be sent by the system for a game that already exists.
          // Unless someone just typed in a valid 9 letter word in the URL. So we have to check that the game exists and if it doesn't, do nothing.
          gameId = msg.id
          if (!((await storage.keys()).includes(gameId))) {
            console.log('Someone is trying to join a game that does not exist!')
            // No updates will have been sent if this happens, so no names will be displayed and all buttons will be disabled, preventing any sends and indicating that there's no game
            break
          }
          // add this connection to the list of people to update for the game it connected to
          // if the game has no connection list, make it
          if (!connections[gameId]) {
            connections[gameId] = []
          }
          // push this connection onto this game's connection list
          connections[gameId].push(ws)
          console.log(`Someone joined game ${gameId}!`)
          console.log('Connections: ', connections)

          sendUpdateToAll(await getGame(gameId)) // send out an update to everyone in this game
          break
        case 'play':
          letters = msg.letters // get the letters played
          player = msg.player
          gameId = msg.id
          console.log(`Player ${player} is trying to play letters ${letters} in game: ${gameId}!`)

          // send out an update with the updated game as defined by the transform function
          game = await getGame(gameId) // grab the game
          updatedGame = transformGame(msg, game) // apply the move to it
          sendUpdateToAll(updatedGame) // send out update with transformed game
          await saveGame(updatedGame) // save transformed game
          break
        case 'draw':
          console.log('msg: ', msg)
          player = msg.player
          gameId = msg.id
          console.log(`Player ${player} is trying to draw in game: ${gameId}!`)
          game = await getGame(gameId)
          updatedGame = transformGame(msg, game) // apply the draw to the game
          sendUpdateToAll(updatedGame)
          await saveGame(updatedGame)
          break
        case 'newGameRequest':
          // Incoming new game request!
          console.log(`Someone requested a new game for ${msg.numPlayers} players!`)
          // create a new game
          game = await newGame(msg.numPlayers)
          // save game in store
          saveGame(game)
          // send the game ID to the client's webpage to be reloaded to so they can join it
          sendNewGameResponse(ws, game.id)
          break
        case 'changeName':
          // Incoming name change!
          player = msg.player
          newName = msg.newName
          console.log(`${player} is trying to change their name to ${newName}! More power to 'em!`)

          game = await getGame(gameId)
          const currentNames = game.players.map(player => player[0]) // first item of every player-hand array

          // check that newName is not already a used name
          if (currentNames.includes(newName)) {
            // newName was already taken, try again!
            // don't change anything
            break
          }

          // update the game object
          game = await getGame(gameId)
          updatedGame = transformGame(msg, game) // apply name change to the game
          sendUpdateToAll(updatedGame)
          await saveGame(updatedGame)
          break
      }
    })
    // remove connection from connections hash when connection is closed
    ws.on('close', () => {
      console.log('Someone left, removing them from any games they were connected to')

      // walk through every connection list for every game
      Object.keys(connections).forEach((gameId, i) => {
        // remove this connection from each one
        console.log('Removing ws from connections to game: ', gameId)
        listRemove(connections[gameId], ws)
        // if it wasn't in there, nothing will change
      })
      console.log('Connections: ', connections)
    })
  })
}

function makeGame(id, playerTable, numPlayers, bag) {
  return { type: 'game', id: id, players: playerTable, numPlayers: numPlayers, bag: bag }
}

async function newGame(numPlayers) {
  var gameId = get_random(DICTIONARY)
  while ( (await storage.keys()).includes(gameId) ) {
    // if the ID is already in use, try again and check that we haven't run out of IDs
    // this code should almost never run :}
    gameId = get_random(DICTIONARY)
    if ( (await storage.keys()).length >= DICTIONARY.length ) {
      console.error();('ERR: out of game IDs!')
    }
  }
  console.log('Making a game with random ID: ', gameId)
  // playerTable is four [name, hand] arrays
  return makeGame(gameId, [['Player 1', []], ['Player 2', []], ['Player 3', []], ['Player 4', []]], numPlayers, newBag())
}

function newBag() {
  // make a new copy of the imported scrabbleLetters constant each time we create a new bag, using spread operator
  return [...scrabbleLetters]
}

// node-persist API: https://www.npmjs.com/package/node-persist#api-documentation

// saves game in store
async function saveGame(game) {
  console.log('Game was saved!')
  var gameId = game.id
  await storage.setItem(gameId,game)
}

// takes a game ID and returns the corresponding game
async function getGame(gameId) {
  console.log(`Getting game ${gameId} with async function call to storage.getItem!`)
  console.log(`Result was: ${await storage.getItem(gameId)}`)
  return await storage.getItem(gameId)
}

// from: https://stackoverflow.com/questions/5915096
function get_random(list) {
  return list[Math.floor((Math.random()*list.length))]
}

// helper function to remove item from list
// does nothing if item is not in list
function listRemove(list, item) {
  const index = list.indexOf(item)
  if (index != -1) {
    list.splice(index, 1)
  }
}

// returns the hand of the specified player from the specified playerTable
function getHand(playerTable, player) {
  for (const [playerName, hand] of playerTable) {
    if (playerName === player) {
      return hand
    }
  }
  console.log("ERR: requested player wasn't in player table")
}

// takes a message (must be play or draw) and a game and returns the result of the play or draw, after making sure it's legal
function transformGame(msg, game) {
  console.log('transforming game ', game.id, 'with message: ', msg)
  var id = game.id
  var playerTable = game.players
  var bag = game.bag

  switch (msg.type) {
    case 'play':
      var player = msg.player
      var letters = msg.letters
      var hand = getHand(playerTable, player)

      // check that the letter being played is in the player's hand
      // and remove it from the hand
      for (const letter of letters) {
        if (hand.includes(letter)) {
          listRemove(hand, letter)
        } else {
          console.log('Letter played wasn\'t in the hand! Not changing anything')
          // ERROR, letter wasn't in hand!
        }
      }
      return game
      break
    case 'draw':
      var player = msg.player
      var hand = getHand(playerTable, player)
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
      break
    case 'changeName':
      var player = msg.player
      var newName = msg.newName

      // build up a new player table, same order, same hands, but replacing player's name with new name
      const newPlayerTable = []
      for (const [playerName, hand] of playerTable) {
        if (playerName === player) {
          newPlayerTable.push([newName, hand])
        } else {
          newPlayerTable.push([playerName, hand])
        }
      }
      game.players = newPlayerTable
      return game

    default:
      // ERROR, msg wasn't recognized!
      // don't change anything
      console.log('message ', msg, ' wasn\'t recognized, can\'t transform a game with it!')
      return game // don't change anything
    }
}

function sendUpdate(ws, game) {
  var updateObject = { type: 'update', game: game }
  ws.send(JSON.stringify(updateObject))
}

function sendNewGameResponse(ws, id) {
  ws.send(JSON.stringify( { type: 'newGameResponse', id: id } ))
}

// takes a game and uses the connections list to send an update to each ws in the connection list for that game
function sendUpdateToAll(game) {
  var connectionsList = connections[game.id]
  console.log(connections)
  connectionsList.forEach((connection, i) => {
    sendUpdate(connection, game)
  })
}

run()
