import React, { useEffect, useState } from 'react';
import { Player } from '../types/game';
import { useGameStore } from '../store/gameStore';
import clsx from 'clsx';
import { Keyboard } from './Keyboard';

const WORD_LENGTH = 5;
const MAX_ATTEMPTS = 6;

interface GameBoardProps {
  player: Player;
  isCurrentPlayer: boolean;
  showLetters?: boolean;
}

export function GameBoard({ player, isCurrentPlayer, showLetters = true }: GameBoardProps) {
  const [currentGuess, setCurrentGuess] = useState('');
  const [shakingRow, setShakingRow] = useState<number | null>(null);
  const [revealingRow, setRevealingRow] = useState<number | null>(null);
  const { submitGuess, game } = useGameStore();

  const guesses = player?.guesses || [];

  const handleKeyPress = async (key: string) => {
    if (!isCurrentPlayer || !game || game.status !== 'playing' || player.solved) return;

    if (key === 'Enter') {
      if (currentGuess.length !== WORD_LENGTH) {
        setShakingRow(guesses.length);
        setTimeout(() => setShakingRow(null), 500);
        return;
      }
      
      try {
        await submitGuess(currentGuess);
        setRevealingRow(guesses.length);
        setTimeout(() => setRevealingRow(null), WORD_LENGTH * 100 + 600);
        setCurrentGuess('');
      } catch (error) {
        console.error('Error submitting guess:', error);
      }
    } else if (key === 'Backspace') {
      setCurrentGuess(prev => prev.slice(0, -1));
    } else if (
      currentGuess.length < WORD_LENGTH && 
      /^[A-Za-z]$/.test(key) &&
      !player.solved
    ) {
      setCurrentGuess(prev => prev + key.toUpperCase());
    }
  };

  useEffect(() => {
    if (!isCurrentPlayer || !game || game.status !== 'playing') return;

    const handleKeyboardPress = (e: KeyboardEvent) => {
      handleKeyPress(e.key);
    };

    window.addEventListener('keydown', handleKeyboardPress);
    return () => window.removeEventListener('keydown', handleKeyboardPress);
  }, [currentGuess, game, isCurrentPlayer, player.solved, submitGuess]);

  const usedLetters = guesses.reduce((acc, guess) => {
    const word = guess.word;
    const result = guess.result;
    
    word.split('').forEach((letter, index) => {
      const status = result[index];
      if (status === 'c' || !acc[letter] || (status === 'p' && acc[letter] === 'a')) {
        acc[letter] = status;
      }
    });
    return acc;
  }, {} as Record<string, string>);

  const guessGrid = Array(MAX_ATTEMPTS).fill(null).map((_, rowIndex) => {
    const isCurrentRow = rowIndex === guesses.length;
    const guess = guesses[rowIndex]?.word || '';
    const result = guesses[rowIndex]?.result || '';
    
    return Array(WORD_LENGTH).fill(null).map((_, colIndex) => {
      const letter = isCurrentRow && isCurrentPlayer 
        ? currentGuess[colIndex] || ''
        : guess[colIndex] || '';
      
      const status = result[colIndex];
      const hasResult = Boolean(status) && Boolean(guess);

      return {
        letter: showLetters ? letter : (letter ? '?' : ''),
        status: status === 'c' ? 'correct' : status === 'p' ? 'present' : status === 'a' ? 'absent' : null,
        hasResult,
      };
    });
  });

  return (
    <div className="w-full max-w-sm mx-auto p-4">
      <div className="grid grid-rows-6 gap-2 mb-4">
        {guessGrid.map((row, rowIndex) => (
          <div 
            key={rowIndex} 
            className={clsx(
              "grid grid-cols-5 gap-2",
              {
                'animate-shake': shakingRow === rowIndex
              }
            )}
          >
            {row.map((cell, colIndex) => {
              const isRevealing = revealingRow === rowIndex;
              const showAnimation = isCurrentPlayer || !isCurrentPlayer;
              
              return (
                <div
                  key={colIndex}
                  className={clsx(
                    'w-14 h-14 border-2 flex items-center justify-center text-2xl font-bold rounded',
                    'transition-all duration-300',
                    {
                      'animate-pop': cell.letter && !cell.hasResult && showAnimation,
                      'scale-110': !cell.hasResult && cell.letter,
                      'border-gray-300': !cell.hasResult && cell.letter,
                      'border-gray-200': !cell.hasResult && !cell.letter,
                      'animate-flip bg-green-500 text-white border-green-500': cell.hasResult && cell.status === 'correct',
                      'animate-flip bg-yellow-500 text-white border-yellow-500': cell.hasResult && cell.status === 'present',
                      'animate-flip bg-gray-500 text-white border-gray-500': cell.hasResult && cell.status === 'absent'
                    }
                  )}
                  style={{
                    animationDelay: isRevealing ? `${colIndex * 100}ms` : '0ms',
                    transitionDelay: isRevealing ? `${colIndex * 100}ms` : '0ms'
                  }}
                >
                  {cell.letter}
                </div>
              );
            })}
          </div>
        ))}
      </div>

      {isCurrentPlayer && game?.status === 'playing' && !player.solved && (
        <>
          <div className="mt-4 text-center text-sm text-gray-600 mb-4">
            Type your guess and press Enter
          </div>
          <Keyboard 
            onKeyPress={handleKeyPress}
            usedLetters={Object.fromEntries(
              Object.entries(usedLetters).map(([key, value]) => [
                key,
                value === 'c' ? 'correct' : value === 'p' ? 'present' : 'absent'
              ])
            )}
          />
        </>
      )}

      {player.solved && (
        <div className="mt-4 text-center text-lg font-semibold text-green-600 animate-bounce">
          Word solved! 🎉
        </div>
      )}

      {!isCurrentPlayer && game?.status === 'waiting' && (
        <div className="mt-4 text-center text-lg text-gray-600">
          Waiting for host to start the game...
        </div>
      )}
    </div>
  );
}