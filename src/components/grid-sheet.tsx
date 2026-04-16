"use client";

import React, { useState, useMemo, useRef, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { ChevronLeft, Trash2, FileSpreadsheet, X, Eye } from "lucide-react";
import { GridView } from "@/components/GridView";
import { DataEntryControls } from "@/components/DataEntryControls";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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

    const masterData = useMemo(() => {
        const logs = props.savedSheetLog[props.draw] || [];
        const totals: Record<string, string> = {};
        logs.filter(l => l.date === dateStr).forEach(l => {
            Object.entries(l.data).forEach(([k, v]) => {
                const cur = parseFloat(totals[k]) || 0;
                totals[k] = String(cur + (parseFloat(v) || 0));
            });
        });
        return totals;
    }, [props.savedSheetLog, props.draw, dateStr]);

    const clientEntries = useMemo(() => {
        if (!selectedClientId) return [];
        return (props.savedSheetLog[props.draw] || []).filter(l => l.clientId === selectedClientId && l.date === dateStr);
    }, [props.savedSheetLog, props.draw, selectedClientId, dateStr]);

    const handleClientChange = (clientId: string) => {
        const id = clientId === 'None' ? null : clientId;
        setSelectedClientId(id);
        setGridData({});
        setUpdatedCells([]);
        setHistory([]);
        
        if (id) {
            const initial: Record<string, string> = {};
            (props.savedSheetLog[props.draw] || []).filter(l => l.clientId === id && l.date === dateStr).forEach(l => {
                Object.entries(l.data).forEach(([k, v]) => {
                    const cur = parseFloat(initial[k]) || 0;
                    initial[k] = String(cur + (parseFloat(v) || 0));
                });
            });
            setGridData(initial);
        }
    };

    const handleDataUpdate = (updates: { [key: string]: number | string }, rawInput: string) => {
        setHistory(prev => [...prev, { ...gridData }]);
        const newData = { ...gridData };
        Object.entries(updates).forEach(([k, v]) => {
            const cur = parseFloat(newData[k]) || 0;
            newData[k] = String(cur + (parseFloat(v) || 0));
        });
        setGridData(newData);
        setUpdatedCells(Object.keys(updates));
        
        if (selectedClientId) {
            const client = props.clients.find(c => c.id === selectedClientId);
            if (client) {
                const step: Record<string, string> = {};
                Object.entries(updates).forEach(([k, v]) => step[k] = String(v));
                props.onClientSheetSave(client.name, client.id, step, props.draw, props.date, rawInput);
            }
        }
    };

    return (
        <div className="flex flex-col h-full gap-4">
            <div className="flex items-center justify-between border-b pb-4">
                <Button variant="ghost" size="sm" onClick={props.onBack} className="font-black uppercase tracking-widest text-[10px]">
                    <ChevronLeft className="mr-1 h-3 w-3" /> Back to Dashboard
                </Button>
                <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black uppercase tracking-tighter text-primary">
                        {props.draw} <span className="text-muted-foreground ml-2 font-bold">{format(props.date, "dd/MM/yyyy")}</span>
                    </h2>
                </div>
            </div>

            <div className="flex-1 flex flex-col lg:flex-row gap-4 min-h-0">
                <GridView 
                    currentData={gridData}
                    updatedCells={updatedCells}
                    validations={{}}
                    handleCellChange={(k, v) => setGridData(p => ({ ...p, [k]: v }))}
                    handleCellBlur={() => {}}
                    isDataEntryDisabled={!selectedClientId}
                    showClientSelectionToast={() => toast({ title: "Select Client First" })}
                />

                <div className="w-full lg:w-80 flex flex-col gap-4">
                    <DataEntryControls 
                        ref={controlsRef}
                        clients={props.clients}
                        selectedClientId={selectedClientId}
                        onClientChange={handleClientChange}
                        onSave={() => { setUpdatedCells([]); toast({title:"Saved"}); }}
                        onRevert={() => { if(history.length){setGridData(history[history.length-1]); setHistory(p=>p.slice(0,-1)); setUpdatedCells([]);} }}
                        isRevertDisabled={history.length === 0}
                        onDataUpdate={handleDataUpdate}
                        onClear={() => setGridData({})}
                        setLastEntry={() => {}}
                        checkBalance={() => true}
                        showClientSelectionToast={() => toast({ title: "Select Client" })}
                        getClientDisplay={(c) => `${c.name} (${c.inOut})`}
                        focusMultiText={() => controlsRef.current?.focus()}
                        openMasterSheet={() => setIsMasterSheetOpen(true)}
                        currentGridData={gridData}
                        draw={props.draw}
                        openViewEntryDialog={() => setIsViewEntryDialogOpen(true)}
                    />
                    
                    {selectedClientId && (
                        <Button variant="outline" className="w-full rounded-none font-black uppercase text-[10px] tracking-widest" onClick={() => setIsViewEntryDialogOpen(true)}>
                            <Eye className="mr-2 h-4 w-4" /> View Client Entries
                        </Button>
                    )}
                </div>
            </div>

            <Dialog open={isViewEntryDialogOpen} onOpenChange={setIsViewEntryDialogOpen}>
                <DialogContent className="max-w-xl rounded-none">
                    <DialogHeader><DialogTitle className="uppercase font-black">History: {props.draw}</DialogTitle></DialogHeader>
                    <ScrollArea className="max-h-[60vh] mt-4">
                        <div className="space-y-2 pr-4">
                            {clientEntries.map((e, i) => (
                                <Card key={e.id} className="p-4 border-l-4 border-l-primary rounded-none flex justify-between items-center bg-muted/5">
                                    <div className="flex-1">
                                        <p className="font-black text-lg">Entry {i + 1}: <span className="text-primary">₹{formatNumber(e.gameTotal)}</span></p>
                                        <p className="text-[10px] text-muted-foreground font-bold uppercase mt-1">{e.rawInput}</p>
                                    </div>
                                    <Button variant="ghost" size="icon" className="text-destructive" onClick={() => setLogToDelete(e)}><Trash2 className="h-4 w-4" /></Button>
                                </Card>
                            ))}
                            {clientEntries.length === 0 && <p className="text-center py-12 text-muted-foreground font-bold">No entries found.</p>}
                        </div>
                    </ScrollArea>
                </DialogContent>
            </Dialog>

            <Dialog open={isMasterSheetOpen} onOpenChange={setIsMasterSheetOpen}>
                <DialogContent className="max-w-[95vw] w-full h-[90vh] flex flex-col p-0 border-zinc-800 rounded-none bg-zinc-950">
                    <DialogHeader className="p-4 border-b border-zinc-800 flex flex-row items-center justify-between">
                        <div>
                            <DialogTitle className="uppercase font-black text-primary text-xl flex items-center gap-2">
                                <FileSpreadsheet className="h-6 w-6" /> MASTER SHEET
                            </DialogTitle>
                        </div>
                        <Button variant="ghost" size="icon" onClick={() => setIsMasterSheetOpen(false)}><X className="h-6 w-6" /></Button>
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
                    <DialogHeader><DialogTitle>Delete Entry?</DialogTitle><DialogDescription className="font-bold">This will remove ₹{logToDelete ? formatNumber(logToDelete.gameTotal) : 0} from the sheet.</DialogDescription></DialogHeader>
                    <div className="flex justify-end gap-2 mt-4">
                        <Button variant="outline" className="rounded-none" onClick={() => setLogToDelete(null)}>Cancel</Button>
                        <Button variant="destructive" className="rounded-none font-black" onClick={() => { if(logToDelete){props.onDeleteLogEntry(logToDelete.id); setLogToDelete(null);} }}>Delete Entry</Button>
                    </div>
                </DialogContent>
            </Dialog>
        </div>
    );
});

GridSheet.displayName = 'GridSheet';
export default GridSheet;