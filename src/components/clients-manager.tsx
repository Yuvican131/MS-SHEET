"use client"
import { useState, useEffect, useRef, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter, DialogClose, DialogDescription } from "@/components/ui/dialog"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { PlusCircle, MoreHorizontal, Edit, Trash2, ArrowUpCircle, ArrowDownCircle, Eraser, Mic } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, DropdownMenuSeparator } from "@/components/ui/dropdown-menu"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Account } from "./accounts-manager"
import { formatNumber } from "@/lib/utils"
import { useToast } from "@/hooks/use-toast"
import type { Client } from "@/hooks/useClients"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

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
    const paymentType = formData.get("paymentType") as Client['paymentType'];

    if (editingClient) {
      const updatedClient = { ...editingClient, name, pair, comm, inOut, patti, activeBalance, paymentType };
      onUpdateClient(updatedClient);
    } else {
      const newClient: Omit<Client, 'id'> = { name, pair, comm, inOut, patti, activeBalance, paymentType }
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
      <Card className="h-full flex flex-col">
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle>Manage Clients</CardTitle>
          <Dialog open={isFormDialogOpen} onOpenChange={(open) => {
            if (!open) {
              setEditingClient(null);
              stopListening();
            }
            setIsFormDialogOpen(open)
          }}>
            <DialogTrigger asChild>
              <Button size="sm" onClick={openAddDialog}>
                <PlusCircle className="h-4 w-4 mr-2" />
                Add Client
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>{editingClient ? "Edit Client" : "Add New Client"}</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleSaveClient} className="space-y-4">
                <div>
                  <Label htmlFor="name">Name</Label>
                  <div className="relative">
                    <Input 
                      id="name" 
                      name="name" 
                      value={clientNameInput} 
                      onChange={(e) => setClientNameInput(e.target.value)} 
                      placeholder="Enter name or use voice" 
                      required 
                    />
                    <Button 
                      type="button" 
                      variant="outline"
                      size="icon" 
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7"
                      onClick={handleListen}
                    >
                      <Mic className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="pair">Pair</Label>
                    <Input id="pair" name="pair" defaultValue={editingClient?.pair} placeholder="Pair" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="comm">Comm</Label>
                    <Input id="comm" name="comm" defaultValue={editingClient?.comm} placeholder="Comm" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="inOut">Phone Number (In/Out)</Label>
                    <Input id="inOut" name="inOut" defaultValue={editingClient?.inOut} placeholder="Phone Number" required />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="patti">Patti</Label>
                    <Input id="patti" name="patti" defaultValue={editingClient?.patti} placeholder="Patti" required />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                    <div>
                        <Label htmlFor="activeBalance">Opening Balance</Label>
                        <Input id="activeBalance" name="activeBalance" type="number" defaultValue={editingClient?.activeBalance} placeholder="e.g. 1000" />
                    </div>
                    <div>
                        <Label htmlFor="paymentType">Payment Type</Label>
                        <Select name="paymentType" defaultValue={editingClient?.paymentType || 'credit'}>
                            <SelectTrigger id="paymentType">
                                <SelectValue placeholder="Select Type" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="credit">Credit</SelectItem>
                                <SelectItem value="pre-paid">Pre-paid</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                <DialogFooter>
                  <DialogClose asChild>
                    <Button type="button" variant="outline">Cancel</Button>
                  </DialogClose>
                  <Button type="submit">Save</Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent className="flex-1 min-h-0">
          <div className="hidden md:block">
            <ScrollArea className="h-full">
              <table className="w-full text-sm text-left">
                <thead className="text-xs text-muted-foreground uppercase bg-muted/50">
                  <tr>
                    <th scope="col" className="px-6 py-3">SI.No</th>
                    <th scope="col" className="px-6 py-3">Name</th>
                    <th scope="col" className="px-6 py-3">Pair</th>
                    <th scope="col" className="px-6 py-3">Comm</th>
                    <th scope="col" className="px-6 py-3">Opening Balance</th>
                    <th scope="col" className="px-6 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {clients.map((client, index) => {
                    const balance = client.activeBalance || 0;
                    const balanceColor = balance >= 0 ? 'text-green-500' : 'text-red-500';

                    return (
                      <tr key={client.id} className="bg-card border-b hover:bg-muted/50">
                        <td className="px-6 py-4">{index + 1}</td>
                        <td className="px-6 py-4 font-medium whitespace-nowrap">{client.name}</td>
                        <td className="px-6 py-4">{client.pair}</td>
                        <td className="px-6 py-4">{client.comm}%</td>
                        <td className={`px-6 py-4 font-bold ${balanceColor}`}>{formatNumber(balance)}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center justify-end gap-2">
                              <Button variant="outline" size="sm" onClick={() => openTransactionDialog(client, 'deposit')}>
                                  <ArrowUpCircle className="mr-2 h-4 w-4 text-green-500" />
                                  Deposit
                              </Button>
                              <Button variant="outline" size="sm" onClick={() => openTransactionDialog(client, 'withdraw')}>
                                  <ArrowDownCircle className="mr-2 h-4 w-4 text-red-500" />
                                  Withdrawal
                              </Button>
                              <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                  <Button variant="ghost" className="h-8 w-8 p-0">
                                    <span className="sr-only">Open menu</span>
                                    <MoreHorizontal className="h-4 w-4" />
                                  </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent align="end">
                                  <DropdownMenuItem onClick={() => handleEditClient(client)}>
                                    <Edit className="mr-2 h-4 w-4" />
                                    <span>Edit Details</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuItem onClick={() => handleClearClientData(client.id, client.name)}>
                                    <Eraser className="mr-2 h-4 w-4" />
                                    <span>Clear Sheet Data</span>
                                  </DropdownMenuItem>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDeleteClient(client.id, client.name)}>
                                    <Trash2 className="mr-2 h-4 w-4" />
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
              <div className="space-y-4">
                {clients.map((client) => {
                  const balance = client.activeBalance || 0;
                  const balanceColor = balance >= 0 ? 'text-green-500' : 'text-red-500';

                  return (
                    <Card key={client.id} className="p-4">
                      <div className="flex justify-between items-start">
                        <div>
                          <CardTitle className="text-lg">{client.name}</CardTitle>
                          <CardDescription>
                            Pair: {client.pair} | Comm: {client.comm}%
                          </CardDescription>
                        </div>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" className="h-8 w-8 p-0">
                              <span className="sr-only">Open menu</span>
                              <MoreHorizontal className="h-4 w-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            <DropdownMenuItem onClick={() => handleEditClient(client)}>
                              <Edit className="mr-2 h-4 w-4" />
                              <span>Edit Details</span>
                            </DropdownMenuItem>
                            <DropdownMenuItem onClick={() => handleClearClientData(client.id, client.name)}>
                              <Eraser className="mr-2 h-4 w-4" />
                              <span>Clear Sheet Data</span>
                            </DropdownMenuItem>
                            <DropdownMenuSeparator />
                            <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive" onClick={() => handleDeleteClient(client.id, client.name)}>
                              <Trash2 className="mr-2 h-4 w-4" />
                              <span>Delete Client</span>
                            </DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </div>
                      <div className="mt-4">
                        <p className="text-sm text-muted-foreground">Opening Balance</p>
                        <p className={`text-2xl font-bold ${balanceColor}`}>₹{formatNumber(balance)}</p>
                      </div>
                      <div className="mt-4 flex gap-2">
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openTransactionDialog(client, 'deposit')}>
                            <ArrowUpCircle className="mr-2 h-4 w-4 text-green-500" />
                            Deposit
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => openTransactionDialog(client, 'withdraw')}>
                            <ArrowDownCircle className="mr-2 h-4 w-4 text-red-500" />
                            Withdrawal
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
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          <DialogHeader>
            <DialogTitle className="text-center">Listening...</DialogTitle>
          </DialogHeader>
          <div className="flex flex-col items-center justify-center h-48 gap-4">
            <div className="relative">
              <Button size="icon" className="h-24 w-24 rounded-full bg-red-500 hover:bg-red-600 relative">
                <Mic className="h-12 w-12" />
              </Button>
              <div className="absolute inset-0 rounded-full border-4 border-red-500 pulse-ring" />
            </div>
            <p className="text-lg text-muted-foreground min-h-[28px]">{interimTranscript || '...'}</p>
          </div>
          <DialogFooter>
            <Button variant="destructive" onClick={stopListening}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Dialog open={!!transactionClient} onOpenChange={(open) => { if (!open) setTransactionClient(null) }}>
        <DialogContent className="sm:max-w-lg">
            <DialogHeader>
                <DialogTitle>{transactionType === 'deposit' ? 'Record a Deposit for' : 'Record a Withdrawal for'} {transactionClient?.name}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-4">
                <Label htmlFor="transactionAmount">Amount</Label>
                <Input
                    id="transactionAmount"
                    type="number"
                    value={transactionAmount}
                    onChange={(e) => setTransactionAmount(e.target.value)}
                    placeholder="Enter amount"
                />
            </div>
            <DialogFooter>
                <Button variant="outline" onClick={() => setTransactionClient(null)}>Cancel</Button>
                <Button onClick={handleTransaction}>Confirm Transaction</Button>
            </DialogFooter>
        </DialogContent>
      </Dialog>
      <AlertDialog open={isConfirmDialogOpen} onOpenChange={setIsConfirmDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{dialogTitle}</AlertDialogTitle>
          </AlertDialogHeader>
          <AlertDialogDescription>{dialogDescription}</AlertDialogDescription>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={() => {
              if (dialogAction) {
                dialogAction();
              }
              setIsConfirmDialogOpen(false);
            }}>
              Confirm
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
