'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import {
  Query,
  onSnapshot,
  DocumentData,
  FirestoreError,
  QuerySnapshot,
  CollectionReference,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export type WithId<T> = T & { id: string };

export interface UseCollectionResult<T> {
  data: WithId<T>[] | null;
  isLoading: boolean;
  error: FirestoreError | Error | null;
  setData: React.Dispatch<React.SetStateAction<WithId<T>[] | null>>;
}

const EMPTY_ARRAY: any[] = [];

export function useCollection<T = any>(
  memoizedTargetRefOrQuery: (CollectionReference<DocumentData> | Query<DocumentData>) | null | undefined,
): UseCollectionResult<T> {
  const [data, setData] = useState<WithId<T>[] | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<FirestoreError | Error | null>(null);
  
  // Use hash-based checking to prevent redundant re-renders
  const prevDataHash = useRef<string>("");

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      if (data !== null) setData(null);
      if (isLoading) setIsLoading(false);
      if (error !== null) setError(null);
      return;
    }

    if (!isLoading) setIsLoading(true);
    if (error) setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = snapshot.docs.map(doc => ({
          ...(doc.data() as T),
          id: doc.id
        }));
        
        // Only trigger state update if the data content actually changed
        const currentHash = JSON.stringify(results);
        if (currentHash !== prevDataHash.current) {
          prevDataHash.current = currentHash;
          setData(results.length === 0 ? EMPTY_ARRAY : results);
        }
        
        setError(null);
        setIsLoading(false);
      },
      (err: FirestoreError) => {
        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path: 'collection',
        });

        setError(contextualError);
        setData(null);
        setIsLoading(false);
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  // Return a memoized object to prevent infinite re-render loops in components using this hook
  return useMemo(() => ({ 
    data, 
    isLoading, 
    error, 
    setData 
  }), [data, isLoading, error]);
}