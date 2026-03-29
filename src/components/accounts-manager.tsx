
"use client"
import { useState, useMemo } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import type { Client } from "@/hooks/useClients"
import { formatNumber } from "@/lib/utils"
import { TrendingUp, TrendingDown, HandCoins, Landmark, CircleDollarSign, Trophy, User, Search, ChevronRight, Activity } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area"
import { cn } from "@/lib/utils"

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
};

const draws = ["DD", "ML", "FB", "GB", "GL", "DS"];

const DrawDetailsPanel = ({
  client,
  account,
  drawName,
  drawData,
}: {
  client: Client | undefined;
  account: Account;
  drawName: string;
  drawData: DrawData | undefined;
}) => {

  const totalAmount = drawData?.totalAmount || 0;
  if (totalAmount === 0) {
    return (
      <div className="p-8 bg-muted/20 rounded-xl text-sm font-medium border-2 border-dashed text-center text-muted-foreground italic">
        No entries recorded for {drawName} today.
      </div>
    );
  }

  const clientCommissionPercent = client ? parseFloat(client.comm) / 100 : 0.10;
  const commission = totalAmount * clientCommissionPercent;
  const afterCommission = totalAmount - commission;
  
  const passingAmount = drawData?.passingAmount || 0;
  const passingMultiplier = client ? parseFloat(client.pair) : 90;
  const passingTotal = passingAmount * passingMultiplier;

  const finalTotal = afterCommission - passingTotal;
  const finalTotalColor = finalTotal < 0 ? 'text-destructive' : 'text-primary';
  
  return (
    <div className="p-6 bg-card rounded-xl text-sm border shadow-sm">
      <h4 className="font-bold text-center text-lg mb-4 text-primary">{drawName} Draw Summary</h4>
      <div className="grid grid-cols-2 gap-x-8 gap-y-3">
        <span className="text-muted-foreground">Gross Amount</span>
        <span className="text-right font-bold text-base">₹{formatNumber(totalAmount)}</span>
        
        <span className="text-muted-foreground">Commission ({clientCommissionPercent*100}%)</span>
        <span className="text-right font-semibold text-destructive">- ₹{formatNumber(commission)}</span>
        
        <span className="text-muted-foreground">Net After Commission</span>
        <span className="text-right font-bold">₹{formatNumber(afterCommission)}</span>
        
        <Separator className="col-span-2 my-2" />
        
        <span className="text-muted-foreground flex flex-col">
          <span>Passing Reward</span>
          {passingAmount > 0 && <span className="text-[10px] text-primary">Points: {formatNumber(passingAmount)} × {passingMultiplier}</span>}
        </span>
        <span className="text-right font-semibold text-destructive">
          - ₹{formatNumber(passingTotal)}
        </span>
      </div>
      <Separator className="my-4" />
      <div className="flex justify-between items-center pt-2">
        <span className="font-bold text-lg uppercase tracking-tight">Daily Net Profit</span>
        <span className={`text-right font-black text-2xl tabular-nums ${finalTotalColor}`}>
          ₹{formatNumber(finalTotal)}
        </span>
      </div>
    </div>
  )
}

export default function AccountsManager({ accounts, clients, setAccounts }: AccountsManagerProps) {
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
          <Card className="flex flex-col h-full overflow-hidden">
            <CardHeader className="p-4 space-y-4">
              <CardTitle className="text-lg flex items-center gap-2">
                <Search className="h-4 w-4 text-muted-foreground" />
                <Input 
                  placeholder="Search clients..." 
                  className="h-9"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
              </CardTitle>
            </CardHeader>
            <ScrollArea className="flex-1 border-t">
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
                        <span className="font-bold truncate text-sm">
                          {account.clientName}
                        </span>
                        <span className={cn(
                          "text-[10px] uppercase font-mono mt-0.5",
                          isActive ? "text-primary-foreground/80" : "text-muted-foreground"
                        )}>
                          ₹{formatNumber(balanceValue)}
                        </span>
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
            <Card className="h-full flex flex-col overflow-hidden">
              {/* Systematic Header with Shifted Metrics */}
              <CardHeader className="border-b bg-muted/5 p-0 overflow-hidden">
                <div className="flex flex-col lg:flex-row">
                  {/* Client ID Section */}
                  <div className="p-6 border-b lg:border-b-0 lg:border-r bg-muted/10 min-w-[280px]">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <CardTitle className="text-3xl font-black text-primary uppercase tracking-tight">
                          {selectedAccount.clientName}
                        </CardTitle>
                        {selectedClient?.paymentType === 'pre-paid' && (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-500 border-amber-500/20 uppercase text-[10px]">Pre-paid</Badge>
                        )}
                      </div>
                      <p className="text-sm text-muted-foreground flex items-center gap-2">
                        <User className="h-3 w-3" /> {selectedClient?.name || 'N/A'} • {selectedClient?.comm}% Commission
                      </p>
                    </div>
                  </div>

                  {/* Summary Metrics Strip - Systematic Alignment */}
                  <div className="flex-1 grid grid-cols-1 sm:grid-cols-3">
                    <div className="p-6 flex flex-col justify-center border-b sm:border-b-0 sm:border-r hover:bg-muted/5 transition-colors">
                      <p className="text-[10px] text-muted-foreground uppercase font-black tracking-widest mb-1">Opening Balance</p>
                      <p className="text-xl font-bold tabular-nums">₹{formatNumber(selectedAccount.openingBalance)}</p>
                    </div>
                    <div className="p-6 flex flex-col justify-center border-b sm:border-b-0 sm:border-r hover:bg-muted/5 transition-colors">
                      <p className="text-[10px] text-amber-500 uppercase font-black tracking-widest mb-1">Total Played</p>
                      <p className="text-xl font-bold tabular-nums text-amber-500">₹{formatNumber(totalPlayed)}</p>
                    </div>
                    <div className="p-6 flex flex-col justify-center bg-primary/5 hover:bg-primary/10 transition-colors">
                      <p className="text-[10px] text-primary uppercase font-black tracking-widest mb-1">Closing Balance</p>
                      <p className={cn(
                        "text-2xl font-black tabular-nums",
                        selectedAccount.balance >= 0 ? "text-primary" : "text-destructive"
                      )}>
                        ₹{formatNumber(selectedAccount.balance)}
                      </p>
                    </div>
                  </div>
                </div>
              </CardHeader>
              
              <ScrollArea className="flex-1">
                <CardContent className="p-6 space-y-8">
                  {/* Draw Breakdown */}
                  <div className="space-y-4">
                    <h3 className="font-black text-lg uppercase tracking-tight flex items-center gap-2">
                      <Activity className="h-5 w-5 text-primary" /> Daily Draw Performance
                    </h3>
                    
                    {hasActiveDraws ? (
                      <Tabs defaultValue={draws.find(d => selectedAccount.draws?.[d]?.totalAmount ?? 0 > 0) || draws[0]} className="w-full">
                        <ScrollArea className="w-full pb-2">
                          <TabsList className="inline-flex w-auto bg-muted/50 p-1">
                            {draws.map(draw => {
                              const amount = selectedAccount.draws?.[draw]?.totalAmount || 0;
                              return (
                                <TabsTrigger 
                                  key={draw} 
                                  value={draw} 
                                  className={cn(
                                    "px-4 py-2 text-xs font-bold",
                                    amount > 0 && "text-primary"
                                  )}
                                >
                                  {draw} {amount > 0 && `(₹${formatNumber(amount)})`}
                                </TabsTrigger>
                              );
                            })}
                          </TabsList>
                        </ScrollArea>
                        {draws.map(draw => (
                          <TabsContent key={draw} value={draw} className="mt-4">
                            <DrawDetailsPanel 
                              client={selectedClient}
                              account={selectedAccount}
                              drawName={draw} 
                              drawData={selectedAccount.draws ? selectedAccount.draws[draw] : undefined}
                            />
                          </TabsContent>
                        ))}
                      </Tabs>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-16 border-2 border-dashed rounded-2xl bg-muted/5">
                        <CircleDollarSign className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <p className="text-muted-foreground font-medium">No transactions recorded for this client today.</p>
                      </div>
                    )}
                  </div>
                </CardContent>
              </ScrollArea>
            </Card>
          ) : (
            <div className="h-full flex flex-col items-center justify-center border-2 border-dashed rounded-2xl bg-muted/5">
              <HandCoins className="h-16 w-16 text-muted-foreground/20 mb-4" />
              <p className="text-muted-foreground font-bold text-lg">Select a client from the left to view their ledger.</p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
