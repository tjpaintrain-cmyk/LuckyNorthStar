import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { z } from 'zod';
import { PrismaClient, Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const prisma = new PrismaClient();
const app = express();
app.use(express.json());
app.use(cors({ origin: process.env.WEB_ORIGIN || 'http://localhost:3000', credentials: true }));
app.use(helmet());
app.use(rateLimit({ windowMs: 60_000, max: 200 }));

// --- helpers ---
function sign(uid: string){
  return jwt.sign({ uid }, process.env.JWT_SECRET || 'devsecret', { expiresIn: '1d' });
}
function auth(req: express.Request, res: express.Response, next: express.NextFunction){
  const h = req.headers.authorization;
  if(!h) return res.status(401).json({ error: 'unauthorized' });
  try {
    (req as any).uid = (jwt.verify(h.split(' ')[1], process.env.JWT_SECRET || 'devsecret') as any).uid;
    next();
  } catch {
    return res.status(401).json({ error:'bad token' });
  }
}
async function getWallet(userId: string|null, currency: 'GC'|'SC', subtype:'AVAILABLE'|'ESCROW'|'BONUS'){
  let w = await prisma.wallet.findFirst({ where:{ userId, currency, subtype } });
  if(!w) w = await prisma.wallet.create({ data:{ userId, currency, subtype } });
  return w;
}
async function house(currency:'GC'|'SC'){ return getWallet(null, currency, 'AVAILABLE'); }

async function postTx(type:any, idempotencyKey:string|undefined, entries:{walletId:string, direction:'DEBIT'|'CREDIT', amount:number}[], metadata:any={}){
  return prisma.$transaction(async (tx)=>{
    if(idempotencyKey){
      const dupe = await tx.transaction.findFirst({ where:{ idempotencyKey } });
      if(dupe) return dupe;
    }
    const t = await tx.transaction.create({ data:{ type, idempotencyKey, metadata } });
    for(const e of entries){
      if(e.amount<=0) throw new Error('amount>0');
      await tx.entry.create({ data:{ transactionId:t.id, walletId:e.walletId, direction:e.direction, amount: new Prisma.Decimal(e.amount) } });
      await tx.wallet.update({ where:{ id:e.walletId }, data:{ balance: { [e.direction==='DEBIT'?'decrement':'increment']: new Prisma.Decimal(e.amount) } } });
    }
    return t;
  });
}

// --- RNG helpers ---
function hmac(seed:string, msg:string){ return crypto.createHmac('sha256', seed).update(msg).digest(); }
function prns(serverSeed:string, clientSeed:string, nonce:number, count:number){
  const mac = hmac(serverSeed, `${clientSeed}:${nonce}`);
  const arr:number[] = [];
  for(let i=0;i<count;i++){
    const v = mac.readUInt32BE((i*4)%32);
    arr.push(v/2**32);
  }
  return arr;
}

// --- Auth ---
app.post('/auth/signup', async (req,res)=>{
  const body = z.object({ email:z.string().email(), password:z.string().optional(), dob:z.string(), country:z.string(), state:z.string().optional() }).parse(req.body);
  const user = await prisma.user.create({ data:{ email: body.email }});
  await prisma.profile.create({ data:{ userId:user.id, dob:new Date(body.dob), country:body.country, state: body.state ?? null } });
  const token = sign(user.id);
  res.json({ userId: user.id, token });
});

app.get('/auth/me', auth, async (req,res)=>{
  const uid = (req as any).uid as string;
  const [gcAvail, scAvail] = await Promise.all([ getWallet(uid,'GC','AVAILABLE'), getWallet(uid,'SC','AVAILABLE') ]);
  res.json({ user:{ id:uid }, balances:{ GC: gcAvail.balance, SC: scAvail.balance } });
});

// --- Wallet ---
app.get('/wallet/balances', auth, async (req,res)=>{
  const uid = (req as any).uid as string;
  const ws = await prisma.wallet.findMany({ where:{ userId: uid } });
  res.json({ wallets: ws });
});

// --- Daily SC grant ---
app.post('/sweeps/daily', auth, async (req,res)=>{
  const uid = (req as any).uid as string;
  const dayKey = `daily:${uid}:${new Date().toISOString().slice(0,10)}`;
  const [userAvail, houseSc] = await Promise.all([ getWallet(uid,'SC','AVAILABLE'), house('SC') ]);
  await postTx('GRANT_SC', dayKey, [
    { walletId: houseSc.id, direction:'DEBIT', amount: 1 },
    { walletId: userAvail.id, direction:'CREDIT', amount: 1 },
  ], { source:'DAILY' });
  res.json({ granted: 1 });
});

// --- Mock GC purchase (no Stripe call) ---
app.post('/purchase/checkout', auth, async (req,res)=>{
  const uid = (req as any).uid as string;
  const body = z.object({ packageId:z.string() }).parse(req.body);
  const pkg = { 'gc_999':{ usd:9.99, gc:100000 }, 'gc_1999':{ usd:19.99, gc:220000 } }[body.packageId as keyof any];
  if(!pkg) return res.status(400).json({ error:'bad package' });
  const [uGc, hGc] = await Promise.all([ getWallet(uid,'GC','AVAILABLE'), house('GC') ]);
  await postTx('GC_PURCHASE', `pkg:${uid}:${body.packageId}:${Date.now()}`, [
    { walletId: hGc.id, direction:'DEBIT', amount: pkg.gc },
    { walletId: uGc.id, direction:'CREDIT', amount: pkg.gc }
  ], { packageId: body.packageId, amountUsd: pkg.usd });
  res.json({ ok:true, simulated:true });
});

// --- Simple Slot Demo (Neon Heist subset) ---
const NeonHeist = {
  code:'slot-neon-heist', lines:5,
  reels: [
    ['W','S','M','D','C','A','K','Q','J','10','M','D','A','K','Q','J','10','C','A','K'],
    ['W','S','M','D','C','A','K','Q','J','10','M','A','K','Q','J','10','C','A','K','Q'],
    ['W','S','M','D','C','A','K','Q','J','10','M','D','A','K','Q','J','10','C','A','K'],
    ['W','S','M','D','C','A','K','Q','J','10','M','A','K','Q','J','10','C','A','K','Q'],
    ['W','S','M','D','C','A','K','Q','J','10','M','D','A','K','Q','J','10','C','A','K'],
  ],
  pay: {
    'W':[500,100,20], 'M':[200,60,10], 'D':[100,40,8], 'C':[60,30,6],
    'A':[40,20,4], 'K':[30,15,3], 'Q':[20,10,2], 'J':[15,8,2], '10':[10,6,2],
  },
  linesDef: [
    [[0,1,2,3,4],[0,0,0,0,0]],
    [[0,1,2,3,4],[1,1,1,1,1]],
    [[0,1,2,3,4],[2,2,2,2,2]],
    [[0,1,2,3,4],[0,1,2,1,0]],
    [[0,1,2,3,4],[2,1,0,1,2]],
  ]
};

app.post('/games/:code/start', auth, async (req,res)=>{
  const uid = (req as any).uid as string;
  const { code } = req.params;
  const body = z.object({ currency: z.enum(['GC','SC']), amount: z.number().positive(), clientSeed: z.string().min(1) }).parse(req.body);

  const [avail, escrow] = await Promise.all([
    getWallet(uid, body.currency, 'AVAILABLE'),
    getWallet(uid, body.currency, 'ESCROW')
  ]);
  if(Number(avail.balance) < body.amount) return res.status(400).json({ error:'insufficient funds' });

  await postTx('WAGER', `wager:${uid}:${Date.now()}`, [
    { walletId: avail.id, direction:'DEBIT', amount: body.amount },
    { walletId: escrow.id, direction:'CREDIT', amount: body.amount },
  ], { gameCode: code });

  const serverSeed = crypto.randomBytes(32).toString('hex');
  const serverHash = crypto.createHash('sha256').update(serverSeed).digest('hex');

  const round = await prisma.gameRound.create({
    data:{
      userId: uid,
      gameId: (await prisma.game.upsert({
        where:{ code }, update:{}, create:{ code, type:'SLOT', name:code, rtp:new Prisma.Decimal(96.00), volatility:'MEDIUM', config:{} }
      })).id,
      currency: body.currency, wager: new Prisma.Decimal(body.amount),
      state:'STARTED', clientSeed: body.clientSeed, serverSeedHash: serverHash, nonce: 1, outcome:{} as any
    }
  });
  res.json({ roundId: round.id, serverSeedHash: serverHash, nonce: 1 });
});

app.post('/games/:code/resolve', auth, async (req,res)=>{
  const uid = (req as any).uid as string;
  const { roundId } = z.object({ roundId: z.string() }).parse(req.body);
  const round = await prisma.gameRound.findUnique({ where:{ id: roundId } });
  if(!round || round.userId !== uid) return res.status(404).json({ error:'round' });
  if(round.state !== 'STARTED') return res.status(400).json({ error:'state' });

  const serverSeed = crypto.randomBytes(32).toString('hex');
  const rng = prns(serverSeed, round.clientSeed, round.nonce, 5);
  const stops = rng.map((r,i)=> Math.floor(r * NeonHeist.reels[i].length));
  const grid = stops.map((s,i)=> [0,1,2].map(r=> NeonHeist.reels[i][(s+r)%NeonHeist.reels[i].length]));

  function payLine(coords:number[][]):number{
    const [cols, rows] = coords;
    const symbols = cols.map((c,i)=> grid[c][rows[i]]);
    let base:any = symbols[0] === 'W' ? null : symbols[0];
    let count = 1;
    for(let i=1;i<5;i++){
      const sym:any = symbols[i];
      if(sym === base || sym === 'W' || (base===null && sym!=='S')){ count++; if(base===null && sym!=='W') base = sym; }
      else break;
    }
    if(!base || !NeonHeist.pay[base]) return 0;
    if(count>=5) return NeonHeist.pay[base][0];
    if(count===4) return NeonHeist.pay[base][1];
    if(count===3) return NeonHeist.pay[base][2];
    return 0;
  }
  const lines = NeonHeist.linesDef.map(([cols,rows])=> payLine([cols as any, rows as any]));
  const payoutMult = lines.reduce((a,b)=>a+b,0);
  const wager = Number(round.wager);
  const payout = Math.floor(payoutMult) * (wager/20);

  const [avail, escrow, houseW] = await Promise.all([
    getWallet(uid, round.currency as any, 'AVAILABLE'),
    getWallet(uid, round.currency as any, 'ESCROW'),
    house(round.currency as any)
  ]);

  const ops:any[] = [];
  ops.push({ walletId: escrow.id, direction:'DEBIT', amount: Number(round.wager) });
  ops.push({ walletId: houseW.id, direction:'CREDIT', amount: Number(round.wager) });
  if(payout>0){
    ops.push({ walletId: houseW.id, direction:'DEBIT', amount: payout });
    ops.push({ walletId: avail.id, direction:'CREDIT', amount: payout });
  }
  await postTx('START_SETTLE', `settle:${round.id}`, ops, { roundId: round.id, payout });

  const updated = await prisma.gameRound.update({ where:{ id: round.id }, data:{
    state:'RESOLVED', payout: new Prisma.Decimal(payout), outcome:{ stops, grid, lines, payout }, serverSeedRevealedAt: new Date()
  }});
  res.json({ outcome: updated.outcome, payout, serverSeed });
});

// --- Redemption lock (SC only) ---
app.post('/redemptions', auth, async (req,res)=>{
  const uid = (req as any).uid as string;
  const { amount } = z.object({ amount: z.number().positive(), payoutMethod: z.any().optional(), idem: z.string().optional() }).parse(req.body);
  const [avail, escrow] = await Promise.all([ getWallet(uid,'SC','AVAILABLE'), getWallet(uid,'SC','ESCROW') ]);
  if(Number(avail.balance) < amount) return res.status(400).json({ error:'insufficient SC' });
  await postTx('REDEMPTION_LOCK', `redeem:${uid}:${Date.now()}`, [
    { walletId: avail.id, direction:'DEBIT', amount },
    { walletId: escrow.id, direction:'CREDIT', amount },
  ], { stage:'LOCK' });
  const r = await prisma.redemption.create({ data:{ userId: uid, amountSc: amount, status:'PENDING' } });
  res.json({ redemptionId: r.id, status: r.status });
});

const port = process.env.PORT || 4000;
app.listen(port, ()=> console.log(`API on :${port}`));
