
"use client"
import React, { useMemo, useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { formatNumber } from "@/lib/utils";
import { Wallet as WalletIcon, Calendar as CalendarIcon, Percent, Scale, TrendingUp, TrendingDown, Landmark, Banknote, Trash2, HandCoins, Minus, Plus, Save, CircleDollarSign, Trophy, History } from 'lucide-react';
import { Separator } from "@/components/ui/separator";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, getYear, getMonth, startOfYear, endOfYear, eachMonthOfInterval, startOfDay, endOfDay, subDays, parseISO, compareAsc, isBefore } from "date-fns";
import type { Client } from '@/hooks/useClients';
import type { SavedSheetInfo } from '@/hooks/useSheetLog';
import { useDeclaredNumbers } from '@/hooks/useDeclaredNumbers';
import { useToast } from "@/hooks/use-toast";
import { ScrollArea } from './ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose } from "@/components/ui/dialog";


const draws = ["DD", "ML", "FB", "GB", "GL", "DS"];
const defaultUpperComm = 20;
const defaultClientPair = 90;
const defaultUpperPair = 80;

type ReportRow = {
  label: string;
  date: Date;
  clientPayable: number;
  upperPayable: number;
  brokerNet: number;
  hasActivity: boolean;
};

const BrokerProfitLoss = ({ userId, clients, savedSheetLog }: {
    userId?: string;
    clients: Client[];
    savedSheetLog: { [draw: string]: SavedSheetInfo[] };
}) => {
    const [mounted, setMounted] = useState(false);
    const { declaredNumbers } = useDeclaredNumbers(userId);
    const [selectedClientId, setSelectedClientId] = useState<string>('all');
    const [viewMode, setViewMode] = useState<'month' | 'year'>('month');
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(undefined);
    const [upperComm, setUpperComm] = useState(defaultUpperComm.toString());
    const [upperPair, setUpperPair] = useState(defaultUpperPair.toString());
    const [appliedUpperComm, setAppliedUpperComm] = useState(defaultUpperComm.toString());
    const [appliedUpperPair, setAppliedUpperPair] = useState(defaultUpperPair.toString());
    const {toast} = useToast();

    useEffect(() => {
        setMounted(true);
        setSelectedDate(new Date());
        const savedComm = localStorage.getItem('upperBrokerComm');
        const savedPair = localStorage.getItem('upperBrokerPair');
        if (savedComm) {
            setUpperComm(savedComm);
            setAppliedUpperComm(savedComm);
        }
        if (savedPair) {
            setUpperPair(savedPair);
            setAppliedUpperPair(savedPair);
        }
    }, []);

    const handleApplySettings = () => {
        setAppliedUpperComm(upperComm);
        setAppliedUpperPair(upperPair);
        localStorage.setItem('upperBrokerComm', upperComm);
        localStorage.setItem('upperBrokerPair', upperPair);
        toast({ title: "Settings Applied", description: "Broker commission and pair rates have been updated." });
    };

    const calculateNetForPeriod = useCallback((periodStart: Date, periodEnd: Date) => {
        let totalClientPayable = 0;
        let totalUpperPayable = 0;
        let hasActivity = false;

        const allLogs = Object.values(savedSheetLog).flat();
        const logsForPeriod = allLogs.filter(log => {
            const logDate = startOfDay(new Date(log.date));
            return logDate >= periodStart && logDate <= periodEnd;
        });

        if (logsForPeriod.length > 0) hasActivity = true;

        const clientsToProcess = selectedClientId === 'all' 
            ? clients 
            : clients.filter(c => c.id === selectedClientId);

        clientsToProcess.forEach(client => {
            const clientLogs = logsForPeriod.filter(log => log.clientId === client.id);
            if (clientLogs.length === 0) return;

            let clientGameTotal = 0;
            let clientPassingAmount = 0;
            const clientCommPercent = (client.comm && !isNaN(parseFloat(client.comm))) ? parseFloat(client.comm) / 100 : 0;
            const clientPairRate = parseFloat(client.pair) || defaultClientPair;

            clientLogs.forEach(log => {
                clientGameTotal += log.gameTotal;
                const declaredNumber = declaredNumbers[`${log.draw}-${log.date}`]?.number;
                if (declaredNumber && log.data[declaredNumber]) {
                    clientPassingAmount += parseFloat(log.data[declaredNumber]) || 0;
                }
            });

            const clientCommission = clientGameTotal * clientCommPercent;
            const clientNet = clientGameTotal - clientCommission;
            const clientWinnings = clientPassingAmount * clientPairRate;
            totalClientPayable += clientNet - clientWinnings;
        });

        let totalGameRawForUpper = 0;
        let totalPassingAmountRawForUpper = 0;
        const upperCommPercent = parseFloat(appliedUpperComm) / 100 || defaultUpperComm / 100;
        const upperPairRate = parseFloat(appliedUpperPair) || defaultUpperPair;

        const logsForUpper = selectedClientId === 'all' 
            ? logsForPeriod 
            : logsForPeriod.filter(log => log.clientId === selectedClientId);

        logsForUpper.forEach(log => {
            totalGameRawForUpper += log.gameTotal;
            const declaredNumber = declaredNumbers[`${log.draw}-${log.date}`]?.number;
            if(declaredNumber && log.data[declaredNumber]) {
                totalPassingAmountRawForUpper += parseFloat(log.data[declaredNumber]) || 0;
            }
        });

        const upperCommission = totalGameRawForUpper * upperCommPercent;
        const upperWinnings = totalPassingAmountRawForUpper * upperPairRate;
        totalUpperPayable = (totalGameRawForUpper - upperCommission) - upperWinnings;
        
        const brokerNet = totalClientPayable - totalUpperPayable;
        
        return { clientPayable: totalClientPayable, upperPayable: totalUpperPayable, brokerNet, hasActivity };

    }, [savedSheetLog, clients, selectedClientId, declaredNumbers, appliedUpperComm, appliedUpperPair]);


    const reportData: ReportRow[] = useMemo(() => {
        if (!selectedDate || !mounted) return [];
        if (viewMode === 'month') {
            const monthStart = startOfMonth(selectedDate);
            const monthEnd = endOfMonth(selectedDate);
            const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
        
            return daysInMonth.map(day => {
                const dayStart = startOfDay(day);
                const dayEnd = endOfDay(day);
                const { clientPayable, upperPayable, brokerNet, hasActivity } = calculateNetForPeriod(dayStart, dayEnd);
                return {
                    date: day,
                    label: format(day, "EEE, dd MMM yyyy"),
                    clientPayable,
                    upperPayable,
                    brokerNet,
                    hasActivity
                };
            }).filter(row => row.hasActivity);
        } else {
            const yearStart = startOfYear(selectedDate);
            const yearEnd = endOfYear(selectedDate);
            const monthsInYear = eachMonthOfInterval({ start: yearStart, end: yearEnd });

            return monthsInYear.map(month => {
                const monthStart = startOfMonth(month);
                const monthEnd = endOfMonth(month);
                const { clientPayable, upperPayable, brokerNet, hasActivity } = calculateNetForPeriod(monthStart, monthEnd);
                return {
                    date: month,
                    label: format(month, "MMMM yyyy"),
                    clientPayable,
                    upperPayable,
                    brokerNet,
                    hasActivity
                };
            }).filter(row => row.hasActivity);
        }

    }, [selectedDate, viewMode, calculateNetForPeriod, mounted]);
  
    const grandTotalForPeriod = useMemo(() => {
        return reportData.reduce((acc, row) => {
            acc.clientPayable += row.clientPayable;
            acc.upperPayable += row.upperPayable;
            acc.brokerNet += row.brokerNet;
            return acc;
        }, { clientPayable: 0, upperPayable: 0, brokerNet: 0 });
    }, [reportData]);

    const hasData = reportData.length > 0;

    if (!mounted) return null;

    return (
        <div className="space-y-6">
            <h3 className="text-lg font-semibold text-primary flex items-center gap-2">
                <WalletIcon className="h-5 w-5" /> Broker Profit and Loss
            </h3>
            <div className="p-4 border rounded-lg bg-muted/50">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 items-end">
                    <div className="space-y-2">
                        <Label htmlFor="upper-comm">Upper Broker Comm (%)</Label>
                        <Input 
                        id="upper-comm" 
                        value={upperComm} 
                        onChange={(e) => setUpperComm(e.target.value)} 
                        placeholder={String(defaultUpperComm)}
                        />
                    </div>
                    <div className="space-y-2">
                        <Label htmlFor="upper-pair">Upper Broker Pair Rate</Label>
                        <Input 
                        id="upper-pair" 
                        value={upperPair} 
                        onChange={(e) => setUpperPair(e.target.value)} 
                        placeholder={String(defaultUpperPair)}
                        />
                    </div>
                    <Button onClick={handleApplySettings}>Apply Settings</Button>
                </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                 <div className="space-y-2">
                    <Label>View By</Label>
                    <Select value={viewMode} onValueChange={(value) => setViewMode(value as 'month' | 'year')}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="month">Month</SelectItem>
                            <SelectItem value="year">Year</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                   <Label>{viewMode === 'month' ? 'Select Month' : 'Select Year'}</Label>
                    <Popover>
                        <PopoverTrigger asChild>
                            <Button
                                variant={"outline"}
                                className={cn("w-full justify-start text-left font-normal", !selectedDate && "text-muted-foreground")}
                            >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {selectedDate ? format(selectedDate, viewMode === 'month' ? "MMMM yyyy" : "yyyy") : <span>Pick a date</span>}
                            </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                            <Calendar
                                mode="single"
                                selected={selectedDate}
                                onSelect={(date) => date && setSelectedDate(date)}
                                initialFocus
                                defaultMonth={selectedDate}
                                fromYear={2020}
                                toYear={new Date().getFullYear() + 5}
                                captionLayout="dropdown-buttons"
                            />
                        </PopoverContent>
                    </Popover>
                </div>
                <div className="space-y-2">
                    <Label>Filter by Client</Label>
                    <Select value={selectedClientId} onValueChange={setSelectedClientId}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Clients</SelectItem>
                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            {hasData ? (
                <>
                    <Card>
                        <CardHeader className="flex flex-row items-center justify-between pb-2">
                            <CardTitle className="text-sm font-medium">
                                {viewMode === 'month' ? 'Monthly Profit' : 'Yearly Profit'}
                            </CardTitle>
                            <WalletIcon className="h-4 w-4 text-muted-foreground" />
                        </CardHeader>
                        <CardContent>
                            <div className={`text-2xl font-bold ${grandTotalForPeriod.brokerNet >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {grandTotalForPeriod.brokerNet >= 0 ? `+${formatNumber(grandTotalForPeriod.brokerNet)}` : `${formatNumber(grandTotalForPeriod.brokerNet)}`}
                            </div>
                            <p className="text-xs text-muted-foreground">
                                Total profit for {selectedDate ? format(selectedDate, viewMode === 'month' ? "MMMM yyyy" : "yyyy") : ''}
                            </p>
                        </CardContent>
                    </Card>

                    <div className="overflow-x-auto">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead>{viewMode === 'month' ? 'Date' : 'Month'}</TableHead>
                                <TableHead className="text-right">Client Payable</TableHead>
                                <TableHead className="text-right">Upper Payable</TableHead>
                                <TableHead className="text-right">Broker Profit/Loss</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                            {reportData.map((row, index) => (
                                <TableRow key={index}>
                                <TableCell>{row.label}</TableCell>
                                <TableCell className="text-right">₹{formatNumber(row.clientPayable)}</TableCell>
                                <TableCell className="text-right">₹{formatNumber(row.upperPayable)}</TableCell>
                                <TableCell className={`text-right font-bold ${row.brokerNet >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {row.brokerNet >= 0 ? `+₹${formatNumber(row.brokerNet)}` : `-₹${formatNumber(Math.abs(row.brokerNet))}`}
                                </TableCell>
                                </TableRow>
                            ))}
                            </TableBody>
                            <TableFooter>
                            <TableRow className="bg-muted/50 hover:bg-muted">
                                <TableCell colSpan={1} className="font-bold text-lg text-right">Total</TableCell>
                                <TableCell className="text-right font-bold text-lg">₹{formatNumber(grandTotalForPeriod.clientPayable)}</TableCell>
                                <TableCell className="text-right font-bold text-lg">₹{formatNumber(grandTotalForPeriod.upperPayable)}</TableCell>
                                <TableCell className={`text-right font-bold text-lg ${grandTotalForPeriod.brokerNet >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {grandTotalForPeriod.brokerNet >= 0 ? `+₹${formatNumber(grandTotalForPeriod.brokerNet)}` : `-₹${formatNumber(Math.abs(grandTotalForPeriod.brokerNet))}`}
                                </TableCell>
                            </TableRow>
                            </TableFooter>
                        </Table>
                    </div>
                </>
            ) : (
                <div className="text-center text-muted-foreground py-10">
                    No data available for the selected period.
                </div>
            )}
        </div>
    );
};

export type Settlement = {
  id: string;
  amount: number;
  reference: string;
  timestamp: string;
};

type AdminPanelProps = {
  userId?: string;
  clients: Client[];
  savedSheetLog: { [draw: string]: SavedSheetInfo[] };
  settlements: { [key: string]: Settlement[] };
  setSettlements: React.Dispatch<React.SetStateAction<{ [key: string]: Settlement[] }>>;
};


export default function AdminPanel({ userId, clients, savedSheetLog, settlements, setSettlements }: AdminPanelProps) {
    const [mounted, setMounted] = useState(false);
    const { toast } = useToast();
    const { declaredNumbers } = useDeclaredNumbers(userId);
    const [summaryDate, setSummaryDate] = useState<Date | undefined>(undefined);
    const [appliedUpperComm, setAppliedUpperComm] = useState(defaultUpperComm.toString());
    const [appliedUpperPair, setAppliedUpperPair] = useState(defaultUpperPair.toString());

    const [jamaAmount, setJamaAmount] = useState('');
    const [lenaAmount, setLenaAmount] = useState('');
    const [settlementReference, setSettlementReference] = useState('');
    const [isSettlementHistoryOpen, setIsSettlementHistoryOpen] = useState(false);
    
    useEffect(() => {
        setMounted(true);
        setSummaryDate(new Date());
        const savedComm = localStorage.getItem('upperBrokerComm');
        const savedPair = localStorage.getItem('upperBrokerPair');
        if (savedComm) setAppliedUpperComm(savedComm);
        if (savedPair) setAppliedUpperPair(savedPair);
    }, []);

    
    const calculateDailyNet = useCallback((date: Date, allLogs: SavedSheetInfo[]) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const logsForDay = allLogs.filter(log => log.date === dateStr);
        if (logsForDay.length === 0) return 0;
    
        let totalGameRawForUpper = 0;
        let totalPassingAmountRawForUpper = 0;
        const upperCommPercent = parseFloat(appliedUpperComm) / 100 || defaultUpperComm / 100;
        const upperPairRate = parseFloat(appliedUpperPair) || defaultUpperPair;

        logsForDay.forEach(log => {
            totalGameRawForUpper += log.gameTotal;
            const declaredNumber = declaredNumbers[`${log.draw}-${log.date}`]?.number;
            if(declaredNumber && log.data[declaredNumber]) {
                totalPassingAmountRawForUpper += parseFloat(log.data[declaredNumber]) || 0;
            }
        });
        const upperCommission = totalGameRawForUpper * upperCommPercent;
        const upperWinnings = totalPassingAmountRawForUpper * upperPairRate;
        
        return (totalGameRawForUpper - upperCommission) - upperWinnings;

    }, [declaredNumbers, appliedUpperComm, appliedUpperPair]);
    
    const runningTotal = useMemo(() => {
      let cumulativeTotal = 0;
      const allLogs = Object.values(savedSheetLog).flat();
      
      const allDatesWithActivity = new Set<string>();
      allLogs.forEach(log => allDatesWithActivity.add(log.date));
      Object.keys(settlements).forEach(dateStr => {
        if (dateStr !== 'NaN-NaN-NaN' && !/undefined/.test(dateStr)) {
             try {
                parseISO(dateStr); 
                allDatesWithActivity.add(dateStr);
            } catch (e) {}
        }
      });
    
      if (allDatesWithActivity.size === 0) return 0;
    
      const sortedDates = Array.from(allDatesWithActivity).sort((a, b) => compareAsc(parseISO(a), parseISO(b)));
    
      if (sortedDates.length === 0 || !sortedDates[0]) return 0;
    
      try {
        const firstDate = parseISO(sortedDates[0]);
        const today = new Date();
        const intervalDays = firstDate <= today ? eachDayOfInterval({ start: firstDate, end: today }) : [];
    
        for (const day of intervalDays) {
          const brokerNetForDay = calculateDailyNet(day, allLogs);
          const dailySettlements = settlements[format(day, 'yyyy-MM-dd')] || [];
          const settlementForDay = dailySettlements.reduce((acc, s) => acc + s.amount, 0);
          cumulativeTotal += brokerNetForDay + settlementForDay;
        }
      } catch (e) {
          console.error("Error creating date interval for running total", e);
          return 0;
      }
    
      return cumulativeTotal;
    }, [savedSheetLog, settlements, calculateDailyNet]);

    const handleSettlement = () => {
        if (!summaryDate) return;
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

        const settlementChange = lena - jama;
        const dateKey = format(summaryDate, 'yyyy-MM-dd');
        
        const newSettlement: Settlement = {
            id: new Date().toISOString(),
            amount: settlementChange,
            reference: settlementReference,
            timestamp: new Date().toISOString()
        };

        setSettlements(prev => {
            const daySettlements = prev[dateKey] ? [...prev[dateKey]] : [];
            daySettlements.push(newSettlement);
            return {
                ...prev,
                [dateKey]: daySettlements
            };
        });
        
        toast({ title: "Settlement Recorded", description: `Settlement for ${format(summaryDate, 'PPP')} has been updated.` });
        setJamaAmount('');
        setLenaAmount('');
        setSettlementReference('');
    };

    const handleDeleteSettlement = (settlementId: string) => {
        if (!summaryDate) return;
        const dateKey = format(summaryDate, 'yyyy-MM-dd');
        setSettlements(prev => {
            const daySettlements = prev[dateKey] || [];
            const newDaySettlements = daySettlements.filter(s => s.id !== settlementId);
            if (newDaySettlements.length > 0) {
                return { ...prev, [dateKey]: newDaySettlements };
            } else {
                const newSettlements = { ...prev };
                delete newSettlements[dateKey];
                return newSettlements;
            }
        });
        toast({ title: "Settlement entry deleted." });
    };

    const calculateDrawSummary = (draw: string, date: Date) => {
        const allLogs = Object.values(savedSheetLog).flat();
        const dateStr = format(date, 'yyyy-MM-dd');
        
        const logsForDrawAndDate = allLogs.filter(log => log.draw === draw && log.date === dateStr);
        
        let totalRaw = 0;
        let totalPassing = 0;
        
        const declaredNumber = declaredNumbers[`${draw}-${dateStr}`]?.number;

        logsForDrawAndDate.forEach(log => {
            totalRaw += log.gameTotal;
            if (declaredNumber && log.data[declaredNumber]) {
                totalPassing += parseFloat(log.data[declaredNumber]);
            }
        });
        
        return { totalRaw, totalPassing };
    };

    const finalSummaryForDay = useMemo(() => {
        if (!summaryDate) return { totalRaw: 0, commission: 0, passing: 0, finalNet: 0 };
        const allLogs = Object.values(savedSheetLog).flat();
        const dateStr = format(summaryDate, 'yyyy-MM-dd');
        const logsForDay = allLogs.filter(log => log.date === dateStr);

        let totalRaw = 0;
        let passingRaw = 0;

        logsForDay.forEach(log => {
            totalRaw += log.gameTotal;

            const declaredNumber = declaredNumbers[`${log.draw}-${log.date}`]?.number;
            if (declaredNumber && log.data[declaredNumber]) {
                const passingAmount = parseFloat(log.data[declaredNumber]) || 0;
                passingRaw += passingAmount;
            }
        });

        const upperCommPercent = parseFloat(appliedUpperComm) / 100 || defaultUpperComm / 100;
        const upperPairRate = parseFloat(appliedUpperPair) || defaultUpperPair;

        const commission = totalRaw * upperCommPercent;
        const passing = passingRaw * upperPairRate;
        
        const finalNet = (totalRaw - commission) - passing;

        return { 
            totalRaw, 
            commission, 
            passing, 
            finalNet,
        };
    }, [summaryDate, savedSheetLog, declaredNumbers, appliedUpperComm, appliedUpperPair]);
    
    const dailySettlements = summaryDate ? settlements[format(summaryDate, 'yyyy-MM-dd')] || [] : [];

    if (!mounted) return null;

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="flex flex-row justify-between items-start">
        <div>
            <CardTitle>Admin Panel</CardTitle>
            <CardDescription>High-level overview of your brokerage operations.</CardDescription>
        </div>
        <div className="flex items-center gap-2">
            <Card className="p-2 flex items-center gap-2">
                <Label className="text-sm font-semibold whitespace-nowrap">Running Net</Label>
                <div className={`text-lg font-extrabold ${runningTotal >= 0 ? 'text-green-500' : 'text-red-500'}`}>{formatNumber(runningTotal)}</div>
            </Card>

             <Button variant="outline" onClick={() => setIsSettlementHistoryOpen(true)} disabled={dailySettlements.length === 0} size="icon" className="h-9 w-9">
                <History className="h-4 w-4" />
                <span className="sr-only">View History</span>
            </Button>
            <Popover>
                <PopoverTrigger asChild>
                    <Button className="h-9">
                        <Plus className="mr-2 h-4 w-4" /> Record Settlement
                    </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80">
                    <div className="grid gap-4">
                        <div className="space-y-2">
                            <h4 className="font-medium leading-none">Add Settlement</h4>
                            <p className="text-sm text-muted-foreground">
                                Record a payment to adjust the running total for {summaryDate ? format(summaryDate, 'PPP') : ''}.
                            </p>
                        </div>
                        <div className="grid gap-2">
                             <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="jama-amount">Jama (Pay)</Label>
                                <Input id="jama-amount" placeholder="Amount" value={jamaAmount} onChange={e => {setJamaAmount(e.target.value); setLenaAmount('');}} className="col-span-2 h-8" />
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="lena-amount">Lena (Receive)</Label>
                                <Input id="lena-amount" placeholder="Amount" value={lenaAmount} onChange={e => {setLenaAmount(e.target.value); setJamaAmount('');}} className="col-span-2 h-8"/>
                            </div>
                            <div className="grid grid-cols-3 items-center gap-4">
                                <Label htmlFor="settlement-ref">Reference</Label>
                                <Input id="settlement-ref" placeholder="e.g. Online/Cash" value={settlementReference} onChange={e => setSettlementReference(e.target.value)} className="col-span-2 h-8"/>
                            </div>
                        </div>
                        <Button onClick={handleSettlement}>
                            <Save className="mr-2 h-4 w-4" /> Save Settlement
                        </Button>
                    </div>
                </PopoverContent>
            </Popover>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-6 overflow-y-auto">
        <div>
            <div className="flex items-center gap-4 mb-6 flex-wrap">
                <h3 className="text-lg font-semibold text-primary flex items-center gap-2 flex-shrink-0">
                    <Banknote className="h-5 w-5" /> All Draws Summary
                </h3>
                <Popover>
                    <PopoverTrigger asChild>
                        <Button
                        variant={"outline"}
                        className={cn(
                            "w-auto min-w-[240px] justify-start text-left font-normal",
                            !summaryDate && "text-muted-foreground"
                        )}
                        >
                        <CalendarIcon className="mr-2 h-4 w-4" />
                        {summaryDate ? format(summaryDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-auto p-0">
                        <Calendar
                        mode="single"
                        selected={summaryDate}
                        onSelect={(date) => date && setSummaryDate(date)}
                        initialFocus
                        />
                    </PopoverContent>
                </Popover>
            </div>
            
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-7 gap-4">
              {draws.map(draw => {
                  const { totalRaw, totalPassing } = summaryDate ? calculateDrawSummary(draw, summaryDate) : { totalRaw: 0, totalPassing: 0 };
                  const dateStr = summaryDate ? format(summaryDate, 'yyyy-MM-dd') : '';
                  const declaredNumber = declaredNumbers[`${draw}-${dateStr}`]?.number;
                  return (
                      <div key={draw} className="bg-card border rounded-lg p-4 flex flex-col justify-between overflow-hidden">
                          <div className="flex justify-between items-start text-card-foreground">
                              <h3 className="font-bold text-lg">{draw}</h3>
                              {declaredNumber ? (
                                <div className="flex items-center justify-center h-8 w-8 rounded-full border-2 border-primary text-primary font-bold text-base flex-shrink-0">
                                  {declaredNumber}
                                </div>
                              ) : (
                                <HandCoins className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                              )}
                          </div>
                          <div className="text-center font-bold my-2 flex-grow flex items-center justify-center min-h-0 overflow-hidden">
                              <span className="text-2xl break-all line-clamp-2">{formatNumber(totalRaw)}</span>
                          </div>
                          <div className="flex justify-between items-center text-sm p-2 -m-2 mt-2 bg-muted/50 rounded-md">
                              <div className='flex items-center gap-1.5 text-muted-foreground'>
                                  <TrendingDown className="h-4 w-4 text-red-500" />
                                  <span>Pass</span>
                              </div>
                              <span className={`font-semibold ${totalPassing > 0 ? 'text-red-500' : 'text-muted-foreground'}`}>{formatNumber(totalPassing)}</span>
                          </div>
                      </div>
                  );
              })}

              <div className="bg-card rounded-lg p-4 flex flex-col justify-between border-t-4 border-primary">
                  <div className="flex justify-between items-center font-bold text-lg text-primary">
                      <h3>Final Summary</h3>
                      <Landmark className="h-5 w-5 text-primary/80" />
                  </div>
                  <div className="space-y-1 mt-2 flex-grow text-card-foreground">
                      <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground text-sm">Total</span>
                          <span className="font-semibold text-xl break-all text-right">{formatNumber(finalSummaryForDay.totalRaw)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground text-sm">Comm</span> 
                          <span className="font-semibold text-xl break-all text-right">{formatNumber(finalSummaryForDay.commission)}</span>
                      </div>
                      <div className="flex justify-between items-center gap-2">
                          <span className="text-muted-foreground text-sm">Passing</span> 
                          <span className="font-semibold text-xl break-all text-right">{formatNumber(finalSummaryForDay.passing)}</span>
                      </div>
                  </div>
                   <Separator className="my-2 bg-primary/20" />
                  <div className="flex justify-between items-center font-bold text-xl gap-2">
                     <span className={`${finalSummaryForDay.finalNet >= 0 ? 'text-green-500' : 'text-red-500'} whitespace-nowrap text-sm`}>Final Net</span>
                     <span className={`${finalSummaryForDay.finalNet >= 0 ? 'text-green-500' : 'text-red-500'} break-all text-right`}>{formatNumber(finalSummaryForDay.finalNet)}</span>
                  </div>
              </div>
          </div>
        </div>

        <Separator className="my-8" />
        
        <div>
            <BrokerProfitLoss 
                userId={userId}
                clients={clients} 
                savedSheetLog={savedSheetLog}
            />
        </div>
      </CardContent>
      <Dialog open={isSettlementHistoryOpen} onOpenChange={setIsSettlementHistoryOpen}>
          <DialogContent className="max-w-2xl">
              <DialogHeader>
                  <DialogTitle>Settlement History</DialogTitle>
                  <DialogDescription>Recorded settlements for {summaryDate ? format(summaryDate, 'PPP') : ''}</DialogDescription>
              </DialogHeader>
              <div className="my-4">
                  <ScrollArea className="max-h-[60vh]">
                      <Table>
                          <TableHeader>
                              <TableRow>
                                  <TableHead>Time</TableHead>
                                  <TableHead>Amount</TableHead>
                                  <TableHead>Reference</TableHead>
                                  <TableHead className="text-right">Action</TableHead>
                              </TableRow>
                          </TableHeader>
                          <TableBody>
                              {dailySettlements.map(s => (
                                  <TableRow key={s.id}>
                                      <TableCell>{format(new Date(s.timestamp), 'p')}</TableCell>
                                      <TableCell className={`font-semibold ${s.amount > 0 ? 'text-green-500' : 'text-red-500'}`}>
                                          {s.amount > 0 ? `+${formatNumber(s.amount)}` : formatNumber(s.amount)}
                                      </TableCell>
                                      <TableCell>{s.reference}</TableCell>
                                      <TableCell className="text-right">
                                          <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDeleteSettlement(s.id)}>
                                              <Trash2 className="h-4 w-4" />
                                          </Button>
                                      </TableCell>
                                  </TableRow>
                              ))}
                          </TableBody>
                      </Table>
                  </ScrollArea>
              </div>
              <DialogFooter>
                  <DialogClose asChild>
                      <Button type="button" variant="secondary">
                        Close
                      </Button>
                  </DialogClose>
              </DialogFooter>
          </DialogContent>
      </Dialog>
    </Card>
  );
}
