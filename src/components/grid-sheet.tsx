
"use client"
import React, { useState, useImperativeHandle, forwardRef, useRef, useCallback, useMemo } from "react"
import { useToast } from "@/hooks/use-toast"
import { validateCellContent, ValidateCellContentOutput } from "@/ai/flows/validate-cell-content"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Download, Plus, AlertCircle, Loader2, Trash2, Copy, X, Save, RotateCcw, Undo2, Eye, FileSpreadsheet, ArrowLeft, Grid, Edit, TrendingUp, TrendingDown } from "lucide-react"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Checkbox } from "@/components/ui/checkbox"
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose, DialogDescription, DialogTitle } from "@/components/ui/dialog"
import { format, isSameDay } from "date-fns"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Account } from "./accounts-manager";
import { formatNumber } from "@/lib/utils"
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
const DUMMY_ACCOUNTS = "Revenue, Expenses, Assets, Liabilities, Equity, COGS"
const DUMMY_RULES = "Cell content must be a number or a standard account name. If it's a number, it can be positive or negative."
const MAX_COMBINATIONS = 100;

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

    toast({ title: "Cutting Applied", description: `Subtracted ${cutValue} from all cells in the master sheet.` });
    setCuttingValue("");
  };

  const handleApplyLess = () => {
    const lessPercent = parseFloat(lessValue);
    if (isNaN(lessPercent) || lessPercent < 0 || lessPercent > 100) {
      toast({ title: "Invalid Input", description: "Please enter a valid percentage (0-100) for Less.", variant: "destructive" });
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

    toast({ title: "Less Applied", description: `Subtracted ${lessPercent}% from all cells in the master sheet.` });
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
    
    const fullContent = `${draw}\n${sheetBody}\n\n${totalString}`;

    setGeneratedSheetContent(fullContent);
    setIsGeneratedSheetDialogOpen(true);
    toast({ title: "Master Sheet Generated", description: "The multi-text area has been populated with the grid data." });
  };
  
  const handleCopyToClipboard = (content: string) => {
    navigator.clipboard.writeText(content).then(() => {
        toast({ title: "Copied to clipboard!" });
    }, (err) => {
        toast({ title: "Failed to copy", description: "Could not copy text to clipboard.", variant: "destructive" });
        console.error('Failed to copy: ', err);
    });
  };

  const masterSheetRowTotals = Array.from({ length: GRID_ROWS }, (_, rowIndex) => calculateRowTotal(rowIndex, masterSheetData));
  const masterSheetColumnTotals = Array.from({ length: GRID_COLS }, (_, colIndex) => calculateColumnTotal(colIndex, masterSheetData));
  
 return (
    <>
    <div className="flex h-full flex-col gap-4 bg-background p-1 md:p-4 pb-4">
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto] gap-4 w-full flex-grow items-stretch">
        <div className="flex flex-col min-w-0">
            <div className="grid-sheet-layout h-full w-full">
                {Array.from({ length: GRID_ROWS }, (_, rowIndex) => (
                    <React.Fragment key={`master-row-${rowIndex}`}>
                        {Array.from({ length: GRID_COLS }, (_, colIndex) => {
                            const cellNumber = rowIndex * GRID_COLS + colIndex + 1;
                            const displayKey = cellNumber.toString().padStart(2, '0');
                            const dataKey = cellNumber === 100 ? '00' : displayKey;
                            return (
                                <div key={`master-cell-${dataKey}`} className="relative flex items-center border rounded-sm grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                                    <div className="absolute top-0.5 left-1 text-[0.6rem] sm:top-1 sm:left-1.5 sm:text-xs select-none pointer-events-none z-10 grid-cell-number font-bold" style={{ color: 'var(--grid-cell-number-color)' }}>{displayKey}</div>
                                    <Input
                                        type="text"
                                        readOnly
                                        className="p-0 h-full w-full text-center bg-transparent border-0 focus:ring-0 font-bold grid-cell-input transition-colors duration-300"
                                        value={masterSheetData[dataKey] ? formatNumber(masterSheetData[dataKey]) : ''}
                                        aria-label={`Cell ${displayKey}`}
                                        style={{ color: 'var(--grid-cell-amount-color)' }}
                                    />
                                </div>
                            );
                        })}
                        <div className="flex items-center justify-center font-medium border rounded-sm bg-transparent grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                            <span className="font-medium text-center h-full w-full p-1 border-0 focus:ring-0 bg-transparent grid-cell-total flex items-center justify-center" style={{ color: 'var(--grid-cell-total-color)' }}>
                                {masterSheetRowTotals[rowIndex] ? formatNumber(masterSheetRowTotals[rowIndex]) : ''}
                            </span>
                        </div>
                    </React.Fragment>
                ))}
                {Array.from({ length: GRID_COLS }, (_, colIndex) => (
                    <div key={`master-col-total-${colIndex}`} className="flex items-center justify-center font-medium p-0 h-full border rounded-sm bg-transparent grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)' }}>
                         <span className="font-medium text-center h-full w-full p-1 border-0 focus:ring-0 bg-transparent grid-cell-total flex items-center justify-center" style={{ color: 'var(--grid-cell-total-color)' }}>
                            {masterSheetColumnTotals[colIndex] ? formatNumber(masterSheetColumnTotals[colIndex]) : ''}
                        </span>
                    </div>
                ))}
                <div className="flex items-center justify-center font-bold text-lg border rounded-sm grid-cell" style={{ borderColor: 'var(--grid-cell-border-color)', color: 'var(--grid-cell-total-color)' }}>
                    {formatNumber(masterSheetGrandTotal)}
                </div>
            </div>
        </div>
        <div className="flex flex-col gap-4 w-full lg:w-[320px] xl:w-[360px] flex-shrink-0">
          <div className="border rounded-lg p-3 flex flex-col gap-3 bg-card">
              <h3 className="font-semibold text-sm text-card-foreground">Manual Controls</h3>
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                    <Switch id="commission-less-switch" checked={showCommissionLess} onCheckedChange={setShowCommissionLess} />
                    <Label htmlFor="commission-less-switch">Show Commission Less</Label>
                </div>
                <Button onClick={() => setMasterSheetData(initialMasterData)} size="sm" variant="outline"><RotateCcw className="h-3 w-3 mr-2" /> Reset</Button>
              </div>
              <Separator />
              <div className="flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                      <Label htmlFor="master-cutting" className="text-sm text-card-foreground w-16">Cutting</Label>
                      <Input id="master-cutting" placeholder="Value" className="text-sm h-8 text-center flex-grow" value={cuttingValue} onChange={(e) => setCuttingValue(e.target.value)} />
                      <Button onClick={handleApplyCutting} size="sm" className="h-8">Apply</Button>
                  </div>
                  <div className="flex items-center gap-2">
                      <Label htmlFor="master-less" className="text-sm text-card-foreground w-16">Less (%)</Label>
                      <Input id="master-less" placeholder="Value" className="text-sm h-8 text-center flex-grow" value={lessValue} onChange={(e) => setLessValue(e.target.value)} />
                      <Button onClick={handleApplyLess} size="sm" className="h-8">Apply</Button>
                  </div>
                  <div className="flex items-center gap-2">
                      <Label htmlFor="master-dabba" className="text-sm text-card-foreground w-16">Dabba</Label>
                      <Input id="master-dabba" placeholder="Value" className="text-sm h-8 text-center flex-grow" value={dabbaValue} onChange={(e) => setDabbaValue(e.target.value)} />
                      <Button size="sm" className="h-8">Apply</Button>
                  </div>
              </div>
              <Separator />
                <div className="p-2 bg-muted/50 rounded-lg">
                    <h4 className="text-xs font-semibold text-center mb-2">Profit/Loss Summary</h4>
                    <div className="space-y-1 text-xs">
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Original Total</span>
                            <span className="font-mono font-semibold">₹{formatNumber(initialGrandTotal)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">Adjusted Total</span>
                            <span className="font-mono font-semibold">₹{formatNumber(masterSheetGrandTotal)}</span>
                        </div>
                        <Separator className="my-1" />
                        <div className="flex justify-between items-center text-sm">
                            <span className="font-bold">Net Profit/Loss</span>
                            <span className={`font-mono font-bold ${netProfit >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                              {netProfit >= 0 ? `+₹${formatNumber(netProfit)}` : `-₹${formatNumber(Math.abs(netProfit))}`}
                            </span>
                        </div>
                    </div>
                </div>
          </div>
          

          <Card className="flex flex-col flex-grow bg-card min-h-0">
              <CardHeader className="p-3">
                  <CardTitle className="text-sm">Client Entries for {format(date, 'PPP')}</CardTitle>
              </CardHeader>
              <CardContent className="p-3 flex-grow min-h-0">
                  <ScrollArea className="h-full">
                      <div className="space-y-2 pr-2">
                          {currentLogs.length > 0 ? currentLogs.map((log, index) => (
                              <div key={log.id} className="flex justify-between items-center p-2 rounded-md bg-muted text-sm group">
                                  <div className="flex items-center gap-2">
                                      <Checkbox
                                          id={`log-${draw}-${index}`}
                                          checked={selectedLogIndices.includes(index)}
                                          onCheckedChange={() => handleLogSelectionChange(index)}
                                          className="border-primary"
                                      />
                                      <label htmlFor={`log-${draw}-${index}`} className="cursor-pointer text-muted-foreground">{index + 1}. {log.clientName}</label>
                                  </div>
                                  <div className="flex items-center gap-2">
                                      <span className="font-mono font-semibold text-foreground">₹{formatNumber(log.gameTotal)}</span>
                                       <Button
                                          variant="ghost"
                                          size="icon"
                                          className="h-6 w-6 opacity-0 group-hover:opacity-100 text-destructive hover:text-destructive"
                                          onClick={() => onDeleteLog(log.id, log.clientName)}
                                        >
                                          <Trash2 className="h-4 w-4" />
                                          <span className="sr-only">Delete Log</span>
                                        </Button>
                                  </div>
                              </div>
                          )) : (
                              <div className="text-center text-muted-foreground italic h-full flex items-center justify-center">No logs for this draw on this date.</div>
                          )}
                      </div>
                  </ScrollArea>
              </CardContent>
          </Card>
          
          <Button onClick={handleGenerateSheet} variant="outline">
            <Download className="mr-2 h-4 w-4"/> Generate & Download Report
          </Button>
        </div>
      </div>
    </div>
     <Dialog open={isGeneratedSheetDialogOpen} onOpenChange={setIsGeneratedSheetDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Generated Master Sheet Content</DialogTitle>
          </DialogHeader>
          <div className="my-4">
            <Textarea
              readOnly
              value={generatedSheetContent}
              rows={Math.min(15, generatedSheetContent.split('\n').length)}
              className="bg-muted"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
            <Button onClick={() => handleCopyToClipboard(generatedSheetContent)}>
              <Copy className="mr-2 h-4 w-4" />
              Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
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
        toast({ title: "Sheet Updated", description: `${updatedKeys.length} cell(s) have been updated.` });
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
          toast({ title: "Sheet Updated by Client", description: `Cell ${client.name} value multiplied by commission ${client.comm}.` });
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
    if (!selectedClientId) return;

    const cellContent = currentData[key]

    if (!cellContent || cellContent.trim() === "") {
      const newValidations = {...validations};
      delete newValidations[key];
      setValidations(newValidations);
      return;
    }

    setValidations(prev => ({ ...prev, [key]: { isValid: true, recommendation: '', isLoading: true } }))

    try {
      const result: ValidateCellContentOutput = await validateCellContent({
        cellContent,
        validationRules: DUMMY_RULES,
        commonlyUsedAccountNames: DUMMY_ACCOUNTS,
      })
      setValidations(prev => ({ ...prev, [key]: { ...result, isLoading: false } }))
    } catch (error) {
      // AI errors are handled silently to avoid blocking the user experience when API keys are missing.
      setValidations(prev => ({ ...prev, [key]: { isValid: true, recommendation: '', isLoading: false } }))
    }
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
        description: `This entry of ${formatNumber(entryTotal)} exceeds the remaining balance of ${formatNumber(remainingBalance)}.`,
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
    toast({ title: "Sheet Cleared", description: "All cell values for the current view have been reset." });
  };
  
  const handleSaveSheet = () => {
    if (!selectedClientId) {
      toast({
        title: "No Client Selected",
        description: "Please select a client to save their sheet.",
        variant: "destructive",
      });
      return;
    }
    
    const newEntries = { ...(clientSheetData[selectedClientId]?.data || {}) };
    
    if (Object.keys(newEntries).length === 0) {
      toast({
        title: "No Data to Save",
        description: "The sheet is empty. Please enter some data before saving.",
        variant: "destructive",
      });
      return;
    }
    
    const clientName = props.clients.find(c => c.id === selectedClientId)?.name || "Unknown Client";
    
    props.onClientSheetSave(clientName, selectedClientId, newEntries, props.draw, props.date, currentRawInput);
    
    updateClientData(selectedClientId, {});
    setCurrentRawInput("");
    setPreviousSheetState(null);
    focusMultiText();
  };
  
  const handleDeleteLogEntry = () => {
    if (logToDelete) {
        deleteSheetLogEntry(logToDelete.id);
        toast({ title: "Log Deleted", description: `The entry for ${logToDelete.name} has been deleted.` });
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
        // Fallback for entries without a createdAt timestamp
        return b.id.localeCompare(a.id);
      });
  }, [selectedClientId, props.savedSheetLog, props.draw, props.date]);


  const getClientDisplay = (client: Client) => {
    const dateStr = props.date.toISOString().split('T')[0];
    const clientLogs = (props.savedSheetLog[props.draw] || []).filter(log => log.clientId === client.id && log.date === dateStr);
    const totalAmount = clientLogs.reduce((sum, log) => sum + log.gameTotal, 0);
    return `${client.name} - ${formatNumber(totalAmount)}`;
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
        <DialogContent className="w-full h-full p-0 border-0 sm:max-w-none">
          <DialogHeader className="flex-row items-center p-4 border-b">
            <Button variant="ghost" size="icon" onClick={() => setIsMasterSheetDialogOpen(false)} className="mr-2">
                <ArrowLeft className="h-4 w-4" />
                <span className="sr-only">Back</span>
            </Button>
            <DialogTitle>Master Sheet : {props.draw}</DialogTitle>
          </DialogHeader>
           <MasterSheetViewer 
             allSavedLogs={props.savedSheetLog}
             draw={props.draw}
             date={props.date}
             clients={props.clients}
             onDeleteLog={(id, name) => setLogToDelete({ id, name })}
           />
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!logToDelete} onOpenChange={() => setLogToDelete(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Log Entry?</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the sheet for <strong>{logToDelete?.name}</strong>? This action cannot be undone.
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
            <DialogTitle>Last Entry</DialogTitle>
          </DialogHeader>
          <div className="my-4">
            <Textarea
              readOnly
              value={props.lastEntry || "No entries yet."}
              rows={Math.min(15, (props.lastEntry || "").split('\n').length)}
              className="bg-muted"
            />
          </div>
          <DialogFooter className="sm:justify-between">
            <DialogClose asChild>
              <Button type="button" variant="secondary">
                Close
              </Button>
            </DialogClose>
             <Button onClick={() => navigator.clipboard.writeText(props.lastEntry)}>
                <Copy className="mr-2 h-4 w-4" />
                Copy to Clipboard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={isViewEntryDialogOpen} onOpenChange={setIsViewEntryDialogOpen}>
        <DialogContent className="max-w-xl">
            <DialogHeader>
                <DialogTitle>
                    Entries for {props.clients.find(c => c.id === selectedClientId)?.name}
                </DialogTitle>
                <DialogDescription>
                    Draw: {props.draw} | Date: {format(props.date, 'PPP')}
                </DialogDescription>
            </DialogHeader>
            <div className="my-4">
                <ScrollArea className="max-h-[60vh]">
                    <div className="space-y-2 pr-4">
                        {clientEntries.length > 0 ? (
                            clientEntries.map((entry, index) => (
                                <Card key={entry.id} className="p-3">
                                    <div className="flex justify-between items-center">
                                        <div>
                                            <p className="font-semibold">
                                                Entry {clientEntries.length - index}: 
                                                <span className="font-mono text-primary ml-2">₹{formatNumber(entry.gameTotal)}</span>
                                            </p>
                                            <p className="text-xs text-muted-foreground whitespace-pre-wrap">
                                                {entry.rawInput || Object.entries(entry.data).map(([k, v]) => `${k}=${v}`).join(', ')}
                                            </p>
                                        </div>
                                        <Button variant="ghost" size="icon" className="text-destructive" onClick={() => props.onDeleteLogEntry(entry.id)}>
                                            <Trash2 className="h-4 w-4" />
                                        </Button>
                                    </div>
                                </Card>
                            ))
                        ) : (
                            <p className="text-center text-muted-foreground py-8">No entries saved for this client today.</p>
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
