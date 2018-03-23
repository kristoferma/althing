// Messenger API integration example
// We assume you have:
// * a Wit.ai bot setup (https://wit.ai/docs/quickstart)
// * a Messenger Platform setup (https://developers.facebook.com/docs/messenger-platform/quickstart)
// You need to `npm install` the following dependencies: body-parser, express, request.
//
// 1. npm install body-parser express request
// 2. Download and install ngrok from https://ngrok.com/download
// 3. ./ngrok http 8445
// 4. WIT_TOKEN=your_access_token FB_APP_SECRET=your_app_secret FB_PAGE_TOKEN=your_page_token node examples/messenger.js
// 5. Subscribe your page to the Webhooks using verify_token and `https://<your_ngrok_io>/webhook` as callback URL.
// 6. Talk to your bot on Messenger!

const bodyParser = require("body-parser");
const crypto = require("crypto");
const EventEmitter = require("events");
const express = require("express");
const fetch = require("node-fetch");

const actions = require("./witActions");
const gameLogic = require("./gameLogic");
const strings = require("./strings");

let Wit = null;
let log = null;
try {
  // if running from repo
  Wit = require("../").Wit;
  log = require("../").log;
} catch (e) {
  Wit = require("node-wit").Wit;
  log = require("node-wit").log;
}

// Webserver parameter
const PORT = process.env.PORT || 8445;

// Wit.ai parameters
const WIT_TOKEN = process.env.WIT_TOKEN;

// Messenger API parameters
const FB_PAGE_TOKEN = process.env.FB_PAGE_TOKEN;
if (!FB_PAGE_TOKEN) {
  throw new Error("missing FB_PAGE_TOKEN");
}
const FB_APP_SECRET = process.env.FB_APP_SECRET;
if (!FB_APP_SECRET) {
  throw new Error("missing FB_APP_SECRET");
}

let FB_VERIFY_TOKEN = null;
crypto.randomBytes(8, (err, buff) => {
  if (err) throw err;
  FB_VERIFY_TOKEN = buff.toString("hex");
  console.log(`/webhook will accept the Verify Token "${FB_VERIFY_TOKEN}"`);
});

// ----------------------------------------------------------------------------
// Messenger API specific code

// See the Send API reference
// https://developers.facebook.com/docs/messenger-platform/send-api-reference

const fbMessage = (id, text) => {
  let body;
  if (typeof text === "string") {
    body = JSON.stringify({
      recipient: { id },
      message: { text }
    });
  } else {
    body = JSON.stringify({
      recipient: { id },
      message: text
    });
  }

  const qs = `access_token=${encodeURIComponent(FB_PAGE_TOKEN)}`;
  return fetch(`https://graph.facebook.com/me/messages?${qs}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body
  })
    .then(rsp => rsp.json())
    .then(json => {
      if (json.error && json.error.message) {
        throw new Error(json.error.message);
      }
      return json;
    });
};

const sendAllPlayers = (gameID, message) =>
  gameLogic
    .getPlayers(gameID)
    .forEach(player =>
      fbMessage(player, message).catch(error => console.error(error))
    );

const voteButtons = gameID => {
  let buttonCounter = 3;
  let buttons = [];
  let elements = [];
  gameLogic.getRemainingPlayers(gameID).forEach(player => {
    if (!player) return;
    if (buttonCounter > 0) {
      buttons.push({
        type: "postback",
        title: `${player.first_name} ${player.last_name}`,
        payload: player.playerID
      });
    }
    if (buttonCounter === 0) {
      buttonCounter = 3;
      elements.push({ title: "Voting", buttons });
      buttons = [];
    }
  });
  let message = {
    attachment: {
      type: "template",
      payload: {
        template_type: "generic",
        elements:
          elements.length > 0 ? elements : [{ title: "Voting", buttons }]
      }
    }
  };
  return message;
};

const duelButtons = () => ({
  attachment: {
    type: "template",
    payload: {
      template_type: "generic",
      elements: [
        {
          title: "Voting",
          buttons: [
            { type: "postback", title: `Friendly`, payload: "friendly" },
            { type: "postback", title: `Hostile`, payload: "hostile" }
          ]
        }
      ]
    }
  }
});

// ----------------------------------------------------------------------------
// Wit.ai bot specific code

// This will contain all user sessions.
// Each session has an entry:
// sessionId -> {fbid: facebookUserId, context: sessionState}
const sessions = {};

const findOrCreateSession = fbid => {
  let sessionId;
  // Let's see if we already have a session for the user fbid
  Object.keys(sessions).forEach(k => {
    if (sessions[k].fbid === fbid) {
      // Yep, got it!
      sessionId = k;
    }
  });
  if (!sessionId) {
    // No session found for user fbid, let's create a new one
    sessionId = new Date().toISOString();
    sessions[sessionId] = { fbid, context: {} };
  }
  return sessionId;
};

// Our bot actions
class MyEmitter extends EventEmitter {}
const myEmitter = new MyEmitter();
myEmitter.on("event", () => {
  console.log("an event occurred!");
});

// Setting up our bot
const wit = new Wit({
  accessToken: WIT_TOKEN,
  actions,
  logger: new log.Logger(log.DEBUG)
});

// Starting our webserver and putting it all together
const app = express();
app.use(({ method, url }, rsp, next) => {
  rsp.on("finish", () => {
    console.log(`${rsp.statusCode} ${method} ${url}`);
  });
  next();
});
app.use(bodyParser.json({ verify: verifyRequestSignature }));

// Webhook setup
app.get("/webhook", (req, res) => {
  if (
    req.query["hub.mode"] === "subscribe" &&
    req.query["hub.verify_token"] === FB_VERIFY_TOKEN
  ) {
    res.send(req.query["hub.challenge"]);
  } else {
    res.sendStatus(400);
  }
});

// Message handler
app.post("/webhook", (req, res) => {
  // Parse the Messenger payload
  // See the Webhook reference
  // https://developers.facebook.com/docs/messenger-platform/webhook-reference
  const data = req.body;

  if (data.object === "page") {
    data.entry.forEach(entry => {
      entry.messaging.forEach(event => {
        if (event.postback) {
          const sender = event.sender.id;
          const sessionId = findOrCreateSession(sender);
          const context = sessions[sessionId].context;
          const gameID = context.gameID;
          if (
            event.postback.payload == "friendly" ||
            event.postback.payload == "hostile" ||
            gameLogic.isDuelRound(gameID)
          ) {
            const results = gameLogic.duelRoundAnswer(
              gameID,
              sender,
              event.postback.payload
            );
            if (results) {
              myEmitter.emit("duel round over", gameID, results);
            }
          } else {
            const voter = sender;
            const vote = event.postback.payload;
            if (
              gameLogic.vote(gameID, voter, vote) ||
              gameLogic.isDuelRound(gameID)
            ) {
              sendAllPlayers(
                gameID,
                strings.playerVoted(gameLogic.getPlayerInfo(voter))
              );
            } else {
              fbMessage(sender, strings.cannotVote);
            }
          }
        } else if (event.message && !event.message.is_echo) {
          // Yay! We got a new message!
          // We retrieve the Facebook user ID of the sender
          const sender = event.sender.id;

          // We retrieve the user's current session, or create one if it doesn't exist
          // This is needed for our bot to figure out the conversation history
          const sessionId = findOrCreateSession(sender);

          // We retrieve the message content
          const { text, attachments } = event.message;
          if (attachments) {
            // We received an attachment
            // Let's reply with an automatic message
            fbMessage(
              sender,
              "Sorry I can only process text messages for now."
            ).catch(console.error);
          } else if (text) {
            // We received a text message

            // Let's forward the message to the Wit.ai Bot Engine
            // This will run all actions until our bot has nothing left to do
            wit
              .message(
                // sessionId, // the user's current session
                text, // the user's message
                sessions[sessionId].context // the user's current session state
              )
              .then(data => {
                // Our bot did everything it has to do.
                // Now it's waiting for further messages to proceed.
                console.log("Waiting for next user messages");
                // Based on the session state, you might want to reset the session.
                // This depends heavily on the business logic of your bot.
                // Example:
                // if (context['done']) {
                //   delete sessions[sessionId];
                // }
                const context = sessions[sessionId].context;
                const { entities } = data;
                const intent = entities.intent[0];
                const number = entities.number ? entities.number[0] : null;
                let messageRespond;

                if (intent.value === "New Game") {
                  if (gameLogic.isGameAvailable(context.gameID)) {
                    messageRespond = "Game already running";
                  } else {
                    const gameID = gameLogic.createGame(sender);
                    context.gameID = gameID;
                    messageRespond = strings.createNewGame(gameID);
                    const qs = `access_token=${encodeURIComponent(
                      FB_PAGE_TOKEN
                    )}`;
                    fetch(`https://graph.facebook.com/${sender}?${qs}`)
                      .then(rsp => rsp.json())
                      .then(json => {
                        if (json.error && json.error.message) {
                          throw new Error(json.error.message);
                        }
                        gameLogic.setPlayerInfo(sender, json);
                      });
                  }
                } else if (intent.value === "Join Game") {
                  const gameID = number.value;
                  if (gameLogic.isGameAvailable(gameID)) {
                    if (gameLogic.isPlayerPlaying(gameID, sender)) {
                      messageRespond = strings.alreadyJoined(gameID);
                    } else {
                      fbMessage(sender, strings.ruleUrl);
                      gameLogic.addPlayer(gameID, sender);
                      context.gameID = gameID;
                      messageRespond = strings.joinNewGame(gameID);
                      const qs = `access_token=${encodeURIComponent(
                        FB_PAGE_TOKEN
                      )}`;
                      fetch(`https://graph.facebook.com/${sender}?${qs}`)
                        .then(rsp => rsp.json())
                        .then(json => {
                          if (json.error && json.error.message) {
                            throw new Error(json.error.message);
                          }
                          gameLogic.setPlayerInfo(sender, json);
                          sendAllPlayers(
                            gameID,
                            `${gameLogic.getPlayerInfo(sender)} joined the game`
                          );
                        });
                    }
                  } else {
                    messageRespond = strings.gameNotAvailable(gameID);
                  }
                } else if (intent.value === "Start Game") {
                  if (context.gameID) {
                    const gameID = context.gameID;
                    gameLogic.startGame(gameID);

                    firstRound(gameID);
                  } else {
                    messageRespond = strings.gameNotJoined;
                  }
                } else if (intent.value === "List of Players") {
                  if (context.gameID) {
                    const gameID = context.gameID;
                    messageRespond = gameLogic.listOfPlayers(gameID).toString();
                  } else {
                    messageRespond = strings.gameNotJoined;
                  }
                } else {
                  messageRespond = "Something is wrong";
                }
                if (messageRespond)
                  fbMessage(sender, messageRespond).catch(error =>
                    console.error(error)
                  );

                // Updating the user's current session state
                sessions[sessionId].context = context;
              })
              .catch(err => {
                console.error(
                  "Oops! Got an error from Wit: ",
                  err.stack || err
                );
              });
          }
        }
        console.log("received event", JSON.stringify(event));
      });
    });
  }
  res.sendStatus(200);
});

const multi = 10; //50;
const twoMinutes = 60000 * 0.5;

const firstRound = gameID => {
  let delay = 0;
  myEmitter.emit("new round", gameID);
};

myEmitter.on("duel round over", (gameID, results) => {
  if (results.winner) {
    console.log(results);
    sendAllPlayers(
      gameID,
      strings.duelWinner(
        gameLogic.getPlayerInfo(results.winner),
        gameLogic.getPlayerInfo(results.loser)
      )
    );
  } else if (results.winners) {
    console.log(results);
    sendAllPlayers(
      gameID,
      strings.duelWinners(
        gameLogic.getPlayerInfo(results.winners[0]),
        gameLogic.getPlayerInfo(results.winners[1])
      )
    );
  } else if (results.losers) {
    console.log(results);
    sendAllPlayers(
      gameID,
      strings.duelLosers(
        gameLogic.getPlayerInfo(results.losers[0]),
        gameLogic.getPlayerInfo(results.losers[1])
      )
    );
  }
  console.log("duel round over");
  myEmitter.emit("new round", gameID);
});

myEmitter.on("new round", gameID => {
  const gameWinners = gameLogic.gameOver(gameID);
  if (gameWinners) {
    const gameWinnersNames = gameWinners.map(winner =>
      gameLogic.getPlayerInfo(winner)
    );
    sendAllPlayers(gameID, strings.winnersOfGame(gameWinnersNames));
    return gameLogic.stopGame(gameID);
  }
  if (gameLogic.isWinner(gameID)) {
    const roundWinner = gameLogic.winnerOfCurrentRound(gameID);
    sendAllPlayers(gameID, strings.winnerOfThisRound(roundWinner));
    myEmitter.emit("new round");
  } else if (gameLogic.isDuelRound(gameID)) {
    const remainingPlayers = gameLogic.getRemainingPlayersName(gameID);

    sendAllPlayers(gameID, strings.duelRoundStarting(remainingPlayers));

    gameLogic.startDuel(gameID).then(remainingPlayers => {
      remainingPlayers.map(player => {
        fbMessage(player, duelButtons());
      });
    });
  } else {
    newRound(gameID);
  }
});

const newRound = gameID => {
  let delay = 0;
  sendAllPlayers(gameID, strings.gameIntro);
  gameLogic.newRound(gameID);
  setTimeout(
    sendAllPlayers,
    (delay += strings.gameIntro.length * multi),
    gameID,
    voteButtons(gameID)
  );
  setTimeout(
    (gameID, string) => {
      gameLogic.stopVoting(gameID);
      sendAllPlayers(gameID, string);
      gameLogic.calculateResults(gameID).then(losers => {
        sendAllPlayers(
          gameID,
          strings.losersOfTheRound(
            losers.map(loser => gameLogic.getPlayerInfo(loser))
          )
        );
        myEmitter.emit("new round", gameID);
      });
    },
    delay + twoMinutes,
    gameID,
    strings.stopVoting
  );
};
/*
 * Verify that the callback came from Facebook. Using the App Secret from
 * the App Dashboard, we can verify the signature that is sent with each
 * callback in the x-hub-signature field, located in the header.
 *
 * https://developers.facebook.com/docs/graph-api/webhooks#setup
 *
 */
function verifyRequestSignature(req, res, buf) {
  const signature = req.headers["x-hub-signature"];

  if (!signature) {
    // For testing, let's log an error. In production, you should throw an
    // error.
    console.error("Couldn't validate the signature.");
  } else {
    const elements = signature.split("=");
    const signatureHash = elements[1];

    const expectedHash = crypto
      .createHmac("sha1", FB_APP_SECRET)
      .update(buf)
      .digest("hex");

    if (signatureHash !== expectedHash) {
      throw new Error("Couldn't validate the request signature.");
    }
  }
}

app.listen(PORT);
console.log(`Listening on :${PORT}...`);
