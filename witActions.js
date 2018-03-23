const { getNextGameID } = require("./gameLogic");
exports.send = ({ sessionId }, { text }) => {
  // Our bot has something to say!
  // Let's retrieve the Facebook user whose session belongs to
  const recipientId = sessions[sessionId].fbid;
  if (recipientId) {
    // Yay, we found our recipient!
    // Let's forward our bot response to her.
    // We return a promise to let our bot know when we're done sending
    return fbMessage(recipientId, text).then(() => null).catch(err => {
      console.error(
        "Oops! An error occurred while forwarding the response to",
        recipientId,
        ":",
        err.stack || err
      );
    });
  } else {
    console.error("Oops! Couldn't find user for session:", sessionId);
    // Giving the wheel back to our bot
    return Promise.resolve();
  }
};

exports.startGame = ({ sessionId, context, text, entities }) => {
  console.log(`Session ${sessionId} received ${text}`);
  console.log(`The current context is ${JSON.stringify(context)}`);
  console.log(`Wit extracted ${JSON.stringify(entities)}`);

  return new Promise((resolve, reject) => {
    context.gameID = getNextGameID();

    resolve(context);
  });
};

exports.null = ({ sessionId, context, text, entities }) => {
  return Promise.resolve();
};
