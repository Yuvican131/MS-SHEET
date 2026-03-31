
"use client"
import React, { useState, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { validateCellContent, ValidateCellContentOutput } from "@/ai/flows/validate-cell-content"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Download, Plus, AlertCircle, Loader2, Trash2, Copy, X, Save, RotateCcw, Undo2, Eye, FileSpreadsheet, ArrowLeft, Grid, Edit, TrendingUp, TrendingDown, Settings2, Receipt, ListChecks } from "lucide-react"
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
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table"
import { Separator } from "./ui/separator"
import { Switch } from "@/components/ui/switch"
import { Badge } from "./ui/badge"


type CellData = { [key: string]: string }
type ValidationResult = {
  isValid: boolean
  recommendation: string
}
type CellValidation = { [key: string]: ValidationResult & { isLoading: boolean } }

type Sheet = {
  id: string;
  name: string;
  data: CellData;
  rowTotals: { [key: number]: string };
};

type ClientSheetData = {
  [clientId: string]: {
    data: CellData;
    rowTotals: { [key: string]: string };
  };
};

const initialSheets: Sheet[] = [
  { id: "1", name: "Sheet 1", data: {}, rowTotals: {} },
]

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
    const logsToProcess = (currentLogs || []);
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
            valueToAdd = Math.round(netValue / 5) * 5;
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

  const handleApplyCutting = () => {
    const cutValue = parseFloat(cuttingValue);
    if (isNaN(cutValue)) {
      toast({ title: "Invalid Input", description: "Please enter a valid number for cutting.", variant: "destructive" });
      return;
    }

    const newMasterData = { ...masterSheetData };
    Object.keys(newMasterData).forEach(key => {
      const cellValue = parseFloat(newMasterData[key]) || 0;
      newMasterData[key] = String(cellValue - cutValue);
    });
    setMasterSheetData(newMasterData);

    toast({ title: "Cutting Applied", description: `Subtracted ${cutValue} from all cells.` });
    setCuttingValue("");
  };

  const handleApplyLess = () => {
    const lessPercent = parseFloat(lessValue);
    if (isNaN(lessPercent) || lessPercent < 0 || lessPercent > 100) {
      toast({ title: "Invalid Input", description: "Please enter a valid percentage (0-100).", variant: "destructive" });
      return;
    }

    const newMasterData = { ...masterSheetData };
    Object.keys(newMasterData).forEach(key => {
      const cellValue = parseFloat(newMasterData[key]) || 0;
      if (cellValue !== 0) {
        const reduction = cellValue * (lessPercent / 100);
        newMasterData[key] = String(cellValue - reduction);
      }
    });
    setMasterSheetData(newMasterData);

    toast({ title: "Less Applied", description: `Subtracted ${lessPercent}% from all cells.` });
    setLessValue("");
  };

  const handleLogSelectionChange = (index: number) => {
    setSelectedLogIndices(prev =>
      prev.includes(index)
        ? prev.filter(i => i !== index)
        : [...prev, index]
    );
  };
  
  const handleGenerateSheet = () => {
    const valueToCells: { [value: string]: string[] } = {};

    for (let i = 1; i <= 100; i++) {
        const displayKey = i.toString().padStart(2, '0');
        const dataKey = i === 100 ? '00' : displayKey;
        const value = masterSheetData[dataKey];
        if (value && value.trim() !== '' && !isNaN(Number(value)) && Number(value) !== 0) {
            if (!valueToCells[value]) {
                valueToCells[value] = [];
            }
            valueToCells[value].push(displayKey);
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
    <div className="flex flex-col md:flex-row h-full w-full bg-background overflow-hidden">
      {/* Left side: Grid Area - Maximized to cover available space */}
      <div className="flex-1 p-2 md:p-4 overflow-auto bg-muted/5 flex items-start justify-center">
        <div className="grid-sheet-layout w-full h-full shadow-2xl border bg-card rounded-xl p-4 md:p-6">
            {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
                <React.Fragment key={`master-row-${rowIndex}`}>
                    {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                        const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
                        const displayKey = cellNumber.toString().padStart(2, '0');
                        const dataKey = cellNumber === 100 ? '00' : displayKey;
                        const hasValue = !!masterSheetData[dataKey];
                        return (
                            <div key={`master-cell-${dataKey}`} className={cn(
                                "relative flex items-center border rounded-md transition-all duration-200 min-h-[50px] md:min-h-[70px]",
                                hasValue ? "bg-primary/10 ring-1 ring-primary/20" : "bg-transparent"
                            )} style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                                <div className="absolute top-1 left-1.5 text-[0.7rem] md:text-[0.8rem] select-none pointer-events-none z-10 font-black opacity-50" style={{ color: 'var(--grid-cell-number-color)' }}>{displayKey}</div>
                                <div className="h-full w-full flex items-center justify-center font-black text-lg md:text-xl lg:text-2xl" style={{ color: 'var(--grid-cell-amount-color)' }}>
                                    {masterSheetData[dataKey] ? formatNumber(masterSheetData[dataKey]) : ''}
                                </div>
                            </div>
                        );
                    })}
                    <div className="flex items-center justify-center font-black border rounded-md bg-muted/20" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                        <span className="text-[0.8rem] md:text-base font-black" style={{ color: 'var(--grid-cell-total-color)' }}>
                            {masterSheetRowTotals[rowIndex] ? formatNumber(masterSheetRowTotals[rowIndex]) : ''}
                        </span>
                    </div>
                </React.Fragment>
            ))}
            {Array.from({ length: GRID_COLS }, (_, colIndex) => (
                <div key={`master-col-total-${colIndex}`} className="flex items-center justify-center font-black h-12 md:h-16 border rounded-md bg-muted/20" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                     <span className="text-[0.8rem] md:text-base font-black" style={{ color: 'var(--grid-cell-total-color)' }}>
                        {masterSheetColumnTotals[colIndex] ? formatNumber(masterSheetColumnTotals[colIndex]) : ''}
                    </span>
                </div>
            ))}
            <div className="flex items-center justify-center font-black text-xl md:text-2xl border rounded-md bg-primary/20" style={{ borderColor: 'var(--grid-cell-border-color)', color: 'var(--grid-cell-total-color)' }}>
                {formatNumber(masterSheetGrandTotal)}
            </div>
        </div>
      </div>

      {/* Right side: Optimized Sidebar - Always Visible */}
      <div className="w-full md:w-[360px] lg:w-[420px] border-l bg-card flex flex-col shadow-[-10px_0_30px_rgba(0,0,0,0.1)] z-10">
        <ScrollArea className="flex-1">
          <div className="p-4 md:p-6 space-y-6">
            {/* Adjustment Section */}
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                    <Settings2 className="h-5 w-5 text-primary" />
                    <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Adjustments</h3>
                </div>
                <Button onClick={() => setMasterSheetData(initialMasterData)} variant="outline" size="sm" className="h-8 text-[10px] uppercase font-black border-primary/20 text-primary hover:bg-primary/10">
                    <RotateCcw className="h-3 w-3 mr-1" /> Reset
                </Button>
              </div>
              
              <div className="grid gap-4">
                <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
                    <div className="flex items-center gap-3">
                        <Switch id="comm-less" checked={showCommissionLess} onCheckedChange={setShowCommissionLess} />
                        <Label htmlFor="comm-less" className="text-xs font-black uppercase tracking-tight">Commission Less</Label>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Cutting Value</Label>
                    <div className="flex gap-2">
                        <Input placeholder="0" className="h-12 font-black text-xl focus:ring-primary" value={cuttingValue} onChange={(e) => setCuttingValue(e.target.value)} />
                        <Button onClick={handleApplyCutting} className="h-12 px-6 font-black uppercase text-xs tracking-widest">Apply</Button>
                    </div>
                </div>

                <div className="space-y-2">
                    <Label className="text-[10px] font-black uppercase tracking-widest text-muted-foreground ml-1">Less Percentage (%)</Label>
                    <div className="flex gap-2">
                        <Input placeholder="0%" className="h-12 font-black text-xl focus:ring-primary" value={lessValue} onChange={(e) => setLessValue(e.target.value)} />
                        <Button onClick={handleApplyLess} className="h-12 px-6 font-black uppercase text-xs tracking-widest">Apply</Button>
                    </div>
                </div>
              </div>
            </div>

            {/* Performance Summary Section */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2">
                <Receipt className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Performance</h3>
              </div>
              
              <div className="rounded-2xl border bg-primary/5 p-6 space-y-6">
                <div className="grid grid-cols-2 gap-8">
                    <div className="space-y-1">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Original</p>
                        <p className="text-2xl font-black tracking-tighter">₹{formatNumber(initialGrandTotal)}</p>
                    </div>
                    <div className="space-y-1 text-right">
                        <p className="text-[10px] text-muted-foreground font-black uppercase tracking-widest">Adjusted</p>
                        <p className="text-2xl font-black tracking-tighter">₹{formatNumber(masterSheetGrandTotal)}</p>
                    </div>
                </div>
                <Separator className="bg-primary/20" />
                <div className="flex justify-between items-center bg-background/50 p-4 rounded-xl border-dashed border-2 border-primary/20">
                    <span className="text-[11px] font-black uppercase tracking-widest text-primary">Broker Profit</span>
                    <Badge className={cn(
                        "text-lg font-black py-2 px-6 rounded-full shadow-[0_5px_15px_rgba(var(--primary),0.2)]",
                        netProfit >= 0 ? "bg-primary text-primary-foreground" : "bg-destructive text-destructive-foreground"
                    )}>
                        {netProfit >= 0 ? "+" : ""}₹{formatNumber(netProfit)}
                    </Badge>
                </div>
              </div>
            </div>

            {/* Client Logs Section */}
            <div className="space-y-4">
               <div className="flex items-center gap-2 mb-2">
                <ListChecks className="h-5 w-5 text-primary" />
                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">Active Clients</h3>
              </div>
              
              <div className="space-y-3">
                  {currentLogs.length > 0 ? currentLogs.map((log, index) => (
                      <div key={log.id} className={cn(
                          "flex items-center justify-between p-4 rounded-xl border transition-all group",
                          selectedLogIndices.includes(index) ? "bg-card border-primary/40 shadow-md ring-1 ring-primary/10" : "bg-muted/10 opacity-50 border-transparent hover:opacity-100"
                      )}>
                          <div className="flex items-center gap-4 min-w-0">
                              <Checkbox
                                  id={`log-master-${index}`}
                                  checked={selectedLogIndices.includes(index)}
                                  onCheckedChange={() => handleLogSelectionChange(index)}
                                  className="h-6 w-6"
                              />
                              <label htmlFor={`log-master-${index}`} className="text-xs font-black truncate cursor-pointer uppercase tracking-tight">
                                {log.clientName}
                              </label>
                          </div>
                          <div className="flex items-center gap-3">
                              <span className="text-sm font-black tabular-nums">₹{formatNumber(log.gameTotal)}</span>
                              <Button variant="ghost" size="icon" className="h-9 w-9 opacity-0 group-hover:opacity-100 text-destructive transition-opacity" onClick={() => onDeleteLog(log.id, log.clientName)}>
                                  <Trash2 className="h-5 w-5" />
                              </Button>
                          </div>
                      </div>
                  )) : (
                      <div className="text-center py-20 text-muted-foreground/30 flex flex-col items-center gap-4">
                          <AlertCircle className="h-12 w-12" />
                          <p className="text-xs font-black uppercase tracking-widest">No Client Data Found</p>
                      </div>
                  )}
              </div>
            </div>
          </div>
        </ScrollArea>

        {/* Fixed Footer - High Performance Design */}
        <div className="p-4 md:p-6 border-t bg-card/90 backdrop-blur-md">
          <Button onClick={handleGenerateSheet} className="w-full h-16 text-base font-black uppercase tracking-[0.25em] shadow-[0_15px_30px_rgba(var(--primary),0.35)] hover:scale-[1.03] active:scale-95 transition-all rounded-2xl">
            <Download className="mr-3 h-6 w-6" /> Generate Master Sheet
          </Button>
        </div>
      </div>

      {/* Generated Sheet Dialog */}
      <Dialog open={isGeneratedSheetDialogOpen} onOpenChange={setIsGeneratedSheetDialogOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle className="text-3xl font-black uppercase tracking-tight">Export Master Sheet</DialogTitle>
            <DialogDescription className="text-xs uppercase font-bold tracking-widest text-primary font-mono">{props.draw} | {format(date, 'PPPP')}</DialogDescription>
          </DialogHeader>
          <div className="my-6">
            <Textarea readOnly value={generatedSheetContent} rows={18} className="bg-muted font-mono text-base leading-relaxed p-6 rounded-2xl border-none shadow-inner resize-none focus:ring-0" />
          </div>
          <DialogFooter className="sm:justify-between gap-4">
            <DialogClose asChild><Button variant="outline" className="h-14 px-10 font-black uppercase text-xs tracking-widest rounded-xl">Close</Button></DialogClose>
            <Button onClick={() => handleCopyToClipboard(generatedSheetContent)} className="h-14 px-10 font-black uppercase text-xs tracking-widest rounded-xl flex-1"><Copy className="mr-3 h-5 w-5" /> Copy Data To Clipboard</Button>
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
      setPreviousSheetState(null); // Clear previous state after reverting
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

          if(selectedClientId) {
            updateClientData(selectedClientId, newData);
          }

          setUpdatedCells(prev => [...prev, key]);
          setTimeout(() => setUpdatedCells(prev => prev.filter(c => c !== key)), 2000);
          toast({ title: "Sheet Updated", description: `Cell ${client.name} adjusted.` });
        }
      }
    },
    clearSheet: () => handleClearSheet(),
    getClientData: (clientId: string) => {
      return clientSheetData[clientId]?.data;
    },
    getClientCurrentData: (clientId: string) => {
        return clientSheetData[clientId]?.data;
    },
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

    if (selectedClientId) {
      updateClientData(selectedClientId, newData);
    }
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
    if (!selectedClientId || !props.savedSheetLog[props.draw]) {
      return [];
    }
    const dateStrToMatch = format(props.date, 'yyyy-MM-dd');
    return props.savedSheetLog[props.draw]
      .filter(log => log.clientId === selectedClientId && log.date === dateStrToMatch)
      .sort((a, b) => {
        if (a.createdAt && b.createdAt) {
          return b.createdAt.localeCompare(a.createdAt);
        }
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
      <Card className="h-full flex flex-col overflow-hidden">
        <CardContent className="p-1 md:p-2 flex-grow flex flex-col min-h-0">
          {isMobile ? (
            <Tabs defaultValue="grid" className="w-full flex flex-col min-h-0">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="grid" className="gap-1.5"><Grid className="h-4 w-4" /> Grid</TabsTrigger>
                <TabsTrigger value="entry" className="gap-1.5"><Edit className="h-4 w-4" /> Entry</TabsTrigger>
              </TabsList>
              <TabsContent value="grid" className="flex-grow min-h-0 mt-2">
                <div className="flex flex-col min-w-0 h-full">
                  <GridView
                    currentData={currentData}
                    updatedCells={updatedCells}
                    validations={validations}
                    handleCellChange={handleCellChange}
                    handleCellBlur={handleCellBlur}
                    isDataEntryDisabled={!selectedClientId}
                    showClientSelectionToast={showClientSelectionToast}
                  />
                </div>
              </TabsContent>
              <TabsContent value="entry" className="flex-grow min-h-0 mt-2">
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
            <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-2 flex-grow min-h-0">
              <div className="flex flex-col min-w-0">
                  <GridView
                    currentData={currentData}
                    updatedCells={updatedCells}
                    validations={validations}
                    handleCellChange={handleCellChange}
                    handleCellBlur={handleCellBlur}
                    isDataEntryDisabled={!selectedClientId}
                    showClientSelectionToast={showClientSelectionToast}
                  />
              </div>
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
        <DialogContent className="w-full h-[98vh] p-0 border-0 sm:max-w-[98vw] overflow-hidden flex flex-col rounded-none md:rounded-lg">
          <DialogHeader className="flex flex-row items-center justify-between px-6 py-4 border-b shrink-0 bg-card">
            <div className="flex items-center gap-6">
                <Button variant="ghost" size="icon" onClick={() => setIsMasterSheetDialogOpen(false)} className="h-10 w-10 hover:bg-muted/50 rounded-full">
                    <ArrowLeft className="h-6 w-6" />
                    <span className="sr-only">Back</span>
                </Button>
                <div>
                    <DialogTitle className="text-2xl font-black uppercase tracking-tight text-foreground">Master Summary</DialogTitle>
                    <p className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em]">{props.draw} | {format(props.date, 'PPPP')}</p>
                </div>
            </div>
            <div className="flex items-center gap-4">
                <Badge className="h-10 px-6 font-black bg-primary/20 text-primary border-primary/30 text-base uppercase tracking-widest">{props.draw}</Badge>
            </div>
          </DialogHeader>
           <div className="flex-1 overflow-hidden bg-background">
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
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the entry for <strong>{logToDelete?.name}</strong>?
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setLogToDelete(null)}>Cancel</Button>
            <Button variant="destructive" onClick={handleDeleteLogEntry}>Delete</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>


      <Dialog open={props.isLastEntryDialogOpen} onOpenChange={props.setIsLastEntryDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Last Processed Entry</DialogTitle>
          </DialogHeader>
          <div className="my-4">
            <Textarea
              readOnly
              value={props.lastEntry || "No entries yet."}
              rows={Math.min(15, (props.lastEntry || "").split('\n').length)}
              className="bg-muted font-mono"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild><Button variant="secondary">Close</Button></DialogClose>
             <Button onClick={() => navigator.clipboard.writeText(props.lastEntry)}>
                <Copy className="mr-2 h-4 w-4" /> Copy
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewEntryDialogOpen} onOpenChange={setIsViewEntryDialogOpen}>
        <DialogContent className="max-w-xl">
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
                                <Card key={entry.id} className="p-3 border-l-4 border-l-primary">
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
                                        <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => props.onDeleteLogEntry(entry.id)}>
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
                <Button variant="outline" onClick={() => setIsViewEntryDialogOpen(false)}>Close</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
});

GridSheet.displayName = 'GridSheet';

export default GridSheet;
