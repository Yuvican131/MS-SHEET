
"use client"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Badge } from "@/components/ui/badge"
import type { Client } from "@/hooks/useClients"
import { useToast } from "@/hooks/use-toast"
import { formatNumber } from "@/lib/utils"
import { TrendingUp, TrendingDown, HandCoins, Landmark, CircleDollarSign, Trophy, User } from 'lucide-react';
import { ScrollArea } from "@/components/ui/scroll-area"


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
      <div className="p-4 bg-muted/50 rounded-lg text-sm font-mono border text-center text-muted-foreground italic">
        No entries for {drawName}.
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
  const finalTotalColor = finalTotal < 0 ? 'text-red-500' : 'text-green-400';
  
  return (
    <div className="p-4 bg-muted/50 rounded-lg text-sm font-mono border">
      <h4 className="font-bold text-center text-base mb-2 text-primary">{drawName}</h4>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1">
        <span className="text-foreground/80">Total</span><span className="text-right font-semibold">: ₹{formatNumber(totalAmount)}</span>
        <span className="text-foreground/80">{clientCommissionPercent*100}% Comm</span><span className="text-right font-semibold">: ₹{formatNumber(commission)}</span>
        <span className="text-foreground/80">After Comm</span><span className="text-right font-semibold">: ₹{formatNumber(afterCommission)}</span>
        <span className="text-foreground/80">Passing</span>
        <span className="text-right font-semibold">
          : {passingAmount > 0 ? `${formatNumber(passingAmount)} = ` : ''}₹{formatNumber(passingTotal)} {passingAmount > 0 ? `(x${passingMultiplier})` : ''}
        </span>
      </div>
      <Separator className="my-2 bg-border/50" />
      <div className="grid grid-cols-2 gap-x-4">
        <span className="font-bold text-base">Final</span>
        <span className={`text-right font-bold text-base ${finalTotalColor}`}>: ₹{formatNumber(finalTotal)}</span>
      </div>
    </div>
  )
}

export default function AccountsManager({ accounts, clients, setAccounts }: AccountsManagerProps) {
  return (
    <Card className="h-full flex flex-col">
      <CardHeader>
        <CardTitle>Manage Account Ledger</CardTitle>
      </CardHeader>
      <CardContent className="flex-1 space-y-6 overflow-y-auto p-2 sm:p-6">
        <div>
            <h3 className="text-lg font-semibold mb-3 text-primary flex items-center gap-2 px-2">
                <HandCoins className="h-5 w-5" /> Client Ledgers
            </h3>
            <Accordion type="single" collapsible className="w-full space-y-2">
              {accounts.map((account, index) => {
                const client = clients.find(c => c.id === account.id);
                const balanceValue = account.balance || 0;
                const balanceColor = balanceValue >= 0 ? 'text-green-400' : 'text-red-500';

                const totalPlayed = account.draws ? Object.values(account.draws).reduce((sum, d) => sum + (d?.totalAmount || 0), 0) : 0;
                
                const hasActiveDraws = account.draws && Object.values(account.draws).some(d => d.totalAmount > 0);

                return (
                  <AccordionItem value={`item-${index}`} key={account.id} className="border rounded-lg px-2 hover:bg-muted/30 transition-colors">
                    <AccordionTrigger className="hover:no-underline py-4">
                        <div className="flex items-center justify-between w-full pr-4 gap-2">
                            <div className="flex items-center gap-3 overflow-hidden text-left">
                                <span className="text-muted-foreground w-6 shrink-0 text-xs font-mono">{index + 1}.</span>
                                <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-3 overflow-hidden">
                                    <span className="font-bold truncate text-base">{account.clientName}</span>
                                    <div className="flex items-center gap-2">
                                        {client?.paymentType === 'pre-paid' && (
                                            <Badge variant="outline" className="text-[10px] h-4 px-1 uppercase bg-amber-500/10 text-amber-500 border-amber-500/20">Pre-paid</Badge>
                                        )}
                                        <span className="text-[10px] text-muted-foreground hidden sm:inline uppercase tracking-wider">
                                            {client?.comm}% Comm
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <div className="shrink-0 text-right">
                                <span className={`font-black text-base sm:text-lg tabular-nums ${balanceColor}`}>
                                    ₹{formatNumber(balanceValue)}
                                </span>
                            </div>
                        </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="p-2 sm:p-4 bg-card rounded-lg space-y-4">
                        
                        <div className="p-4 bg-muted/30 rounded-lg text-sm font-mono border">
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                            <span className="text-foreground/80 flex items-center gap-1.5"><User className="h-3 w-3" /> User Name</span><span className="text-right font-semibold text-primary">: {client?.name || 'N/A'}</span>
                            <span className="text-foreground/80">Opening Balance</span><span className="text-right font-semibold">: ₹{formatNumber(account.openingBalance)}</span>
                            <span className="text-foreground/80">Total Played Today</span><span className="text-right font-semibold text-amber-500">: ₹{formatNumber(totalPlayed)}</span>
                            <Separator className="my-1 col-span-2 bg-border/50" />
                            <span className="text-foreground/80 font-bold">Closing Balance</span><span className={`text-right font-bold ${balanceValue < 0 ? 'text-red-500' : 'text-green-400'}`}>: ₹{formatNumber(balanceValue)}</span>
                          </div>
                        </div>
                        
                        {hasActiveDraws ? (
                          <Tabs defaultValue={draws[0]} className="w-full">
                            <ScrollArea>
                                <TabsList className="grid w-full grid-cols-6 h-auto">
                                  {draws.map(draw => (
                                    <TabsTrigger key={draw} value={draw} className="text-[10px] sm:text-xs px-1 py-2">
                                      {draw}
                                    </TabsTrigger>
                                  ))}
                                </TabsList>
                            </ScrollArea>
                            {draws.map(draw => (
                              <TabsContent key={draw} value={draw}>
                                <DrawDetailsPanel 
                                  client={client}
                                  account={account}
                                  drawName={draw} 
                                  drawData={account.draws ? account.draws[draw] : undefined}
                                />
                              </TabsContent>
                            ))}
                          </Tabs>
                        ) : (
                          <div className="text-center text-muted-foreground italic py-8 border rounded-lg bg-muted/10">
                            No entries for this client today.
                          </div>
                        )}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )
              })}
            </Accordion>
        </div>
      </CardContent>
    </Card>
  )
}
