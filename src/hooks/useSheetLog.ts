'use client';
import { useMemo, useCallback } from 'react';
import { collection, doc, writeBatch, query, where, getDocs } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { addDocumentNonBlocking, updateDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { useToast } from './use-toast';
import { format } from 'date-fns';

export interface SavedSheetInfo {
  id: string;
  clientName: string;
  clientId: string;
  gameTotal: number;
  data: { [key: string]: string };
  date: string; // ISO date string
  draw: string;
  rawInput?: string;
  createdAt?: string;
}

const SILO_ID = "global-admin";

export const useSheetLog = (userId?: string) => {
  const firestore = useFirestore();
  const { toast } = useToast();

  const sheetLogColRef = useMemoFirebase(() => {
    if (!userId) return null;
    return collection(firestore, `users/${SILO_ID}/sheetLogs`);
  }, [firestore, userId]);

  const { data: sheetLogData, isLoading, error, setData: setSheetLogData } = useCollection<Omit<SavedSheetInfo, 'id'>>(sheetLogColRef);

  const savedSheetLog = useMemo(() => {
    if (!sheetLogData) return {};
    const logByDraw: { [key: string]: SavedSheetInfo[] } = {};
    sheetLogData.forEach(log => {
      if (!logByDraw[log.draw]) {
        logByDraw[log.draw] = [];
      }
      logByDraw[log.draw].push(log);
    });
    return logByDraw;
  }, [sheetLogData]);

  const addSheetLogEntry = useCallback((entry: Omit<SavedSheetInfo, 'id'> | SavedSheetInfo) => {
    if (!sheetLogColRef) return;
    
    if ('id' in entry) {
      const docRef = doc(firestore, sheetLogColRef.path, entry.id);
      const { id, ...entryData } = entry;
      updateDocumentNonBlocking(docRef, entryData);
    } else {
      addDocumentNonBlocking(sheetLogColRef, entry);
    }
  }, [sheetLogColRef, firestore]);
  
  const deleteSheetLogEntry = useCallback((logId: string) => {
    setSheetLogData(prevData => prevData?.filter(log => log.id !== logId) || null);
    const docRef = doc(firestore, `users/${SILO_ID}/sheetLogs`, logId);
    deleteDocumentNonBlocking(docRef);
    toast({ title: "Entry Deleted" });
  }, [firestore, setSheetLogData, toast]);

  const deleteSheetLogsForClient = useCallback(async (clientId: string, showToast: boolean = true) => {
    return new Promise(async (resolve, reject) => {
        try {
            const q = query(collection(firestore, `users/${SILO_ID}/sheetLogs`), where("clientId", "==", clientId));
            const querySnapshot = await getDocs(q);

            if (querySnapshot.empty) {
                resolve();
                return;
            }

            const batch = writeBatch(firestore);
            querySnapshot.forEach((doc) => batch.delete(doc.ref));
            await batch.commit();

            setSheetLogData(currentLogs => {
                if (!currentLogs) return null;
                return currentLogs.filter(log => log.clientId !== clientId);
            });

            resolve();
        } catch (e) {
            console.error("Error clearing sheet logs: ", e);
            reject(e);
        }
    });
  }, [firestore, setSheetLogData]);
  
  const deleteSheetLogsForDraw = useCallback(async (draw: string, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');

    try {
      const q = query(
        collection(firestore, `users/${SILO_ID}/sheetLogs`),
        where("draw", "==", draw),
        where("date", "==", dateStr)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) return;
      
      const logsToDeleteIds = querySnapshot.docs.map(doc => doc.id);
      
      setSheetLogData(prevData => {
        if (!prevData) return null;
        return prevData.filter(log => !logsToDeleteIds.includes(log.id));
      });

      const batch = writeBatch(firestore);
      querySnapshot.forEach((doc) => batch.delete(doc.ref));
      await batch.commit();

      toast({ title: "Success", description: `Cleared draw data.` });
    } catch (e) {
      console.error("Error clearing draw logs: ", e);
    }
  }, [firestore, setSheetLogData, toast]);

  return { savedSheetLog, isLoading, error, addSheetLogEntry, deleteSheetLogsForClient, deleteSheetLogsForDraw, deleteSheetLogEntry };
};