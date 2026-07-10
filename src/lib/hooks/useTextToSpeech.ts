'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { textToSpeech } from '@/lib/ai/textToSpeech';

export function useTextToSpeech(provider: string, model: string) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const currentUrlRef = useRef<string | null>(null);

  const revokeCurrent = useCallback(() => {
    if (currentUrlRef.current) {
      URL.revokeObjectURL(currentUrlRef.current);
      currentUrlRef.current = null;
    }
  }, []);

  useEffect(() => {
    // Revoke the last-issued blob URL on unmount so the browser can reclaim
    // the underlying audio bytes.
    return revokeCurrent;
  }, [revokeCurrent]);

  const speak = useCallback(
    async (input: string, voice?: string, parameters: object = {}) => {
      revokeCurrent();
      setAudioUrl(null);
      setIsLoading(true);
      setError(null);

      try {
        const { blob } = await textToSpeech(provider, model, input, voice, parameters);
        const url = URL.createObjectURL(blob);
        currentUrlRef.current = url;
        setAudioUrl(url);
        return blob;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [provider, model, revokeCurrent]
  );

  return { audioUrl, isLoading, error, speak };
}
