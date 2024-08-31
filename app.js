const fs = require('fs');

const data = fs.readFileSync('groups.json' , 'utf8');

const groups = JSON.parse(data);



const groupStageResults = simulateGroupStage(groups);

// Determine which teams advance and which one is eliminated
const { advancingTeams, eliminatedTeam } = determineAdvancingTeams(groupStageResults);
const knockoutStage = createKnockoutStage(advancingTeams, groupStageResults); // Create knockout stage


printGroupStageResults(groupStageResults);
// Print the final standings and which teams advance
printAdvancingTeams(advancingTeams, eliminatedTeam);


printKnockoutStage(knockoutStage); // Print the knockout stage structure
// Extract quarter-final matches
const quarterFinals = knockoutStage.quarterFinals;

const semiFinals = [
    [quarterFinals[0][0], quarterFinals[1][0]], // Winners of Match 1 and 2
    [quarterFinals[2][0], quarterFinals[3][0]]  // Winners of Match 3 and 4
];

playKnockoutStage(quarterFinals); 




// Simulate all groups
function simulateGroupStage(groups) {
    const groupResults = {};

    for (const groupName in groups) {
        //console.log(`Simulating matches for Group ${groupName}:`);
        const groupArray = groups[groupName];  // Access the array of teams for the group

        groupResults[groupName] = GroupStageMatchups(groupArray);

    }

    return groupResults;
}



function GroupStageMatchups(groupArray)
{
    const numTeams = groupArray.length;
    const numRounds = numTeams - 1; // 3 rounds for 4 teams
    const matchesPerRound = numTeams / 2; // 2 matches per round for 4 teams

    // Initialize match tracking for each round
    const roundMatches = Array.from({ length: numRounds }, () => []);

    // Create a round-robin schedule
    const schedule = [];
    for (let round = 0; round < numRounds; round++) {
        const roundMatchesThisRound = [];
        for (let i = 0; i < numTeams; i += 2) {
            const teamA = groupArray[i];
            const teamB = groupArray[i + 1];
            roundMatchesThisRound.push({ teamA, teamB });
        }
        schedule.push(roundMatchesThisRound);
        // Rotate the teams for the next round
        groupArray.splice(1, 0, groupArray.pop());
    }

    const results = groupArray.map(team => ({
        team,
        wins: 0,
        losses: 0,
        points: 0,
        pointsScored: 0,
        pointsAllowed: 0,
        pointDifference: 0,
        matches: Array(numRounds).fill(null) // Track matches per round
    }));

    // Simulate matches based on the schedule
    schedule.forEach((round, roundIndex) => {
        round.forEach(({ teamA, teamB }) => {
            const matchResult = simulateMatch(teamA, teamB);
            const { winner, loser, score } = matchResult;

            // Update stats for the teams
            const teamAStats = results.find(t => t.team.ISOCode === teamA.ISOCode);
            const teamBStats = results.find(t => t.team.ISOCode === teamB.ISOCode);

            if (winner.ISOCode === teamA.ISOCode) {
                teamAStats.wins++;
                teamBStats.losses++;
            } else {
                teamBStats.wins++;
                teamAStats.losses++;
            }

            teamAStats.pointsScored += Math.max(0, score.teamAScore);
            teamAStats.pointsAllowed += Math.max(0, score.teamBScore);
            teamBStats.pointsScored += Math.max(0, score.teamBScore);
            teamBStats.pointsAllowed += Math.max(0, score.teamAScore);

            teamAStats.pointDifference = teamAStats.pointsScored - teamAStats.pointsAllowed;
            teamBStats.pointDifference = teamBStats.pointsScored - teamBStats.pointsAllowed;

            // Store match result by round
            roundMatches[roundIndex].push({
                teamA: teamA.Team,
                teamB: teamB.Team,
                score: `${score.teamAScore}:${score.teamBScore}`
            });
        });
    });

    // Calculate points for each team (2 points for a win, 0 for a loss)
    results.forEach(team => {
        team.points = team.wins * 2;
    });

    // Sort the teams within the group based on points, point difference, and points scored
    results.sort((a, b) => {
        if (b.points !== a.points) return b.points - a.points;
        if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
        return b.pointsScored - a.pointsScored;
    });

    return { results, roundMatches };
}

function printGroupStageResults(groupResults) {
   // Initialize an object to store matches for each round across all groups
   const roundMatches = {};

   // Aggregate matches by rounds and groups
   for (const [groupName, { results, roundMatches: groupRoundMatches }] of Object.entries(groupResults)) {
       groupRoundMatches.forEach((round, roundIndex) => {
           if (!roundMatches[roundIndex]) {
               roundMatches[roundIndex] = [];
           }
           round.forEach(match => {
               roundMatches[roundIndex].push({
                   ...match,
                   group: groupName
               });
           });
       });
   }

   // Print matches organized by rounds
   for (const [roundIndex, matches] of Object.entries(roundMatches)) {
       console.log(`Group Stage - Round ${parseInt(roundIndex) + 1}:`);
       
       // Organize matches by group for the current round
       const matchesByGroup = matches.reduce((acc, { teamA, teamB, score, group }) => {
           if (!acc[group]) {
               acc[group] = [];
           }
           acc[group].push(`${teamA} - ${teamB} (${score})`);
           return acc;
       }, {});

       // Print matches for each group in the current round
       for (const [group, groupMatches] of Object.entries(matchesByGroup)) {
           console.log(`  Group ${group}: ${groupMatches.join(' ')}`);
       }
       console.log(); // Newline for better readability
   }

   // Print final standings for each group
   for (const [groupName, { results }] of Object.entries(groupResults)) {
       console.log(`Group ${groupName}:`);
       results.forEach((team, index) => {
           console.log(`  ${index + 1}. ${team.team.Team} ${team.wins} / ${team.losses} / ${team.points} / ${team.pointsScored} / ${team.pointsAllowed} / ${team.pointDifference}`);
       });
       console.log(); // Newline for better readability
   }
}

function determineAdvancingTeams(groupResults) {
    const firstPlaceTeams = [];
    const secondPlaceTeams = [];
    const thirdPlaceTeams = [];

    // Extract the top 3 teams from each group and categorize them
    for (const [groupName, { results }] of Object.entries(groupResults)) {
        firstPlaceTeams.push(results[0]);
        secondPlaceTeams.push(results[1]);
        thirdPlaceTeams.push(results[2]);
    }

    // Define a ranking function that sorts teams based on points, point difference, and points scored
    const rankTeams = (teams) => {
        return teams.sort((a, b) => {
            if (b.points !== a.points) return b.points - a.points;
            if (b.pointDifference !== a.pointDifference) return b.pointDifference - a.pointDifference;
            return b.pointsScored - a.pointsScored;
        });
    };

    // Rank first, second, and third place teams
    const rankedFirstPlaceTeams = rankTeams(firstPlaceTeams);
    const rankedSecondPlaceTeams = rankTeams(secondPlaceTeams);
    const rankedThirdPlaceTeams = rankTeams(thirdPlaceTeams);

    // Combine all ranked teams
    const rankedTeams = [...rankedFirstPlaceTeams, ...rankedSecondPlaceTeams, ...rankedThirdPlaceTeams];

    // The top 8 teams advance, the 9th team does not
    const advancingTeams = rankedTeams.slice(0, 8);
    const eliminatedTeam = rankedTeams[8];

    return { advancingTeams, eliminatedTeam };
}

// Function to print advancing teams and the eliminated team
function printAdvancingTeams(advancingTeams, eliminatedTeam) {
    console.log("Teams advancing to the knockout stage:");
    advancingTeams.forEach((team, index) => {
        console.log(`${index + 1}. ${team.team.Team} (Points: ${team.points}, Point Difference: ${team.pointDifference}, Points Scored: ${team.pointsScored})`);
    });

    console.log("\nTeam that did not advance:");
    console.log(`${eliminatedTeam.team.Team} (Points: ${eliminatedTeam.points}, Point Difference: ${eliminatedTeam.pointDifference}, Points Scored: ${eliminatedTeam.pointsScored})`);
}

function createKnockoutStage(advancingTeams, groupResults) {
    // Step 1: Divide teams into pots
    const potD = advancingTeams.slice(0, 2); // Teams ranked 1 and 2
    const potE = advancingTeams.slice(2, 4); // Teams ranked 3 and 4
    const potF = advancingTeams.slice(4, 6); // Teams ranked 5 and 6
    const potG = advancingTeams.slice(6, 8); // Teams ranked 7 and 8

    // Step 2: Randomly match teams for quarter-finals
    const quarterFinals = [];

    const randomPairing = (pot1, pot2) => {
        const usedTeams = new Set();
        const pairs = [];

        for (const team1 of pot1) {
            const availableOpponents = pot2.filter(team2 => {
                // Ensure team2 hasn't been used and the teams didn't play in the group stage
                return !usedTeams.has(team2.team.Team) && findTeamGroup(team1, groupResults) !== findTeamGroup(team2, groupResults);
            });

            if (availableOpponents.length > 0) {
                const team2 = availableOpponents[Math.floor(Math.random() * availableOpponents.length)];
                pairs.push([team1, team2]);
                usedTeams.add(team1.team.Team);
                usedTeams.add(team2.team.Team);
            } else {
                throw new Error("No valid match found based on group stage restrictions.");
            }
        }

        return pairs;
    };

    const potDGMatches = randomPairing(potD, potG);
    const potEFMatches = randomPairing(potE, potF);

    quarterFinals.push(...potDGMatches, ...potEFMatches);

    // Step 3: Create semi-final pairs
    const semiFinals = [
        [quarterFinals[0], quarterFinals[1]], // Pot D/G vs Pot E/F
        [quarterFinals[2], quarterFinals[3]]  // Pot F/G vs Pot E/D
    ];

    return { potD, potE, potF, potG, quarterFinals, semiFinals };
}

function findTeamGroup(team, groupResults) {
    for (const [groupName, { results }] of Object.entries(groupResults)) {
        if (results.find(t => t.team.Team === team.team.Team)) {
            return groupName;
        }
    }
    return null;
}

function printKnockoutStage(knockoutStage) {
    const { potD, potE, potF, potG, quarterFinals, semiFinals } = knockoutStage;

    // Print pots
    console.log("Pot D (1st and 2nd ranked teams):");
    potD.forEach(team => console.log(`  ${team.team.Team}`));
    console.log("\nPot E (3rd and 4th ranked teams):");
    potE.forEach(team => console.log(`  ${team.team.Team}`));
    console.log("\nPot F (5th and 6th ranked teams):");
    potF.forEach(team => console.log(`  ${team.team.Team}`));
    console.log("\nPot G (7th and 8th ranked teams):");
    potG.forEach(team => console.log(`  ${team.team.Team}`));
    console.log();

    // Print quarter-final matches
    console.log("Quarter-Finals:");
    quarterFinals.forEach((match, index) => {
        console.log(`  Match ${index + 1}: ${match[0].team.Team} vs ${match[1].team.Team}`);
    });
    console.log();
}

function simulateKnockoutMatch(teamA, teamB) {
    const teamAScore = Math.floor(Math.random() * (120 - 70 + 1)) + 70; // Random score between 70 and 120
    const teamBScore = Math.floor(Math.random() * (120 - 70 + 1)) + 70;

    const winner = teamAScore > teamBScore ? teamA : teamB;
    const loser = teamAScore > teamBScore ? teamB : teamA;

    return {
        teamA: teamA.team.Team,
        teamB: teamB.team.Team,
        teamAScore,
        teamBScore,
        winner,
        loser,
    };
}

function playKnockoutStage(quarterFinals) {
    const quarterFinalWinners = [];
    const semiFinalResults = [];
    const thirdPlaceMatch = [];
    const finalMatch = [];
    
    // Step 1: Simulate Quarter-Finals
    console.log("Quarter-Finals:");
    quarterFinals.forEach((match, index) => {
        const result = simulateKnockoutMatch(match[0], match[1]);
        quarterFinalWinners.push(result.winner);
        console.log(`  Match ${index + 1}: ${result.teamA} - ${result.teamB} (${result.teamAScore}:${result.teamBScore})`);
    });
    console.log();
    // Step 2: Set up Semi-Finals using the winners from Quarter-Finals
    const semiFinalsPtr = [
        [quarterFinalWinners[0], quarterFinalWinners[1]], // Winners of Match 1 and 2
        [quarterFinalWinners[2], quarterFinalWinners[3]]  // Winners of Match 3 and 4
    ];
    // Step 2: Simulate Semi-Finals
    console.log("Semi-Finals:");
    const semiFinalWinners = [];
    const semiFinalLosers = [];
    for (let i = 0; i < 2; i++) {
        const result = simulateKnockoutMatch(semiFinalsPtr[i][0], semiFinalsPtr[i][1]);
        semiFinalWinners.push(result.winner);
        semiFinalLosers.push(result.loser);
        console.log(`  Match ${i + 1}: ${result.teamA} - ${result.teamB} (${result.teamAScore}:${result.teamBScore})`);
    }
    console.log();

    // Step 3: Simulate Third-Place Match
    console.log("Third-Place Match:");
    const thirdPlaceResult = simulateKnockoutMatch(semiFinalLosers[0], semiFinalLosers[1]);
    thirdPlaceMatch.push(thirdPlaceResult.winner);
    console.log(`  ${thirdPlaceResult.teamA} - ${thirdPlaceResult.teamB} (${thirdPlaceResult.teamAScore}:${thirdPlaceResult.teamBScore})`);
    console.log();

    // Step 4: Simulate Final
    console.log("Final:");
    const finalResult = simulateKnockoutMatch(semiFinalWinners[0], semiFinalWinners[1]);
    finalMatch.push(finalResult.winner);
    console.log(`  ${finalResult.teamA} - ${finalResult.teamB} (${finalResult.teamAScore}:${finalResult.teamBScore})`);
    console.log();

    // Step 5: Display Medal Winners
    console.log("Medals:");
    console.log(`  Gold: ${finalMatch[0].team.Team}`);
    console.log(`  Silver: ${finalResult.loser.team.Team}`);
    console.log(`  Bronze: ${thirdPlaceMatch[0].team.Team}`);
}

function simulateMatch(teamA, teamB) {
    const { teamAScore, teamBScore } = generateScore(teamA, teamB);

    // Determine the winner and loser
    let winner, loser;
    if (teamAScore > teamBScore) {
        winner = teamA;
        loser = teamB;
    } else {
        winner = teamB;
        loser = teamA;
    }

    return { winner, loser, score: { teamAScore, teamBScore } };
}

function generateScore(teamA, teamB) {
    const teamARanking = teamA.FIBARanking;
    const teamBRanking = teamB.FIBARanking;

    // Set a base score threshold
    const baseScore = 70;

    // Define the maximum score difference based on ranking
    const maxScoreDifference = 30; // Maximum score difference, can be adjusted
    const rankingDifference = Math.abs(teamARanking - teamBRanking);
    const normalizedDifference = Math.min(maxScoreDifference, rankingDifference * 1.5); // Adjust sensitivity

    // Generate scores for each team with a better chance for the higher-ranked team
    const scoreBias = teamARanking < teamBRanking ? normalizedDifference : -normalizedDifference;
    let teamAScore = baseScore + Math.floor(Math.random() * (baseScore + maxScoreDifference) + scoreBias);
    let teamBScore = baseScore + Math.floor(Math.random() * (baseScore + maxScoreDifference) - scoreBias);

    // Ensure scores are positive and realistic
    const minScore = 50; // Minimum score to ensure realistic game outcomes
    const maxScore = 150; // Maximum score to ensure scores are within a reasonable range

    // Clamp scores within the realistic range
    teamAScore = Math.max(minScore, Math.min(maxScore, teamAScore));
    teamBScore = Math.max(minScore, Math.min(maxScore, teamBScore));

    // Ensure there is always a winner by adjusting if scores are the same
    if (teamAScore  === teamBScore) {
        if (Math.random() < 0.5) {
            teamAScore += 1;
        } else {
            teamBScore += 1;
        }
    }

    return { teamAScore, teamBScore };
}