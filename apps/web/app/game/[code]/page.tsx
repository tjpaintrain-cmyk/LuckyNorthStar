'use client';
import { useState } from 'react';

export default function Game({ params }:{ params:{ code:string } }){
  const [currency,setCurrency]=useState<'GC'|'SC'>('GC');
  const [amount,setAmount]=useState(20);
  const [log,setLog]=useState<any>(null);
  const [roundId,setRoundId]=useState<string>('');

  async function start(){
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${params.code}/start`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')||''}`},
      body: JSON.stringify({ currency, amount, clientSeed: 'demo' })
    }).then(r=>r.json());
    if(r.roundId) setRoundId(r.roundId);
    setLog(r);
  }
  async function resolve(){
    const r = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/games/${params.code}/resolve`,{
      method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${localStorage.getItem('token')||''}`},
      body: JSON.stringify({ roundId })
    }).then(r=>r.json());
    setLog(r);
  }
  return (
    <main className="p-6 text-white bg-black min-h-screen">
      <h2 className="text-2xl font-bold">{params.code}</h2>
      <div className="mt-4 flex gap-2 items-center">
        <select value={currency} onChange={e=>setCurrency(e.target.value as any)} className="bg-zinc-900 p-2 rounded">
          <option>GC</option><option>SC</option>
        </select>
        <input value={amount} onChange={e=>setAmount(parseInt(e.target.value||'0'))} type="number" className="bg-zinc-900 p-2 rounded w-32"/>
        <button className="px-3 py-2 rounded bg-fuchsia-600" onClick={start}>Start</button>
        <button disabled={!roundId} className="px-3 py-2 rounded bg-zinc-700 disabled:opacity-50" onClick={resolve}>Resolve</button>
      </div>
      <pre className="mt-6 bg-zinc-900 p-4 rounded overflow-auto">{log? JSON.stringify(log,null,2): '—'}</pre>
      <p className="text-xs text-gray-400 mt-4">Set a token in localStorage from /auth/signup response before playing.</p>
    </main>
  );
}
