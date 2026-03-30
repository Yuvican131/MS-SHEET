
"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { AlertCircle, Loader2 } from "lucide-react";
import { formatNumber } from "@/lib/utils";
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
            // Calculate next cell
            let currentNum = currentKey === '00' ? 100 : parseInt(currentKey, 10);
            let nextNum = (currentNum % 100) + 1;
            let nextKey = nextNum === 100 ? '00' : nextNum.toString().padStart(2, '0');
            
            const nextInput = document.getElementById(`cell-${nextKey}`);
            if (nextInput) {
                (nextInput as HTMLInputElement).focus();
                (nextInput as HTMLInputElement).select(); // Select content for quick overwriting
            }
        }
    };

    const onInputChange = (key: string, value: string) => {
        // Regex to allow only digits or an empty string
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
        <div className="grid-sheet-layout h-full w-full">
            {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
                <React.Fragment key={`row-${rowIndex}`}>
                    {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                        const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
                        const displayKey = cellNumber.toString().padStart(2, '0');
                        const dataKey = cellNumber === 100 ? '00' : displayKey;
                        const isUpdated = updatedCells.includes(dataKey);
                        const validation = validations[dataKey];

                        return (
                            <div key={dataKey} className="relative flex border rounded-sm grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                                <div className="absolute top-0.5 left-1 text-xs sm:top-1 sm:left-1.5 sm:text-sm select-none pointer-events-none z-10" style={{ color: 'var(--grid-cell-number-color)' }}>{displayKey}</div>
                                <Input
                                    id={`cell-${dataKey}`}
                                    type="text"
                                    value={currentData[dataKey] || ''}
                                    onChange={(e) => onInputChange(dataKey, e.target.value)}
                                    onBlur={() => handleCellBlur(dataKey)}
                                    onKeyDown={(e) => handleKeyDown(e, dataKey)}
                                    disabled={isDataEntryDisabled}
                                    onClick={isDataEntryDisabled ? showClientSelectionToast : undefined}
                                    className={`p-0 h-full w-full text-center bg-transparent border-0 focus:ring-0 grid-cell-input transition-colors duration-300 ${isUpdated ? "bg-primary/20" : ""} ${isDataEntryDisabled ? 'cursor-not-allowed bg-muted/50' : ''}`}
                                    style={{ color: 'var(--grid-cell-amount-color)' }}
                                    aria-label={`Cell ${displayKey} value ${currentData[dataKey] || 'empty'}`}
                                />
                                {validation && !validation.isValid && !validation.isLoading && (
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <button className="absolute bottom-0 right-0 p-0.5 text-destructive-foreground bg-destructive rounded-full">
                                                <AlertCircle className="h-3 w-3" />
                                            </button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-64 p-2 text-sm">
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
                    <div className="flex items-center justify-center font-medium border rounded-sm bg-transparent grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                        <span className="font-medium text-center h-full w-full p-1 border-0 focus:ring-0 bg-transparent grid-cell-total flex items-center justify-center" style={{ color: 'var(--grid-cell-total-color)' }}>
                            {rowTotals[rowIndex] ? formatNumber(rowTotals[rowIndex]) : ''}
                        </span>
                    </div>
                </React.Fragment>
            ))}
            {Array.from({ length: GRID_COLS }, (_, colIndex) => (
                <div key={`col-total-${colIndex}`} className="flex items-center justify-center font-medium p-0 h-full border rounded-sm bg-transparent grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                    <span className="font-medium text-center h-full w-full p-1 border-0 focus:ring-0 bg-transparent grid-cell-total flex items-center justify-center" style={{ color: 'var(--grid-cell-total-color)' }}>
                        {columnTotals[colIndex] ? formatNumber(columnTotals[colIndex]) : ''}
                    </span>
                </div>
            ))}
            <div className="flex items-center justify-center font-bold text-lg border rounded-sm grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)', color: 'var(--grid-cell-total-color)' }}>
                {formatNumber(grandTotal)}
            </div>
        </div>
    );
}
