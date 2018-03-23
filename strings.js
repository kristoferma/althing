exports.createNewGame = gameID => `New game starting, the id is ${gameID}`;

exports.joinNewGame = gameID =>
  `You have joined game ${gameID}, it will start in a moment`;

exports.alreadyJoined = gameID => `You have already joined game ${gameID}`;

exports.gameNotAvailable = gameID => `Game ${gameID} is not available`;

exports.gameNotJoined = "Please join or start a game first";

exports.startGame = "Game succesfully started";

exports.gameIntro = `Let the Althing begin!
 
A session has been called! A new county is up for grabs. 
Start eliminating candidates by voting within the next 2 minutes. 
When everyone has voted we see the results and move on to the next round.
 
Pick a person to vote:
`;

exports.gameRules =
  "Every county counts as one vote. In every session each remaining leader votes for one other player. Whoever gets the most votes against them is eliminated. Every player that didn’t vote for that player, is also eliminated from the session (Don’t worry, they sessions are very short). Another round of voting is called until only two players remain.";

exports.prisonersDilemma =
  "These two players have to lie under a fur blanket, as you say, and decide whether to be FRIENDLY or a HOSTILE towards the other player.";
exports.prisonersDilemma1 = `If they are both FRIENDLY: They decide to split the land to get one county each.
If one is FRIENDLY and the other is HOSTILE: The Hostile player gains the county and the Friendly player loses one of their gained counties. (They can’t lose their last county)
If they are both HOSTILE: Neither of them gains the county but both of them lose a county if they can.
 
This is signifies the end of a session. As long as no player has 3 counties a new session begins. If multiple players have 3 counties, they both win.`;

exports.letTheGamesBegin = "Let the Althing begin!";

exports.firstRound = `Round 1!

A session has been called! A new county is up for grabs. Start eliminating candidates by voting within the next 2 minutes. When everyone has voted we see the results and move on to the next round.
 
Tell me who you want to vote for by writing: “Vote” and the name of the person you want to vote for. You could for example write: Vote Eyjólfur.
You can change your vote at any time. The other players will be notified that you changed your vote.`;

exports.playerVoted = player => `${player} has voted`;

exports.thirtySecondsLeft = "Vote in the next 30 seconds!";

exports.stopVoting = "Stop voting now!";

exports.cannotVote = "You are not allowed to vote";

exports.losersOfTheRound = losers =>
  `The player/s who had the most votes are: ${losers.toString()}. They and all players who did not vote for them are eliminated`;

exports.ruleUrl = "Find the rules to the game at: http://bit.ly/2svcUx4";

exports.duelRoundStarting = ([competitor1, competitor2]) =>
  `${competitor1} and ${competitor2} move on to a final agreement round. They can decide to be FRIENDLY or HOSTILE. If both are friendly they both get a new county. If one is friendly and the other is hostile the hostile player gains one county and the friendly player could lose a county. If both are hostile, they both lose a county if they have more than one.`;

exports.winnerOfThisRound = winnerName =>
  `Only ${winnerName} remains and is awarded the new county and extra voting power.`;

exports.duelWinner = (winner, loser) =>
  `The session is over! ${winner} gains a county! ${loser} loses a county!`;

exports.duelWinners = (winner, winner1) =>
  `The session is over! ${winner} and ${winner1} both gain a new county!`;

exports.duelLosers = (loser, loser1) =>
  `The session is over! ${loser} and ${loser1} both lose a county!`;

exports.winnersOfGame = winners => {
  if (winners.length > 1) {
    return `${winners.toString()} have won and been jointly nominated as High-Chiefs of Althingi`;
  } else {
    return `${winners[0]} is has won and has been nominated the High-Chief of Althing!`;
  }
};
