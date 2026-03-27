import React, { createContext, useContext, useState, useCallback } from 'react';

type AnnouncementPriority = 'polite' | 'assertive';

interface AnnouncementContextType {
    announce: (message: string, priority?: AnnouncementPriority) => void;
}

const AnnouncementContext = createContext<AnnouncementContextType | undefined>(undefined);

export const AnnouncementProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    const [message, setMessage] = useState('');
    const [priority, setPriority] = useState<AnnouncementPriority>('polite');

    const announce = useCallback((msg: string, pri: AnnouncementPriority = 'polite') => {
        setPriority(pri);
        setMessage(''); // Clear first to ensure change detection if message is same
        setTimeout(() => {
            setMessage(msg);
        }, 50);
    }, []);

    return (
        <AnnouncementContext.Provider value={{ announce }}>
            {children}
            {/* The Live Region */}
            <div
                aria-live={priority}
                aria-atomic="true"
                className="sr-only"
                style={{
                    position: 'absolute',
                    width: '1px',
                    height: '1px',
                    padding: 0,
                    margin: '-1px',
                    overflow: 'hidden',
                    clip: 'rect(0,0,0,0)',
                    whiteSpace: 'nowrap',
                    border: 0
                }}
            >
                {message}
            </div>
        </AnnouncementContext.Provider>
    );
};

export const useAnnounce = () => {
    const context = useContext(AnnouncementContext);
    if (!context) {
        throw new Error('useAnnounce must be used within an AnnouncementProvider');
    }
    return context.announce;
};
