'use client';

import { Trash2 } from 'lucide-react';

interface DeleteApplicationButtonProps {
    id: number;
    onDelete?: (id: number, e: React.MouseEvent) => void;
}

export default function DeleteApplicationButton({ id, onDelete }: DeleteApplicationButtonProps) {
    const handleClick = (e: React.MouseEvent) => {
        if (onDelete) {
            onDelete(id, e);
        }
    };

    return (
        <button
            onClick={handleClick}
            className="text-slate-300 hover:text-red-500 transition-colors p-1 rounded-md hover:bg-red-50 focus:outline-none"
            title="Delete Application"
        >
            <Trash2 className="h-3.5 w-3.5" />
        </button>
    );
}
