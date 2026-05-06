import { useState, useCallback } from 'react';

export interface FetchMutationOptions<TResult> {
    onSuccess?: (result: TResult) => void;
    onError?: (err: unknown) => void;
}

export interface FetchMutationState<TResult> {
    run: () => Promise<TResult | undefined>;
    isLoading: boolean;
    error: string | null;
    reset: () => void;
}

/**
 * Wraps an async function with loading + error state.
 * Handles the common try/catch/finally pattern for mutations.
 */
export function useFetchMutation<TResult>(
    fn: () => Promise<TResult>,
    options?: FetchMutationOptions<TResult>,
): FetchMutationState<TResult> {
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const run = useCallback(async (): Promise<TResult | undefined> => {
        setIsLoading(true);
        setError(null);
        try {
            const result = await fn();
            options?.onSuccess?.(result);
            return result;
        } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            setError(message);
            options?.onError?.(err);
            return undefined;
        } finally {
            setIsLoading(false);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fn]);

    const reset = useCallback(() => {
        setError(null);
        setIsLoading(false);
    }, []);

    return { run, isLoading, error, reset };
}
