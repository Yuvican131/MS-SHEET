
"use client"
import React, { useMemo, useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow, TableFooter } from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatNumber } from "@/lib/utils";
import { isSameDay, subDays, format } from "date-fns"
import type { Client } from '@/hooks/useClients';
import type { SavedSheetInfo } from '@/hooks/useSheetLog';
import type { DeclaredNumber } from '@/hooks/useDeclaredNumbers';

type LedgerRecordProps = {
  clients: Client[];
  savedSheetLog: { [draw: string]: SavedSheetInfo[] };
  draws: string[];
  declaredNumbers: { [key: string]: DeclaredNumber };
};

const defaultClientPair = 90;

type PerformanceRecord = {
  clientName: string;
  drawName: string;
  totalInvested: number;
  profitLoss: number;
};


const ClientProfitLoss = ({ clients, savedSheetLog, draws, declaredNumbers }: LedgerRecordProps) => {
    const [mounted, setMounted] = useState(false);
    const [now, setNow] = useState<Date | undefined>(undefined);
    const [selectedClient, setSelectedClient] = useState<string>("all");
    const [selectedDraw, setSelectedDraw] = useState<string>("all");
    const [dateRange, setDateRange] = useState<string>("all");
    const [searchQuery, setSearchQuery] = useState("");

    useEffect(() => {
        setMounted(true);
        setNow(new Date());
    }, []);

    const performanceData: PerformanceRecord[] = useMemo(() => {
        if (!mounted || !now) return [];
        const clientDrawMap: { [key: string]: { totalInvested: number, profitLoss: number } } = {};

        // Iterate over each draw and its logs
        Object.entries(savedSheetLog).forEach(([drawName, logs]) => {
            // Filter logs by selected draw if not 'all'
            if (selectedDraw !== 'all' && drawName !== selectedDraw) return;
            
            let filteredLogs = logs;
            if (dateRange === 'today') {
                filteredLogs = logs.filter(log => isSameDay(new Date(log.date), now));
            } else if (dateRange === 'yesterday') {
                filteredLogs = logs.filter(log => isSameDay(new Date(log.date), subDays(now, 1)));
            } else if (dateRange === 'last7') {
                const sevenDaysAgo = subDays(now, 7);
                filteredLogs = logs.filter(log => new Date(log.date) >= sevenDaysAgo);
            }

            filteredLogs.forEach(log => {
                const client = clients.find(c => c.id === log.clientId);
                if (!client) return;

                if (searchQuery && !client.name.toLowerCase().includes(searchQuery.toLowerCase())) {
                    return;
                }
                
                if (selectedClient !== 'all' && log.clientId !== selectedClient) return;

                const mapKey = `${client.id}-${drawName}`;

                if (!clientDrawMap[mapKey]) {
                    clientDrawMap[mapKey] = { totalInvested: 0, profitLoss: 0 };
                }

                const totalInvested = log.gameTotal;
                const clientComm = totalInvested * (parseFloat(client.comm) / 100);
                const clientNet = totalInvested - clientComm;

                const dateStr = format(new Date(log.date), 'yyyy-MM-dd');
                const declarationId = `${drawName}-${dateStr}`;
                const declaredNumber = declaredNumbers[declarationId]?.number;

                const passingAmount = (declaredNumber && log.data[declaredNumber]) ? (parseFloat(log.data[declaredNumber]) || 0) : 0;
                const clientWinnings = passingAmount * (parseFloat(client.pair) || defaultClientPair);

                const profitLoss = clientNet - clientWinnings; // For broker: what they take in minus what they pay out

                clientDrawMap[mapKey].totalInvested += totalInvested;
                clientDrawMap[mapKey].profitLoss += profitLoss;
            });
        });

        const allPerformance = Object.keys(clientDrawMap).map(key => {
            const [clientId, drawName] = key.split('-');
            const client = clients.find(c => c.id === clientId);
            return {
                clientName: client?.name || 'Unknown',
                drawName,
                totalInvested: clientDrawMap[key].totalInvested,
                // For client P/L, we invert the broker's profit
                profitLoss: -clientDrawMap[key].profitLoss,
            };
        });

        return allPerformance.sort((a, b) => a.profitLoss - b.profitLoss);

    }, [clients, savedSheetLog, selectedClient, selectedDraw, dateRange, searchQuery, declaredNumbers, mounted, now]);
    
    const overallTotalInvested = useMemo(() => {
        return performanceData.reduce((acc, record) => acc + record.totalInvested, 0);
    }, [performanceData]);

    const overallTotalProfitLoss = useMemo(() => {
        return performanceData.reduce((acc, record) => acc + record.profitLoss, 0);
    }, [performanceData]);

    if (!mounted) return null;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-4 border rounded-lg bg-muted/50">
                <div className="space-y-2">
                    <Label>Filter by Client</Label>
                    <Select value={selectedClient} onValueChange={setSelectedClient}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Clients</SelectItem>
                            {clients.map(c => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Filter by Draw</Label>
                    <Select value={selectedDraw} onValueChange={setSelectedDraw}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Draws</SelectItem>
                            {draws.map(d => <SelectItem key={d} value={d}>{d}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label>Filter by Date</Label>
                    <Select value={dateRange} onValueChange={setDateRange}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">All Time</SelectItem>
                            <SelectItem value="today">Today</SelectItem>
                            <SelectItem value="yesterday">Yesterday</SelectItem>
                            <SelectItem value="last7">Last 7 Days</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label htmlFor="client-search">Search by Client Name</Label>
                    <Input
                        id="client-search"
                        placeholder="Enter client name..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                    />
                </div>
            </div>
            <div className="overflow-x-auto">
                <Table>
                    <TableHeader>
                        <TableRow>
                            <TableHead>Client Name</TableHead>
                            <TableHead>Draw Name</TableHead>
                            <TableHead className="text-right">Total Invested</TableHead>
                            <TableHead className="text-right">Client Profit/Loss</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {performanceData.length > 0 ? performanceData.map((record, index) => (
                            <TableRow key={index}>
                                <TableCell>{record.clientName}</TableCell>
                                <TableCell>{record.drawName}</TableCell>
                                <TableCell className="text-right">₹{formatNumber(record.totalInvested)}</TableCell>
                                <TableCell className={`text-right font-bold ${record.profitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                    {record.profitLoss >= 0 ? `+₹${formatNumber(record.profitLoss)}` : `-₹${formatNumber(Math.abs(record.profitLoss))}`}
                                </TableCell>
                            </TableRow>
                        )) : (
                            <TableRow>
                                <TableCell colSpan={4} className="text-center text-muted-foreground h-24">
                                    No data available for the selected filters.
                                </TableCell>
                            </TableRow>
                        )}
                    </TableBody>
                    <TableFooter>
                        <TableRow className="bg-muted/50 hover:bg-muted">
                            <TableCell colSpan={2} className="font-bold text-lg text-right">Overall Totals</TableCell>
                            <TableCell className="text-right font-bold text-lg">₹{formatNumber(overallTotalInvested)}</TableCell>
                            <TableCell className={`text-right font-bold text-lg ${overallTotalProfitLoss >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                {overallTotalProfitLoss >= 0 ? `+₹${formatNumber(overallTotalProfitLoss)}` : `-₹${formatNumber(Math.abs(overallTotalProfitLoss))}`}
                            </TableCell>
                        </TableRow>
                    </TableFooter>
                </Table>
            </div>
        </div>
    );
}

export default function LedgerRecord({ clients, savedSheetLog, draws, declaredNumbers }: LedgerRecordProps) {
  return (
    <Card className="h-full flex flex-col overflow-hidden">
      <CardHeader>
        <CardTitle>Client Performance</CardTitle>
        <CardDescription>Analyze client profit and loss performance.</CardDescription>
      </CardHeader>
      <CardContent className="flex-1 overflow-y-auto">
        <ClientProfitLoss clients={clients} savedSheetLog={savedSheetLog} draws={draws} declaredNumbers={declaredNumbers} />
      </CardContent>
    </Card>
  );
}
