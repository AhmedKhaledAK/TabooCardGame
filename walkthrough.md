# Taboo Game Walkthrough

The Taboo game is now running! Follow these steps to verify the functionality.

## Prerequisites
- Ensure the server is running on port 3001.
- Ensure the client is running (usually port 5173).

## Verification Steps

### 1. Lobby & Room Creation
1.  Open [http://localhost:5173](http://localhost:5173) in a browser tab (Tab A).
2.  Enter your name (e.g., "Alice") and click **Create Room**.
3.  Copy the **Room Code** displayed at the top (e.g., "ABCDEF").

### 2. Joining a Room
1.  Open a second browser tab (Tab B) at [http://localhost:5173](http://localhost:5173).
2.  Enter a name (e.g., "Bob").
3.  Enter the Room Code from Tab A and click **Join**.
4.  Verify both players appear in the lobby in both tabs.

### 3. Team Selection
1.  In Tab A (Alice), click **Join Team A**.
2.  In Tab B (Bob), click **Join Team B**.
3.  Verify names appear under the respective teams.

### 4. Starting the Game
1.  In Tab A (Host), click **START GAME**.
2.  Verify the game screen loads for both players.

### 5. Game Loop & Roles
1.  Check the role assigned to each player (displayed at the top).
    - **Describer** (Team A): Should see the Card and "Success/Skip" buttons.
    - **Watcher** (Team B): Should see the Card and a big red "BUZZ" button.
    - **Guesser** (Team A): Should see "Guess the word!" and NO card.
    - **Spectator** (Team B): Should see the timer/score.
2.  **Timer**: Verify the countdown is running.

### 6. Gameplay Actions
1.  **Success**: As Describer, click **Success**. Verify Team A's score increases by 1 and a new card appears.
2.  **Buzz**: As Watcher, click **BUZZ**. Verify Team A's score decreases by 1 (or stops) and a visual shake/sound effect occurs (if implemented).
3.  **Skip**: As Describer, click **Skip**. Verify a new card appears with no score change.

### 7. Turn Switching
1.  Wait for the timer to reach 0.
2.  Verify the turn switches to Team B.
3.  Verify roles rotate (someone from Team B becomes Describer).

## Troubleshooting
- If the game doesn't start, ensure at least one player is on each team.
- If sockets disconnect, refresh the page and rejoin with the same code (if persistence is implemented) or create a new room.
