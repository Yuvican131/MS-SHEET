
"use client"
import { useState, useMemo } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import type { Client } from "@/hooks/useClients"
import { formatNumber } from "@/lib/utils"
import { Building, CircleDollarSign, HandCoins, User, Search, ChevronRight, Activity, TrendingUp, TrendingDown, ReceiptText } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"

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
  getDeclaredNumber: (draw: string, date: Date | undefined) => string | undefined;
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
            <TableHead className="w-[180px] font-black uppercase text-[10px] tracking-widest">Draw</TableHead>
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
                <TableCell className="font-bold py-4">
                  <div className="flex flex-col gap-2">
                    <span className="text-primary text-base font-black leading-none">{drawName}</span>
                    {winningNumber && (
                      <Badge variant="secondary" className="w-fit font-black border-2 border-primary/30 text-primary bg-primary/5 text-lg h-10 px-3 flex items-center justify-center min-w-[3.5rem]">
                        Result: {winningNumber}
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

export default function AccountsManager({ accounts, clients, selectedDate, getDeclaredNumber }: AccountsManagerProps) {
  const [selectedAccountId, setSelectedAccountId] = useState<string | null>(accounts[0]?.id || null);
  const [searchQuery, setSearchQuery] = useState("");

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

  return (
    <Card className="h-full flex flex-col border-none shadow-none bg-transparent">
      <CardContent className="flex-1 p-0 flex flex-col lg:flex-row gap-6 min-h-0 overflow-hidden">
        
        {/* Left Column: Client List */}
        <div className="w-full lg:w-80 flex flex-col gap-4 flex-shrink-0">
          <Card className="flex flex-col h-full overflow-hidden border shadow-sm">
            <CardHeader className="p-4 space-y-4 border-b bg-muted/20">
              <CardTitle className="text-sm font-black flex items-center gap-2 uppercase tracking-widest text-muted-foreground">
                <Search className="h-3 w-3" />
                Client Accounts
              </CardTitle>
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
                        "w-full text-left p-3 rounded-lg transition-all flex items-center justify-between group",
                        isActive 
                          ? "bg-primary text-primary-foreground shadow-md" 
                          : "hover:bg-muted"
                      )}
                    >
                      <div className="flex flex-col min-w-0">
                        <span className="font-black truncate text-sm uppercase tracking-tight">
                          {account.clientName}
                        </span>
                        <div className="flex items-center gap-2 mt-1">
                           <span className={cn(
                            "text-[10px] font-mono",
                            isActive ? "text-primary-foreground/80" : (balanceValue >= 0 ? "text-primary" : "text-destructive")
                          )}>
                            ₹{formatNumber(balanceValue)}
                          </span>
                          {isActive && <div className="h-1 w-1 rounded-full bg-primary-foreground animate-pulse" />}
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform",
                        isActive ? "translate-x-1" : "opacity-0 group-hover:opacity-100"
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
                <CardContent className="p-6 space-y-6">
                  <div className="space-y-4">
                    <h3 className="font-black text-xs uppercase tracking-[0.2em] text-muted-foreground flex items-center gap-2">
                      <Activity className="h-4 w-4 text-primary" /> Daily Draw Performance
                    </h3>
                    
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
                        <p className="text-muted-foreground font-bold uppercase text-[10px] tracking-widest">No activity for this client today</p>
                      </div>
                    )}
                  </div>
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
