import { createClient } from '@supabase/supabase-js';
import { Game, Player } from '../types/game';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  throw new Error('Missing Supabase credentials');
}

export const supabase = createClient(supabaseUrl, supabaseKey);

export const gameService = {
  async createGame(hostId: string, word: string): Promise<string> {
    const { data, error } = await supabase
      .from('games')
      .insert([{ 
        host_id: hostId, 
        word: word.toUpperCase(), 
        status: 'waiting', 
        players: [] 
      }])
      .select('id')
      .single();

    if (error) {
      throw error;
    }
    
    return data.id;
  },

  subscribeToGame(gameId: string, callback: (game: Game) => void) {
    const channel = supabase
      .channel(`game:${gameId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'games',
          filter: `id=eq.${gameId}`
        },
        async (payload) => {
          const { data: game, error } = await supabase
            .from('games')
            .select('*')
            .eq('id', gameId)
            .single();
            
          if (error) {
            console.error('Error fetching game:', error);
            return;
          }
          
          callback({
            ...game,
            hostId: game.host_id,
            startedAt: game.started_at,
            endedAt: game.ended_at,
          });
        }
      )
      .subscribe();

    return channel;
  },

  async getGame(gameId: string) {
    const { data, error } = await supabase
      .from('games')
      .select('*')
      .eq('id', gameId)
      .single();
      
    if (error) {
      throw error;
    }
    
    return { 
      data: {
        ...data,
        hostId: data.host_id,
        startedAt: data.started_at,
        endedAt: data.ended_at,
      }
    };
  },

  async joinGame(gameId: string, player: Omit<Player, 'guesses' | 'solved'>) {
    const { error } = await supabase.rpc('join_game', {
      p_game_id: gameId,
      p_player: {
        ...player,
        guesses: [],
        solved: false
      }
    });
    
    if (error) {
      throw error;
    }
  },

  async submitGuess(gameId: string, playerId: string, guess: string) {
    const { data: game, error: gameError } = await supabase
      .from('games')
      .select('word')
      .eq('id', gameId)
      .single();
      
    if (gameError) {
      throw gameError;
    }

    const upperGuess = guess.toUpperCase();
    const word = game.word.toUpperCase();

    // Initialize result array
    const result = Array(5).fill('a'); // 'a' for absent
    const remainingLetters = [...word];

    // First pass: Mark correct letters
    for (let i = 0; i < 5; i++) {
      if (upperGuess[i] === word[i]) {
        result[i] = 'c'; // 'c' for correct
        remainingLetters[i] = null;
      }
    }

    // Second pass: Mark present letters
    for (let i = 0; i < 5; i++) {
      if (result[i] === 'c') continue;
      
      const letterIndex = remainingLetters.indexOf(upperGuess[i]);
      if (letterIndex !== -1) {
        result[i] = 'p'; // 'p' for present
        remainingLetters[letterIndex] = null;
      }
    }

    const resultString = result.join('');

    const { error } = await supabase.rpc('submit_guess', {
      p_game_id: gameId,
      p_guess: upperGuess,
      p_player_id: playerId,
      p_result: resultString
    });
    
    if (error) {
      throw error;
    }
    
    return result.map(r => {
      switch (r) {
        case 'c': return 'correct';
        case 'p': return 'present';
        default: return 'absent';
      }
    });
  },

  async updateGameStatus(
    gameId: string, 
    status: 'waiting' | 'playing' | 'finished',
    startedAt?: number,
    endedAt?: number
  ) {
    const { error } = await supabase.rpc('update_game_status', {
      p_game_id: gameId,
      p_status: status,
      p_started_at: startedAt,
      p_ended_at: endedAt
    });
    
    if (error) {
      throw error;
    }
  }
};