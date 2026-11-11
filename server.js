import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WebSocketServer, WebSocket } from 'ws';
import crypto from 'node:crypto';
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'public');
const rooms=new Map();
const RECONNECT_MS=30*60*1000;
const now=()=>Date.now();
const server=http.createServer((req,res)=>{
 const pathname=new URL(req.url,'http://localhost').pathname;
 const file=pathname==='/'?'index.html':pathname.slice(1);
 if(!['index.html','app.js','style.css'].includes(file)){res.writeHead(404);return res.end('Not found')}
 const mime=file.endsWith('.js')?'text/javascript':file.endsWith('.css')?'text/css':'text/html';
 res.writeHead(200,{'Content-Type':mime+'; charset=utf-8','Cache-Control':'no-store'});fs.createReadStream(path.join(root,file)).pipe(res);
});
const wss=new WebSocketServer({server,maxPayload:5*1024*1024});
const makePlayer=()=>({counters:{},token:crypto.randomUUID(),socket:null,energy:5,maxEnergy:5,heroes:Array(6).fill(null),heroPool:[],activeSpell:null,deck:[],hand:[],discard:[]});
const makeRoom=()=>({players:[makePlayer(),makePlayer()],turn:0,round:1,log:[],pending:null,emptySince:null});
const send=(ws,obj)=>{if(ws?.readyState===WebSocket.OPEN)ws.send(JSON.stringify(obj))};
const log=(r,s)=>{r.log.unshift(s);r.log=r.log.slice(0,35)};
const publicCard=(c)=>({id:c.id,name:c.name,image:c.image,type:c.type,attack:c.attack,baseAttack:c.baseAttack??c.attack,hp:c.hp,maxHp:c.maxHp,armor:c.armor,counters:c.counters||{},exhausted:c.exhausted,statuses:c.statuses||[],effectiveAttack:Math.max(0,c.attack+(c.statuses||[]).filter(x=>x.stat==='attack').reduce((n,x)=>n+x.amount,0))});
function snapshot(r,viewer){return {type:'state',you:viewer,turn:r.turn,round:r.round,log:r.log,pending:r.pending?{kind:r.pending.kind,requester:r.pending.requester,name:r.pending.name||''}:null,players:r.players.map((p,i)=>({connected:!!p.socket&&p.socket.readyState===WebSocket.OPEN,energy:p.energy,maxEnergy:p.maxEnergy,counters:p.counters,heroes:p.heroes.map(h=>h?publicCard(h):null),heroPool:p.heroPool.map(publicCard),activeSpell:p.activeSpell?publicCard(p.activeSpell):null,hand:i===viewer?p.hand.map(publicCard):Array(p.hand.length).fill(null),deckCount:p.deck.length,discard:p.discard.map(publicCard)}))}}
function broadcast(r){r.players.forEach((p,i)=>send(p.socket,snapshot(r,i)))}
const bounded=(v,min,max)=>Math.max(min,Math.min(max,Number.isFinite(Number(v))?Math.trunc(Number(v)):min));
const getCard=(p,id)=>p.hand.findIndex(c=>c.id===id);
function action(r,who,m){const p=r.players[who],op=r.players[1-who];const target=r.players[bounded(m.player,0,1)];const slot=bounded(m.slot,0,5);let h=target.heroes[slot];
 switch(m.action){
 case 'requestCleanup':{
  if(r.pending)throw Error('Es wartet bereits eine Bestätigung');
  if(!op.socket||op.socket.readyState!==WebSocket.OPEN)throw Error('Gegner muss online sein');
  r.pending={kind:'cleanup',requester:who};log(r,`Spieler ${who+1} beantragt das vollständige Aufräumen`);break;
 }
 case 'requestReturnHero':{
  if(r.pending)throw Error('Es wartet bereits eine Bestätigung');
  if(m.player!==who||!h)throw Error('Ungültiger Charakter');
  if(!op.socket||op.socket.readyState!==WebSocket.OPEN)throw Error('Gegner muss online sein');
  r.pending={kind:'returnHero',requester:who,slot,cardId:h.id,name:h.name};
  log(r,`Spieler ${who+1} beantragt die Rücknahme von ${h.name}`);break;
 }
 case 'respondApproval':{
  const req=r.pending;if(!req||req.requester===who)throw Error('Keine gegnerische Anfrage');
  r.pending=null;
  if(m.approve!==true){log(r,`Spieler ${who+1} lehnt die Anfrage ab`);break}
  if(req.kind==='returnHero'){
   const owner=r.players[req.requester];const card=owner.heroes[req.slot];
   if(!card||card.id!==req.cardId)throw Error('Charakter wurde inzwischen verändert');
   owner.heroPool.push(card);owner.heroes[req.slot]=null;
   log(r,`Spieler ${who+1} genehmigt die Rücknahme von ${card.name}`);
  }else if(req.kind==='cleanup'){
   for(const pl of r.players){for(const hero of pl.heroes){if(hero){hero.hp=hero.maxHp;hero.armor=0;hero.exhausted=false;hero.statuses=[];hero.counters={};pl.heroPool.push(hero)}}
    pl.heroes=Array(6).fill(null);if(pl.activeSpell){pl.discard.push(pl.activeSpell);pl.activeSpell=null}
    pl.deck.push(...pl.hand.splice(0),...pl.discard.splice(0));for(let i=pl.deck.length-1;i>0;i--){const j=crypto.randomInt(i+1);[pl.deck[i],pl.deck[j]]=[pl.deck[j],pl.deck[i]]}
    pl.energy=pl.maxEnergy;
   }
   log(r,`Beide Spieler bestätigen das vollständige Aufräumen`);
  }break;
 }
 case 'deleteCard':{
  const zone=String(m.zone);if(!['heroPool','hand','discard'].includes(zone))throw Error('Ungültiger Kartenbereich');
  const idx=p[zone].findIndex(c=>c.id===m.cardId);if(idx<0)throw Error('Karte nicht gefunden');
  const [deleted]=p[zone].splice(idx,1);log(r,`Spieler ${who+1} löscht ${deleted.name}`);break;
 }

 case 'clearMyCards':{
  if(p.heroes.some(Boolean)||p.activeSpell||p.hand.length||p.discard.length||p.deck.length||p.heroPool.length){
   // Loading a deck resets only the owner's cards; avoid affecting the opponent.
   p.heroes=Array(6).fill(null);p.activeSpell=null;p.deck=[];p.hand=[];p.discard=[];p.heroPool=[];
  }
  log(r,`Spieler ${who+1} lädt ein neues Deck`);break;
 }
 case 'import': {if(!Array.isArray(m.cards)||m.cards.length>30)throw Error('Maximal 30 Karten pro Import');for(const c of m.cards){if(typeof c.name!=='string'||c.name.length>80||typeof c.image!=='string'||c.image.length>650000||!/^data:image\/(png|jpeg|webp);base64,/.test(c.image))throw Error('Ungültige Karte oder Bild zu groß');(c.type==='hero'?p.heroPool:p.deck).push({id:crypto.randomUUID(),name:c.name,image:c.image,type:c.type==='hero'?'hero':'action',attack:bounded(c.attack,0,99),baseAttack:bounded(c.attack,0,99),hp:bounded(c.hp,1,99),maxHp:bounded(c.hp,1,99),armor:0,counters:{},exhausted:false,statuses:[]})}log(r,`Spieler ${who+1} importiert ${m.cards.length} Karten`);break}
 case 'shuffle':for(let i=p.deck.length-1;i>0;i--){let j=crypto.randomInt(i+1);[p.deck[i],p.deck[j]]=[p.deck[j],p.deck[i]]}log(r,`Spieler ${who+1} mischt das Deck`);break;
 case 'draw':{let n=bounded(m.count??1,1,10);while(n--&&p.deck.length)p.hand.push(p.deck.pop());log(r,`Spieler ${who+1} zieht Karten`);break}
 case 'place':{const idx=p.heroPool.findIndex(c=>c.id===m.cardId);if(idx<0)throw Error('Held nicht im Charakterstapel');if(m.player!==who)throw Error('Nur eigene Helden platzieren');if(p.heroes[slot])throw Error('Position belegt');let c=p.heroPool[idx];if(c.type!=='hero')throw Error('Nur Helden auf das Feld');p.heroes[slot]=c;p.heroPool.splice(idx,1);log(r,`Spieler ${who+1} platziert ${c.name}`);break}
 case 'play':{const idx=getCard(p,m.cardId);if(idx<0)throw Error('Karte nicht auf deiner Hand');if(p.activeSpell)throw Error('Magiefeld belegt: Karte zuerst ablegen');const [c]=p.hand.splice(idx,1);if(c.type!=='action')throw Error('Nur Magiekarten hier ausspielen');p.activeSpell=c;log(r,`Spieler ${who+1} spielt ${c.name} offen aus`);break}
 case 'discardSpell':{if(!p.activeSpell)throw Error('Kein Zauber auf dem Feld');p.discard.push(p.activeSpell);log(r,`Spieler ${who+1} legt ${p.activeSpell.name} ab`);p.activeSpell=null;break}
 case 'recycle':{p.deck.push(...p.discard.splice(0));for(let i=p.deck.length-1;i>0;i--){const j=crypto.randomInt(i+1);[p.deck[i],p.deck[j]]=[p.deck[j],p.deck[i]]}log(r,`Spieler ${who+1} mischt die Ablage zurück ins Deck`);break}
 case 'cleanup':{throw Error('Aufräumen erfordert jetzt Zustimmung beider Spieler');if(m.confirm!==true)throw Error('Bestätigung fehlt');for(const hero of p.heroes){if(hero){hero.hp=hero.maxHp;hero.armor=0;hero.exhausted=false;hero.statuses=[];hero.counters={};p.heroPool.push(hero)}}p.heroes=Array(6).fill(null);if(p.activeSpell){p.discard.push(p.activeSpell);p.activeSpell=null}p.deck.push(...p.hand.splice(0),...p.discard.splice(0));for(let i=p.deck.length-1;i>0;i--){const j=crypto.randomInt(i+1);[p.deck[i],p.deck[j]]=[p.deck[j],p.deck[i]]}p.energy=p.maxEnergy;log(r,`Spieler ${who+1} räumt sein Spielfeld auf und mischt Magiekarten`);break}
 case 'condition':{if(!h)throw Error('Kein Held');const kind=String(m.kind);if(!['burn','poison'].includes(kind))throw Error('Unbekannter Zustand');h.counters[kind]=bounded(m.value,0,99);log(r,`${h.name}: ${kind} ${h.counters[kind]}`);break}
 case 'returnHero':{throw Error('Charakter-Rücknahme erfordert Zustimmung');if(m.player!==who)throw Error('Nur eigene Helden zurücknehmen');if(!h)throw Error('Kein Held');p.heroPool.push(h);p.heroes[slot]=null;log(r,`Spieler ${who+1} nimmt ${h.name} zurück`);break}
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
wss.on('connection',ws=>{let roomId=null,seat=null;ws.on('message',raw=>{try{const m=JSON.parse(raw.toString());if(!roomId){if(m.type!=='join')throw Error('Bitte Raum betreten');let code=String(m.code||'').toUpperCase().trim();if(!code){do{code=crypto.randomBytes(3).toString('hex').toUpperCase()}while(rooms.has(code));rooms.set(code,makeRoom())}const r=rooms.get(code);if(!r)throw Error('Raum nicht gefunden oder 30-Minuten-Frist abgelaufen');let i=r.players.findIndex(p=>p.token===m.token&&m.token);if(i<0)i=r.players.findIndex(p=>!p.socket&&!p.reservedUntil);if(i<0)throw Error('Raum voll oder Plätze für Wiederverbindung reserviert');const p=r.players[i];if(p.socket&&p.socket!==ws)p.socket.close();p.socket=ws;p.reservedUntil=null;r.emptySince=null;roomId=code;seat=i;send(ws,{type:'joined',code,token:p.token,seat:i});log(r,`Spieler ${i+1} verbunden`);broadcast(r);return}
 if(m.type!=='action')throw Error('Ungültige Nachricht');const r=rooms.get(roomId);action(r,seat,m);broadcast(r)}catch(e){send(ws,{type:'error',message:e.message})}});ws.on('close',()=>{if(roomId){const r=rooms.get(roomId);if(r?.players[seat]?.socket===ws){r.players[seat].socket=null;r.players[seat].reservedUntil=now()+RECONNECT_MS;if(r.players.every(p=>!p.socket))r.emptySince=now();broadcast(r)}}})});
server.listen(process.env.PORT||3000,()=>console.log('TCG läuft auf http://localhost:'+(process.env.PORT||3000)));

// Keep disconnected seats for 30 minutes, then free them. Delete empty rooms.
setInterval(()=>{for(const [id,r] of rooms){for(const p of r.players){if(p.reservedUntil&&p.reservedUntil<=now()){p.reservedUntil=null}}if(r.emptySince&&now()-r.emptySince>=RECONNECT_MS)rooms.delete(id)}},60*1000).unref();
