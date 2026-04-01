
"use client"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Client } from "@/hooks/useClients"
import { formatNumber } from "@/lib/utils"
import { Building, CircleDollarSign, HandCoins, User, Search, ChevronRight, Activity, TrendingUp, TrendingDown, ReceiptText, Calendar as CalendarIcon, ChevronLeft, ChevronRight as ChevronRightIcon, Plus, Save } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Calendar } from "@/components/ui/calendar"
import { Button } from "@/components/ui/button"
import { Label } from "@/components/ui/label"
import { format, addDays, subDays } from "date-fns"
import { useToast } from "@/hooks/use-toast"

export type DrawData = {
  totalAmount: number;
  passingAmount: number;
}

export type Account = {
  id: string
  clientName: string
  balance: number
  openingBalance: number
  draws?: { [key: string]: DrawData }
}

type AccountsManagerProps = {
  accounts: Account[];
  clients: Client[];
  setAccounts: React.Dispatch<React.SetStateAction<Account[]>>;
  selectedDate: Date | undefined;
  onDateChange: (date: Date | undefined) => void;
  getDeclaredNumber: (draw: string, date: Date | undefined) => string | undefined;
  onClientTransaction?: (clientId: string, amount: number) => void;
};

const draws = ["DD", "ML", "FB", "GB", "GL", "DS"];

const DrawsPerformanceTable = ({
  client,
  account,
  selectedDate,
  getDeclaredNumber,
}: {
  client: Client | undefined;
  account: Account;
  selectedDate: Date | undefined;
  getDeclaredNumber: (draw: string, date: Date | undefined) => string | undefined;
}) => {
  const clientCommPercent = client ? parseFloat(client.comm) / 100 : 0;
  const passingMultiplier = client ? parseFloat(client.pair) : 90;

  return (
    <div className="border rounded-xl overflow-hidden bg-card shadow-sm">
      <Table>
        <TableHeader className="bg-muted/50">
          <TableRow>
            <TableHead className="w-[280px] font-black uppercase text-[10px] tracking-widest">
              Draw & Result {selectedDate && <span className="ml-2 text-muted-foreground font-normal">({format(selectedDate, "dd/MM/yyyy")})</span>}
            </TableHead>
            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Total Played</TableHead>
            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Passing Pts</TableHead>
            <TableHead className="text-right font-black uppercase text-[10px] tracking-widest">Draw Net</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {draws.map((drawName) => {
            const drawData = account.draws?.[drawName];
            const totalAmount = drawData?.totalAmount || 0;
            const passingAmount = drawData?.passingAmount || 0;
            const winningNumber = getDeclaredNumber(drawName, selectedDate);
            
            const commission = totalAmount * clientCommPercent;
            const winnings = passingAmount * passingMultiplier;
            const net = (totalAmount - commission) - winnings;

            if (totalAmount === 0) return null;

            return (
              <TableRow key={drawName} className="hover:bg-muted/30 transition-colors">
                <TableCell className="font-bold py-3">
                  <div className="flex items-center gap-3">
                    <span className="text-primary text-lg font-black leading-none min-w-[3rem]">{drawName}</span>
                    {winningNumber && (
                      <Badge variant="secondary" className="font-black border-2 border-primary/30 text-primary bg-primary/5 text-lg h-9 px-3 flex items-center justify-center min-w-[3rem]">
                        {winningNumber}
                      </Badge>
                    )}
                  </div>
                </TableCell>
                <TableCell className="text-right font-bold tabular-nums text-sm md:text-base">
                  ₹{formatNumber(totalAmount)}
                </TableCell>
                <TableCell className="text-right font-mono text-muted-foreground text-xs md:text-sm">
                  {passingAmount > 0 ? `${passingAmount} pts` : '0 pts'}
                </TableCell>
                <TableCell className={cn(
                  "text-right font-black tabular-nums text-sm md:text-base",
                  net >= 0 ? "text-primary" : "text-destructive"
                )}>
                  <div className="flex items-center justify-end gap-1">
                    {net >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                    ₹{formatNumber(net)}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </div>
  );
};

export default function AccountsManager({ accounts, clients, selectedDate, onDateChange, getDeclaredNumber, onClientTransaction }: AccountsManagerProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accounts[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState("");
  const { toast } = useToast();

  const [jamaAmount, setJamaAmount] = useState('');
  const [lenaAmount, setLenaAmount] = useState('');
  const [settlementReference, setSettlementReference] = useState('');

  const filteredAccounts = useMemo(() => {
    return accounts.filter(acc => 
      acc.clientName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [accounts, searchQuery]);

  const selectedAccount = useMemo(() => {
    return accounts.find(acc => acc.id === selectedAccountId);
  }, [accounts, selectedAccountId]);

  const selectedClient = useMemo(() => {
    return clients.find(c => c.id === selectedAccountId);
  }, [clients, selectedAccountId]);

  const totalPlayed = selectedAccount?.draws ? Object.values(selectedAccount.draws).reduce((sum, d) => sum + (d?.totalAmount || 0), 0) : 0;
  const hasActiveDraws = selectedAccount?.draws && Object.values(selectedAccount.draws).some(d => d.totalAmount > 0);

  const handlePrevDay = () => {
    if (selectedDate) onDateChange(subDays(selectedDate, 1));
  };

  const handleNextDay = () => {
    if (selectedDate) onDateChange(addDays(selectedDate, 1));
  };

  const handleSettlement = () => {
    const jama = parseFloat(jamaAmount) || 0;
    const lena = parseFloat(lenaAmount) || 0;
    
    if (jama > 0 && lena > 0) {
        toast({ title: "Invalid Entry", description: "Please enter a value in either Jama or Lena, not both.", variant: "destructive" });
        return;
    }
    if (jama === 0 && lena === 0) {
        toast({ title: "Invalid Entry", description: "Please enter an amount for Jama or Lena.", variant: "destructive" });
        return;
    }

    if (!onClientTransaction || !selectedAccountId) return;

    // Jama = Client pays me (+), Lena = I pay client (-)
    const settlementChange = jama - lena;
    onClientTransaction(selectedAccountId, settlementChange);
    
    toast({ title: "Settlement Recorded", description: `₹${formatNumber(Math.abs(settlementChange))} recorded for ${selectedAccount?.clientName}.` });
    setJamaAmount('');
    setLenaAmount('');
    setSettlementReference('');
  };

  return (
    <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
      <CardContent className="flex-1 p-0 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
        
        {/* Left Column: Client List */}
        <div className="w-full lg:w-96 flex flex-col gap-4 flex-shrink-0">
          <Card className="flex flex-col h-full overflow-hidden border shadow-sm">
            <CardHeader className="p-4 space-y-4 border-b bg-muted/20">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                  <Search className="h-3 w-3" />
                  Client Accounts
                </CardTitle>
              </div>

              {/* Date Selector Header */}
              <div className="flex items-center gap-1">
                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handlePrevDay}>
                  <ChevronLeft className="h-4 w-4" />
                </Button>
                
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      variant="outline"
                      className={cn(
                        "flex-1 h-9 justify-start text-left font-bold text-xs uppercase tracking-tighter",
                        !selectedDate && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4 text-primary" />
                      {selectedDate ? format(selectedDate, "EEE, dd MMM") : "Select Date"}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={selectedDate}
                      onSelect={onDateChange}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>

                <Button variant="outline" size="icon" className="h-9 w-9 shrink-0" onClick={handleNextDay}>
                  <ChevronRightIcon className="h-4 w-4" />
                </Button>
              </div>

              <Input 
                placeholder="Search clients..." 
                className="h-9 bg-background"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </CardHeader>
            <ScrollArea className="flex-1">
              <div className="p-2 space-y-1">
                {filteredAccounts.map((account) => {
                  const balanceValue = account.balance || 0;
                  const isActive = selectedAccountId === account.id;

                  return (
                    <button
                      key={account.id}
                      onClick={() => setSelectedAccountId(account.id)}
                      className={cn(
                        "w-full text-left p-3 rounded-lg transition-all flex items-center group relative",
                        isActive 
                          ? "bg-muted ring-2 ring-primary ring-inset shadow-sm" 
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex items-center justify-between w-full min-w-0 pr-2">
                        <span className={cn(
                          "font-black truncate text-sm uppercase tracking-tight flex-1",
                          isActive ? "text-primary" : "text-foreground"
                        )}>
                          {account.clientName}
                        </span>
                        <span className={cn(
                          "text-base font-black tabular-nums whitespace-nowrap ml-2",
                          balanceValue >= 0 ? "text-primary" : "text-destructive"
                        )}>
                          ₹{formatNumber(balanceValue)}
                        </span>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 shrink-0 transition-transform",
                        isActive ? "translate-x-1 text-primary" : "opacity-0 group-hover:opacity-100"
                      )} />
                    </button>
                  )
                })}
              </div>
            </ScrollArea>
          </Card>
        </div>

        {/* Right Column: Details View */}
        <div className="flex-1 min-w-0">
          {selectedAccount ? (
            <Card className="h-full flex flex-col overflow-hidden border shadow-md">
              <CardHeader className="border-b bg-card p-0 overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  <div className="p-6 border-b lg:border-b-0 lg:border-r bg-muted/5 min-w-[300px]">
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 flex-wrap">
                          <CardTitle className="text-3xl font-black text-primary uppercase tracking-tighter">
                            {selectedAccount.clientName}
                          </CardTitle>
                          {selectedClient?.paymentType === 'pre-paid' && (
                            <Badge className="bg-amber-500 hover:bg-amber-600 text-white border-none uppercase text-[9px] font-black px-2 h-5">Pre-paid</Badge>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-y-1 gap-x-4">
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-bold">
                            <User className="h-3 w-3" /> {selectedClient?.name || 'N/A'}
                          </p>
                          <p className="text-[10px] text-muted-foreground flex items-center gap-1.5 uppercase font-bold">
                            <ReceiptText className="h-3 w-3" /> {selectedClient?.comm}% COMM
                          </p>
                        </div>
                      </div>
                      
                      {/* Record Settlement Button */}
                      <Popover>
                        <PopoverTrigger asChild>
                          <Button size="sm" className="w-full font-black uppercase tracking-widest text-[10px] h-10">
                            <Plus className="mr-2 h-3.5 w-3.5" /> Record Settlement
                          </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-80" align="start">
                          <div className="grid gap-4">
                            <div className="space-y-2">
                              <h4 className="font-bold leading-none uppercase text-xs tracking-widest">Client Settlement</h4>
                              <p className="text-[10px] text-muted-foreground uppercase font-bold">
                                Record a payment adjustment for {selectedAccount.clientName}.
                              </p>
                            </div>
                            <div className="grid gap-2">
                              <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="jama-amount" className="text-[10px] font-black uppercase">Jama (Rcv)</Label>
                                <Input id="jama-amount" placeholder="Amount" value={jamaAmount} onChange={e => {setJamaAmount(e.target.value); setLenaAmount('');}} className="col-span-2 h-8 text-xs font-bold" />
                              </div>
                              <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="lena-amount" className="text-[10px] font-black uppercase">Lena (Pay)</Label>
                                <Input id="lena-amount" placeholder="Amount" value={lenaAmount} onChange={e => {setLenaAmount(e.target.value); setJamaAmount('');}} className="col-span-2 h-8 text-xs font-bold"/>
                              </div>
                              <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="settlement-ref" className="text-[10px] font-black uppercase">Ref</Label>
                                <Input id="settlement-ref" placeholder="e.g. Cash" value={settlementReference} onChange={e => setSettlementReference(e.target.value)} className="col-span-2 h-8 text-xs font-bold"/>
                              </div>
                            </div>
                            <Button onClick={handleSettlement} className="h-9 font-black uppercase tracking-widest text-[10px]">
                              <Save className="mr-2 h-3.5 w-3.5" /> Save Entry
                            </Button>
                          </div>
                        </PopoverContent>
                      </Popover>
                    </div>
                  </div>

                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3">
                    <div className="p-5 flex flex-col justify-center border-b sm:border-b-0 sm:border-r hover:bg-muted/5 transition-colors">
                      <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Opening Bal</p>
                      <p className="text-lg font-black tabular-nums">₹{formatNumber(selectedAccount.openingBalance)}</p>
                    </div>
                    <div className="p-5 flex flex-col justify-center border-b sm:border-b-0 sm:border-r hover:bg-muted/5 transition-colors">
                      <p className="text-[9px] text-amber-500 uppercase font-black tracking-widest mb-1">Vol (Gross)</p>
                      <p className="text-lg font-black tabular-nums text-amber-500">₹{formatNumber(totalPlayed)}</p>
                    </div>
                    <div className="p-5 flex flex-col justify-center bg-primary/5 hover:bg-primary/10 transition-colors">
                      <p className="text-[9px] text-primary uppercase font-black tracking-widest mb-1">Closing Bal</p>
                      <p className={cn(
                        "text-xl font-black tabular-nums",
                        selectedAccount.balance >= 0 ? "text-primary" : "text-destructive"
                      )}>
                        ₹{formatNumber(selectedAccount.balance)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1">
                <CardContent className="p-6">
                    {hasActiveDraws ? (
                      <DrawsPerformanceTable 
                        client={selectedClient}
                        account={selectedAccount}
                        selectedDate={selectedDate}
                        getDeclaredNumber={getDeclaredNumber}
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed rounded-3xl bg-muted/5">
                        <CircleDollarSign className="h-14 w-14 text-muted-foreground/20 mb-4" />
                        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">No activity for this client on this date</p>
                      </div>
                    )}
                </CardContent>
              </ScrollArea>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-3xl bg-muted/5">
              <div className="bg-muted p-8 rounded-full mb-6">
                <HandCoins className="h-16 w-16 text-muted-foreground/40" />
              </div>
              <p className="text-muted-foreground font-black uppercase tracking-widest text-sm">Select a client to view ledger</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
