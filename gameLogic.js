let gameIdCounter = 1;
const games = {};
const players = {};

exports.createGame = creator => {
  const gameID = gameIdCounter++;

  games[gameID] = {
    state: "Waiting for players",
    creator: creator,
    players: [creator],
    voteStrength: { [creator]: 1 },
    remainingPlayers: [creator],
    votes: {},
    dualRoundVotes: [],
    dualRoundStatus: false
  };
  return gameID;
};

exports.startGame = gameID => {
  games[gameID].state = "Round 1";
  games[gameID].votingAllowed = true;
};

exports.newRound = (gameID, roundNr) => {
  games[gameID].votingAllowed = true;
};

exports.isGameAvailable = gameID => games[gameID];

exports.isPlayerPlaying = (gameID, playerID) =>
  games[gameID].players.includes(playerID);

exports.addPlayer = (gameID, playerID) => {
  games[gameID].players.push(playerID);
  games[gameID].remainingPlayers.push(playerID);
  games[gameID].voteStrength[playerID] = 1;
};

exports.getPlayers = gameID => games[gameID].players;

exports.getAllPlayers = gameID =>
  games[gameID].players.map(playerID => players[playerID]);

exports.getRemainingPlayers = gameID =>
  games[gameID].remainingPlayers.map(playerID => players[playerID]);

exports.getRemainingPlayersName = gameID =>
  exports
    .getRemainingPlayers(gameID)
    .map(player => `${player.first_name} ${player.last_name}`);

exports.setPlayerInfo = (playerID, playerInfo) => {
  playerInfo.playerID = playerID;
  players[playerID] = playerInfo;
};

exports.getPlayerInfo = playerID => {
  const { first_name, last_name } = players[playerID];
  return `${first_name} ${last_name}`;
};

exports.listOfPlayers = gameID =>
  games[gameID].players.map(playerID => exports.getPlayerInfo(playerID));

exports.vote = (gameID, voter, vote) => {
  if (games[gameID].votingAllowed) {
    games[gameID].votes[voter] = vote;
    return true;
  } else return false;
};

exports.stopVoting = gameID => {
  games[gameID].votingAllowed = false;
};

exports.isDuelRound = gameID => games[gameID].remainingPlayers.length < 3;

exports.isWinner = gameID => games[gameID].remainingPlayers.length == 1;

exports.winnerOfCurrentRound = gameID => {
  const winnerID = games[gameID].remainingPlayers[0];
  games[gameID].voteStrength[winnerID]++;
  return exports.getPlayerInfo(winnerID);
};

exports.calculateResults = gameID =>
  new Promise((resolve, reject) => {
    const votes = games[gameID].votes;
    const score = {};

    const remainingPlayers = games[gameID].remainingPlayers;

    remainingPlayers.forEach(playerID => (score[playerID] = 0));

    remainingPlayers.forEach(
      playerID =>
        (score[votes[playerID]] = +games[gameID].voteStrength[playerID])
    );
    console.log(score);
    let winner = { playerID: 0, score: 0 };
    remainingPlayers.forEach(playerID => {
      if (score[playerID] > winner.score) {
        winner = { playerID, score: score[playerID] };
      }
    });

    let losers = [];
    remainingPlayers.forEach(playerID => {
      if (score[playerID] == winner.score) losers.push(playerID);
    });

    games[gameID].remainingPlayers = remainingPlayers.filter(playerID => {
      if (
        votedForLoser(playerID, losers, gameID) ||
        losers.includes(playerID)
      ) {
        return false;
      }
      return true;
    });

    games[gameID].votes = {};
    return resolve(losers);
  });

const votedForLoser = (playerID, losers, gameID) => {
  result = true;
  losers.forEach(loser => {
    if (games[gameID].votes[playerID] == loser) result = false;
  });
  return result;
};

exports.startDuel = gameID => {
  games[gameID].votingAllowed = true;
  return Promise.resolve(games[gameID].remainingPlayers);
};

exports.duelRoundAnswer = (gameID, sender, answer) => {
  games[gameID].dualRoundVotes.push({ sender, answer });
  if (games[gameID].dualRoundVotesStatus) {
    games[gameID].dualRoundVotesStatus = false;
    const vote1 = games[gameID].dualRoundVotes[0];
    const vote2 = games[gameID].dualRoundVotes[1];
    let results = {};

    if (vote1.answer == "hostile" && vote2.answer == "friendly") {
      games[gameID].voteStrength[vote1.sender]++;
      if (games[gameID].voteStrength[vote2.sender] > 1)
        games[gameID].voteStrength[vote2.sender]--;
      results = { winner: vote1.sender, loser: vote2.sender };
    } else if (vote2.answer == "hostile" && vote1.answer == "friendly") {
      games[gameID].voteStrength[vote2.sender]++;
      if (games[gameID].voteStrength[vote1.sender] > 1)
        games[gameID].voteStrength[vote1.sender]--;
      results = { winner: vote2.sender, loser: vote1.sender };
    } else if (vote1.answer == "friendly" && vote2.answer == "friendly") {
      games[gameID].voteStrength[vote2.sender]++;
      games[gameID].voteStrength[vote1.sender]++;
      results = { winners: [vote1.sender, vote2.sender] };
    } else if (vote2.answer == "hostile" && vote1.answer == "hostile") {
      if (games[gameID].voteStrength[vote1.sender] > 1)
        games[gameID].voteStrength[vote1.sender]--;
      if (games[gameID].voteStrength[vote2.sender] > 1)
        games[gameID].voteStrength[vote2.sender]--;
      results = { losers: [vote1.sender, vote2.sender] };
    }
    games[gameID].remainingPlayers = games[gameID].players;
    games[gameID].dualRoundVotes = [];
    return results;
  } else {
    games[gameID].dualRoundVotesStatus = true;
    return false;
  }
};

exports.gameOver = gameID => {
  let winners = [];
  games[gameID].remainingPlayers.forEach(player => {
    if (games[gameID].voteStrength[player] >= 3) {
      winners.push(player);
    }
  });
  if (winners.length > 0) {
    return winners;
  } else {
    return false;
  }
};

exports.stopGame = gameID => {
  delete games[gameID];
};
