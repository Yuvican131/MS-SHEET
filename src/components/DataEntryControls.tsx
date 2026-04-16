"use client";

import React, { useState, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileSpreadsheet } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/hooks/useClients";

interface DataEntryControlsProps {
  clients: Client[];
  selectedClientId: string | null;
  onClientChange: (clientId: string) => void;
  onSave: () => void;
  onRevert: () => void;
  isRevertDisabled: boolean;
  onDataUpdate: (updates: { [key: string]: number | string }, lastEntryString: string) => void;
  onClear: () => void;
  setLastEntry: (entry: string) => void;
  checkBalance: (total: number) => boolean;
  showClientSelectionToast: () => void;
  getClientDisplay: (client: Client) => string;
  focusMultiText: () => void;
  openMasterSheet: () => void;
  currentGridData: { [key: string]: string };
  draw: string;
  openViewEntryDialog: () => void;
}

export const DataEntryControls = forwardRef<any, DataEntryControlsProps>((props, ref) => {
  const {
    clients,
    selectedClientId,
    onClientChange,
    onSave,
    onRevert,
    isRevertDisabled,
    onDataUpdate,
    onClear,
    showClientSelectionToast,
    getClientDisplay,
    openMasterSheet,
  } = props;

  const { toast } = useToast();
  const [multiText, setMultiText] = useState("");

  const multiTextRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => multiTextRef.current?.focus()
  }));

  const handleMultiTextApply = useCallback(() => {
    if (!selectedClientId) {
      showClientSelectionToast();
      return;
    }
    if (!multiText.trim()) return;

    const updates: { [key: string]: number } = {};
    const lines = multiText.split(/[\n\r,]+/);

    lines.forEach(line => {
      const parts = line.trim().split(/[\s=]+/);
      for (let i = 0; i < parts.length; i += 2) {
        let key = parts[i]?.toUpperCase() || "";
        const amt = parseFloat(parts[i + 1]);

        if (key && !isNaN(amt)) {
          // Standard: "01", "1", "100" -> "01", "01", "00"
          if (/^\d+$/.test(key)) {
             const num = parseInt(key, 10);
             key = (num % 100).toString().padStart(2, '0');
          }
          // Harup: "A0", "B5" etc.
          updates[key] = (updates[key] || 0) + amt;
        }
      }
    });

    if (Object.keys(updates).length > 0) {
      onDataUpdate(updates, multiText);
      setMultiText("");
      setTimeout(() => multiTextRef.current?.focus(), 0);
    }
  }, [multiText, selectedClientId, onDataUpdate, showClientSelectionToast]);

  return (
    <div className="flex flex-col gap-3 w-full">
      <div className="flex gap-2">
        <Select value={selectedClientId || 'None'} onValueChange={onClientChange}>
          <SelectTrigger className="flex-grow h-10 rounded-none border-zinc-800 font-bold uppercase text-[10px]">
            <SelectValue placeholder="Select Client" />
          </SelectTrigger>
          <SelectContent className="rounded-none border-zinc-800">
            <SelectItem value="None">None</SelectItem>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id} className="font-bold uppercase text-[10px]">
                {getClientDisplay(client)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onSave} className="h-10 px-4 rounded-none font-black uppercase text-[10px] tracking-widest bg-primary text-white">Save</Button>
        <Button onClick={onRevert} disabled={isRevertDisabled} variant="outline" className="h-10 px-4 rounded-none font-black uppercase text-[10px] tracking-widest border-zinc-800">Revert</Button>
      </div>

      <Textarea
        ref={multiTextRef}
        value={multiText}
        onChange={(e) => setMultiText(e.target.value)}
        placeholder="01=100, A0=500, B5=200"
        className="min-h-[120px] rounded-none border-zinc-800 font-bold text-sm bg-zinc-950/50 resize-none focus-visible:ring-primary"
      />

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleMultiTextApply} className="rounded-none font-black uppercase tracking-widest h-12 bg-primary">Apply</Button>
        <Button onClick={onClear} variant="destructive" className="rounded-none font-black uppercase tracking-widest h-12">Clear</Button>
      </div>

      <Button onClick={openMasterSheet} variant="outline" className="w-full h-12 rounded-none font-black uppercase tracking-widest border-zinc-800 hover:bg-zinc-900">
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        View Master Sheet
      </Button>
    </div>
  );
});

DataEntryControls.displayName = 'DataEntryControls';