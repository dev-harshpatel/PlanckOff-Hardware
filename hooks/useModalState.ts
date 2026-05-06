import { useState, useCallback } from 'react';

export interface ModalState<T> {
    isOpen: boolean;
    item: T | null;
    open: (item?: T) => void;
    close: () => void;
}

export function useModalState<T = void>(): ModalState<T> {
    const [isOpen, setIsOpen] = useState(false);
    const [item, setItem] = useState<T | null>(null);

    const open = useCallback((value?: T) => {
        if (value !== undefined) setItem(value as T);
        setIsOpen(true);
    }, []);

    const close = useCallback(() => {
        setIsOpen(false);
        setItem(null);
    }, []);

    return { isOpen, item, open, close };
}
