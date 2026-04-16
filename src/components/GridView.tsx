"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, Loader2 } from "lucide-react";
import { formatNumber, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const GRID_ROWS = 10;
const GRID_COLS = 10;

type CellData = { [key: string]: string };
type ValidationResult = { isValid: boolean; recommendation: string; };
type CellValidation = { [key: string]: ValidationResult & { isLoading: boolean } };

interface GridViewProps {
    currentData: CellData;
    updatedCells: string[];
    validations: CellValidation;
    handleCellChange: (key: string, value: string) => void;
    handleCellBlur: (key: string) => void;
    isDataEntryDisabled: boolean;
    showClientSelectionToast: () => void;
}

export function GridView({
    currentData,
    updatedCells,
    validations,
    handleCellChange,
    handleCellBlur,
    isDataEntryDisabled,
    showClientSelectionToast,
}: GridViewProps) {
    const { toast } = useToast();

    // Standard numeric cells (01-100)
    const rowTotals = Array.from({ length: GRID_ROWS }, (_, rowIndex) => {
        let total = 0;
        for (let colIndex = 0; colIndex < GRID_COLS; colIndex++) {
            const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
            const key = cellNumber === 100 ? '00' : cellNumber.toString().padStart(2, '0');
            total += parseFloat(currentData[key]) || 0;
        }
        return total;
    });

    const columnTotals = Array.from({ length: GRID_COLS }, (_, colIndex) => {
        let total = 0;
        for (let rowIndex = 0; rowIndex < GRID_ROWS; rowIndex++) {
            const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
            const key = cellNumber === 100 ? '00' : cellNumber.toString().padStart(2, '0');
            total += parseFloat(currentData[key]) || 0;
        }
        return total;
    });

    // Harup Totals
    const harupAndarTotal = Array.from({ length: 10 }, (_, i) => parseFloat(currentData[`A${i}`]) || 0).reduce((a, b) => a + b, 0);
    const harupBaharTotal = Array.from({ length: 10 }, (_, i) => parseFloat(currentData[`B${i}`]) || 0).reduce((a, b) => a + b, 0);

    const grandTotal = rowTotals.reduce((acc, total) => acc + total, 0) + harupAndarTotal + harupBaharTotal;

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentKey: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            // Basic sequential navigation for standard cells
            if (!currentKey.startsWith('A') && !currentKey.startsWith('B')) {
                let currentNum = currentKey === '00' ? 100 : parseInt(currentKey, 10);
                let nextNum = (currentNum % 100) + 1;
                let nextKey = nextNum === 100 ? '00' : nextNum.toString().padStart(2, '0');
                const nextInput = document.getElementById(`cell-${nextKey}`);
                if (nextInput) {
                    (nextInput as HTMLInputElement).focus();
                    (nextInput as HTMLInputElement).select();
                }
            }
        }
    };

    const onInputChange = (key: string, value: string) => {
        if (value === '' || /^\d+$/.test(value)) {
            handleCellChange(key, value);
        } else {
            toast({
                title: "Only numbers allowed",
                description: "Please enter numeric values only.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="grid-sheet-layout bg-zinc-950 p-0.5 rounded-none border border-zinc-800 shadow-2xl flex-grow min-h-0 overflow-hidden" style={{ gridTemplateColumns: 'repeat(11, 1fr)', gridTemplateRows: 'repeat(11, 1fr)' }}>
            {/* Rows 1-10 */}
            {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
                <React.Fragment key={`row-${rowIndex}`}>
                    {/* Columns 1-10: Standard Cells */}
                    {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                        const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
                        const displayKey = cellNumber.toString().padStart(2, '0');
                        const dataKey = cellNumber === 100 ? '00' : displayKey;
                        const isUpdated = updatedCells.includes(dataKey);
                        const hasValue = !!currentData[dataKey] && parseFloat(currentData[dataKey]) !== 0;

                        return (
                            <div key={dataKey} className={cn(
                                "relative flex flex-col justify-end border border-zinc-800 rounded-none transition-all h-full min-h-0",
                                hasValue ? "bg-zinc-900 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]" : "bg-transparent",
                                isUpdated ? "ring-2 ring-primary ring-inset z-10" : "",
                                "focus-within:ring-2 focus-within:ring-white focus-within:ring-inset focus-within:z-20"
                            )}>
                                <div className="absolute top-0.5 left-1 text-[10px] lg:text-[13px] select-none pointer-events-none z-10 font-black text-cyan-400 opacity-90">{displayKey}</div>
                                <Input
                                    id={`cell-${dataKey}`}
                                    type="text"
                                    value={currentData[dataKey] || ''}
                                    onChange={(e) => onInputChange(dataKey, e.target.value)}
                                    onBlur={() => handleCellBlur(dataKey)}
                                    onKeyDown={(e) => handleKeyDown(e, dataKey)}
                                    disabled={isDataEntryDisabled}
                                    onClick={isDataEntryDisabled ? showClientSelectionToast : undefined}
                                    className="p-0 h-full w-full text-center bg-transparent border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white font-black text-sm lg:text-lg pt-3 lg:pt-6"
                                />
                            </div>
                        )
                    })}
                    
                    {/* Column 11: Harup Andar (A0-A9) */}
                    {(() => {
                        const dataKey = `A${rowIndex}`;
                        const isUpdated = updatedCells.includes(dataKey);
                        const hasValue = !!currentData[dataKey] && parseFloat(currentData[dataKey]) !== 0;
                        return (
                            <div key={dataKey} className={cn(
                                "relative flex flex-col justify-end border border-zinc-800 rounded-none bg-zinc-900/50 h-full min-h-0",
                                hasValue ? "bg-amber-900/20" : "",
                                isUpdated ? "ring-2 ring-amber-500 ring-inset z-10" : ""
                            )}>
                                <div className="absolute top-0.5 left-1 text-[9px] lg:text-[11px] select-none pointer-events-none z-10 font-black text-amber-500">A{rowIndex}</div>
                                <Input
                                    id={`cell-${dataKey}`}
                                    type="text"
                                    value={currentData[dataKey] || ''}
                                    onChange={(e) => onInputChange(dataKey, e.target.value)}
                                    onBlur={() => handleCellBlur(dataKey)}
                                    disabled={isDataEntryDisabled}
                                    className="p-0 h-full w-full text-center bg-transparent border-0 rounded-none focus-visible:ring-0 text-amber-400 font-black text-xs lg:text-base pt-3"
                                />
                            </div>
                        );
                    })()}
                </React.Fragment>
            ))}

            {/* Row 11: Harup Bahar (B0-B9) & Grand Total */}
            {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                const dataKey = `B${colIndex}`;
                const isUpdated = updatedCells.includes(dataKey);
                const hasValue = !!currentData[dataKey] && parseFloat(currentData[dataKey]) !== 0;
                return (
                    <div key={dataKey} className={cn(
                        "relative flex flex-col justify-end border border-zinc-800 rounded-none bg-zinc-900/50 h-full min-h-0",
                        hasValue ? "bg-amber-900/20" : "",
                        isUpdated ? "ring-2 ring-amber-500 ring-inset z-10" : ""
                    )}>
                        <div className="absolute top-0.5 left-1 text-[9px] lg:text-[11px] select-none pointer-events-none z-10 font-black text-amber-500">B{colIndex}</div>
                        <Input
                            id={`cell-${dataKey}`}
                            type="text"
                            value={currentData[dataKey] || ''}
                            onChange={(e) => onInputChange(dataKey, e.target.value)}
                            onBlur={() => handleCellBlur(dataKey)}
                            disabled={isDataEntryDisabled}
                            className="p-0 h-full w-full text-center bg-transparent border-0 rounded-none focus-visible:ring-0 text-amber-400 font-black text-xs lg:text-base pt-3"
                        />
                    </div>
                );
            })}
            
            {/* Grand Total Box (Bottom Right) */}
            <div className="flex items-center justify-center font-black text-xs lg:text-xl border-2 border-green-500/50 rounded-none bg-zinc-900 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)] h-full min-h-0 overflow-hidden">
                {formatNumber(grandTotal)}
            </div>
        </div>
    );
}