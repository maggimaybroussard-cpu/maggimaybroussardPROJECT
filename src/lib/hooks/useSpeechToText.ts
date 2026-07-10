'use client';

import { useState, useCallback } from 'react';
import { speechToText } from '@/lib/ai/speechToText';

export function useSpeechToText(provider: string, model: string) {
  const [text, setText] = useState<string | null>(null);
  const [fullResponse, setFullResponse] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  const transcribe = useCallback(
    async (file: Blob | File, parameters: object = {}) => {
      setText(null);
      setFullResponse(null);
      setIsLoading(true);
      setError(null);

      try {
        const result = await speechToText(provider, model, file, parameters);
        setText(result?.text ?? null);
        setFullResponse(result);
        return result;
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Unknown error'));
      } finally {
        setIsLoading(false);
      }
    },
    [provider, model]
  );

  return { text, fullResponse, isLoading, error, transcribe };
}
