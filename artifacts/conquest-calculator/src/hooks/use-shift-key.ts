import { useEffect, useState } from 'react';

/**
 * Returns true while the Shift key is held down anywhere in the window.
 * Cleans up on unmount. Safe to call from multiple components — each gets
 * its own state but they share the same underlying DOM event.
 */
export function useShiftKey(): boolean {
  const [held, setHeld] = useState(false);

  useEffect(() => {
    const onDown = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setHeld(true);
    };
    const onUp = (e: KeyboardEvent) => {
      if (e.key === 'Shift') setHeld(false);
    };
    // Also reset on window blur so we don't get stuck-held if the user
    // Alt-Tabs away while holding Shift.
    const onBlur = () => setHeld(false);

    window.addEventListener('keydown', onDown);
    window.addEventListener('keyup', onUp);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onDown);
      window.removeEventListener('keyup', onUp);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  return held;
}
