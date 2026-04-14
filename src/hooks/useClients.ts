'use client';
import { useMemo, useCallback } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import {
  addDocumentNonBlocking,
  updateDocumentNonBlocking,
  deleteDocumentNonBlocking
} from '@/firebase/non-blocking-updates';
import { useSheetLog } from './useSheetLog';

const EMPTY_ARRAY: any[] = [];

export type Client = {
  id: string;
  name: string;
  pair: string;
  comm: string;
  inOut: string;
  patti: string;
  activeBalance: number;
  securityMoney: number;
};

export const useClients = (userId?: string) => {
  const firestore = useFirestore();
  const { toast } = useToast();
  const { deleteSheetLogsForClient } = useSheetLog(userId);

  const clientsColRef = useMemoFirebase(() => {
    if (!userId) return null;
    return collection(firestore, `users/${userId}/clients`);
  }, [firestore, userId]);

  const { data, isLoading, error } = useCollection<Omit<Client, 'id'>>(clientsColRef);
  
  const clients = useMemo(() => data || EMPTY_ARRAY, [data]);

  const addClient = useCallback((client: Omit<Client, 'id'>) => {
    if (!clientsColRef) return;
    addDocumentNonBlocking(clientsColRef, client);
    toast({ title: "Client Added", description: `${client.name} has been added.` });
  }, [clientsColRef, toast]);

  const updateClient = useCallback((client: Client) => {
    if (!userId) return;
    const clientRef = doc(firestore, `users/${userId}/clients`, client.id);
    const { id, ...clientData } = client;
    updateDocumentNonBlocking(clientRef, clientData);
    toast({ title: "Client Updated", description: `${client.name}'s details have been updated.` });
  }, [firestore, userId, toast]);

  const deleteClient = useCallback((id: string, name: string) => {
    if (!userId) return;
    deleteSheetLogsForClient(id, false).then(() => {
      const clientRef = doc(firestore, `users/${userId}/clients`, id);
      deleteDocumentNonBlocking(clientRef);
      toast({ title: "Client Deleted", description: `${name} and all their data have been deleted.` });
    });
  }, [firestore, userId, deleteSheetLogsForClient, toast]);
  
  const clearClientData = useCallback((id: string, name: string) => {
    deleteSheetLogsForClient(id, true);
    toast({ title: "Client Data Cleared", description: `All sheet data for ${name} has been cleared.` });
  }, [deleteSheetLogsForClient, toast]);

  const handleClientTransaction = useCallback((clientId: string, amount: number) => {
    const client = clients.find(c => c.id === clientId);
    if (client) {
      const newBalance = (client.activeBalance || 0) + amount;
      updateClient({ ...client, activeBalance: newBalance });
    }
  }, [clients, updateClient]);

  return useMemo(() => ({ 
    clients, 
    isLoading, 
    error, 
    addClient, 
    updateClient, 
    deleteClient, 
    handleClientTransaction, 
    clearClientData 
  }), [clients, isLoading, error, addClient, updateClient, deleteClient, handleClientTransaction, clearClientData]);
};
