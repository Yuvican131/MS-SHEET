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
  
  // Track previous data stringified to detect real changes
  const prevDataHash = useRef<string>("");

  useEffect(() => {
    if (!memoizedTargetRefOrQuery) {
      setData(prev => prev === null ? prev : null);
      setIsLoading(prev => prev === false ? prev : false);
      setError(prev => prev === null ? prev : null);
      return;
    }

    // Only set loading if not already loading to avoid extra renders
    setIsLoading(current => current ? current : true);
    setError(null);

    const unsubscribe = onSnapshot(
      memoizedTargetRefOrQuery,
      (snapshot: QuerySnapshot<DocumentData>) => {
        const results: WithId<T>[] = [];
        for (const doc of snapshot.docs) {
          results.push({ ...(doc.data() as T), id: doc.id });
        }
        
        // Simple hash check to avoid updating state with same data
        const currentHash = JSON.stringify(results);
        if (currentHash !== prevDataHash.current) {
          prevDataHash.current = currentHash;
          setData(results.length === 0 ? EMPTY_ARRAY : results);
        }
        
        setError(null);
        setIsLoading(false);
      },
      (error: FirestoreError) => {
        const path = memoizedTargetRefOrQuery.type === 'collection'
          ? (memoizedTargetRefOrQuery as CollectionReference).path
          : 'Query';

        const contextualError = new FirestorePermissionError({
          operation: 'list',
          path,
        })

        setError(contextualError)
        setData(null)
        setIsLoading(false)
        errorEmitter.emit('permission-error', contextualError);
      }
    );

    return () => unsubscribe();
  }, [memoizedTargetRefOrQuery]);

  return useMemo(() => ({ 
    data, 
    isLoading, 
    error, 
    setData 
  }), [data, isLoading, error, setData]);
}
