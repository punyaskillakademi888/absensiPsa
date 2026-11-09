import { useEffect, useRef } from 'react';

export function useVisibleInterval(
  callback: () => void | Promise<void>,
  intervalMs: number,
  enabled = true,
  runOnMount = true
): void {
  const callbackRef = useRef(callback);

  useEffect(() => {
    callbackRef.current = callback;
  }, [callback]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    let inFlight = false;

    const refresh = () => {
      if (!active || document.visibilityState !== 'visible' || inFlight) return;
      inFlight = true;
      Promise.resolve()
        .then(() => callbackRef.current())
        .catch(error => console.error('[Polling] Refresh gagal:', error))
        .finally(() => {
          inFlight = false;
        });
    };

    if (runOnMount) refresh();
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    const timer = window.setInterval(refresh, intervalMs);

    return () => {
      active = false;
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
      window.clearInterval(timer);
    };
  }, [enabled, intervalMs, runOnMount]);
}
