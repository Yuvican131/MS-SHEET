"use client";

import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Trash2, FileSpreadsheet, X } from "lucide-react";
import { GridView } from "@/components/GridView";
import { DataEntryControls } from "@/components/DataEntryControls";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { formatNumber } from "@/lib/utils";
import { format } from "date-fns";
import type { Client } from "@/hooks/useClients";
import type { SavedSheetInfo } from "@/hooks/useSheetLog";
import type { Account } from "@/components/accounts-manager";

interface GridSheetProps {
    draw: string;
    date: Date;
    clients: Client[];
    onClientSheetSave: (name: string, id: string, data: { [key: string]: string }, draw: string, date: Date, rawInput?: string) => void;
    savedSheetLog: { [draw: string]: SavedSheetInfo[] };
    accounts: Account[];
    draws: string[];
    onDeleteLogEntry: (id: string) => void;
    onBack: () => void;
}

const GridSheet = forwardRef<any, GridSheetProps>((props, ref) => {
    const { toast } = useToast();
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [gridData, setGridData] = useState<{ [key: string]: string }>({});
    const [updatedCells, setUpdatedCells] = useState<string[]>([]);
    const [isViewEntryDialogOpen, setIsViewEntryDialogOpen] = useState(false);
    const [isMasterSheetOpen, setIsMasterSheetOpen] = useState(false);
    const [logToDelete, setLogToDelete] = useState<SavedSheetInfo | null>(null);
    const [history, setHistory] = useState<{ [key: string]: string }[]>([]);
    
    const controlsRef = useRef<any>(null);

    useImperativeHandle(ref, () => ({
        reset: () => {
            setGridData({});
            setUpdatedCells([]);
            setSelectedClientId(null);
            setHistory([]);
        }
    }));

    const dateStr = useMemo(() => format(props.date, 'yyyy-MM-dd'), [props.date]);

    // Aggregate data for the Master Sheet (all clients for this draw/date)
    const masterData = useMemo(() => {
        const logs = props.savedSheetLog[props.draw] || [];
        const totals: { [key: string]: string } = {};
        logs.forEach(log => {
            if (log.date === dateStr) {
                Object.entries(log.data).forEach(([key, val]) => {
                    const current = parseFloat(totals[key]) || 0;
                    totals[key] = String(current + (parseFloat(val) || 0));
                });
            }
        });
        return totals;
    }, [props.savedSheetLog, props.draw, dateStr]);

    const clientEntries = useMemo(() => {
        if (!selectedClientId) return [];
        const logs = props.savedSheetLog[props.draw] || [];
        return logs.filter(log => log.clientId === selectedClientId && log.date === dateStr);
    }, [props.savedSheetLog, props.draw, selectedClientId, dateStr]);

    const handleClientChange = (clientId: string) => {
        const id = clientId === 'None' ? null : clientId;
        setSelectedClientId(id);
        setGridData({});
        setUpdatedCells([]);
        setHistory([]);
        
        if (id) {
            const logs = props.savedSheetLog[props.draw] || [];
            const clientLogs = logs.filter(log => log.clientId === id && log.date === dateStr);
            const initialData: { [key: string]: string } = {};
            clientLogs.forEach(log => {
                Object.entries(log.data).forEach(([key, val]) => {
                    const current = parseFloat(initialData[key]) || 0;
                    initialData[key] = String(current + (parseFloat(val) || 0));
                });
            });
            setGridData(initialData);
        }
    };

    const handleCellChange = (key: string, value: string) => {
        setGridData(prev => ({ ...prev, [key]: value }));
        if (!updatedCells.includes(key)) {
            setUpdatedCells(prev => [...prev, key]);
        }
    };

    const handleDataUpdate = (updates: { [key: string]: number | string }, rawInput: string) => {
        setHistory(prev => [...prev, { ...gridData }]);
        const newData = { ...gridData };
        const changedCells: string[] = [];
        
        Object.entries(updates).forEach(([key, val]) => {
            const current = parseFloat(newData[key]) || 0;
            newData[key] = String(current + (parseFloat(val) || 0));
            if (!changedCells.includes(key)) changedCells.push(key);
        });

        setGridData(newData);
        setUpdatedCells(changedCells);
        
        if (selectedClientId) {
            const client = props.clients.find(c => c.id === selectedClientId);
            if (client) {
                const stepData: { [key: string]: string } = {};
                Object.entries(updates).forEach(([k, v]) => stepData[k] = String(v));
                props.onClientSheetSave(client.name, client.id, stepData, props.draw, props.date, rawInput);
            }
        }
    };

    const handleRevert = () => {
        if (history.length > 0) {
            const last = history[history.length - 1];
            setGridData(last);
            setHistory(prev => prev.slice(0, -1));
            setUpdatedCells([]);
            toast({ title: "Reverted", description: "Last entry undone locally." });
        }
    };

    const handleSave = () => {
        if (!selectedClientId) {
            toast({ title: "Error", description: "Select a client first.", variant: "destructive" });
            return;
        }
        toast({ title: "Saved", description: "All changes are synced." });
        setUpdatedCells([]);
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between">
                <Button variant="ghost" size="sm" onClick={props.onBack} className="gap-2">
                    <ChevronLeft className="h-4 w-4" /> Back to Dashboard
                </Button>
                <div className="flex items-center gap-4">
                    <h2 className="text-xl font-black uppercase tracking-tighter text-primary">
                        {props.draw} - {props.date.toLocaleDateString()}
                    </h2>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                <GridView 
                    currentData={gridData}
                    updatedCells={updatedCells}
                    validations={{}}
                    handleCellChange={handleCellChange}
                    handleCellBlur={() => {}}
                    isDataEntryDisabled={!selectedClientId}
                    showClientSelectionToast={() => toast({ title: "Select Client", description: "Please select a client to start entry." })}
                />

                <DataEntryControls 
                    ref={controlsRef}
                    clients={props.clients}
                    selectedClientId={selectedClientId}
                    onClientChange={handleClientChange}
                    onSave={handleSave}
                    onRevert={handleRevert}
                    isRevertDisabled={history.length === 0}
                    onDataUpdate={handleDataUpdate}
                    onClear={() => setGridData({})}
                    setLastEntry={() => {}}
                    checkBalance={() => true}
                    showClientSelectionToast={() => toast({ title: "Select Client" })}
                    getClientDisplay={(c) => c.name}
                    focusMultiText={() => controlsRef.current?.focus()}
                    openMasterSheet={() => setIsMasterSheetOpen(true)}
                    currentGridData={gridData}
                    draw={props.draw}
                    openViewEntryDialog={() => setIsViewEntryDialogOpen(true)}
                />
            </div>

            <Dialog open={isViewEntryDialogOpen} onOpenChange={(open) => setIsViewEntryDialogOpen(open)}>
                <DialogContent className="max-w-xl rounded-none">
                    <DialogHeader>
                        <DialogTitle className="uppercase font-black">Entry History: {props.draw}</DialogTitle>
                    </DialogHeader>
                    <div className="my-4">
                        <ScrollArea className="max-h-[60vh]">
                            <div className="space-y-2 pr-4">
                                {clientEntries.length > 0 ? (
                                    clientEntries.map((entry, index) => (
                                        <Card key={entry.id} className="p-3 border-l-4 border-l-primary rounded-none">
                                            <div className="flex justify-between items-center">
                                                <div className="flex-1 mr-4">
                                                    <p className="font-bold">
                                                        Entry {index + 1}: <span className="text-primary">₹{formatNumber(entry.gameTotal)}</span>
                                                    </p>
                                                    <p className="text-[10px] text-muted-foreground whitespace-pre-wrap mt-1">
                                                        {entry.rawInput || "Manual Entry"}
                                                    </p>
                                                </div>
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="h-8 w-8 text-destructive"
                                                    onClick={() => setLogToDelete(entry)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            </div>
                                        </Card>
                                    ))
                                ) : (
                                    <p className="text-center text-muted-foreground py-8 italic font-bold">No entries found for this client.</p>
                                )}
                            </div>
                        </ScrollArea>
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={isMasterSheetOpen} onOpenChange={(open) => setIsMasterSheetOpen(open)}>
                <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 overflow-hidden border-zinc-800 rounded-none bg-zinc-950">
                    <DialogHeader className="p-4 border-b border-zinc-800 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="uppercase font-black text-primary text-xl flex items-center gap-2">
                                <FileSpreadsheet className="h-6 w-6" />
                                MASTER SHEET: {props.draw}
                            </DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground uppercase">
                                Combined totals for all clients on {props.date.toLocaleDateString()}
                            </DialogDescription>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsMasterSheetOpen(false)}>
                            <X className="h-6 w-6" />
                        </Button>
                    </DialogHeader>
                    <div className="flex-1 min-h-0 p-2 overflow-hidden bg-zinc-950">
                        <GridView 
                            currentData={masterData}
                            updatedCells={[]}
                            validations={{}}
                            handleCellChange={() => {}}
                            handleCellBlur={() => {}}
                            isDataEntryDisabled={true}
                            showClientSelectionToast={() => {}}
                        />
                    </div>
                </DialogContent>
            </Dialog>

            <Dialog open={!!logToDelete} onOpenChange={() => setLogToDelete(null)}>
                <DialogContent className="rounded-none">
                    <DialogHeader>
                        <DialogTitle>Confirm Deletion</DialogTitle>
                        <DialogDescription>
                            Permanently delete entry of ₹{logToDelete ? formatNumber(logToDelete.gameTotal) : 0}?
                        </DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => setLogToDelete(null)}>Cancel</Button>
                        <Button 
                            variant="destructive" 
                            onClick={() => {
                                if (logToDelete) {
                                    props.onDeleteLogEntry(logToDelete.id);
                                    setLogToDelete(null);
                                }
                            }}
                        >
                            Delete
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
});

GridSheet.displayName = 'GridSheet';

export default GridSheet;
