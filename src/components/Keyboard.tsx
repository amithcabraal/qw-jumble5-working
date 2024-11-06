import React from 'react';
import clsx from 'clsx';

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Enter', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'Backspace']
];

interface KeyboardProps {
  onKeyPress: (key: string) => void;
  usedLetters: Record<string, string>;
}

export function Keyboard({ onKeyPress, usedLetters }: KeyboardProps) {
  return (
    <div className="w-full max-w-3xl mx-auto">
      {KEYBOARD_ROWS.map((row, rowIndex) => (
        <div key={rowIndex} className="flex justify-center gap-1 mb-1">
          {row.map((key) => {
            const isSpecialKey = key === 'Enter' || key === 'Backspace';
            const letterStatus = usedLetters[key];

            return (
              <button
                key={key}
                onClick={() => onKeyPress(key)}
                className={clsx(
                  'h-14 rounded font-semibold transition-all duration-300',
                  isSpecialKey ? 'px-4 text-sm' : 'w-10',
                  {
                    'bg-green-500 text-white hover:bg-green-600': letterStatus === 'correct',
                    'bg-yellow-500 text-white hover:bg-yellow-600': letterStatus === 'present',
                    'bg-gray-500 text-white hover:bg-gray-600': letterStatus === 'absent',
                    'bg-gray-200 hover:bg-gray-300': !letterStatus,
                  }
                )}
              >
                {key === 'Backspace' ? '⌫' : key}
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
}