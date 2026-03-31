"use client"
import React, { useState, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Download, AlertCircle, Trash2, Copy, X, RotateCcw, Eye, ArrowLeft, Grid, Edit, Settings2, Receipt, ListChecks, CheckCircle2 } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { format, isSameDay } from "date-fns"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Account } from "./accounts-manager";
import { cn, formatNumber } from "@/lib/utils"
import type { Client } from "@/hooks/useClients"
import type { SavedSheetInfo } from "@/hooks/useSheetLog"
import { useSheetLog } from "@/hooks/useSheetLog"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { useIsMobile } from "@/hooks/use-mobile"
import { DataEntryControls } from "./DataEntryControls"
import { GridView } from "./GridView"
import { Separator } from "./ui/separator"
import { Switch } from "@/components/ui/switch"
import { Badge } from "./ui/badge"

type CellData = { [key: string]: string }
type ValidationResult = {
  isValid: boolean
  recommendation: string
}
type CellValidation = { [key: string]: ValidationResult & { isLoading: boolean } }

type ClientSheetData = {
  [clientId: string]: {
    data: CellData;
    rowTotals: { [key: string]: string };
  };
};

const GRID_ROWS = 10;
const GRID_COLS = 10;

export type GridSheetHandle = {
  handleClientUpdate: (client: Client) => void;
  clearSheet: () => void;
  getClientData: (clientId: string) => CellData | undefined;
  getClientCurrentData: (clientId: string) => CellData | undefined;
  getClientPreviousData: (clientId: string) => CellData | undefined;
};

export type GridSheetProps = {
  draw: string;
  date: Date;
  lastEntry: string;
  setLastEntry: (entry: string) => void;
  isLastEntryDialogOpen: boolean;
  setIsLastEntryDialogOpen: (open: boolean) => void;
  clients: Client[];
  onClientSheetSave: (clientName: string, clientId: string, data: CellData, draw: string, date: Date, rawInput?: string) => void;
  savedSheetLog: { [draw: string]: SavedSheetInfo[] };
  accounts: Account[];
  draws: string[];
  onDeleteLogEntry: (logId: string) => void;
}

const MasterSheetViewer = ({
  allSavedLogs,
  draw,
  date,
  clients,
  onDeleteLog,
}: {
  allSavedLogs: { [draw: string]: SavedSheetInfo[] };
  draw: string;
  date: Date;
  clients: Client[];
  onDeleteLog: (logId: string, clientName: string) => void;
}) => {
  const { toast } = useToast();
  const [masterSheetData, setMasterSheetData] = useState<CellData>({});
  const [cuttingValue, setCuttingValue] = useState("");
  const [lessValue, setLessValue] = useState("");
  const [dabbaValue, setDabbaValue] = useState("");
  const [selectedLogIndices, setSelectedLogIndices] = useState<number[]>([]);
  const [isGeneratedSheetDialogOpen, setIsGeneratedSheetDialogOpen] = useState(false);
  const [generatedSheetContent, setGeneratedSheetContent] = useState("");
  const [currentLogs, setCurrentLogs] = useState<SavedSheetInfo[]>([]);
  const [initialMasterData, setInitialMasterData] = useState<CellData>({});
  const [showCommissionLess, setShowCommissionLess] = useState(false);

  React.useEffect(() => {
    const logsForDate = (allSavedLogs[draw] || []).filter(log => isSameDay(new Date(log.date), date));
    setCurrentLogs(logsForDate);
    setSelectedLogIndices(logsForDate.map((_, index) => index));
  }, [draw, date, allSavedLogs]);

  const calculateGrandTotal = (data: CellData) => {
    return Object.values(data).reduce((sum, value) => sum + (parseFloat(value) || 0), 0);
  };
  
  React.useEffect(() => {
    const logsToProcess = currentLogs || [];
    const newMasterData: CellData = {};
    
    selectedLogIndices.forEach(index => {
      const logEntry = logsToProcess[index];
      if (logEntry) {
        const client = clients.find(c => c.id === logEntry.clientId);
        const commissionRate = client ? (parseFloat(client.comm) / 100) : 0;

        Object.entries(logEntry.data).forEach(([key, value]) => {
          const numericValue = parseFloat(value) || 0;
          let valueToAdd = numericValue;

          if (showCommissionLess) {
            const commission = numericValue * commissionRate;
            const netValue = numericValue - commission;
            valueToAdd = Math.round(netValue);
          }

          const existingValue = parseFloat(newMasterData[key]) || 0;
          newMasterData[key] = String(existingValue + valueToAdd);
        });
      }
    });
    
    setMasterSheetData(newMasterData);
    if(!showCommissionLess) {
        setInitialMasterData(newMasterData);
    }
  }, [selectedLogIndices, currentLogs, clients, showCommissionLess]);
  
  const calculateRowTotal = (rowIndex: number, data: CellData) => {
    let total = 0;
    for (let colIndex = 0; colIndex < GRID_COLS; colIndex++) {
        const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
        const key = cellNumber === 100 ? '00' : cellNumber.toString().padStart(2, '0');
        const value = data[key];
        if (value && !isNaN(Number(value))) {
            total += Number(value);
        }
    }
    return total;
  };
  
  const calculateColumnTotal = (colIndex: number, data: CellData) => {
    let total = 0;
    for (let rowIndex = 0; rowIndex < GRID_ROWS; rowIndex++) {
      const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
      const key = cellNumber === 100 ? '00' : cellNumber.toString().padStart(2, '0');
      total += parseFloat(data[key]) || 0;
    }
    return total;
  };

  const initialGrandTotal = calculateGrandTotal(initialMasterData);
  const masterSheetGrandTotal = calculateGrandTotal(masterSheetData);
  const netProfit = initialGrandTotal - masterSheetGrandTotal;

  const handleApplyAdjustment = (type: 'cutting' | 'less' | 'dabba') => {
    let value: number;
    const newMasterData = { ...masterSheetData };

    if (type === 'cutting') {
      value = parseFloat(cuttingValue);
      if (isNaN(value)) return;
      Object.keys(newMasterData).forEach(key => {
        const val = parseFloat(newMasterData[key]) || 0;
        if (val !== 0) newMasterData[key] = String(Math.max(0, val - value));
      });
      setCuttingValue("");
    } else if (type === 'less') {
      value = parseFloat(lessValue);
      if (isNaN(value)) return;
      Object.keys(newMasterData).forEach(key => {
        const val = parseFloat(newMasterData[key]) || 0;
        if (val !== 0) newMasterData[key] = String(val * (1 - value / 100));
      });
      setLessValue("");
    } else if (type === 'dabba') {
      value = parseFloat(dabbaValue);
      if (isNaN(value)) return;
      Object.keys(newMasterData).forEach(key => {
        const val = parseFloat(newMasterData[key]) || 0;
        if (val !== 0) newMasterData[key] = String(val + value);
      });
      setDabbaValue("");
    }

    setMasterSheetData(newMasterData);
    toast({ title: "Adjustment Applied", description: `Applied ${type} to all active cells.` });
  };

  const handleLogSelectionChange = (index: number) => {
    setSelectedLogIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };
  
  const handleGenerateSheet = () => {
    const valueToCells: { [value: string]: string [] } = {};

    for (let i = 1; i <= 100; i++) {
        const displayKey = i.toString().padStart(2, '0');
        const dataKey = i === 100 ? '00' : displayKey;
        const value = masterSheetData[dataKey];
        if (value && value.trim() !== '' && !isNaN(Number(value)) && Number(value) !== 0) {
            const roundedVal = String(Math.round(parseFloat(value)));
            if (!valueToCells[roundedVal]) {
                valueToCells[roundedVal] = [];
            }
            valueToCells[roundedVal].push(displayKey);
        }
    }

    const sheetBody = Object.entries(valueToCells)
        .map(([value, cells]) => {
            cells.sort((a, b) => parseInt(a) - parseInt(b));
            return `${cells.join(',')}=${value}`;
        })
        .join('\n');
    
    const grandTotal = calculateGrandTotal(masterSheetData);
    const totalString = `Total = ${formatNumber(grandTotal)}`;
    const fullContent = `${draw} | ${format(date, 'PPP')}\n\n${sheetBody}\n\n${totalString}`;

    setGeneratedSheetContent(fullContent);
    setIsGeneratedSheetDialogOpen(true);
  };
  
  const handleCopyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
        toast({ title: "Copied to clipboard!" });
    });
  };

  const masterSheetRowTotals = Array.from({ length: GRID_ROWS }, (_, rowIndex) => calculateRowTotal(rowIndex, masterSheetData));
  const masterSheetColumnTotals = Array.from({ length: GRID_COLS }, (_, colIndex) => calculateColumnTotal(colIndex, masterSheetData));
  
 return (
    <div className="flex flex-col lg:flex-row h-full w-full bg-background overflow-hidden">
      <div className="flex-1 p-1 lg:p-2 overflow-hidden bg-black flex flex-col">
        <div className="grid-sheet-layout w-full border border-zinc-800 bg-zinc-950 rounded-none p-1 shadow-2xl flex-grow min-h-0">
            {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
                <React.Fragment key={`master-row-${rowIndex}`}>
                    {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                        const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
                        const displayKey = cellNumber.toString().padStart(2, '0');
                        const dataKey = cellNumber === 100 ? '00' : displayKey;
                        const hasValue = !!masterSheetData[dataKey] && parseFloat(masterSheetData[dataKey]) !== 0;
                        return (
                            <div key={`master-cell-${dataKey}`} className={cn(
                                "relative flex flex-col justify-end items-center border border-zinc-800 rounded-none transition-all h-full min-h-0 pb-0.5",
                                hasValue ? "bg-zinc-900 shadow-[inset_0_0_20px_rgba(0,0,0,0.5)]" : "bg-transparent"
                            )}>
                                <div className="absolute top-0.5 left-1 text-[11px] lg:text-[13px] select-none pointer-events-none z-10 font-black text-cyan-400 opacity-90">{displayKey}</div>
                                <div className="font-black text-xs lg:text-lg text-white">
                                    {hasValue ? formatNumber(masterSheetData[dataKey]) : ''}
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-center justify-center font-black border border-zinc-800 rounded-none bg-zinc-900/50 h-full min-h-0 overflow-hidden">
                        <span className="text-[10px] lg:text-xs text-green-500 font-black px-0.5">
                            {masterSheetRowTotals[rowIndex] ? formatNumber(masterSheetRowTotals[rowIndex]) : ''}
                        </span>
                    </div>
                </React.Fragment>
            ))}
            {Array.from({ length: GRID_COLS }, (_, colIndex) => (
                <div key={`master-col-total-${colIndex}`} className="flex items-center justify-center font-black h-full min-h-0 border border-zinc-800 rounded-none bg-zinc-900/50 overflow-hidden">
                     <span className="text-[10px] lg:text-xs text-green-500 font-black px-0.5">
                        {masterSheetColumnTotals[colIndex] ? formatNumber(masterSheetColumnTotals[colIndex]) : ''}
                    </span>
                </div>
            ))}
            <div className="flex items-center justify-center font-black text-xs lg:text-base border-2 border-green-500/50 rounded-none bg-zinc-900 text-green-500 shadow-[0_0_15px_rgba(34,197,94,0.2)] h-full min-h-0 overflow-hidden">
                {formatNumber(masterSheetGrandTotal)}
            </div>
        </div>
      </div>

      <div className="w-full lg:w-[320px] xl:w-[380px] border-l border-zinc-800 bg-zinc-950 flex flex-col z-10">
        <ScrollArea className="flex-1">
          <div className="p-4 lg:p-6 space-y-6">
            <div className="space-y-4">
              <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Manual Controls</h3>
              <div className="flex items-center justify-between p-3 rounded-none bg-zinc-900 border border-zinc-800">
                  <div className="flex items-center gap-3">
                      <Switch id="comm-less" checked={showCommissionLess} onCheckedChange={setShowCommissionLess} />
                      <Label htmlFor="comm-less" className="text-xs font-bold text-zinc-300">Show Commission Less</Label>
                  </div>
                  <Button onClick={() => setMasterSheetData(initialMasterData)} variant="ghost" size="icon" className="h-8 w-8 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-none">
                      <RotateCcw className="h-4 w-4" />
                  </Button>
              </div>

              <div className="space-y-3">
                <div className="flex items-center gap-2">
                    <Label className="w-14 text-[10px] font-bold uppercase text-zinc-500">Cutting</Label>
                    <Input placeholder="Value" className="h-9 bg-zinc-900 border-zinc-800 text-xs font-bold focus:ring-green-500/50 rounded-none" value={cuttingValue} onChange={(e) => setCuttingValue(e.target.value)} />
                    <Button size="sm" onClick={() => handleApplyAdjustment('cutting')} className="h-9 px-4 bg-green-600 hover:bg-green-700 text-[10px] font-bold uppercase rounded-none">Apply</Button>
                </div>
                <div className="flex items-center gap-2">
                    <Label className="w-14 text-[10px] font-bold uppercase text-zinc-500">Less (%)</Label>
                    <Input placeholder="Value" className="h-9 bg-zinc-900 border-zinc-800 text-xs font-bold focus:ring-green-500/50 rounded-none" value={lessValue} onChange={(e) => setLessValue(e.target.value)} />
                    <Button size="sm" onClick={() => handleApplyAdjustment('less')} className="h-9 px-4 bg-green-600 hover:bg-green-700 text-[10px] font-bold uppercase rounded-none">Apply</Button>
                </div>
                <div className="flex items-center gap-2">
                    <Label className="w-14 text-[10px] font-bold uppercase text-zinc-500">Dabba</Label>
                    <Input placeholder="Value" className="h-9 bg-zinc-900 border-zinc-800 text-xs font-bold focus:ring-green-500/50 rounded-none" value={dabbaValue} onChange={(e) => setDabbaValue(e.target.value)} />
                    <Button size="sm" onClick={() => handleApplyAdjustment('dabba')} className="h-9 px-4 bg-green-600 hover:bg-green-700 text-[10px] font-bold uppercase rounded-none">Apply</Button>
                </div>
              </div>
            </div>

            <Card className="bg-zinc-900 border-zinc-800 rounded-none overflow-hidden shadow-xl">
                <div className="p-3 bg-zinc-950 border-b border-zinc-800 text-center">
                    <span className="text-[10px] font-bold uppercase tracking-widest text-zinc-400">Profit/Loss Summary</span>
                </div>
                <div className="p-4 space-y-3">
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-400">Original Total</span>
                        <span className="text-xs font-bold text-zinc-200">₹{formatNumber(initialGrandTotal)}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs text-zinc-400">Adjusted Total</span>
                        <span className="text-xs font-bold text-zinc-200">₹{formatNumber(masterSheetGrandTotal)}</span>
                    </div>
                    <Separator className="bg-zinc-800" />
                    <div className="flex justify-between items-center pt-1">
                        <span className="text-sm font-bold text-zinc-100">Net Profit/Loss</span>
                        <span className={cn(
                            "text-sm font-black",
                            netProfit >= 0 ? "text-green-500" : "text-red-500"
                        )}>
                            {netProfit >= 0 ? "+" : ""}₹{formatNumber(netProfit)}
                        </span>
                    </div>
                </div>
            </Card>

            <div className="space-y-4">
               <h3 className="text-xs font-bold uppercase tracking-widest text-zinc-400">Client Entries for {format(date, 'MMM do, yyyy')}</h3>
              <div className="space-y-2">
                  {currentLogs.length > 0 ? currentLogs.map((log, index) => (
                      <div key={log.id} className={cn(
                          "flex items-center justify-between p-3 rounded-none border transition-all",
                          selectedLogIndices.includes(index) ? "bg-zinc-900 border-green-500/30" : "bg-zinc-900/40 border-transparent opacity-50"
                      )}>
                          <div className="flex items-center gap-3 min-w-0">
                              <Checkbox
                                  id={`log-master-${index}`}
                                  checked={selectedLogIndices.includes(index)}
                                  onCheckedChange={() => handleLogSelectionChange(index)}
                                  className="h-5 w-5 rounded-none border-zinc-700 data-[state=checked]:bg-green-500 data-[state=checked]:border-green-500"
                              />
                              <label htmlFor={`log-master-${index}`} className="text-xs font-bold truncate text-zinc-300">
                                {index + 1}. {log.clientName}
                              </label>
                          </div>
                          <span className="text-xs font-black text-zinc-100">₹{formatNumber(log.gameTotal)}</span>
                      </div>
                  )) : (
                      <div className="text-center py-10 text-zinc-600 border border-dashed border-zinc-800 rounded-none">
                          <p className="text-[10px] font-bold uppercase tracking-widest">No entries found</p>
                      </div>
                  )}
              </div>
            </div>
          </div>
        </ScrollArea>

        <div className="p-4 border-t border-zinc-800 bg-zinc-950">
          <Button onClick={handleGenerateSheet} className="w-full h-12 bg-zinc-100 hover:bg-white text-zinc-950 font-bold uppercase tracking-widest rounded-none transition-all active:scale-95">
            <Download className="mr-2 h-4 w-4" /> Generate Report
          </Button>
        </div>
      </div>

      <Dialog open={isGeneratedSheetDialogOpen} onOpenChange={setIsGeneratedSheetDialogOpen}>
        <DialogContent className="max-w-3xl h-[80vh] flex flex-col rounded-none">
          <DialogHeader>
            <DialogTitle>Generated Report</DialogTitle>
            <DialogDescription>{draw} | {format(date, 'PPPP')}</DialogDescription>
          </DialogHeader>
          <div className="flex-1 my-4 min-h-0">
            <Textarea readOnly value={generatedSheetContent} className="h-full bg-zinc-900 font-mono text-sm leading-relaxed p-4 rounded-none border-zinc-800 resize-none" />
          </div>
          <DialogFooter className="sm:justify-between gap-4">
            <DialogClose asChild><Button variant="outline" className="rounded-none">Close</Button></DialogClose>
            <Button onClick={() => handleCopyToClipboard(generatedSheetContent)} className="flex-1 rounded-none">Copy to Clipboard</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

const GridSheet = forwardRef<GridSheetHandle, GridSheetProps>((props, ref) => {
  const { toast } = useToast()
  const { deleteSheetLogEntry } = useSheetLog();
  const [clientSheetData, setClientSheetData] = useState<ClientSheetData>({});
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isMasterSheetDialogOpen, setIsMasterSheetDialogOpen] = useState(false);
  const [logToDelete, setLogToDelete] = useState<{ id: string, name: string } | null>(null);
  const [isViewEntryDialogOpen, setIsViewEntryDialogOpen] = useState(false);
  const isMobile = useIsMobile();
  const [currentRawInput, setCurrentRawInput] = useState<string>("");

  const [validations, setValidations] = useState<CellValidation>({})
  const [updatedCells, setUpdatedCells] = useState<string[]>([]);
  const [previousSheetState, setPreviousSheetState] = useState<{ data: CellData, rowTotals: { [key: number]: string } } | null>(null);

  const currentData = selectedClientId ? clientSheetData[selectedClientId]?.data || {} : {};

  const multiTextRef = useRef<HTMLTextAreaElement>(null);
  const focusMultiText = useCallback(() => {
    multiTextRef.current?.focus();
  }, []);

  const showClientSelectionToast = () => {
    toast({
      title: "No Client Selected",
      description: "Please select a client to enable data entry.",
      variant: "destructive",
    });
  };

  const updateClientData = (clientId: string, data: CellData) => {
    setClientSheetData(prev => ({
      ...prev,
      [clientId]: {
        ...(prev[clientId] || { rowTotals: {} }),
        data,
      }
    }));
  };

  const handleSelectedClientChange = (clientId: string) => {
    if (clientId === "None") {
      setSelectedClientId(null);
    } else {
      setSelectedClientId(clientId);
      updateClientData(clientId, {});
      focusMultiText();
    }
  };

  const saveDataForUndo = () => {
    if (!selectedClientId) return;
    const dataToSave = clientSheetData[selectedClientId];
    setPreviousSheetState({ data: { ...(dataToSave?.data || {}) }, rowTotals: { ...(dataToSave?.rowTotals || {}) } });
  };
  
  const handleRevertLastEntry = () => {
    if (previousSheetState && selectedClientId) {
      updateClientData(selectedClientId, previousSheetState.data);
      toast({ title: "Last Entry Reverted", description: "The last change has been undone." });
      setPreviousSheetState(null);
    } else {
      toast({ title: "No Entry to Revert", description: "There is no previous action to revert.", variant: "destructive" });
    }
  };
  
  const handleDataUpdate = (updates: { [key: string]: number | string }, lastEntryString: string) => {
    if (!selectedClientId) {
        showClientSelectionToast();
        return;
    }
    saveDataForUndo();

    const newData = { ...currentData };
    const updatedKeys: string[] = [];

    for (const key in updates) {
        const value = updates[key];
        const currentVal = parseFloat(newData[key]) || 0;
        const updateVal = parseFloat(String(value)) || 0;
        newData[key] = String(currentVal + updateVal);
        updatedKeys.push(key);
    }

    if (updatedKeys.length > 0) {
        updateClientData(selectedClientId, newData);
        setCurrentRawInput(prev => prev ? `${prev}\n${lastEntryString}` : lastEntryString);
        setUpdatedCells(updatedKeys);
        props.setLastEntry(lastEntryString);
        setTimeout(() => setUpdatedCells([]), 2000);
        toast({ title: "Sheet Updated", description: `${updatedKeys.length} cell(s) updated.` });
    }
  };

  useImperativeHandle(ref, () => ({
    handleClientUpdate: (client: Client) => {
      if (selectedClientId === null) {
        showClientSelectionToast();
        return;
      }
      if (client.pair === '90') {
        saveDataForUndo();
        const cellNum = parseInt(client.name, 10);
        const commission = parseFloat(client.comm);

        if (!isNaN(cellNum) && cellNum >= 0 && cellNum <= 99 && !isNaN(commission)) {
          const key = (cellNum).toString().padStart(2, '0');
          const newData = { ...currentData };
          const currentValue = parseFloat(newData[key]) || 0;
          newData[key] = String(currentValue * commission);
          if(selectedClientId) updateClientData(selectedClientId, newData);
          setUpdatedCells(prev => [...prev, key]);
          setTimeout(() => setUpdatedCells(prev => prev.filter(c => c !== key)), 2000);
          toast({ title: "Sheet Updated", description: `Cell ${client.name} adjusted.` });
        }
      }
    },
    clearSheet: () => handleClearSheet(),
    getClientData: (clientId: string) => clientSheetData[clientId]?.data,
    getClientCurrentData: (clientId: string) => clientSheetData[clientId]?.data,
    getClientPreviousData: (clientId: string) => {
      const dateStr = props.date.toISOString().split('T')[0];
      const log = (props.savedSheetLog[props.draw] || []).find(l => l.clientId === clientId && l.date === dateStr);
      return log ? log.data : {};
    },
  }));

  const handleCellChange = (key: string, value: string) => {
    if (selectedClientId === null) {
      showClientSelectionToast();
      return;
    }
    saveDataForUndo();
    const newData = { ...currentData, [key]: value };
    if (selectedClientId) updateClientData(selectedClientId, newData);
  }

  const handleCellBlur = async (key: string) => {
    return;
  }

  const checkBalance = (entryTotal: number): boolean => {
    if (!selectedClientId) return true;
    const client = props.clients.find(c => c.id === selectedClientId);
    if (!client || !client.activeBalance) return true;
    const activeBalance = client.activeBalance;
    const logsForDraw = props.savedSheetLog[props.draw] || [];
    const logEntry = logsForDraw.find(log => log.clientId === selectedClientId);
    const totalPlayed = logEntry?.gameTotal || 0;
    const remainingBalance = activeBalance - totalPlayed;
    if (entryTotal > remainingBalance) {
      toast({
        title: "Balance Limit Exceeded",
        description: `This entry exceeds the remaining balance.`,
        variant: "destructive",
      });
      return false;
    }
    return true;
  };
  
  const handleClearSheet = () => {
    if (selectedClientId === null) {
        showClientSelectionToast();
        return;
    }
    saveDataForUndo();
    updateClientData(selectedClientId, {});
    setValidations({});
    setUpdatedCells([]);
    props.setLastEntry('');
    setCurrentRawInput("");
    toast({ title: "Sheet Cleared" });
  };
  
  const handleSaveSheet = () => {
    if (!selectedClientId) {
      showClientSelectionToast();
      return;
    }
    const newEntries = { ...(clientSheetData[selectedClientId]?.data || {}) };
    if (Object.keys(newEntries).length === 0) {
      toast({
        title: "No Data",
        description: "Please enter data before saving.",
        variant: "destructive",
      });
      return;
    }
    const clientName = props.clients.find(c => c.id === selectedClientId)?.name || "Unknown";
    props.onClientSheetSave(clientName, selectedClientId, newEntries, props.draw, props.date, currentRawInput);
    updateClientData(selectedClientId, {});
    setCurrentRawInput("");
    setPreviousSheetState(null);
    focusMultiText();
  };
  
  const handleDeleteLogEntry = () => {
    if (logToDelete) {
        deleteSheetLogEntry(logToDelete.id);
        toast({ title: "Entry Deleted" });
    }
    setLogToDelete(null);
  };

  const openViewEntryDialog = () => {
    if (!selectedClientId) {
      showClientSelectionToast();
      return;
    }
    setIsViewEntryDialogOpen(true);
  };

  const clientEntries = useMemo(() => {
    if (!selectedClientId || !props.savedSheetLog[props.draw]) return [];
    const dateStrToMatch = format(props.date, 'yyyy-MM-dd');
    return props.savedSheetLog[props.draw]
      .filter(log => log.clientId === selectedClientId && log.date === dateStrToMatch)
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) return b.createdAt.localeCompare(a.createdAt);
        return b.id.localeCompare(a.id);
      });
  }, [selectedClientId, props.savedSheetLog, props.draw, props.date]);

  const getClientDisplay = (client: Client) => {
    const dateStr = props.date.toISOString().split('T')[0];
    const clientLogs = (props.savedSheetLog[props.draw] || []).filter(log => log.clientId === client.id && log.date === dateStr);
    const totalAmount = clientLogs.reduce((sum, log) => sum + log.gameTotal, 0);
    return `${client.name} - ₹${formatNumber(totalAmount)}`;
  };
  
  return (
    <>
      <Card className="h-full flex flex-col overflow-hidden rounded-none border-0 bg-transparent">
        <CardContent className="p-0.5 md:p-1 flex-grow flex flex-col min-h-0">
          {isMobile ? (
            <Tabs defaultValue="grid" className="w-full h-full flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2 rounded-none bg-zinc-900 border-b border-zinc-800 shrink-0">
                <TabsTrigger value="grid" className="gap-1.5 rounded-none data-[state=active]:bg-zinc-800"><Grid className="h-4 w-4" /> Grid</TabsTrigger>
                <TabsTrigger value="entry" className="gap-1.5 rounded-none data-[state=active]:bg-zinc-800"><Edit className="h-4 w-4" /> Entry</TabsTrigger>
              </TabsList>
              <TabsContent value="grid" className="flex-grow min-h-0 mt-0 overflow-hidden flex flex-col">
                <GridView
                  currentData={currentData}
                  updatedCells={updatedCells}
                  validations={validations}
                  handleCellChange={handleCellChange}
                  handleCellBlur={handleCellBlur}
                  isDataEntryDisabled={!selectedClientId}
                  showClientSelectionToast={showClientSelectionToast}
                />
              </TabsContent>
              <TabsContent value="entry" className="flex-grow min-h-0 mt-0 overflow-y-auto">
                 <DataEntryControls
                    clients={props.clients}
                    selectedClientId={selectedClientId}
                    onClientChange={handleSelectedClientChange}
                    onSave={handleSaveSheet}
                    onRevert={handleRevertLastEntry}
                    isRevertDisabled={!previousSheetState || selectedClientId === null}
                    onDataUpdate={handleDataUpdate}
                    onClear={handleClearSheet}
                    setLastEntry={props.setLastEntry}
                    checkBalance={checkBalance}
                    showClientSelectionToast={showClientSelectionToast}
                    getClientDisplay={getClientDisplay}
                    focusMultiText={focusMultiText}
                    openMasterSheet={() => setIsMasterSheetDialogOpen(true)}
                    currentGridData={currentData}
                    draw={props.draw}
                    openViewEntryDialog={openViewEntryDialog}
                 />
              </TabsContent>
            </Tabs>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-1 flex-grow min-h-0 overflow-hidden">
              <GridView
                currentData={currentData}
                updatedCells={updatedCells}
                validations={validations}
                handleCellChange={handleCellChange}
                handleCellBlur={handleCellBlur}
                isDataEntryDisabled={!selectedClientId}
                showClientSelectionToast={showClientSelectionToast}
              />
               <DataEntryControls
                  ref={multiTextRef}
                  clients={props.clients}
                  selectedClientId={selectedClientId}
                  onClientChange={handleSelectedClientChange}
                  onSave={handleSaveSheet}
                  onRevert={handleRevertLastEntry}
                  isRevertDisabled={!previousSheetState || selectedClientId === null}
                  onDataUpdate={handleDataUpdate}
                  onClear={handleClearSheet}
                  setLastEntry={props.setLastEntry}
                  checkBalance={checkBalance}
                  showClientSelectionToast={showClientSelectionToast}
                  getClientDisplay={getClientDisplay}
                  focusMultiText={focusMultiText}
                  openMasterSheet={() => setIsMasterSheetDialogOpen(true)}
                  currentGridData={currentData}
                  draw={props.draw}
                  openViewEntryDialog={openViewEntryDialog}
               />
            </div>
          )}
        </CardContent>
      </Card>
      
      <Dialog open={isMasterSheetDialogOpen} onOpenChange={setIsMasterSheetDialogOpen}>
        <DialogContent className="w-full h-full p-0 border-0 sm:max-w-none overflow-hidden flex flex-col rounded-none">
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-3 border-b border-zinc-800 shrink-0 bg-zinc-950">
            <div className="flex items-center gap-6">
                <Button variant="ghost" size="icon" onClick={() => setIsMasterSheetDialogOpen(false)} className="h-10 w-10 hover:bg-zinc-800 rounded-none text-zinc-100">
                    <ArrowLeft className="h-6 w-6" />
                    <span className="sr-only">Back</span>
                </Button>
                <div>
                    <DialogTitle className="text-xl font-bold text-zinc-100">Master Sheet : {props.draw}</DialogTitle>
                </div>
            </div>
             <Button variant="ghost" size="icon" onClick={() => setIsMasterSheetDialogOpen(false)} className="h-8 w-8 hover:bg-zinc-800 rounded-none text-zinc-400">
                <X className="h-5 w-5" />
            </Button>
          </DialogHeader>
           <div className="flex-1 overflow-hidden bg-zinc-950">
                <MasterSheetViewer 
                    allSavedLogs={props.savedSheetLog}
                    draw={props.draw}
                    date={props.date}
                    clients={props.clients}
                    onDeleteLog={(id, name) => setLogToDelete({ id, name })}
                />
           </div>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!logToDelete} onOpenChange={() => setLogToDelete(null)}>
        <DialogContent className="rounded-none">
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the entry for <strong>{logToDelete?.name}</strong>? This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogToDelete(null)} className="rounded-none">Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteLogEntry} className="rounded-none">Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={props.isLastEntryDialogOpen} onOpenChange={props.setIsLastEntryDialogOpen}>
        <DialogContent className="max-w-lg rounded-none">
          <DialogHeader>
            <DialogTitle>Last Processed Entry</DialogTitle>
          </DialogHeader>
          <div className="my-4">
            <Textarea
              readOnly
              value={props.lastEntry || "No entries yet."}
              rows={Math.min(15, (props.lastEntry || "").split('\n').length)}
              className="bg-muted font-mono rounded-none"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild><Button variant="secondary" className="rounded-none">Close</Button></DialogClose>
             <Button onClick={() => navigator.clipboard.writeText(props.lastEntry)} className="rounded-none">
                <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewEntryDialogOpen} onOpenChange={setIsViewEntryDialogOpen}>
        <DialogContent className="max-w-xl rounded-none">
            <DialogHeader>
                <DialogTitle className="uppercase font-black">Client History</DialogTitle>
                <DialogDescription>
                    {props.clients.find(c => c.id === selectedClientId)?.name} | {props.draw}
                </DialogDescription>
            </DialogHeader>
            <div className="my-4">
                <ScrollArea className="max-h-[60vh]">
                    <div className="space-y-2 pr-4">
                        {clientEntries.length > 0 ? (
                            clientEntries.map((entry, index) => (
                                <Card key={entry.id} className="p-3 border-l-4 border-l-primary rounded-none">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-bold">
                                                Entry {clientEntries.length - index}: 
                                                <span className="font-black text-primary ml-2">₹{formatNumber(entry.gameTotal)}</span>
                                            </p>
                                            <p className="text-xs text-muted-foreground whitespace-pre-wrap mt-1">
                                                {entry.rawInput || "Manual Grid Update"}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive rounded-none" onClick={() => props.onDeleteLogEntry(entry.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-8 italic font-bold">No entries found for today.</p>
                        )}
                    </div>
                </ScrollArea>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setIsViewEntryDialogOpen(false)} className="rounded-none">Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
});

GridSheet.displayName = 'GridSheet';

export default GridSheet;