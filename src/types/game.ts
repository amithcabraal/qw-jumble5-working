export interface Player {
  id: string;
  name: string;
  guesses: Array<{
    word: string;
    result: string;
  }>;
  solved: boolean;
  timeCompleted?: number;
}

export interface Game {
  id: string;
  hostId: string;
  word: string;
  status: 'waiting' | 'playing' | 'finished';
  players: Player[];
  startedAt?: number;
  endedAt?: number;
  winner?: Player;
}