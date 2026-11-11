import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const rooms=new Map();
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':pathname.slice(1);
 if(!['index.html','app.js','style.css'].includes(file)){res.writeHead(404);return res.end('Not found')}
 const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(path.join(root,file)).pipe(res);
});
const wss=new WebSocketServer({server,maxPayload:5*1024*1024});
const makePlayer=()=>({counters:{},token:crypto.randomUUID(),socket:null,energy:5,maxEnergy:5,heroes:Array(6).fill(null),deck:[],hand:[],discard:[]});
const makeRoom=()=>({players:[makePlayer(),makePlayer()],turn:0,round:1,log:[]});
const send=(ws,obj)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))};
const log=(r,s)=>{r.log.unshift(s);r.log=r.log.slice(0,35)};
const publicCard=(c)=>({id:c.id,name:c.name,image:c.image,type:c.type,attack:c.attack,hp:c.hp,maxHp:c.maxHp,armor:c.armor,counters:c.counters||{},exhausted:c.exhausted,statuses:c.statuses||[],effectiveAttack:Math.max(0,c.attack+(c.statuses||[]).filter(x=>x.stat==='attack').reduce((n,x)=>n+x.amount,0))});
function snapshot(r,viewer){return {type:'state',you:viewer,turn:r.turn,round:r.round,log:r.log,players:r.players.map((p,i)=>({connected:!!p.socket&&p.socket.readyState===WebSocket.OPEN,energy:p.energy,maxEnergy:p.maxEnergy,counters:p.counters,heroes:p.heroes.map(h=>h?publicCard(h):null),hand:i===viewer?p.hand.map(publicCard):Array(p.hand.length).fill(null),deckCount:p.deck.length,discard:p.discard.map(publicCard)}))}}
function broadcast(r){r.players.forEach((p,i)=>send(p.socket,snapshot(r,i)))}
const bounded=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Math.trunc(Number(v)):min));
const getCard=(p,id)=>p.hand.findIndex(c=>c.id===id);
function action(r,who,m){const p=r.players[who],op=r.players[1-who];const target=r.players[bounded(m.player,0,1)];const slot=bounded(m.slot,0,5);let h=target.heroes[slot];
 switch(m.action){
 case 'import': {if(!Array.isArray(m.cards)||m.cards.length>30)throw Error('Maximal 30 Karten pro Import');for(const c of m.cards){if(typeof c.name!=='string'||c.name.length>80||typeof c.image!=='string'||c.image.length>650000||!/^data:image\/(png|jpeg|webp);base64,/.test(c.image))throw Error('Ungültige Karte oder Bild zu groß');p.deck.push({id:crypto.randomUUID(),name:c.name,image:c.image,type:c.type==='hero'?'hero':'action',attack:bounded(c.attack,0,99),hp:bounded(c.hp,1,99),maxHp:bounded(c.hp,1,99),armor:0,counters:{},exhausted:false,statuses:[]})}log(r,`Spieler ${who+1} importiert ${m.cards.length} Karten`);break}
 case 'shuffle':for(let i=p.deck.length-1;i>0;i--){let j=crypto.randomInt(i+1);[p.deck[i],p.deck[j]]=[p.deck[j],p.deck[i]]}log(r,`Spieler ${who+1} mischt das Deck`);break;
 case 'draw':{let n=bounded(m.count??1,1,10);while(n--&&p.deck.length)p.hand.push(p.deck.pop());log(r,`Spieler ${who+1} zieht Karten`);break}
 case 'place':{const idx=getCard(p,m.cardId);if(idx<0)throw Error('Karte nicht auf deiner Hand');if(m.player!==who)throw Error('Nur eigene Helden platzieren');if(p.heroes[slot])throw Error('Position belegt');let c=p.hand[idx];if(c.type!=='hero')throw Error('Nur Helden auf das Feld');p.heroes[slot]=c;p.hand.splice(idx,1);log(r,`Spieler ${who+1} platziert ${c.name}`);break}
 case 'play':{const idx=getCard(p,m.cardId);if(idx<0)throw Error('Karte nicht auf deiner Hand');const [c]=p.hand.splice(idx,1);p.discard.push(c);log(r,`Spieler ${who+1} spielt ${c.name}`);break}
 case 'move':{if(m.player!==who)throw Error('Nur eigene Helden bewegen');const to=bounded(m.to,0,5);if(!h||target.heroes[to])throw Error('Ungültige Bewegung');target.heroes[to]=h;target.heroes[slot]=null;log(r,`Spieler ${who+1} bewegt ${h.name}`);break}
 case 'exhaust':if(!h)throw Error('Keine Karte');h.exhausted=!h.exhausted;log(r,`${h.name}: ${h.exhausted?'erschöpft':'aktiv'}`);break;
 case 'setStat':{if(!h)throw Error('Kein Held');const stat=String(m.stat);if(!['hp','maxHp','attack','armor'].includes(stat))throw Error('Unbekannter Wert');h[stat]=bounded(m.value,0,9999);log(r,`${h.name}: ${stat} = ${h[stat]}`);break}
 case 'setEnergy':{if(m.player!==who)throw Error('Nur eigene Energie');const stat=m.stat==='maxEnergy'?'maxEnergy':'energy';p[stat]=bounded(m.value,0,9999);log(r,`Spieler ${who+1}: ${stat} = ${p[stat]}`);break}
 case 'counter':{const name=String(m.name||'').trim().slice(0,40);if(!name)throw Error('Counter braucht Namen');const scope=m.scope==='player'?'player':'hero';if(scope==='player'&&m.player!==who)throw Error('Nur eigene Spieler-Counter');if(scope==='hero'&&!h)throw Error('Kein Held');const obj=scope==='player'?target:h;obj.counters??={};const val=bounded(m.value,-9999,9999);if(m.remove)delete obj.counters[name];else obj.counters[name]=val;log(r,`${scope==='hero'?h.name:'Spieler '+(who+1)}: ${name} ${m.remove?'entfernt':'= '+val}`);break}
 case 'roll':{const sides=bounded(m.sides||20,2,1000);const value=crypto.randomInt(1,sides+1);log(r,`🎲 Spieler ${who+1} würfelt W${sides}: ${value}`);break}
 case 'damage':{if(!h)throw Error('Kein Held');const raw=bounded(m.amount,0,99);const absorbed=Math.min(raw,h.armor);h.armor-=absorbed;h.hp=Math.max(0,h.hp-(raw-absorbed));log(r,`${h.name} erhält ${raw-absorbed} Schaden (${absorbed} geblockt)`);break}
 case 'heal':if(!h)throw Error('Kein Held');h.hp=Math.min(h.maxHp,h.hp+bounded(m.amount,0,99));log(r,`${h.name} wird geheilt`);break;
 case 'armor':if(!h)throw Error('Kein Held');h.armor=bounded(h.armor+bounded(m.amount,-99,99),0,99);log(r,`${h.name}: Rüstung ${h.armor}`);break;
 case 'addStatus':{
  if(!h)throw Error('Kein Held');
  const stat=String(m.stat||'');
  if(!['attack','damageBonus','damageReduction'].includes(stat))throw Error('Unbekannter Effekt');
  const amount=bounded(m.amount,-99,99);
  if(!amount)throw Error('Effektwert darf nicht 0 sein');
  const duration=bounded(m.duration??0,0,30); // 0 = permanent, otherwise target owner's turns
  const name=String(m.name||'Magieeffekt').trim().slice(0,60)||'Magieeffekt';
  h.statuses??=[];
  h.statuses.push({id:crypto.randomUUID(),name,stat,amount,remaining:duration});
  log(r,`${h.name}: ${name} (${stat} ${amount>0?'+':''}${amount})${duration?' für '+duration+' eigene Zugenden':''}`);
  break;
 }
 case 'removeStatus':{
  if(!h)throw Error('Kein Held');
  const before=(h.statuses||[]).length;
  h.statuses=(h.statuses||[]).filter(x=>x.id!==m.statusId);
  if(h.statuses.length===before)throw Error('Effekt nicht gefunden');
  log(r,`${h.name}: Effekt entfernt`);break;
 }
 case 'attack':{
  if(r.turn!==who)throw Error('Nicht dein Zug');
  const source=p.heroes[bounded(m.from,0,5)];
  if(!source||source.hp<=0||source.exhausted)throw Error('Angreifer nicht einsatzbereit');
  if(!h||h.hp<=0||m.player===who)throw Error('Ungültiges Ziel');
  const sum=(hero,stat)=>(hero.statuses||[]).filter(x=>x.stat===stat).reduce((a,x)=>a+x.amount,0);
  const raw=Math.max(0,source.attack+sum(source,'attack')+sum(source,'damageBonus')-sum(h,'damageReduction'));
  const absorbed=Math.min(raw,h.armor);h.armor-=absorbed;h.hp=Math.max(0,h.hp-(raw-absorbed));source.exhausted=true;
  log(r,`${source.name} greift ${h.name} an: ${raw-absorbed} HP-Schaden (${absorbed} Rüstung)`);break;
 }
 case 'energy':if(m.player!==who)throw Error('Nur eigene Energie');p.energy=bounded(p.energy+bounded(m.amount,-99,99),0,p.maxEnergy);break;
 case 'maxEnergy':if(m.player!==who)throw Error('Nur eigene Energie');p.maxEnergy=bounded(p.maxEnergy+bounded(m.amount,-99,99),0,20);p.energy=Math.min(p.energy,p.maxEnergy);break;
 case 'endTurn':if(r.turn!==who)throw Error('Nicht dein Zug');for(const hero of p.heroes){if(!hero)continue;hero.statuses=(hero.statuses||[]).filter(e=>{if(e.remaining===0)return true;e.remaining--;if(e.remaining===0){log(r,`${hero.name}: ${e.name} läuft ab`);return false}return true})}r.turn=1-who;if(r.turn===0)r.round++;log(r,`Spieler ${who+1} beendet den Zug`);break;
 default:throw Error('Unbekannte Aktion');
 }}
wss.on('connection',ws=>{let roomId=null,seat=null;ws.on('message',raw=>{try{const m=JSON.parse(raw.toString());if(!roomId){if(m.type!=='join')throw Error('Bitte Raum betreten');let code=String(m.code||'').toUpperCase().trim();if(!code){do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(code));rooms.set(code,makeRoom())}const r=rooms.get(code);if(!r)throw Error('Raum nicht gefunden');let i=r.players.findIndex(p=>p.token===m.token&&m.token);if(i<0)i=r.players.findIndex(p=>!p.socket);if(i<0)throw Error('Raum voll');const p=r.players[i];if(p.socket&&p.socket!==ws)p.socket.close();p.socket=ws;roomId=code;seat=i;send(ws,{type:'joined',code,token:p.token,seat:i});log(r,`Spieler ${i+1} verbunden`);broadcast(r);return}
 if(m.type!=='action')throw Error('Ungültige Nachricht');const r=rooms.get(roomId);action(r,seat,m);broadcast(r)}catch(e){send(ws,{type:'error',message:e.message})}});ws.on('close',()=>{if(roomId){const r=rooms.get(roomId);if(r?.players[seat]?.socket===ws){r.players[seat].socket=null;broadcast(r)}}})});
server.listen(process.env.PORT||3000,()=>console.log('TCG läuft auf http://localhost:'+(process.env.PORT||3000)));
