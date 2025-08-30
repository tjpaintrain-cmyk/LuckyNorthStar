export default function Home(){
  return (
    <main className="min-h-screen bg-black text-white">
      <section className="max-w-3xl mx-auto py-16 px-6">
        <h1 className="text-4xl font-bold">LuckyNorthStar</h1>
        <p className="mt-4 text-gray-300">
          Play with <b>Gold Coins</b> for fun or earn <b>Sweeps Coins</b> via daily bonuses & AMOE.
          No purchase necessary. See Official Rules.
        </p>
        <div className="mt-6 flex gap-3">
          <a className="px-4 py-2 rounded bg-fuchsia-600" href="/lobby">Enter Lobby</a>
          <a className="px-4 py-2 rounded bg-zinc-800" href="/daily">Claim Daily</a>
        </div>
      </section>
    </main>
  );
}
