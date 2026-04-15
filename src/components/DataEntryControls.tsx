"use client";

import React, { useState, useEffect, useRef, useCallback, forwardRef, useImperativeHandle } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Save, Undo2, Trash2, FileSpreadsheet, Copy, Eye, Download, Mic, Upload, StopCircle, Loader2 } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogFooter, DialogClose, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import type { Client } from "@/hooks/useClients";
import { formatNumber } from "@/lib/utils";
import { transcribeAudio } from "@/ai/flows/transcribe-audio-flow";

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
    checkBalance,
    showClientSelectionToast,
    getClientDisplay,
    focusMultiText,
    openMasterSheet,
    currentGridData,
    draw,
    openViewEntryDialog,
  } = props;

  const { toast } = useToast();
  const [multiText, setMultiText] = useState("");

  const multiTextRef = useRef<HTMLTextAreaElement>(null);

  useImperativeHandle(ref, () => ({
    focus: () => multiTextRef.current?.focus()
  }));

  const isDataEntryDisabled = !selectedClientId;

  const handleMultiTextApply = useCallback(() => {
    if (isDataEntryDisabled) {
      showClientSelectionToast();
      return;
    }
    if (!multiText.trim()) return;

    const updates: { [key: string]: number } = {};
    let totalForCheck = 0;

    const lines = multiText.split(/[\n\r]+/);

    lines.forEach(line => {
      const parts = line.trim().split(/[\s,=]+/);
      for (let i = 0; i < parts.length; i += 2) {
        const num = parts[i];
        const amt = parseFloat(parts[i + 1]);

        if (num && !isNaN(amt)) {
          const key = num.padStart(2, '0').slice(-2);
          updates[key] = (updates[key] || 0) + amt;
          totalForCheck += amt;
        }
      }
    });

    if (!checkBalance(totalForCheck)) return;

    onDataUpdate(updates, multiText);
    setMultiText("");
    setTimeout(() => multiTextRef.current?.focus(), 0);

  }, [multiText, isDataEntryDisabled, onDataUpdate, checkBalance, showClientSelectionToast]);

  return (
    <div className="flex flex-col gap-2 w-full">
      
      {/* CLIENT SELECT */}
      <div className="border rounded-lg p-2 flex gap-2">
        <Select value={selectedClientId || 'None'} onValueChange={onClientChange}>
          <SelectTrigger className="flex-grow h-8 text-xs">
            <SelectValue placeholder="Select Client" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="None">None</SelectItem>
            {clients.map(client => (
              <SelectItem key={client.id} value={client.id}>
                {getClientDisplay(client)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Button onClick={onSave} size="sm">Save</Button>
        <Button onClick={onRevert} size="sm" variant="outline">Revert</Button>
      </div>

      {/* MULTI TEXT */}
      <Textarea
        ref={multiTextRef}
        value={multiText}
        onChange={(e) => setMultiText(e.target.value)}
        placeholder="01=100 or 01 100"
      />

      <div className="grid grid-cols-2 gap-2">
        <Button onClick={handleMultiTextApply}>Apply</Button>
        <Button onClick={onClear} variant="destructive">Clear</Button>
      </div>

      <Button onClick={openMasterSheet} variant="outline">
        <FileSpreadsheet className="mr-2 h-4 w-4" />
        View Master Sheet
      </Button>

    </div>
  );
});

DataEntryControls.displayName = 'DataEntryControls';