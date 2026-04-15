'use client';
import { useMemo, useState, useCallback } from 'react';
import { collection, doc } from 'firebase/firestore';
import { useFirestore, useCollection, useMemoFirebase } from '@/firebase';
import { setDocumentNonBlocking, deleteDocumentNonBlocking } from '@/firebase/non-blocking-updates';
import { format } from 'date-fns';

export interface DeclaredNumber {
  id: string; 
  number: string;
  draw: string;
  date: string; 
  _deleted?: boolean;
}

const EMPTY_OBJECT = {};

export const useDeclaredNumbers = (userId?: string) => {
  const firestore = useFirestore();
  const [localDeclaredNumbers, setLocalDeclaredNumbers] = useState<{ [key: string]: DeclaredNumber | null }>({});

  const declaredNumbersColRef = useMemoFirebase(() => {
    if (!userId) return null;
    return collection(firestore, `users/${userId}/declaredNumbers`);
  }, [firestore, userId]);

  const { data, isLoading, error } = useCollection<Omit<DeclaredNumber, 'id'>>(declaredNumbersColRef);

  const declaredNumbers = useMemo(() => {
    const fromDb = data?.reduce((acc, item) => {
      acc[item.id] = item;
      return acc;
    }, {} as { [key: string]: DeclaredNumber }) || {};

    const merged = { ...fromDb, ...localDeclaredNumbers };

    const clean: { [key: string]: DeclaredNumber } = {};
    Object.keys(merged).forEach(key => {
      const val = merged[key];
      if (val !== null && !val?._deleted) {
        clean[key] = val;
      }
    });

    return Object.keys(clean).length === 0 ? (EMPTY_OBJECT as { [key: string]: DeclaredNumber }) : clean;
  }, [data, localDeclaredNumbers]);

  const getDeclaredNumber = useCallback((draw: string, date: Date | undefined): string | undefined => {
    if (!date) return undefined;
    const dateStr = format(date, 'yyyy-MM-dd');
    const docId = `${draw}-${dateStr}`;
    const entry = declaredNumbers[docId];
    return entry ? entry.number : undefined;
  }, [declaredNumbers]);

  const setDeclaredNumber = useCallback((draw: string, number: string, date: Date) => {
    if (!date || !userId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const docId = `${draw}-${dateStr}`;
    const docRef = doc(firestore, `users/${userId}/declaredNumbers`, docId);
    
    setLocalDeclaredNumbers(prev => ({
        ...prev,
        [docId]: { id: docId, draw, number, date: dateStr, _deleted: false }
    }));
    
    setDocumentNonBlocking(docRef, { number, draw, date: dateStr }, { merge: true });
  }, [firestore, userId]);
  
  const removeDeclaredNumber = useCallback((draw: string, date: Date) => {
    if (!date || !userId) return;
    const dateStr = format(date, 'yyyy-MM-dd');
    const docId = `${draw}-${dateStr}`;

    setLocalDeclaredNumbers(prev => ({ ...prev, [docId]: { ...prev[docId], _deleted: true } as DeclaredNumber | null }));

    const docRef = doc(firestore, `users/${userId}/declaredNumbers`, docId);
    deleteDocumentNonBlocking(docRef);
  }, [firestore, userId]);

  return useMemo(() => ({ 
    declaredNumbers, 
    isLoading, 
    error, 
    setDeclaredNumber, 
    removeDeclaredNumber, 
    getDeclaredNumber 
  }), [declaredNumbers, isLoading, error, setDeclaredNumber, removeDeclaredNumber, getDeclaredNumber]);
};
