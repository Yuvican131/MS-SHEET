import { NextResponse } from 'next/server';
import { initializeFirebase } from '@/firebase';
import { collection, query, where, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { processOrder } from '@/ai/flows/process-order-flow';
import { format } from 'date-fns';

/**
 * API Route for n8n/WhatsApp Automation.
 * Expects: { "message": string, "clientPhoneNumber": string }
 */
export async function POST(request: Request) {
  const { firestore } = initializeFirebase();
  try {
    const body = await request.json();
    const { message, clientPhoneNumber } = body;

    if (!message || !clientPhoneNumber) {
      return NextResponse.json({ error: 'Missing message or clientPhoneNumber' }, { status: 400 });
    }

    // 1. Find the User and Client associated with the phone number (matching the 'inOut' field)
    const usersSnapshot = await getDocs(collection(firestore, 'users'));
    let targetUserId: string | null = null;
    let targetClientId: string | null = null;
    let targetClient: any | null = null;

    for (const userDoc of usersSnapshot.docs) {
      const clientsRef = collection(firestore, `users/${userDoc.id}/clients`);
      const q = query(clientsRef, where("inOut", "==", clientPhoneNumber));
      const clientsSnapshot = await getDocs(q);

      if (!clientsSnapshot.empty) {
        targetUserId = userDoc.id;
        const clientDoc = clientsSnapshot.docs[0];
        targetClientId = clientDoc.id;
        targetClient = clientDoc.data();
        break;
      }
    }

    if (!targetUserId || !targetClientId || !targetClient) {
      return NextResponse.json({ error: `Client with phone ${clientPhoneNumber} not found.` }, { status: 404 });
    }

    // 2. Use AI to parse the raw WhatsApp message
    const { draw, orders } = await processOrder({ message, clientPhoneNumber });

    if (!draw || !orders || orders.length === 0) {
      return NextResponse.json({ error: 'AI could not extract entries from the message.' }, { status: 422 });
    }

    // 3. Update the Sheet Log (Upsert for the current day and draw)
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const sheetLogId = `${targetClientId}-${draw}-${todayStr}`;
    const logRef = doc(firestore, `users/${targetUserId}/sheetLogs`, sheetLogId);

    const logSnap = await getDoc(logRef);
    const existingLog = logSnap.exists() ? logSnap.data() : { data: {}, gameTotal: 0 };
    const mergedData = { ...existingLog.data };
    let newTotal = existingLog.gameTotal;

    orders.forEach(order => {
      const key = order.number.padStart(2, '0');
      const amt = order.amount;
      const current = parseFloat(mergedData[key]) || 0;
      mergedData[key] = String(current + amt);
      newTotal += amt;
    });

    await setDoc(logRef, {
      clientId: targetClientId,
      clientName: targetClient.name,
      draw: draw,
      date: todayStr,
      gameTotal: newTotal,
      data: mergedData,
      rawInput: `[Automation] ${message}`,
      createdAt: existingLog.createdAt || new Date().toISOString()
    }, { merge: true });

    return NextResponse.json({ 
      success: true, 
      message: `Processed ${orders.length} entries for ${targetClient.name} in ${draw}.` 
    });

  } catch (error: any) {
    console.error('Automation Error:', error);
    return NextResponse.json({ error: 'Internal Server Error', details: error.message }, { status: 500 });
  }
}