import { useRef, useEffect } from 'react';

/**
 * Returns a ref whose `.current` is always the latest value of `value`.
 * Prevents stale closures in callbacks without triggering re-renders.
 */
export function useSyncRef<T>(value: T): React.MutableRefObject<T> {
    const ref = useRef<T>(value);
    useEffect(() => { ref.current = value; }, [value]);
    return ref;
}
