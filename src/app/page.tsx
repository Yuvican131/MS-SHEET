"use client"

import { useState, useRef, useEffect, useMemo, useCallback } from "react"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import GridSheet from "@/components/grid-sheet"
import ClientsManager from "@/components/clients-manager"
import AccountsManager, { Account, DrawData } from "@/components/accounts-manager"
import LedgerRecord from "@/components/ledger-record"
import AdminPanel from "@/components/admin-panel"
import { AuthScreen } from "@/components/auth-screen"
import { Users, Building, Calendar as CalendarIcon, FileSpreadsheet, Shield, PlusCircle, Trash2, Megaphone, Sun, Moon, LogOut, Loader2, LayoutDashboard } from 'lucide-react';
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

  if (!mounted || isUserLoading) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-background">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-muted-foreground animate-pulse">Initializing Environment...</p>
      </div>
    );
  }

  if (!user) {
    return <AuthScreen />;
  }

  return <AuthenticatedApp userId={user.uid} onLogout={handleLogout} />;
}

function AuthenticatedApp({ userId, onLogout }: { userId: string, onLogout: () => void }) {
  const gridSheetRef = useRef<any>(null);
  const [selectedDraw, setSelectedDraw] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date>(() => new Date());
  const [activeTab, setActiveTab] = useState("sheet");

  const [declarationDraw, setDeclarationDraw] = useState("");
  const [declarationNumber, setDeclarationNumber] = useState("");
  const [isDeclarationDialogOpen, setIsDeclarationDialogOpen] = useState(false);
  const [drawToDelete, setDrawToDelete] = useState<ActiveSheet | null>(null);
  
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();

  const { clients, handleClientTransaction, clearClientData, updateClient, addClient, deleteClient } = useClients(userId);
  const { savedSheetLog, addSheetLogEntry, deleteSheetLogsForDraw, deleteSheetLogEntry } = useSheetLog(userId);
  const { setDeclaredNumber, removeDeclaredNumber, getDeclaredNumber, declaredNumbers } = useDeclaredNumbers(userId);
  
  const [formSelectedDraw, setFormSelectedDraw] = useState<string | null>(null);
  const [formSelectedDate, setFormSelectedDate] = useState<Date>(() => new Date());
  
  const [settlements, setSettlements] = useState<{ [key: string]: Settlement[] }>(EMPTY_SETTLEMENTS);

  useEffect(() => {
    const savedSettlements = localStorage.getItem(`settlements-${userId}`);
    if (savedSettlements) {
      try { setSettlements(JSON.parse(savedSettlements)); } catch (e) { console.error(e); }
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
        const [y, m, d] = log.date.split('-').map(Number);
        allSheets.push({ draw: log.draw, date: new Date(Date.UTC(y, m - 1, d)) });
      }
    });

    return allSheets.sort((a, b) => {
        const diff = b.date.getTime() - a.date.getTime();
        return diff !== 0 ? diff : DRAWS_ORDER.indexOf(a.draw) - DRAWS_ORDER.indexOf(b.draw);
    });
  }, [savedSheetLog]);

  const accounts = useMemo(() => {
    if (!clients || clients.length === 0) return EMPTY_ARRAY;
    const allLogs = Object.values(savedSheetLog).flat();
  
    return clients.map(client => {
      const commPercent = parseFloat(client.comm) / 100 || 0;
      const multiplier = parseFloat(client.pair) || 90;
      const logsByDate: Record<string, SavedSheetInfo[]> = {};
      allLogs.filter(log => log.clientId === client.id).forEach(log => {
          if (!logsByDate[log.date]) logsByDate[log.date] = [];
          logsByDate[log.date].push(log);
      });
  
      const sortedDates = Object.keys(logsByDate).sort((a, b) => compareAsc(new Date(a), new Date(b)));
      let runningBalance = client.activeBalance || 0;
      const selectedDayStr = format(selectedDate, 'yyyy-MM-dd');
  
      for (const dateStr of sortedDates) {
        if (dateStr < selectedDayStr) {
          logsByDate[dateStr].forEach(log => {
            const res = getDeclaredNumber(log.draw, new Date(log.date));
            const pass = res ? parseFloat(log.data[res] || "0") : 0;
            runningBalance += (log.gameTotal - (log.gameTotal * commPercent) - (pass * multiplier));
          });
        }
      }
  
      const openingBal = runningBalance;
      const drawInfo: Record<string, DrawData> = {};
      let dailyNet = 0;
      
      DRAWS_ORDER.forEach(draw => {
        const lgs = (logsByDate[selectedDayStr] || []).filter(l => l.draw === draw);
        const total = lgs.reduce((s, l) => s + l.gameTotal, 0);
        const res = getDeclaredNumber(draw, selectedDate);
        const pass = lgs.reduce((s, l) => s + (res ? parseFloat(l.data[res] || "0") : 0), 0);
        
        if (total > 0) dailyNet += (total - (total * commPercent) - (pass * multiplier));
        drawInfo[draw] = { totalAmount: total, passingAmount: pass };
      });
      
      return {
        id: client.id,
        clientName: client.name,
        balance: openingBal + dailyNet,
        openingBalance: openingBal,
        draws: drawInfo,
      } as Account;
    });
  }, [clients, savedSheetLog, getDeclaredNumber, selectedDate]);

  const handleAddSheet = useCallback(() => {
    if(formSelectedDraw && formSelectedDate) {
        setSelectedDraw(formSelectedDraw);
        setSelectedDate(formSelectedDate);
    }
  }, [formSelectedDraw, formSelectedDate]);

  const handleClientSheetSave = useCallback((name: string, id: string, data: { [key: string]: string }, draw: string, date: Date, rawInput?: string) => {
    const todayStr = format(date, 'yyyy-MM-dd');
    const total = Object.values(data).reduce((s, v) => s + (parseFloat(v) || 0), 0);
    if (total === 0) return;
    addSheetLogEntry({ clientName: name, clientId: id, gameTotal: total, data, date: todayStr, draw, rawInput: rawInput || "Manual Update", createdAt: new Date().toISOString() });
    toast({ title: "Sheet Saved", description: `${name}'s data logged.` });
  }, [addSheetLogEntry, toast]);

  return (
    <div className="flex h-screen w-full flex-col bg-background">
      <main className="flex-1 p-2 md:p-4 flex flex-col min-h-0">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full flex flex-col min-h-0">
          <div className="flex items-center justify-between pb-2 flex-wrap gap-2 border-b">
            <ScrollArea className="w-full whitespace-nowrap lg:w-auto">
              <TabsList className="flex w-full md:w-auto border-none p-0 bg-transparent">
                <TabsTrigger value="sheet" className="gap-2 px-4 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50 font-black uppercase tracking-widest text-[10px]">
                  <LayoutDashboard className="h-4 w-4" /> Home
                </TabsTrigger>
                <TabsTrigger value="clients" className="gap-2 px-4 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50 font-black uppercase tracking-widest text-[10px]">
                  <Users className="h-4 w-4" /> Clients
                </TabsTrigger>
                <TabsTrigger value="accounts" className="gap-2 px-4 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50 font-black uppercase tracking-widest text-[10px]">
                  <Building className="h-4 w-4" /> Ledger
                </TabsTrigger>
                <TabsTrigger value="ledger-record" className="gap-2 px-4 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50 font-black uppercase tracking-widest text-[10px]">
                  <FileSpreadsheet className="h-4 w-4" /> Stats
                </TabsTrigger>
                <TabsTrigger value="admin-panel" className="gap-2 px-4 h-12 rounded-none border-b-2 border-transparent data-[state=active]:border-primary data-[state=active]:bg-muted/50 font-black uppercase tracking-widest text-[10px]">
                  <Shield className="h-4 w-4" /> Admin
                </TabsTrigger>
              </TabsList>
            </ScrollArea>
            <div className="flex items-center gap-2">
                <Sun className="h-4 w-4 text-muted-foreground" />
                <Switch checked={theme === 'dark'} onCheckedChange={() => setTheme(theme === 'dark' ? 'light' : 'dark')} />
                <Moon className="h-4 w-4 text-muted-foreground" />
                <Button variant="ghost" size="icon" onClick={onLogout} className="ml-2"><LogOut className="h-4 w-4" /></Button>
            </div>
          </div>

          <TabsContent value="sheet" className="flex-1 flex flex-col min-h-0 mt-4">
            {selectedDraw ? (
              <GridSheet 
                ref={gridSheetRef} 
                draw={selectedDraw} 
                date={selectedDate} 
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
                <Card className="w-full max-w-2xl rounded-none border-zinc-800 bg-zinc-950">
                    <CardHeader><CardTitle className="uppercase font-black tracking-tighter">Open New Sheet</CardTitle></CardHeader>
                    <CardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                            <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase">Draw</Label>
                                <Select onValueChange={setFormSelectedDraw} value={formSelectedDraw || undefined}>
                                    <SelectTrigger className="rounded-none border-zinc-800"><SelectValue placeholder="Select Draw..." /></SelectTrigger>
                                    <SelectContent className="rounded-none">{DRAWS_ORDER.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}</SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label className="text-[10px] font-black uppercase">Date</Label>
                                <Popover>
                                    <PopoverTrigger asChild>
                                        <Button variant="outline" className="w-full justify-start text-left font-bold rounded-none border-zinc-800">
                                            <CalendarIcon className="mr-2 h-4 w-4" />
                                            {formSelectedDate ? format(formSelectedDate, "PPP") : "Pick Date"}
                                        </Button>
                                    </PopoverTrigger>
                                    <PopoverContent className="w-auto p-0 rounded-none border-zinc-800"><Calendar mode="single" selected={formSelectedDate} onSelect={d => d && setFormSelectedDate(d)} initialFocus /></PopoverContent>
                                </Popover>
                            </div>
                        </div>
                        <Button onClick={handleAddSheet} className="w-full mt-6 rounded-none font-black uppercase tracking-widest bg-primary" disabled={!formSelectedDraw || !formSelectedDate}>
                          <PlusCircle className="mr-2 h-4 w-4" /> Add Sheet
                        </Button>
                    </CardContent>
                </Card>

                <div className="w-full max-w-2xl space-y-4">
                  <h2 className="text-sm font-black uppercase tracking-widest text-muted-foreground px-1">Recent Sessions</h2>
                  <div className="space-y-2">
                    {activeSheets.map((sheet, idx) => {
                      const res = getDeclaredNumber(sheet.draw, sheet.date);
                      return (
                      <Card key={`${sheet.draw}-${idx}`} className="flex items-center justify-between p-4 rounded-none border-zinc-800 hover:bg-muted/50 cursor-pointer bg-zinc-950" onClick={() => { setSelectedDraw(sheet.draw); setSelectedDate(sheet.date); }}>
                        <div className="flex items-center gap-4">
                           <div className="flex items-center justify-center h-12 w-12 rounded-full border-2 border-primary text-primary font-black text-xl">{sheet.draw}</div>
                           <div>
                              <p className="font-black text-lg uppercase tracking-tight">{sheet.draw}</p>
                              <p className="text-[10px] font-bold text-muted-foreground">{format(sheet.date, "dd-MM-yyyy")}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-3">
                           {res ? <Badge className="text-xl h-10 w-14 flex items-center justify-center font-black border-2 border-primary bg-primary/10 text-primary rounded-none">{res}</Badge> : (
                             <Button variant="ghost" size="icon" onClick={(e) => { e.stopPropagation(); setDeclarationDraw(sheet.draw); setSelectedDate(sheet.date); setIsDeclarationDialogOpen(true); }}><Megaphone className="h-5 w-5" /></Button>
                           )}
                           <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={(e) => { e.stopPropagation(); setDrawToDelete(sheet); }}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </Card>
                    )})}
                  </div>
                </div>
              </div>
            )}
          </TabsContent>
          <TabsContent value="clients"><ClientsManager clients={clients} accounts={accounts} onAddClient={addClient} onUpdateClient={updateClient} onDeleteClient={deleteClient} onClientTransaction={handleClientTransaction} onClearClientData={clearClientData} /></TabsContent>
          <TabsContent value="accounts"><AccountsManager accounts={accounts} clients={clients} selectedDate={selectedDate} onDateChange={setSelectedDate} getDeclaredNumber={getDeclaredNumber} onClientTransaction={handleClientTransaction} /></TabsContent>
          <TabsContent value="ledger-record"><LedgerRecord clients={clients} savedSheetLog={savedSheetLog} draws={DRAWS_ORDER} declaredNumbers={declaredNumbers} /></TabsContent>
          <TabsContent value="admin-panel"><AdminPanel userId={userId} clients={clients} savedSheetLog={savedSheetLog} settlements={settlements} setSettlements={setSettlements} /></TabsContent>
        </Tabs>
      </main>

      <Dialog open={isDeclarationDialogOpen} onOpenChange={setIsDeclarationDialogOpen}>
        <DialogContent className="rounded-none border-zinc-800 bg-zinc-950">
          <DialogHeader><DialogTitle className="uppercase font-black tracking-widest">Declare Result: {declarationDraw}</DialogTitle></DialogHeader>
          <div className="my-6 space-y-4">
             <Label className="text-[10px] font-black uppercase">Winning Number</Label>
             <Input value={declarationNumber} onChange={e => setDeclarationNumber(e.target.value.replace(/\D/g, "").slice(0, 2))} placeholder="00" className="text-center text-5xl font-black h-24 rounded-none border-zinc-800" />
          </div>
          <DialogFooter className="gap-2">
            <Button onClick={() => { removeDeclaredNumber(declarationDraw, selectedDate); setIsDeclarationDialogOpen(false); }} variant="destructive" className="rounded-none font-bold">Undeclare</Button>
            <Button onClick={() => { if(declarationNumber.length===2){setDeclaredNumber(declarationDraw, declarationNumber, selectedDate); setIsDeclarationDialogOpen(false); setDeclarationNumber(""); toast({title:"Success"});} }} className="rounded-none font-black bg-primary">Confirm</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!drawToDelete} onOpenChange={() => setDrawToDelete(null)}>
        <AlertDialogContent className="rounded-none border-zinc-800 bg-zinc-950">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase">Clear Draw Data?</AlertDialogTitle>
            <AlertDialogDescription className="font-bold">Delete all saved sheets for {drawToDelete?.draw} on {drawToDelete ? format(drawToDelete.date, 'PPP') : ''}?</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none font-bold">Cancel</AlertDialogCancel>
            <AlertDialogAction className="rounded-none bg-destructive font-black" onClick={() => { if(drawToDelete) { deleteSheetLogsForDraw(drawToDelete.draw, drawToDelete.date); removeDeclaredNumber(drawToDelete.draw, drawToDelete.date); setDrawToDelete(null); } }}>Delete Everything</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}