"use client";
import { useState, useEffect, useCallback } from 'react';

// This hook is no longer the primary source of truth for surveys, 
// but can still be used for other client-side state persistence.

export function useLocalStorage<T>(key: string, initialValue: T): [T, (value: T | ((val: T) => T)) => void] {
  const [storedValue, setStoredValue] = useState<T>(() => {
    if (typeof window === 'undefined') {
      return initialValue;
    }
    try {
      const item = window.localStorage.getItem(key);
      return item ? JSON.parse(item) : initialValue;
    } catch (error) {
      console.log(error);
      return initialValue;
    }
  });

  const setValue = (value: T | ((val: T) => T)) => {
    try {
      const valueToStore =
        value instanceof Function ? value(storedValue) : value;
      setStoredValue(valueToStore);
      if (typeof window !== 'undefined') {
        window.localStorage.setItem(key, JSON.stringify(valueToStore));
      }
    } catch (error) {
      console.log(error);
    }
  };
  
  const handleStorageChange = useCallback((event: StorageEvent) => {
      if (event.key === key && event.newValue) {
          try {
            setStoredValue(JSON.parse(event.newValue));
          } catch (error) {
            console.log(error);
          }
      }
  }, [key]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
        window.addEventListener('storage', handleStorageChange);
        return () => {
            window.removeEventListener('storage', handleStorageChange);
        };
    }
  }, [handleStorageChange]);


  return [storedValue, setValue];
}
