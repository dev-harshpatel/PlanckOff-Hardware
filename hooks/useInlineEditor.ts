import { useState, useCallback } from 'react';

export interface InlineEditorCell<TId = string, TField = string> {
    id: TId;
    field: TField;
}

export interface InlineEditorState<TId = string, TField = string> {
    editingCell: InlineEditorCell<TId, TField> | null;
    tempValue: string;
    setTempValue: (value: string) => void;
    startEdit: (id: TId, field: TField, currentValue: string) => void;
    cancelEdit: () => void;
    isEditing: (id: TId, field: TField) => boolean;
}

/**
 * Manages inline cell editing state for tables.
 * The commit logic stays in the parent — call `editingCell` + `tempValue` from onBlur/onKeyDown.
 */
export function useInlineEditor<TId = string, TField = string>(): InlineEditorState<TId, TField> {
    const [editingCell, setEditingCell] = useState<InlineEditorCell<TId, TField> | null>(null);
    const [tempValue, setTempValue] = useState('');

    const startEdit = useCallback((id: TId, field: TField, currentValue: string) => {
        setEditingCell({ id, field });
        setTempValue(currentValue);
    }, []);

    const cancelEdit = useCallback(() => {
        setEditingCell(null);
        setTempValue('');
    }, []);

    const isEditing = useCallback((id: TId, field: TField): boolean => {
        return editingCell?.id === id && editingCell?.field === field;
    }, [editingCell]);

    return { editingCell, tempValue, setTempValue, startEdit, cancelEdit, isEditing };
}
