
"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, MoreHorizontal, Edit, Trash2, ArrowUpCircle, ArrowDownCircle, Eraser, Mic, ShieldCheck } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Account } from "./accounts-manager"
import { formatNumber } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { Client } from "@/hooks/useClients"

type ClientsManagerProps = {
  clients: Client[];
  accounts: Account[];
  onAddClient: (client: Omit<Client, 'id'>) => void;
  onUpdateClient: (client: Client) => void;
  onDeleteClient: (id: string, name: string) => void;
  onClientTransaction: (clientId: string, amount: number) => void;
  onClearClientData: (clientId: string, name: string) => void;
}

export default function ClientsManager({ clients, accounts, onAddClient, onUpdateClient, onDeleteClient, onClientTransaction, onClearClientData }: ClientsManagerProps) {
  const [isFormDialogOpen, setIsFormDialogOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<Client | null>(null)
  const [transactionClient, setTransactionClient] = useState<Client | null>(null);
  const [transactionType, setTransactionType] = useState<'deposit' | 'withdraw' | null>(null);
  const [transactionAmount, setTransactionAmount] = useState('');
  const [dialogAction, setDialogAction] = useState<(() => void) | null>(null);
  const [dialogTitle, setDialogTitle] = useState('');
  const [dialogDescription, setDialogDescription] = useState('');
  const [isConfirmDialogOpen, setIsConfirmDialogOpen] = useState(false);
  const { toast } = useToast();

  const [clientNameInput, setClientNameInput] = useState('');
  const recognitionRef = useRef<any>(null);
  const [isListeningDialogOpen, setIsListeningDialogOpen] = useState(false);
  const [interimTranscript, setInterimTranscript] = useState('');

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        
        recognition.onstart = () => {
          setInterimTranscript('Listening...');
        };

        recognition.onresult = (event) => {
          const transcript = Array.from(event.results)
            .map(result => result[0])
            .map(result => result.transcript)
            .join('');
          setInterimTranscript(transcript);
        };
        
        recognition.onend = () => {
          setIsListeningDialogOpen(false);
        };
        
        recognition.onerror = (event) => {
          console.error("Speech recognition error", event.error);
          setInterimTranscript(`Error: ${event.error}. Please try again.`);
          toast({
            title: "Voice Recognition Error",
            description: event.error === 'not-allowed' ? "Microphone access was denied." : `An error occurred: ${event.error}`,
            variant: "destructive"
          });
          setIsListeningDialogOpen(false);
        };
        
        recognitionRef.current = recognition;
      }
    }

    return () => {
      stopListening();
    };
  }, [stopListening, toast]);
  
  useEffect(() => {
    if (editingClient) {
      setClientNameInput(editingClient.name);
    } else {
      setClientNameInput('');
    }
  }, [editingClient, isFormDialogOpen]);
  
  useEffect(() => {
    if (!isListeningDialogOpen && interimTranscript !== 'Listening...' && interimTranscript) {
        setClientNameInput(prev => interimTranscript || prev);
    }
  }, [isListeningDialogOpen, interimTranscript]);


  const handleListen = () => {
    const recognition = recognitionRef.current;
    if (recognition) {
        setInterimTranscript('');
        setIsListeningDialogOpen(true);
        recognition.start();
    } else {
      toast({
        title: "Voice Recognition Not Supported",
        description: "Your browser does not support voice recognition.",
        variant: "destructive"
      });
    }
  };

  const handleSaveClient = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const name = clientNameInput;
    const pair = formData.get("pair") as string
    const comm = formData.get("comm") as string
    const inOut = formData.get("inOut") as string
    const patti = formData.get("patti") as string
    const activeBalanceStr = formData.get("activeBalance") as string;
    const activeBalance = parseFloat(activeBalanceStr) || 0;
    const securityMoneyStr = formData.get("securityMoney") as string;
    const securityMoney = parseFloat(securityMoneyStr) || 0;

    if (editingClient) {
      const updatedClient = { ...editingClient, name, pair, comm, inOut, patti, activeBalance, securityMoney };
      onUpdateClient(updatedClient);
    } else {
      const newClient: Omit<Client, 'id'> = { name, pair, comm, inOut, patti, activeBalance, securityMoney }
      onAddClient(newClient);
    }
    setEditingClient(null)
    setIsFormDialogOpen(false)
    setClientNameInput('');
  }
  
  const handleEditClient = (client: Client) => {
    setEditingClient(client)
    setIsFormDialogOpen(true)
  }

  const confirmAction = (title: string, description: string, action: () => void) => {
    setDialogTitle(title);
    setDialogDescription(description);
    setDialogAction(() => action);
    setIsConfirmDialogOpen(true);
  };
  
  const handleDeleteClient = (id: string, name: string) => {
    confirmAction(
      `Delete Client: ${name}?`,
      "This action cannot be undone. This will permanently delete the client and all their associated sheet data.",
      () => onDeleteClient(id, name)
    );
  };

  const handleClearClientData = (id: string, name: string) => {
    confirmAction(
      `Clear Sheet Data for ${name}?`,
      "This action cannot be undone. This will permanently delete all sheet log history for this client.",
      () => onClearClientData(id, name)
    );
  };

  const openAddDialog = () => {
    setEditingClient(null)
    setClientNameInput('');
    setIsFormDialogOpen(true)
  }

  const openTransactionDialog = (client: Client, type: 'deposit' | 'withdraw') => {
    setTransactionClient(client);
    setTransactionType(type);
    setTransactionAmount('');
  };
  
  const handleTransaction = () => {
    if (!transactionClient || !transactionType) return;
  
    const amount = parseFloat(transactionAmount);
    if (isNaN(amount) || amount <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid positive number.",
        variant: "destructive",
      });
      return;
    }
  
    const finalAmount = transactionType === 'deposit' ? amount : -amount;
    onClientTransaction(transactionClient.id, finalAmount);
  
    toast({
      title: "Transaction Successful",
      description: `₹${formatNumber(amount)} has been ${transactionType === 'deposit' ? 'recorded as a deposit for' : 'withdrawn from'} ${transactionClient.name}.`,
    });
  
    setTransactionClient(null);
    setTransactionType(null);
  };

  return (
    <>
      <Card className="h-full flex flex-col rounded-none border-0 shadow-none">
        <CardHeader className="flex flex-row items-center justify-between border-b bg-muted/20 px-6 py-4">
          <div>
            <CardTitle className="text-xl font-black uppercase tracking-widest text-primary">Manage Clients</CardTitle>
            <CardDescription className="text-xs uppercase font-bold text-muted-foreground mt-1">Configure client details and security deposits</CardDescription>
          </div>
          <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
            if (!open) {
              setEditingClient(null);
              stopListening();
            }
            setIsFormDialogOpen(open)
          }}>
            <DialogTrigger asChild>
              <Button onClick={openAddDialog} className="font-black uppercase tracking-widest text-xs h-10 px-6 rounded-none">
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg rounded-none border-zinc-800">
              <DialogHeader>
                <DialogTitle className="font-black uppercase tracking-widest text-primary">{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveClient} className="space-y-4">
                <div className="space-y-1.5">
                  <Label htmlFor="name" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Client Name</Label>
                  <div className="relative">
                    <Input 
                      id="name" 
                      name="name" 
                      value={clientNameInput} 
                      onChange={(e) => setClientNameInput(e.target.value)} 
                      placeholder="Enter name or use voice" 
                      required 
                      className="rounded-none border-zinc-800 font-bold"
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      size="icon" 
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-none"
                      onClick={handleListen}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="pair" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Pair Rate</Label>
                    <Input id="pair" name="pair" defaultValue={editingClient?.pair} placeholder="e.g. 90" required className="rounded-none border-zinc-800 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="comm" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Commission (%)</Label>
                    <Input id="comm" name="comm" defaultValue={editingClient?.comm} placeholder="e.g. 20" required className="rounded-none border-zinc-800 font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label htmlFor="inOut" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Contact Info</Label>
                    <Input id="inOut" name="inOut" defaultValue={editingClient?.inOut} placeholder="Phone Number" required className="rounded-none border-zinc-800 font-bold" />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="patti" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Patti Rate</Label>
                    <Input id="patti" name="patti" defaultValue={editingClient?.patti} placeholder="Patti" required className="rounded-none border-zinc-800 font-bold" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                        <Label htmlFor="activeBalance" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Opening Balance</Label>
                        <Input id="activeBalance" name="activeBalance" type="number" defaultValue={editingClient?.activeBalance} placeholder="e.g. 0" className="rounded-none border-zinc-800 font-bold" />
                    </div>
                    <div className="space-y-1.5">
                        <Label htmlFor="securityMoney" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Security Money</Label>
                        <Input id="securityMoney" name="securityMoney" type="number" defaultValue={editingClient?.securityMoney} placeholder="e.g. 10000" required className="rounded-none border-zinc-800 font-bold" />
                    </div>
                </div>
                <DialogFooter className="pt-4">
                  <DialogClose asChild>
                    <Button type="button" variant="outline" className="rounded-none font-bold uppercase text-[10px]">Cancel</Button>
                  </DialogClose>
                  <Button type="submit" className="rounded-none font-black uppercase tracking-widest text-[10px]">Save Client</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex-1 p-0 overflow-hidden">
          <div className="hidden md:block h-full">
            <ScrollArea className="h-full">
              <table className="w-full text-sm text-left border-collapse">
                <thead className="text-[10px] font-black text-muted-foreground uppercase bg-muted/30 sticky top-0 z-10">
                  <tr className="border-b">
                    <th scope="col" className="px-6 py-4 tracking-widest">ID</th>
                    <th scope="col" className="px-6 py-4 tracking-widest">Client Name</th>
                    <th scope="col" className="px-6 py-4 tracking-widest">Pair/Comm</th>
                    <th scope="col" className="px-6 py-4 tracking-widest text-amber-500">Security Money</th>
                    <th scope="col" className="px-6 py-4 tracking-widest">Opening Balance</th>
                    <th scope="col" className="px-6 py-4 text-right tracking-widest">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {clients.map((client, index) => {
                    const balance = client.activeBalance || 0;
                    const balanceColor = balance >= 0 ? 'text-primary' : 'text-destructive';

                    return (
                      <tr key={client.id} className="bg-card hover:bg-muted/20 transition-colors">
                        <td className="px-6 py-4 font-mono text-xs text-muted-foreground">{index + 1}</td>
                        <td className="px-6 py-4">
                          <div className="font-black text-foreground uppercase tracking-tight">{client.name}</div>
                          <div className="text-[10px] text-muted-foreground font-bold">{client.inOut}</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-xs font-bold uppercase">P: {client.pair} | C: {client.comm}%</div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="text-sm font-black text-amber-500 tabular-nums">₹{formatNumber(client.securityMoney)}</div>
                        </td>
                        <td className={`px-6 py-4 font-black tabular-nums ${balanceColor}`}>₹{formatNumber(balance)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-1.5">
                              <Button variant="outline" size="sm" onClick={() => openTransactionDialog(client, 'deposit')} className="h-8 rounded-none border-primary/20 hover:bg-primary/5 font-bold uppercase text-[9px]">
                                  <ArrowUpCircle className="mr-1.5 h-3 w-3 text-primary" />
                                  Deposit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openTransactionDialog(client, 'withdraw')} className="h-8 rounded-none border-destructive/20 hover:bg-destructive/5 font-bold uppercase text-[9px]">
                                  <ArrowDownCircle className="mr-1.5 h-3 w-3 text-destructive" />
                                  Withdraw
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none">
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end" className="rounded-none">
                                  <DropdownMenuItem onClick={() => handleEditClient(client)} className="text-xs font-bold uppercase">
                                    <Edit className="mr-2 h-3.5 w-3.5" />
                                    <span>Edit Details</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleClearClientData(client.id, client.name)} className="text-xs font-bold uppercase">
                                    <Eraser className="mr-2 h-3.5 w-3.5" />
                                    <span>Clear Sheet Data</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive text-xs font-bold uppercase" onClick={() => handleDeleteClient(client.id, client.name)}>
                                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                                    <span>Delete Client</span>
                                  </DropdownMenuItem>
                                </DropdownMenuContent>
                              </DropdownMenu>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </ScrollArea>
          </div>
          
          <div className="md:hidden">
            <ScrollArea className="h-full">
              <div className="p-4 space-y-4">
                {clients.map((client) => {
                  const balance = client.activeBalance || 0;
                  const balanceColor = balance >= 0 ? 'text-primary' : 'text-destructive';

                  return (
                    <Card key={client.id} className="rounded-none border-zinc-800 shadow-sm overflow-hidden">
                      <div className="p-4 bg-muted/10 flex justify-between items-start">
                        <div>
                          <div className="font-black text-lg uppercase tracking-tight text-primary">{client.name}</div>
                          <div className="text-[10px] font-bold text-muted-foreground uppercase">{client.inOut}</div>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 rounded-none">
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="rounded-none">
                            <DropdownMenuItem onClick={() => handleEditClient(client)} className="text-xs font-bold uppercase">Edit Details</DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleClearClientData(client.id, client.name)} className="text-xs font-bold uppercase">Clear Data</DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive text-xs font-bold uppercase" onClick={() => handleDeleteClient(client.id, client.name)}>Delete</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="px-4 py-3 grid grid-cols-2 gap-4 border-t border-zinc-800 bg-card">
                        <div>
                          <p className="text-[9px] text-muted-foreground uppercase font-black tracking-widest mb-1">Opening Bal</p>
                          <p className={`text-lg font-black tabular-nums ${balanceColor}`}>₹{formatNumber(balance)}</p>
                        </div>
                        <div>
                          <p className="text-[9px] text-amber-500 uppercase font-black tracking-widest mb-1">Security</p>
                          <p className="text-lg font-black tabular-nums text-amber-500">₹{formatNumber(client.securityMoney)}</p>
                        </div>
                      </div>
                      <div className="p-2 flex gap-2 border-t border-zinc-800 bg-muted/5">
                        <Button variant="outline" size="sm" className="flex-1 rounded-none border-primary/20 font-bold uppercase text-[9px]" onClick={() => openTransactionDialog(client, 'deposit')}>
                            Deposit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1 rounded-none border-destructive/20 font-bold uppercase text-[9px]" onClick={() => openTransactionDialog(client, 'withdraw')}>
                            Withdraw
                        </Button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </ScrollArea>
          </div>
        </CardContent>
      </Card>
      
       <Dialog open={isListeningDialogOpen} onOpenChange={(open) => {
          if (!open) {
            stopListening();
          }
          setIsListeningDialogOpen(open)
        }}>
        <DialogContent className="sm:max-w-md rounded-none border-zinc-800" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center font-black uppercase tracking-widest text-primary">Listening...</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="relative">
              <Button size="icon" className="h-24 w-24 rounded-full bg-red-500 hover:bg-red-600 relative z-10">
                <Mic className="h-12 w-12" />
              </Button>
              <div className="absolute inset-0 rounded-full border-4 border-red-500 pulse-ring" />
            </div>
            <p className="text-sm font-bold text-muted-foreground min-h-[28px] uppercase">{interimTranscript || 'Ready...'}</p>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={stopListening} className="w-full rounded-none font-black uppercase tracking-widest text-xs">Finish</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!transactionClient} onOpenChange={(open) => { if (!open) setTransactionClient(null) }}>
        <DialogContent className="sm:max-w-lg rounded-none border-zinc-800">
            <DialogHeader>
                <DialogTitle className="font-black uppercase tracking-widest text-primary">
                  {transactionType === 'deposit' ? 'Record Deposit' : 'Record Withdrawal'}
                </DialogTitle>
                <DialogDescription className="font-bold uppercase text-[10px]">Client: {transactionClient?.name}</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <div className="space-y-1.5">
                  <Label htmlFor="transactionAmount" className="text-[10px] font-black uppercase tracking-widest text-muted-foreground">Amount</Label>
                  <Input
                      id="transactionAmount"
                      type="number"
                      value={transactionAmount}
                      onChange={(e) => setTransactionAmount(e.target.value)}
                      placeholder="Enter value"
                      className="rounded-none border-zinc-800 font-black text-lg h-12"
                  />
                </div>
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setTransactionClient(null)} className="rounded-none font-bold uppercase text-[10px]">Cancel</Button>
                <Button onClick={handleTransaction} className="rounded-none font-black uppercase tracking-widest text-[10px]">Confirm Entry</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent className="rounded-none border-zinc-800">
          <AlertDialogHeader>
            <AlertDialogTitle className="font-black uppercase tracking-widest text-destructive">{dialogTitle}</AlertDialogTitle>
            <AlertDialogDescription className="font-bold text-zinc-400">{dialogDescription}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-none font-bold uppercase text-[10px]">Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (dialogAction) {
                dialogAction();
              }
              setIsConfirmDialogOpen(false);
            }} className="rounded-none font-black uppercase tracking-widest text-[10px] bg-destructive hover:bg-destructive/90">
              Confirm Action
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
