"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { formatNumber, cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const GRID_ROWS = 10;
const GRID_COLS = 10;

type CellData = { [key: string]: string };

interface GridViewProps {
    currentData: CellData;
    updatedCells: string[];
    handleCellChange: (key: string, value: string) => void;
    isDataEntryDisabled: boolean;
    showClientSelectionToast: () => void;
}

export function GridView({
    currentData,
    updatedCells,
    handleCellChange,
    isDataEntryDisabled,
    showClientSelectionToast,
}: GridViewProps) {
    const { toast } = useToast();

    // Standard numeric cells (01-100)
    const harupAndarTotal = Array.from({ length: 10 }, (_, i) => parseFloat(currentData[`A${i}`]) || 0).reduce((a, b) => a + b, 0);
    const harupBaharTotal = Array.from({ length: 10 }, (_, i) => parseFloat(currentData[`B${i}`]) || 0).reduce((a, b) => a + b, 0);
    
    const standardTotal = Object.keys(currentData).reduce((acc, key) => {
        if (!key.startsWith('A') && !key.startsWith('B')) {
            return acc + (parseFloat(currentData[key]) || 0);
        }
        return acc;
    }, 0);

    const grandTotal = standardTotal + harupAndarTotal + harupBaharTotal;

    const onInputChange = (key: string, value: string) => {
        if (value === '' || /^\d+$/.test(value)) {
            handleCellChange(key, value);
        } else {
            toast({
                title: "Only numbers allowed",
                variant: "destructive",
            });
        }
    };

    return (
        <div className="grid grid-cols-[repeat(11,1fr)] grid-rows-[repeat(11,1fr)] gap-px bg-zinc-800 border border-zinc-800 w-full h-full min-h-0 overflow-hidden">
            {/* Standard 10x10 Grid + Harup Andar Column */}
            {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
                <React.Fragment key={`row-${rowIndex}`}>
                    {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                        const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
                        const displayKey = cellNumber.toString().padStart(2, '0');
                        const dataKey = cellNumber === 100 ? '00' : displayKey;
                        const isUpdated = updatedCells.includes(dataKey);
                        const hasValue = !!currentData[dataKey] && parseFloat(currentData[dataKey]) !== 0;

                        return (
                            <div key={dataKey} className={cn(
                                "relative flex flex-col justify-end bg-zinc-950 border-none transition-all",
                                hasValue ? "bg-zinc-900" : "",
                                isUpdated ? "ring-2 ring-primary ring-inset z-10" : ""
                            )}>
                                <span className="absolute top-1 left-1 text-[10px] font-black text-cyan-500 pointer-events-none">{displayKey}</span>
                                <Input
                                    type="text"
                                    value={currentData[dataKey] || ''}
                                    onChange={(e) => onInputChange(dataKey, e.target.value)}
                                    disabled={isDataEntryDisabled}
                                    onClick={isDataEntryDisabled ? showClientSelectionToast : undefined}
                                    className="p-0 h-full w-full text-right pr-1 bg-transparent border-none rounded-none focus-visible:ring-2 focus-visible:ring-white text-white font-black text-base pt-4"
                                />
                            </div>
                        )
                    })}
                    {/* 11th Column: Harup Andar */}
                    <div className={cn(
                        "relative flex flex-col justify-end bg-zinc-900/50 border-none",
                        updatedCells.includes(`A${rowIndex}`) ? "ring-2 ring-amber-500 ring-inset z-10" : ""
                    )}>
                        <span className="absolute top-1 left-1 text-[10px] font-black text-amber-500">A{rowIndex}</span>
                        <Input
                            type="text"
                            value={currentData[`A${rowIndex}`] || ''}
                            onChange={(e) => onInputChange(`A${rowIndex}`, e.target.value)}
                            disabled={isDataEntryDisabled}
                            className="p-0 h-full w-full text-right pr-1 bg-transparent border-none rounded-none focus-visible:ring-2 focus-visible:ring-amber-500 text-amber-400 font-black text-base pt-4"
                        />
                    </div>
                </React.Fragment>
            ))}

            {/* 11th Row: Harup Bahar + Grand Total */}
            {Array.from({ length: GRID_COLS }, (_, colIndex) => (
                <div key={`B${colIndex}`} className={cn(
                    "relative flex flex-col justify-end bg-zinc-900/50 border-none",
                    updatedCells.includes(`B${colIndex}`) ? "ring-2 ring-amber-500 ring-inset z-10" : ""
                )}>
                    <span className="absolute top-1 left-1 text-[10px] font-black text-amber-500">B{colIndex}</span>
                    <Input
                        type="text"
                        value={currentData[`B${colIndex}`] || ''}
                        onChange={(e) => onInputChange(`B${colIndex}`, e.target.value)}
                        disabled={isDataEntryDisabled}
                        className="p-0 h-full w-full text-right pr-1 bg-transparent border-none rounded-none focus-visible:ring-2 focus-visible:ring-amber-500 text-amber-400 font-black text-base pt-4"
                    />
                </div>
            ))}
            
            {/* Final Cell: Grand Total */}
            <div className="flex items-center justify-center bg-zinc-900 border-none text-primary font-black text-lg ring-1 ring-primary/50">
                {formatNumber(grandTotal)}
            </div>
        </div>
    );
}