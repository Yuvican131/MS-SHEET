
"use client"

import { useState, useRef, useEffect, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GridSheet from "@/components/grid-sheet"
import ClientsManager from "@/components/clients-manager"
import AccountsManager, { Account, DrawData } from "@/components/accounts-manager"
import LedgerRecord from "@/components/ledger-record"
import AdminPanel from "@/components/admin-panel"
import { Users, Building, ArrowLeft, Calendar as CalendarIcon, History, FileSpreadsheet, Shield, PlusCircle, Trash2, X, RotateCw, Megaphone, ArrowUpRight, Sun, Moon } from 'lucide-react';
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, isSameDay, startOfDay, subDays, compareAsc } from "date-fns"
import { cn } from "@/lib/utils"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Badge } from "@/components/ui/badge"
import { useToast } from "@/hooks/use-toast"
import { useClients } from "@/hooks/useClients"
import { useSheetLog, type SavedSheetInfo } from "@/hooks/useSheetLog"
import { useDeclaredNumbers } from "@/hooks/useDeclaredNumbers"
import type { Client } from "@/hooks/useClients"
import { useUser } from "@/firebase"
import { initiateAnonymousSignIn } from "@/firebase/non-blocking-login"
import { useAuth } from "@/firebase"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import type { Settlement } from "@/components/admin-panel";

function GridIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M7 3v18" />
      <path d="M3 7h18" />
      <path d="M12 3v18" />
      <path d="M3 12h18" />
      <path d="M17-3v18" />
      <path d="M3 17h18" />
    </svg>
  )
}

const draws = ["DD", "ML", "FB", "GB", "GL", "DS"];
type ActiveSheet = {
    draw: string;
    date: Date;
};


export default function Home() {
  const gridSheetRef = useRef<{ handleClientUpdate: (client: Client) => void; clearSheet: () => void; getClientData: (clientId: string) => any, getClientCurrentData: (clientId: string) => any | undefined, getClientPreviousData: (clientId: string) => any | undefined }>(null);
  const [selectedDraw, setSelectedDraw] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
  const [lastEntry, setLastEntry] = useState('');
  const [isLastEntryDialogOpen, setIsLastEntryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sheet");

  const [declarationDraw, setDeclarationDraw] = useState("");
  const [declarationNumber, setDeclarationNumber] = useState("");
  const [isDeclarationDialogOpen, setIsDeclarationDialogOpen] = useState(false);
  const { toast } = useToast();
  
  const auth = useAuth();
  const { user, isUserLoading } = useUser();
  const isMobile = useIsMobile();
  const { theme, setTheme } = useTheme();

  const { clients, addClient, updateClient, deleteClient, handleClientTransaction, clearClientData } = useClients(user?.uid);
  const { savedSheetLog, addSheetLogEntry, deleteSheetLogsForDraw, deleteSheetLogEntry } = useSheetLog(user?.uid);
  const { declaredNumbers, setDeclaredNumber, removeDeclaredNumber, getDeclaredNumber } = useDeclaredNumbers(user?.uid);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [drawToDelete, setDrawToDelete] = useState<{ draw: string; date: Date } | null>(null);
  
  const [formSelectedDraw, setFormSelectedDraw] = useState<string | null>(null);
  const [activeSheets, setActiveSheets] = useState<ActiveSheet[]>([]);
  const [formSelectedDate, setFormSelectedDate] = useState<Date>(new Date());
  
  const [settlements, setSettlements] = useState<{ [key: string]: Settlement[] }>({});

  useEffect(() => {
    try {
      const savedSettlements = localStorage.getItem('brokerSettlements');
      if (savedSettlements) {
        const parsedSettlements = JSON.parse(savedSettlements);
        const firstKey = Object.keys(parsedSettlements)[0];
        if (firstKey && Array.isArray(parsedSettlements[firstKey])) {
           setSettlements(parsedSettlements);
        }
      }
    } catch (error) {
      console.error("Failed to parse settlements from localStorage", error);
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('brokerSettlements', JSON.stringify(settlements));
  }, [settlements]);

  useEffect(() => {
    if (!isUserLoading && !user) {
      initiateAnonymousSignIn(auth);
    }
  }, [isUserLoading, user, auth]);
  
  useEffect(() => {
    const uniqueSheetKeys = new Set<string>();
    const sheetsFromLogs: ActiveSheet[] = [];

    // Add sheets from saved logs first
    Object.values(savedSheetLog).flat().forEach(log => {
      const key = `${log.draw}-${log.date}`;
      if (!uniqueSheetKeys.has(key)) {
        uniqueSheetKeys.add(key);
        const dateParts = log.date.split('-').map(Number);
        const logDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        sheetsFromLogs.push({ draw: log.draw, date: logDate });
      }
    });

    // Combine with manually added sheets, ensuring no duplicates
    const allSheets = [...sheetsFromLogs];
    activeSheets.forEach(manualSheet => {
        const key = `${manualSheet.draw}-${format(manualSheet.date, 'yyyy-MM-dd')}`;
        if (!uniqueSheetKeys.has(key)) {
            uniqueSheetKeys.add(key);
            allSheets.push(manualSheet);
        }
    });

    const drawOrder = ["DD", "ML", "FB", "GB", "GL", "DS"];
    allSheets.sort((a, b) => {
        const dateComparison = b.date.getTime() - a.date.getTime();
        if (dateComparison !== 0) {
            return dateComparison;
        }
        return drawOrder.indexOf(a.draw) - drawOrder.indexOf(b.draw);
    });

    setActiveSheets(allSheets);
  }, [savedSheetLog]);


  const updateAccountsFromLog = useCallback(() => {
    const dateForCalc = selectedDate || new Date();
    const allLogs = Object.values(savedSheetLog).flat();
  
    const newAccounts = clients.map(client => {
      const clientCommissionPercent = parseFloat(client.comm) / 100;
      const passingMultiplier = parseFloat(client.pair) || 80;
  
      const logsByDate: { [date: string]: SavedSheetInfo[] } = {};
      allLogs
        .filter(log => log.clientId === client.id)
        .forEach(log => {
          const dateStr = log.date;
          if (!logsByDate[dateStr]) {
            logsByDate[dateStr] = [];
          }
          logsByDate[dateStr].push(log);
        });
  
      const sortedDates = Object.keys(logsByDate).sort((a, b) => compareAsc(new Date(a), new Date(b)));
      
      let runningBalance = client.activeBalance || 0;
      const selectedDayStart = startOfDay(dateForCalc);
  
      for (const dateStr of sortedDates) {
        const logDate = startOfDay(new Date(dateStr));
        
        if (logDate < selectedDayStart) {
          const logsForDay = logsByDate[dateStr];
          let dailyNetResult = 0;
  
          for (const log of logsForDay) {
            const declaredNumberForLogDate = getDeclaredNumber(log.draw, logDate);
            const passingAmountInLog = declaredNumberForLogDate ? parseFloat(log.data[declaredNumberForLogDate] || "0") : 0;
            
            const gameTotal = log.gameTotal;
            const commission = gameTotal * clientCommissionPercent;
            const netFromGames = gameTotal - commission;
            const winnings = passingAmountInLog * passingMultiplier;
            dailyNetResult += (netFromGames - winnings);
          }
          runningBalance += dailyNetResult;
        }
      }
  
      const openingBalanceForSelectedDay = runningBalance;
      
      const updatedDrawsForSelectedDay: { [key: string]: DrawData } = {};
      const logsForSelectedDay = logsByDate[format(dateForCalc, 'yyyy-MM-dd')] || [];
  
      let netResultForSelectedDay = 0;
      
      draws.forEach(drawName => {
        const clientLogsForSelectedDay = logsForSelectedDay.filter(log => log.draw === drawName);
        let totalAmountForDraw = 0;
        let passingAmountForDraw = 0;

        clientLogsForSelectedDay.forEach(log => {
          const declaredNumberForSelectedDay = getDeclaredNumber(drawName, dateForCalc);
          const passingAmountInLog = declaredNumberForSelectedDay ? parseFloat(log.data[declaredNumberForSelectedDay] || "0") : 0;

          totalAmountForDraw += log.gameTotal;
          passingAmountForDraw += passingAmountInLog;
        });

        if (totalAmountForDraw > 0) {
            const commissionOnDay = totalAmountForDraw * clientCommissionPercent;
            const netFromGamesOnDay = totalAmountForDraw - commissionOnDay;
            const winningsOnDay = passingAmountForDraw * passingMultiplier;
            netResultForSelectedDay += (netFromGamesOnDay - winningsOnDay);
        }

        updatedDrawsForSelectedDay[drawName] = { totalAmount: totalAmountForDraw, passingAmount: passingAmountForDraw };
      });
      
      const closingBalance = openingBalanceForSelectedDay + netResultForSelectedDay;
  
      return {
        id: client.id,
        clientName: client.name,
        balance: closingBalance,
        openingBalance: openingBalanceForSelectedDay,
        draws: updatedDrawsForSelectedDay,
      };
    });
  
    setAccounts(newAccounts);
  }, [clients, savedSheetLog, getDeclaredNumber, selectedDate]);


  useEffect(() => {
    updateAccountsFromLog();
  }, [updateAccountsFromLog]);


  const handleClientUpdateForSheet = (client: Client) => {
    if (gridSheetRef.current) {
      gridSheetRef.current.handleClientUpdate(client);
    }
  };
  
  const handleAddSheet = () => {
    if(formSelectedDraw && formSelectedDate) {
        // Create date in UTC to match how log dates are handled
        const utcDate = new Date(Date.UTC(formSelectedDate.getFullYear(), formSelectedDate.getMonth(), formSelectedDate.getDate()));
        const newSheet: ActiveSheet = { draw: formSelectedDraw, date: utcDate };

        const sheetExists = activeSheets.some(s => s.draw === newSheet.draw && isSameDay(s.date, newSheet.date));

        if (!sheetExists) {
            setActiveSheets(prev => [newSheet, ...prev].sort((a, b) => {
                 const dateComparison = b.date.getTime() - a.date.getTime();
                if (dateComparison !== 0) return dateComparison;
                const drawOrder = ["DD", "ML", "FB", "GB", "GL", "DS"];
                return drawOrder.indexOf(a.draw) - drawOrder.indexOf(b.draw);
            }));
        }
    }
  };

  const handleOpenSheet = (sheet: ActiveSheet) => {
    setSelectedDraw(sheet.draw);
    setSelectedDate(sheet.date);
  };
  
  const handleBackToDraws = () => {
    setSelectedDraw(null);
  };
  
  const handleClientSheetSave = (clientName: string, clientId: string, newData: { [key: string]: string }, draw: string, date: Date, rawInput?: string) => {
    const todayStr = date.toISOString().split('T')[0];
  
    const newEntryTotal = Object.values(newData).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
  
    if (newEntryTotal === 0) {
      toast({
        title: "No Data to Save",
        description: "The sheet is empty.",
        variant: "destructive"
      });
      return;
    }
  
    const newEntry: Omit<SavedSheetInfo, 'id'> = {
      clientName,
      clientId,
      gameTotal: newEntryTotal,
      data: newData,
      date: todayStr,
      draw,
      rawInput: rawInput || "Manual Grid Update",
      createdAt: new Date().toISOString(),
    };
  
    addSheetLogEntry(newEntry);
  
    toast({
      title: "Sheet Saved",
      description: `${clientName}'s data has been logged.`,
    });
  };
  
  const handleDeclareOrUndeclare = () => {
    const dateToUse = selectedDate || new Date();
    if (declarationNumber.length === 2) {
      setDeclaredNumber(declarationDraw, declarationNumber, dateToUse);
      toast({ title: "Success", description: `Result processed for draw ${declarationDraw}.` });
    }
    setIsDeclarationDialogOpen(false);
    setDeclarationNumber("");
  };
  
  const handleUndeclare = () => {
    const dateToUse = selectedDate || new Date();
    removeDeclaredNumber(declarationDraw, dateToUse);
    toast({ title: "Success", description: `Result undeclared for draw ${declarationDraw}.` });
    setIsDeclarationDialogOpen(false);
    setDeclarationNumber("");
  };

  const handleDeleteDrawSheets = () => {
    if (drawToDelete && user?.uid) {
        deleteSheetLogsForDraw(drawToDelete.draw, drawToDelete.date);
        removeDeclaredNumber(drawToDelete.draw, drawToDelete.date);
        setActiveSheets(prev => prev.filter(s => !(s.draw === drawToDelete.draw && isSameDay(s.date, drawToDelete.date))));
    }
    setDrawToDelete(null);
  };
  
  const TabListContent = () => (
    <TabsList className="grid w-full grid-cols-5 md:w-auto md:grid-cols-5 border-none p-0">
      <TabsTrigger value="sheet" className="gap-1.5 h-14 md:h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
        <GridIcon className="h-5 w-5 md:h-4 md:w-4" />
        <span className="hidden md:inline">Home</span>
      </TabsTrigger>
      <TabsTrigger value="clients" className="gap-1.5 h-14 md:h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
        <Users className="h-5 w-5 md:h-4 md:w-4" />
        <span className="hidden md:inline">CLIENTS</span>
      </TabsTrigger>
      <TabsTrigger value="accounts" className="gap-1.5 h-14 md:h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
        <Building className="h-5 w-5 md:h-4 md:w-4" />
        <span className="hidden md:inline">ACCOUNT LEDGER</span>
      </TabsTrigger>
      <TabsTrigger value="ledger-record" className="gap-1.5 h-14 md:h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
        <FileSpreadsheet className="h-5 w-5 md:h-4 md:w-4" />
        <span className="hidden md:inline">Client Performance</span>
      </TabsTrigger>
      <TabsTrigger value="admin-panel" className="gap-1.5 h-14 md:h-auto rounded-none border-b-2 border-transparent data-[state=active]:border-primary">
        <Shield className="h-5 w-5 md:h-4 md:w-4" />
        <span className="hidden md:inline">Admin Panel</span>
      </TabsTrigger>
    </TabsList>
  );

  if (isUserLoading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  const isSheetAlreadyAdded = formSelectedDraw ? activeSheets.some(s => s.draw === formSelectedDraw && isSameDay(s.date, formSelectedDate)) : false;


  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <main className="flex-1 p-2 md:p-4 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-2 flex-wrap gap-2">
            <div className="flex items-center flex-grow">
              {isMobile ? (
                  <ScrollArea className="w-full whitespace-nowrap">
                      <TabListContent />
                  </ScrollArea>
              ) : (
                  <TabListContent />
              )}
            </div>
               <div className="flex items-center gap-4">
                <div className="flex items-center space-x-2">
                  <Sun className="h-5 w-5" />
                  <Switch
                    checked={theme === 'dark'}
                    onCheckedChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
                    id="theme-switch"
                  />
                  <Moon className="h-5 w-5" />
                </div>

               {selectedDraw && activeTab === 'sheet' && (
                 <div className="flex items-center">
                    <Button onClick={handleBackToDraws} variant="ghost" className="ml-2">
                      <ArrowLeft className="mr-2 h-4 w-4" />
                      Back to Home
                    </Button>
                    <Button onClick={() => setIsLastEntryDialogOpen(true)} variant="outline" size="sm" className="ml-2">
                        <History className="mr-2 h-4 w-4" />
                        Last Entry
                    </Button>
                </div>
              )}
            </div>
          </div>
          <TabsContent value="sheet" className="flex-1 flex flex-col min-h-0">
            {selectedDraw && selectedDate ? (
              <GridSheet 
                ref={gridSheetRef} 
                draw={selectedDraw} 
                date={selectedDate} 
                lastEntry={lastEntry} 
                setLastEntry={setLastEntry} 
                isLastEntryDialogOpen={isLastEntryDialogOpen} 
                setIsLastEntryDialogOpen={setIsLastEntryDialogOpen}
                clients={clients}
                onClientSheetSave={handleClientSheetSave}
                savedSheetLog={savedSheetLog}
                accounts={accounts}
                draws={draws}
                onDeleteLogEntry={deleteSheetLogEntry}
              />
            ) : (
              <div className="flex flex-col items-center justify-start w-full h-full pt-8 space-y-8">
                <div className="w-full max-w-2xl">
                    <Card>
                        <CardHeader>
                            <CardTitle>Create or Open a Sheet</CardTitle>
                        </CardHeader>
                        <CardContent>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label htmlFor="form-draw-select">Select a Draw</Label>
                                    <Select onValueChange={setFormSelectedDraw} value={formSelectedDraw || undefined}>
                                        <SelectTrigger id="form-draw-select">
                                            <SelectValue placeholder="Select Draw..." />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {draws.map(draw => (
                                                <SelectItem key={draw} value={draw}>{draw}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                  <Label>Pick a date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button
                                                variant={"outline"}
                                                className={cn(
                                                    "w-full justify-start text-left font-normal",
                                                    !formSelectedDate && "text-muted-foreground"
                                                )}
                                            >
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formSelectedDate ? format(formSelectedDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar
                                                mode="single"
                                                selected={formSelectedDate}
                                                onSelect={(date) => date && setFormSelectedDate(date)}
                                                initialFocus
                                            />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div className="mt-4">
                                <Button onClick={handleAddSheet} className="w-full" disabled={!formSelectedDraw || !formSelectedDate || isSheetAlreadyAdded}>
                                  <PlusCircle className="mr-2 h-4 w-4" /> Add Sheet
                                </Button>
                            </div>
                            {isSheetAlreadyAdded && (
                              <p className="text-sm text-center text-muted-foreground pt-2">This sheet has already been added.</p>
                            )}
                        </CardContent>
                    </Card>
                </div>

                <div className="w-full max-w-2xl">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-lg font-semibold text-foreground">Recent Sheets</h2>
                  </div>

                  <div className="space-y-3">
                    {activeSheets.map((sheet, index) => {
                      const declaredNumber = getDeclaredNumber(sheet.draw, sheet.date);
                      return (
                      <Card 
                        key={index} 
                        className="flex items-center justify-between p-3 transition-colors hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => handleOpenSheet(sheet)}>
                           <div className="flex items-center justify-center h-10 w-10 rounded-full border-2 border-primary text-primary font-bold text-lg">
                              {sheet.draw}
                           </div>
                           <div>
                              <p className="font-semibold text-foreground">Draw: {sheet.draw}</p>
                              <p className="text-sm text-muted-foreground">{format(sheet.date, "dd-MM-yyyy")}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div 
                            className="flex items-center justify-center cursor-pointer"
                            onClick={() => { setDeclarationDraw(sheet.draw); setSelectedDate(sheet.date); setIsDeclarationDialogOpen(true); }}
                          >
                           {declaredNumber ? (
                              <Badge variant="secondary" className="text-lg h-9 w-12 flex items-center justify-center font-bold border-2 border-primary text-primary">
                                {declaredNumber}
                              </Badge>
                           ) : (
                             <Button 
                               variant="ghost" 
                               size="icon" 
                               className="text-muted-foreground hover:text-primary">
                               <Megaphone className="h-5 w-5" />
                             </Button>
                           )}
                          </div>
                           <Button variant="outline" className="text-primary border-primary hover:bg-primary hover:text-primary-foreground" onClick={() => handleOpenSheet(sheet)}>
                              Open <ArrowUpRight className="ml-2 h-4 w-4" />
                           </Button>
                           <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDrawToDelete({ draw: sheet.draw, date: sheet.date }) }}>
                              <Trash2 className="h-4 w-4" />
                           </Button>
                        </div>
                      </Card>
                    )})}
                  </div>
                </div>

              </div>
            )}
          </TabsContent>
          <TabsContent value="clients">
            <ClientsManager 
              clients={clients} 
              accounts={accounts}
              onAddClient={addClient} 
              onUpdateClient={updateClient} 
              onDeleteClient={deleteClient}
              onClientTransaction={handleClientTransaction}
              onClearClientData={clearClientData}
            />
          </TabsContent>
          <TabsContent value="accounts">
            <AccountsManager 
              accounts={accounts} 
              clients={clients} 
              setAccounts={setAccounts} 
              selectedDate={selectedDate}
              getDeclaredNumber={getDeclaredNumber}
            />
          </TabsContent>
           <TabsContent value="ledger-record">
            <LedgerRecord clients={clients} savedSheetLog={savedSheetLog} draws={draws} declaredNumbers={declaredNumbers} />
          </TabsContent>
          <TabsContent value="admin-panel">
            <AdminPanel 
              userId={user?.uid} 
              clients={clients} 
              savedSheetLog={savedSheetLog}
              settlements={settlements}
              setSettlements={setSettlements}
            />
          </TabsContent>
        </Tabs>
      </main>

       <Dialog open={isDeclarationDialogOpen} onOpenChange={setIsDeclarationDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Declare Result for Draw {declarationDraw}</DialogTitle>
          </DialogHeader>
          <div className="my-4 space-y-4">
             <Label htmlFor="declaration-number">Enter 2-digit number</Label>
             <Input 
                id="declaration-number"
                value={declarationNumber}
                onChange={(e) => setDeclarationNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))}
                placeholder="00"
                maxLength={2}
                className="text-center text-2xl font-bold h-16"
             />
          </div>
          <DialogFooter>
            <Button onClick={handleUndeclare} variant="destructive">Undeclare</Button>
            <Button onClick={handleDeclareOrUndeclare} disabled={declarationNumber.length !== 2}>Declare</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!drawToDelete} onOpenChange={() => setDrawToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all saved sheets for draw <strong className="font-bold">{drawToDelete?.draw}</strong> on <strong className="font-bold">{drawToDelete ? format(drawToDelete.date, 'PPP') : ''}</strong>. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteDrawSheets}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
