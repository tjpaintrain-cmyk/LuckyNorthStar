'use client';
import Link from 'next/link';
export default function Lobby(){
  const games = [
    { code:'slot-neon-heist', name:'Neon Heist (Slot)' },
  ];
  return (
    <main className="p-6 text-white bg-black min-h-screen">
      <h2 className="text-2xl font-bold mb-4">Lobby</h2>
      <ul className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
        {games.map(g=>(
          <li key={g.code} className="rounded-xl p-4 bg-zinc-900">
            <div className="font-semibold">{g.name}</div>
            <Link className="mt-3 inline-block px-3 py-2 rounded bg-fuchsia-600" href={`/game/${g.code}`}>Play</Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
