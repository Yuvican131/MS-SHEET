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

    const grandTotal = rowTotals.reduce((acc, total) => acc + total, 0);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>, currentKey: string) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            let currentNum = currentKey === '00' ? 100 : parseInt(currentKey, 10);
            let nextNum = (currentNum % 100) + 1;
            let nextKey = nextNum === 100 ? '00' : nextNum.toString().padStart(2, '0');
            
            const nextInput = document.getElementById(`cell-${nextKey}`);
            if (nextInput) {
                (nextInput as HTMLInputElement).focus();
                (nextInput as HTMLInputElement).select();
            }
        }
    };

    const onInputChange = (key: string, value: string) => {
        if (value === '' || /^\d+$/.test(value)) {
            handleCellChange(key, value);
        } else {
            toast({
                title: "Only numbers allowed",
                description: "Please enter numeric values only in the grid.",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="grid-sheet-layout bg-zinc-950 p-1 rounded-none border border-zinc-800 shadow-2xl flex-grow min-h-0 overflow-hidden">
            {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
                <React.Fragment key={`row-${rowIndex}`}>
                    {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                        const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
                        const displayKey = cellNumber.toString().padStart(2, '0');
                        const dataKey = cellNumber === 100 ? '00' : displayKey;
                        const isUpdated = updatedCells.includes(dataKey);
                        const validation = validations[dataKey];
                        const hasValue = !!currentData[dataKey] && parseFloat(currentData[dataKey]) !== 0;

                        return (
                            <div key={dataKey} className={cn(
                                "relative flex flex-col justify-end items-center border border-zinc-800 rounded-none transition-all h-full min-h-0",
                                hasValue ? "bg-zinc-900 shadow-[inset_0_0_15px_rgba(0,0,0,0.5)]" : "bg-transparent",
                                isUpdated ? "ring-2 ring-primary ring-inset z-10" : "",
                                "focus-within:ring-2 focus-within:ring-white focus-within:ring-inset focus-within:z-20"
                            )}>
                                <div className="absolute top-0.5 left-1 text-[11px] lg:text-[13px] select-none pointer-events-none z-10 font-black text-cyan-400 opacity-90">{displayKey}</div>
                                <Input
                                    id={`cell-${dataKey}`}
                                    type="text"
                                    value={currentData[dataKey] || ''}
                                    onChange={(e) => onInputChange(dataKey, e.target.value)}
                                    onBlur={() => handleCellBlur(dataKey)}
                                    onKeyDown={(e) => handleKeyDown(e, dataKey)}
                                    disabled={isDataEntryDisabled}
                                    onClick={isDataEntryDisabled ? showClientSelectionToast : undefined}
                                    className="p-0 h-full w-full text-center bg-transparent border-0 rounded-none focus-visible:ring-0 focus-visible:ring-offset-0 text-white font-black text-sm lg:text-lg flex items-end justify-center pb-0.5"
                                    aria-label={`Cell ${displayKey} value ${currentData[dataKey] || 'empty'}`}
                                />
                                {validation && !validation.isValid && !validation.isLoading && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="absolute bottom-0 right-0 p-0.5 text-destructive-foreground bg-destructive rounded-none">
                                                <AlertCircle className="h-3 w-3" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-2 text-sm rounded-none">
                                            <p>{validation.recommendation}</p>
                                        </PopoverContent>
                                    </Popover>
                                )}
                                {validation && validation.isLoading && (
                                    <div className="absolute bottom-0 right-0 p-0.5">
                                        <Loader2 className="h-3 w-3 animate-spin" />
                                    </div>
                                )}
                            </div>
                        )
                    })}
                    <div className="flex items-center justify-center font-black border border-zinc-800 rounded-none bg-zinc-900/50 h-full min-h-0 overflow-hidden">
                        <span className="text-[10px] lg:text-xs text-green-500 font-black break-all px-0.5">
                            {rowTotals[rowIndex] ? formatNumber(rowTotals[rowIndex]) : ''}
                        </span>
                    </div>
                </React.Fragment>
            ))}
            {Array.from({ length: GRID_COLS }, (_, colIndex) => (
                <div key={`col-total-${colIndex}`} className="flex items-center justify-center font-black border border-zinc-800 rounded-none bg-zinc-900/50 h-full min-h-0 overflow-hidden">
                    <span className="text-[10px] lg:text-xs text-green-500 font-black break-all px-0.5">
                        {columnTotals[colIndex] ? formatNumber(columnTotals[colIndex]) : ''}
                    </span>
                </div>
            ))}
            <div className="flex items-center justify-center font-black text-xs lg:text-base border-2 border-green-500/50 rounded-none bg-zinc-900 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)] h-full min-h-0 overflow-hidden">
                {formatNumber(grandTotal)}
            </div>
        </div>
    );
}