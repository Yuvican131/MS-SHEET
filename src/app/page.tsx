"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GridSheet from "@/components/grid-sheet"
import ClientsManager from "@/components/clients-manager"
import AccountsManager, { Account, DrawData } from "@/components/accounts-manager"
import LedgerRecord from "@/components/ledger-record"
import AdminPanel from "@/components/admin-panel"
import { AuthScreen } from "@/components/auth-screen"
import { Users, Building, Calendar as CalendarIcon, FileSpreadsheet, Shield, PlusCircle, Trash2, Megaphone, ArrowUpRight, Sun, Moon, LogOut, Loader2 } from 'lucide-react';
import { Button } from "@/components/ui/button"
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card"
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { format, isSameDay, startOfDay, compareAsc } from "date-fns"
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ScrollArea } from "@/components/ui/scroll-area";
import { useTheme } from "next-themes";
import { Switch } from "@/components/ui/switch";
import { useUser, useAuth } from "@/firebase";
import { signOut } from "firebase/auth";
import type { Settlement } from "@/components/admin-panel";

const EMPTY_ARRAY: any[] = [];
const EMPTY_SETTLEMENTS = {};
const DRAWS_ORDER = ["DD", "ML", "FB", "GB", "GL", "DS"];

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

type ActiveSheet = {
    draw: string;
    date: Date;
};

export default function Home() {
  const { user, isUserLoading } = useUser();
  const auth = useAuth();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  const handleLogout = useCallback(() => {
    signOut(auth);
  }, [auth]);

  const appUserId = useMemo(() => user?.uid || null, [user]);

  if (!mounted || isUserLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-xs font-black uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Secure Protocol...</p>
      </div>
    );
  }

  if (!user || !appUserId) {
    return <AuthScreen />;
  }

  return <AuthenticatedApp userId={appUserId} onLogout={handleLogout} />;
}

function AuthenticatedApp({ userId, onLogout }: { userId: string, onLogout: () => void }) {
  const gridSheetRef = useRef<any>(null);
  const [selectedDraw, setSelectedDraw] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [lastEntry, setLastEntry] = useState('');
  const [isLastEntryDialogOpen, setIsLastEntryDialogOpen] = useState(false);
  const [activeTab, setActiveTab] = useState("sheet");

  const [declarationDraw, setDeclarationDraw] = useState("");
  const [declarationNumber, setDeclarationNumber] = useState("");
  const [isDeclarationDialogOpen, setIsDeclarationDialogOpen] = useState(false);
  const [drawToDelete, setDrawToDelete] = useState<ActiveSheet | null>(null);
  
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const { clients, addClient, updateClient, deleteClient, handleClientTransaction, clearClientData } = useClients(userId);
  const { savedSheetLog, addSheetLogEntry, deleteSheetLogsForDraw, deleteSheetLogEntry } = useSheetLog(userId);
  const { setDeclaredNumber, removeDeclaredNumber, getDeclaredNumber, declaredNumbers } = useDeclaredNumbers(userId);
  
  const [formSelectedDraw, setFormSelectedDraw] = useState<string | null>(null);
  const [formSelectedDate, setFormSelectedDate] = useState<Date>(() => new Date());
  const [manualSheets, setManualSheets] = useState<ActiveSheet[]>([]);
  
  const [settlements, setSettlements] = useState<{ [key: string]: Settlement[] }>(EMPTY_SETTLEMENTS);

  useEffect(() => {
    try {
      const savedSettlements = localStorage.getItem(`settlements-${userId}`);
      if (savedSettlements) {
        setSettlements(JSON.parse(savedSettlements));
      }
    } catch (error) {
      console.error("Failed to parse settlements from localStorage", error);
    }
  }, [userId]);

  useEffect(() => {
    if (userId && settlements !== EMPTY_SETTLEMENTS) {
      localStorage.setItem(`settlements-${userId}`, JSON.stringify(settlements));
    }
  }, [settlements, userId]);
  
  const activeSheets = useMemo(() => {
    const uniqueSheetKeys = new Set<string>();
    const allSheets: ActiveSheet[] = [];

    const allLogs = Object.values(savedSheetLog).flat();
    allLogs.forEach(log => {
      const key = `${log.draw}-${log.date}`;
      if (!uniqueSheetKeys.has(key)) {
        uniqueSheetKeys.add(key);
        const dateParts = log.date.split('-').map(Number);
        const logDate = new Date(Date.UTC(dateParts[0], dateParts[1] - 1, dateParts[2]));
        allSheets.push({ draw: log.draw, date: logDate });
      }
    });

    manualSheets.forEach(manualSheet => {
        const key = `${manualSheet.draw}-${format(manualSheet.date, 'yyyy-MM-dd')}`;
        if (!uniqueSheetKeys.has(key)) {
            uniqueSheetKeys.add(key);
            allSheets.push(manualSheet);
        }
    });

    return allSheets.sort((a, b) => {
        const dateComparison = b.date.getTime() - a.date.getTime();
        if (dateComparison !== 0) return dateComparison;
        return DRAWS_ORDER.indexOf(a.draw) - DRAWS_ORDER.indexOf(b.draw);
    });
  }, [savedSheetLog, manualSheets]);


  const accounts = useMemo(() => {
    if (!clients || clients.length === 0) return EMPTY_ARRAY;
    
    const dateForCalc = selectedDate;
    const allLogs = Object.values(savedSheetLog).flat();
  
    return clients.map(client => {
      const clientCommissionPercent = parseFloat(client.comm) / 100 || 0;
      const passingMultiplier = parseFloat(client.pair) || 90;
  
      const logsByDate: { [date: string]: SavedSheetInfo[] } = {};
      allLogs
        .filter(log => log.clientId === client.id)
        .forEach(log => {
          const dateStr = log.date;
          if (!logsByDate[dateStr]) logsByDate[dateStr] = [];
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
            const winnings = passingAmountInLog * passingMultiplier;
            dailyNetResult += (gameTotal - commission - winnings);
          }
          runningBalance += dailyNetResult;
        }
      }
  
      const openingBalanceForSelectedDay = runningBalance;
      const updatedDrawsForSelectedDay: { [key: string]: DrawData } = {};
      const logsForSelectedDay = logsByDate[format(dateForCalc, 'yyyy-MM-dd')] || [];
      let netResultForSelectedDay = 0;
      
      DRAWS_ORDER.forEach(drawName => {
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
            const winningsOnDay = passingAmountForDraw * passingMultiplier;
            netResultForSelectedDay += (totalAmountForDraw - commissionOnDay - winningsOnDay);
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
  }, [clients, savedSheetLog, getDeclaredNumber, selectedDate]);

  const handleAddSheet = useCallback(() => {
    if(formSelectedDraw && formSelectedDate) {
        const drawToOpen = formSelectedDraw;
        const dateToOpen = formSelectedDate;

        const utcDate = new Date(Date.UTC(dateToOpen.getFullYear(), dateToOpen.getMonth(), dateToOpen.getDate()));
        const newSheet: ActiveSheet = { draw: drawToOpen, date: utcDate };
        
        setManualSheets(prev => {
            const exists = prev.some(s => s.draw === newSheet.draw && isSameDay(s.date, newSheet.date));
            if (exists) return prev;
            return [newSheet, ...prev];
        });

        setSelectedDraw(drawToOpen);
        setSelectedDate(dateToOpen);
    }
  }, [formSelectedDraw, formSelectedDate]);

  const handleOpenSheet = useCallback((sheet: ActiveSheet) => {
    setSelectedDraw(sheet.draw);
    setSelectedDate(sheet.date);
  }, []);
  
  const handleClientSheetSave = useCallback((clientName: string, clientId: string, newData: { [key: string]: string }, draw: string, date: Date, rawInput?: string) => {
    const todayStr = format(date, 'yyyy-MM-dd');
    const newEntryTotal = Object.values(newData).reduce((sum, val) => sum + (parseFloat(val) || 0), 0);
    if (newEntryTotal === 0) return;
  
    addSheetLogEntry({
      clientName,
      clientId,
      gameTotal: newEntryTotal,
      data: newData,
      date: todayStr,
      draw,
      rawInput: rawInput || "Manual Grid Update",
      createdAt: new Date().toISOString(),
    });
  
    toast({ title: "Sheet Saved", description: `${clientName}'s data logged.` });
  }, [addSheetLogEntry, toast]);
  
  const handleDeclareOrUndeclare = useCallback(() => {
    if (declarationNumber.length === 2) {
      setDeclaredNumber(declarationDraw, declarationNumber, selectedDate);
      toast({ title: "Success", description: `Result declared.` });
    }
    setIsDeclarationDialogOpen(false);
    setDeclarationNumber("");
  }, [selectedDate, declarationNumber, declarationDraw, setDeclaredNumber, toast]);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <main className="flex-1 p-2 md:p-4 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-2 flex-wrap gap-2">
            <div className="flex items-center flex-grow">
              <ScrollArea className="w-full whitespace-nowrap lg:w-auto">
                <TabsList className="flex w-full md:w-auto border-none p-0 bg-transparent">
                  <TabsTrigger value="sheet" className="gap-1.5 h-14 md:h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50">
                    <GridIcon className="h-5 w-5 md:h-4 md:w-4" />
                    <span className="hidden md:inline">Home</span>
                  </TabsTrigger>
                  <TabsTrigger value="clients" className="gap-1.5 h-14 md:h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50">
                    <Users className="h-5 w-5 md:h-4 md:w-4" />
                    <span className="hidden md:inline">CLIENTS</span>
                  </TabsTrigger>
                  <TabsTrigger value="accounts" className="gap-1.5 h-14 md:h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50">
                    <Building className="h-5 w-5 md:h-4 md:w-4" />
                    <span className="hidden md:inline">LEDGER</span>
                  </TabsTrigger>
                  <TabsTrigger value="ledger-record" className="gap-1.5 h-14 md:h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50">
                    <FileSpreadsheet className="h-5 w-5 md:h-4 md:w-4" />
                    <span className="hidden md:inline">STATS</span>
                  </TabsTrigger>
                  <TabsTrigger value="admin-panel" className="gap-1.5 h-14 md:h-10 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50">
                    <Shield className="h-5 w-5 md:h-4 md:w-4" />
                    <span className="hidden md:inline">ADMIN</span>
                  </TabsTrigger>
                </TabsList>
              </ScrollArea>
            </div>
            <div className="flex items-center gap-2">
                <div className="flex items-center space-x-2 mr-2">
                  <Sun className="h-4 w-4" />
                  <Switch id="theme-switch" checked={theme === 'dark'} onCheckedChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
                  <Moon className="h-4 w-4" />
                </div>
                <Button variant="ghost" size="icon" onClick={onLogout} className="h-9 w-9 text-muted-foreground">
                    <LogOut className="h-4 w-4" />
                </Button>
            </div>
          </div>
          <TabsContent value="sheet" className="flex-1 flex flex-col min-h-0">
            {selectedDraw ? (
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
                draws={DRAWS_ORDER}
                onDeleteLogEntry={deleteSheetLogEntry}
                onBack={() => { setSelectedDraw(null); }}
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
                                    <Label>Select a Draw</Label>
                                    <Select onValueChange={setFormSelectedDraw} value={formSelectedDraw || undefined}>
                                        <SelectTrigger><SelectValue placeholder="Select Draw..." /></SelectTrigger>
                                        <SelectContent>
                                            {DRAWS_ORDER.map(draw => (
                                                <SelectItem key={draw} value={draw}>{draw}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                  <Label>Pick a date</Label>
                                    <Popover>
                                        <PopoverTrigger asChild>
                                            <Button variant={"outline"} className={cn("w-full justify-start text-left font-normal", !formSelectedDate && "text-muted-foreground")}>
                                                <CalendarIcon className="mr-2 h-4 w-4" />
                                                {formSelectedDate ? format(formSelectedDate, "PPP") : <span>Pick a date</span>}
                                            </Button>
                                        </PopoverTrigger>
                                        <PopoverContent className="w-auto p-0">
                                            <Calendar mode="single" selected={formSelectedDate} onSelect={(date) => date && setFormSelectedDate(date)} initialFocus />
                                        </PopoverContent>
                                    </Popover>
                                </div>
                            </div>
                            <div className="mt-4">
                                <Button onClick={handleAddSheet} className="w-full" disabled={!formSelectedDraw || !formSelectedDate}>
                                  <PlusCircle className="mr-2 h-4 w-4" /> Add Sheet
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>

                <div className="w-full max-w-2xl">
                  <h2 className="text-lg font-semibold text-foreground mb-4">Recent Sheets</h2>
                  <div className="space-y-3">
                    {activeSheets.map((sheet, index) => {
                      const declaredNumber = getDeclaredNumber(sheet.draw, sheet.date);
                      return (
                      <Card key={`${sheet.draw}-${index}`} className="flex items-center justify-between p-3 transition-colors hover:bg-muted/50">
                        <div className="flex items-center gap-4 flex-grow cursor-pointer" onClick={() => handleOpenSheet(sheet)}>
                           <div className="flex items-center justify-center h-10 w-10 rounded-full border-2 border-primary text-primary font-bold text-lg">{sheet.draw}</div>
                           <div>
                              <p className="font-semibold">Draw: {sheet.draw}</p>
                              <p className="text-xs text-muted-foreground">{format(sheet.date, "dd-MM-yyyy")}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="cursor-pointer" onClick={() => { setDeclarationDraw(sheet.draw); setSelectedDate(sheet.date); setIsDeclarationDialogOpen(true); }}>
                           {declaredNumber ? (
                              <Badge variant="secondary" className="text-lg h-9 w-12 flex items-center justify-center font-bold border-2 border-primary text-primary">{declaredNumber}</Badge>
                           ) : (
                             <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-primary"><Megaphone className="h-5 w-5" /></Button>
                           )}
                          </div>
                           <Button variant="outline" size="sm" onClick={() => handleOpenSheet(sheet)}>Open <ArrowUpRight className="ml-2 h-4 w-4" /></Button>
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
              selectedDate={selectedDate}
              onDateChange={setSelectedDate}
              getDeclaredNumber={getDeclaredNumber}
              onClientTransaction={handleClientTransaction}
            />
          </TabsContent>
           <TabsContent value="ledger-record">
            <LedgerRecord clients={clients} savedSheetLog={savedSheetLog} draws={DRAWS_ORDER} declaredNumbers={declaredNumbers} />
          </TabsContent>
          <TabsContent value="admin-panel">
            <AdminPanel 
              userId={userId} 
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
          <DialogHeader><DialogTitle>Declare Result : {declarationDraw}</DialogTitle></DialogHeader>
          <div className="my-4 space-y-4">
             <Label>Enter 2-digit winning number</Label>
             <Input value={declarationNumber} onChange={(e) => setDeclarationNumber(e.target.value.replace(/[^0-9]/g, "").slice(0, 2))} placeholder="00" maxLength={2} className="text-center text-3xl font-black h-20" />
          </div>
          <DialogFooter>
            <Button onClick={() => { removeDeclaredNumber(declarationDraw, selectedDate); setIsDeclarationDialogOpen(false); }} variant="destructive">Undeclare</Button>
            <Button onClick={handleDeclareOrUndeclare} disabled={declarationNumber.length !== 2}>Declare Result</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!drawToDelete} onOpenChange={() => setDrawToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you sure?</AlertDialogTitle>
            <AlertDialogDescription>Delete all saved sheets for {drawToDelete?.draw} on {drawToDelete ? format(drawToDelete.date, 'PPP') : ''}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => { if(drawToDelete) { deleteSheetLogsForDraw(drawToDelete.draw, drawToDelete.date); removeDeclaredNumber(drawToDelete.draw, drawToDelete.date); setDrawToDelete(null); } }}>Delete</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}