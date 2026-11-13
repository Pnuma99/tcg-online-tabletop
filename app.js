const $=id=>document.getElementById(id);let ws,seat,code,state,selected=null,openedHero=null;
function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500)}
function send(o){if(ws?.readyState===1)ws.send(JSON.stringify(o))}function act(action,extra={}){send({type:'action',action,...extra})}
let reconnectTimer=null,manualCode=null;
function connect(requested){
  manualCode=requested;
  if(ws&&ws.readyState<=1)ws.close();
  ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);
  ws.onopen=()=>send({type:'join',code:requested,token:requested?localStorage.getItem('tcg-token-'+requested):null});
  ws.onmessage=e=>{const m=JSON.parse(e.data);
    if(m.type==='error'){toast(m.message);return}
    if(m.type==='joined'){seat=m.seat;code=m.code;manualCode=code;localStorage.setItem('tcg-token-'+code,m.token);localStorage.setItem('tcg-last-room',code);$('room').textContent='Lobby '+code+' · Spieler '+(seat+1);$('home').hidden=true;$('deckbuilder').hidden=true;$('lobby').hidden=true;$('game').hidden=false;$('status').textContent='Online';if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null}}
    if(m.type==='state'){state=m;render();renderApproval();refreshOpenedHero()}
    if(m.type==='notice')toast(m.message)
  };
  ws.onclose=()=>{$('status').textContent='Verbindung getrennt';if(manualCode){reconnectTimer=setTimeout(()=>connect(manualCode),3000)}};
}
$('join').onclick=()=>connect($('code').value.trim().toUpperCase());
// Reconnect is offered when opening Kampf, not automatically on the main menu.
const lastRoom=localStorage.getItem('tcg-last-room');if(lastRoom)$('code').value=lastRoom;
function cardEl(c,fn){let el=document.createElement('div');el.className='card'+(c.exhausted?' exhausted':'');let img=document.createElement('img');img.src=c.image;img.alt=c.name;el.append(img);if(c.type==='hero'){let st=document.createElement('div');st.className='stats';st.textContent=`⚔ ${c.effectiveAttack??c.attack} · ♥ ${c.hp}/${c.maxHp} · 🛡 ${c.armor}`;el.append(st)}if(c.type==='hero'&&Object.keys(c.counters||{}).length){let tags=document.createElement('div');tags.className='status-tags';tags.textContent=Object.entries(c.counters).map(([k,v])=>`${k}: ${v}`).join(' | ');el.append(tags)}if(c.type==='hero'&&c.statuses?.length){let tags=document.createElement('div');tags.className='status-tags';tags.textContent=c.statuses.map(x=>`${x.name}: ${x.amount>0?'+':''}${x.amount} ${x.stat==='attack'?'ATK':x.stat==='damageBonus'?'Schaden':'Reduktion'}${x.remaining?' ('+x.remaining+')':''}`).join(' | ');el.append(tags)}el.title=c.name;el.onclick=fn;return el}
function renderBoard(player,id){
 const target=$(id);target.replaceChildren();const p=state.players[player];
 const title=document.createElement('div');title.className='board-title';title.textContent=(player===seat?'DEINE CHARAKTERE':'GEGNERISCHE CHARAKTERE')+' · '+(p.connected?'● Online':'○ Offline');target.append(title);
 const spell=document.createElement('div');spell.className='spell-zone';spell.append(document.createTextNode('✦ MAGIEFELD'));
 if(p.activeSpell)spell.append(cardEl(p.activeSpell,()=>showDialog(p.activeSpell.name,p.activeSpell.image,player===seat?[['Auf Ablage legen',()=>act('discardSpell')]]:[])));
 else spell.append(document.createTextNode('— leer —'));
 if(player!==seat)target.append(spell);
 // Enemy order reversed to keep back row farther from the center.
 for(const line of (player===seat?[0,1]:[1,0])){const row=document.createElement('div');row.className='line';
  for(let col=0;col<3;col++){const slot=line*3+col,div=document.createElement('div');div.className='slot';const h=p.heroes[slot];
   if(h)div.append(cardEl(h,()=>openHero(player,slot,h)));
   else{div.classList.add('empty');div.textContent=(line===0?'Front':'Rück')+' '+(col+1);div.onclick=()=>{if(player===seat&&selected){act('place',{player,slot,cardId:selected});selected=null}}}
   row.append(div)}target.append(row)}
 if(player===seat)target.append(spell);
}
function render(){
 const p=state.players[seat],enemy=state.players[1-seat];
 renderBoard(1-seat,'enemy');renderBoard(seat,'self');
 $('turn').textContent=`Runde ${state.round} · ${state.turn===seat?'Du bist am Zug':'Gegner am Zug'}`;
 $('end').disabled=state.turn!==seat;
 $('enemyHandCount').textContent=enemy.hand.length+' Karten';
 $('enemyHand').replaceChildren(...enemy.hand.map(()=>{let el=document.createElement('div');el.className='back';return el}));
 $('enemyDeck').textContent=enemy.deckCount;$('enemyEnergy').textContent=`${enemy.energy}/${enemy.maxEnergy}`;
 $('enemyDiscardCount').textContent=enemy.discard.length;
 $('energy').textContent=`${p.energy} / ${p.maxEnergy}`;
 $('deckCount').textContent=p.deckCount+' Karten';$('handCount').textContent=p.hand.length+' Karten';
 $('heroCount').textContent=p.heroPool.length+' Karten';$('discardCount').textContent=p.discard.length+' Karten';
 $('heroPool').replaceChildren();for(const c of p.heroPool){const el=cardEl(c,()=>showDialog(c.name,c.image,[['Aufstellung wählen',()=>{selected=c.id;render();toast('Freies Charakterfeld auswählen')}],['Karte löschen',()=>{if(confirm('Karte wirklich löschen?'))act('deleteCard',{cardId:c.id,zone:'heroPool'})}] ]));if(selected===c.id)el.style.outline='3px solid #e9c665';$('heroPool').append(el)}
 $('hand').replaceChildren();for(const c of p.hand)$('hand').append(cardEl(c,()=>openHand(c)));
 $('discardPreview').replaceChildren();for(const c of p.discard.slice(-5).reverse())$('discardPreview').append(cardEl(c,()=>showDialog(c.name,c.image,[])));
 $('log').replaceChildren(...state.log.map(s=>{const el=document.createElement('p');el.textContent=s;return el}));
}
function renderApproval(){const pending=state.pending;if(!pending||pending.requester===seat){if($('confirmDialog').open)$('confirmDialog').close();return}const dialog=$('confirmDialog');$('confirmTitle').textContent='Gegner bittet um Genehmigung';$('confirmText').textContent=pending.kind==='cleanup'?'Gesamtes Spielfeld, beide Hände und Ablagestapel zurücksetzen?':`Charakter ${pending.name||''} zurück in den Charakterstapel legen?`;if(!dialog.open)dialog.showModal()}
function showDialog(title,image,buttons){openedHero=null;if($('cardDialog').open)$('cardDialog').close();const details=$('details');details.replaceChildren();const h=document.createElement('h3');h.textContent=title;details.append(h);if(image){const im=document.createElement('img');im.src=image;im.alt=title;im.onclick=()=>im.classList.toggle('zoomed');details.append(im)}$('actions').replaceChildren();for(const [label,fn] of buttons){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{$('cardDialog').close();fn()};$('actions').append(b)}$('cardDialog').showModal()}
function openHand(c){showDialog(c.name,c.image,[['Auf Magiefeld ausspielen',()=>act('play',{cardId:c.id})],['Karte löschen',()=>{if(confirm('Karte löschen?'))act('deleteCard',{cardId:c.id,zone:'hand'})}]] )}
function refreshOpenedHero(){
 if(!openedHero||!$('cardDialog').open)return;
 const {player,slot,id}=openedHero;
 const current=state?.players?.[player]?.heroes?.[slot];
 if(!current||current.id!==id){openedHero=null;$('cardDialog').close();return}
 drawHeroMenu(player,slot,current);
}
function openHero(player,slot,h){
 openedHero={player,slot,id:h.id};
 drawHeroMenu(player,slot,h);
 if(!$('cardDialog').open)$('cardDialog').showModal();
}
function drawHeroMenu(player,slot,h){
 const x={player,slot},mine=player===seat,details=$('details');
 details.replaceChildren();
 const heading=document.createElement('h3');heading.textContent=h.name;details.append(heading);
 const img=document.createElement('img');img.src=h.image;img.alt=h.name;
 img.onclick=()=>img.classList.toggle('zoomed');details.append(img);
 for(const [label,stat] of [['Angriff','attack'],['KP','hp'],['Rüstung','armor']]){
  const row=document.createElement('div');row.className='stat-row';
  const minus=document.createElement('button');minus.textContent='−';
  const text=document.createElement('strong');
  const current=Number(h[stat]||0);
  text.textContent=label+' '+(stat==='attack'?`${h.effectiveAttack??current}/${h.baseAttack??current}`:stat==='hp'?`${h.hp}/${h.maxHp}`:current);
  const plus=document.createElement('button');plus.textContent='+';
  // Read the latest server value, not the stale value captured when the menu opened.
  for(const [btn,delta] of [[minus,-1],[plus,1]])btn.onclick=()=>{
   const latest=state?.players?.[player]?.heroes?.[slot];
   if(!latest||latest.id!==h.id)return toast('Charakter nicht mehr auf diesem Feld');
   const next=Math.max(0,Number(latest[stat]||0)+delta);
   act('setStat',{...x,stat,value:next});
   // Optimistic update prevents rapid taps from repeatedly sending the same value.
   latest[stat]=next;
   if(stat==='attack')latest.effectiveAttack=next+(latest.statuses||[]).filter(e=>e.stat==='attack').reduce((a,e)=>a+e.amount,0);
   drawHeroMenu(player,slot,latest);
  };
  row.append(minus,text,plus);details.append(row);
 }
 const condition=document.createElement('div');condition.className='effect-chip';
 condition.textContent=h.exhausted?'Status: Erschöpft':'Status: Aktiv';details.append(condition);
 for(const effect of h.statuses||[]){const el=document.createElement('div');el.className='effect-chip';el.textContent=`${effect.name}: ${effect.amount>0?'+':''}${effect.amount} ${effect.stat} · ${effect.remaining===0?'dauerhaft':effect.remaining+' Runden'}`;details.append(el)}
 const buttons=[['Aktiv / Erschöpft',()=>act('exhaust',x)],['Buff / Nerf hinzufügen',()=>{const name=prompt('Name des Effekts');if(!name)return;const stat=prompt('Werttyp: attack, damageBonus, damageReduction','attack');if(!stat)return;const amount=prompt('Wert, z.B. 3 oder -2','3');if(amount===null)return;const duration=prompt('Dauer in eigenen Zugenden, 0 = dauerhaft','2');if(duration===null)return;act('addStatus',{...x,name,stat,amount:Number(amount),duration:Number(duration)})}],...((h.statuses||[]).map(e=>['Effekt entfernen: '+e.name,()=>act('removeStatus',{...x,statusId:e.id})])),['Verbrennung / Gift',()=>{const kind=prompt('burn oder poison','poison');if(!kind)return;const value=prompt('Stärke','1');if(value!==null)act('condition',{...x,kind,value:Number(value)})}]];
 if(mine)buttons.push(['Bewegen',()=>{const to=prompt('Zielposition 1–3 Front, 4–6 Rück');if(to)act('move',{...x,to:Number(to)-1})}],['Zurück zum Charakterstapel (Anfrage)',()=>act('requestReturnHero',x)]);
 else buttons.push(['Angreifen',()=>{const from=prompt('Eigener Angreifer: 1–3 Front, 4–6 Rück');if(from)act('attack',{...x,from:Number(from)-1})}]);
 $('actions').replaceChildren();
 for(const [label,fn] of buttons){const btn=document.createElement('button');btn.textContent=label;btn.onclick=()=>{openedHero=null;$('cardDialog').close();fn()};$('actions').append(btn)}
}
function showDiscard(player){const cards=state.players[player].discard;showDialog((player===seat?'Deine':'Gegnerische')+' Ablage ('+cards.length+')',null,cards.map(c=>[c.name,()=>showDialog(c.name,c.image,player===seat?[['Karte löschen',()=>{if(confirm('Karte löschen?'))act('deleteCard',{cardId:c.id,zone:'discard'})}]]:[])]))}
$('browseDiscard').onclick=()=>showDiscard(seat);$('enemyDiscard').onclick=()=>showDiscard(1-seat);
$('recycle').onclick=()=>act('recycle');$('cleanup').onclick=()=>{if(confirm('Anfrage an den Gegner senden: gesamtes Spielfeld für beide Spieler zurücksetzen?'))act('requestCleanup')};
$('approve').onclick=()=>act('respondApproval',{approve:true});$('deny').onclick=()=>act('respondApproval',{approve:false});
$('close').onclick=()=>$('cardDialog').close();$('end').onclick=()=>act('endTurn');$('draw').onclick=()=>act('draw');$('shuffle').onclick=()=>act('shuffle');$('energyMinus').onclick=()=>act('energy',{player:seat,amount:-1});$('energyPlus').onclick=()=>act('energy',{player:seat,amount:1});$('maxMinus').onclick=()=>act('maxEnergy',{player:seat,amount:-1});$('maxPlus').onclick=()=>act('maxEnergy',{player:seat,amount:1});$('roll20').onclick=()=>act('roll',{sides:20});
// Convert large iPhone photos to compact WebP/JPEG before sending them to the room.
// Server currently limits each data URL to 650,000 characters; keep well below that.
async function compressCard(file){
  if(!file.type.startsWith('image/'))throw Error('Keine Bilddatei');
  let source,objectUrl;
  if(typeof createImageBitmap==='function'){try{source=await createImageBitmap(file)}catch{}}
  if(!source){objectUrl=URL.createObjectURL(file);source=await new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=()=>reject(Error('Bild nicht lesbar'));im.src=objectUrl})}
  try{
    for(const height of [1100,950,800,650,500]){
      const ratio=Math.min(1,height/source.height,850/source.width);
      const canvas=document.createElement('canvas');
      canvas.width=Math.max(1,Math.round(source.width*ratio));
      canvas.height=Math.max(1,Math.round(source.height*ratio));
      const ctx=canvas.getContext('2d',{alpha:false});
      if(!ctx)throw Error('Bildverarbeitung nicht verfügbar');
      ctx.fillStyle='#fff';ctx.fillRect(0,0,canvas.width,canvas.height);
      ctx.imageSmoothingEnabled=true;ctx.imageSmoothingQuality='high';
      ctx.drawImage(source,0,0,canvas.width,canvas.height);
      for(const quality of [.85,.73,.60,.48,.35]){
        const blob=await new Promise(resolve=>canvas.toBlob(resolve,'image/webp',quality));
        const output=blob?.type==='image/webp'?blob:await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',quality));
        if(!output)throw Error('Komprimierung fehlgeschlagen');
        if(output.size<=380000){
          return await new Promise((resolve,reject)=>{
            const reader=new FileReader();reader.onload=()=>resolve(reader.result);
            reader.onerror=()=>reject(Error('Bild konnte nicht gelesen werden'));
            reader.readAsDataURL(output);
          });
        }
      }
    }
    throw Error('Bild ist nach Komprimierung noch zu groß');
  }finally{source.close?.();if(objectUrl)URL.revokeObjectURL(objectUrl)}
}
async function importFiles(e,type){
 const input=e.target,files=[...input.files];
 if(files.length>30){toast('Maximal 30 Karten pro Import');input.value='';return}
 input.disabled=true;let done=0,failed=0;
 try{
  for(let i=0;i<files.length;i++){
   const f=files[i],defaultName=f.name.replace(/\\.[^.]+$/,'').trim()||'Neue Karte';
   const nameInput=prompt(`Karte ${i+1}/${files.length} – Name:`,defaultName);
   if(nameInput===null)continue;
   const name=nameInput.trim();
   if(!name||name.length>80){failed++;toast('Name muss 1–80 Zeichen haben');continue}
   let attack=0,hp=1;
   if(type==='hero'){
    const a=prompt(`${name} – Angriff:`,String($('attack').value||5));
    if(a===null)continue;
    const h=prompt(`${name} – maximale KP:`,String($('hp').value||15));
    if(h===null)continue;
    attack=Number(a);hp=Number(h);
    if(!Number.isInteger(attack)||attack<0||attack>99||!Number.isInteger(hp)||hp<1||hp>99){failed++;toast('Ungültige Werte für '+name);continue}
   }
   toast(`Karte ${i+1}/${files.length} wird verarbeitet …`);
   try{
    const image=await compressCard(f);
    if(ws?.readyState!==WebSocket.OPEN)throw Error('Keine Serververbindung');
    // Wait for acknowledgement before storing the card in the local library.
    await new Promise((resolve,reject)=>{
     const timeout=setTimeout(()=>{ws.removeEventListener('message',onMessage);reject(Error('Server antwortet nicht'))},15000);
     function onMessage(event){
      let msg;try{msg=JSON.parse(event.data)}catch{return}
      if(msg.type!=='state'&&msg.type!=='error')return;
      clearTimeout(timeout);ws.removeEventListener('message',onMessage);
      if(msg.type==='error')reject(Error(msg.message||'Import fehlgeschlagen'));else resolve();
     }
     ws.addEventListener('message',onMessage);
     act('import',{cards:[{name,image,type,attack,hp}]});
    });
    await saveCard({name,image,type,attack,hp});
    done++;
   }catch(err){failed++;toast(`${name}: ${err.message}`)}
  }
  toast(`${done} Karte(n) importiert${failed?`, ${failed} fehlgeschlagen`:''}`);
 }finally{input.disabled=false;input.value=''}
}
$('heroFiles').onchange=e=>importFiles(e,'hero');$('actionFiles').onchange=e=>importFiles(e,'action');

// Browser-local library: survives refreshes, not device changes or clearing site data.
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open('tcg-card-library',2);req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('cards'))db.createObjectStore('cards',{keyPath:'id',autoIncrement:true});if(!db.objectStoreNames.contains('decks'))db.createObjectStore('decks',{keyPath:'id'});};req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
async function saveCard(card){try{const db=await dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction('cards','readwrite');tx.objectStore('cards').add(card);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}catch(e){toast('Karte im Spiel, lokale Speicherung fehlgeschlagen')}}
async function getSaved(){const db=await dbOpen();const rows=await new Promise((resolve,reject)=>{const tx=db.transaction('cards','readonly');const req=tx.objectStore('cards').getAll();req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)});db.close();return rows}
async function deleteSaved(id){const db=await dbOpen();await new Promise((resolve,reject)=>{const tx=db.transaction('cards','readwrite');tx.objectStore('cards').delete(id);tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close()}
$('library').onclick=async()=>{
 try{
  const rows=await getSaved();
  const buttons=rows.map(c=>[c.name+' · '+(c.type==='hero'?'Charakter':'Effekt'),()=>{
    showDialog(c.name,c.image,[
      ['In diesen Raum importieren',()=>act('import',{cards:[{name:c.name,image:c.image,type:c.type,attack:c.attack,hp:c.hp}]})],
      ['Aus Bibliothek löschen',async()=>{if(confirm('Lokal gespeicherte Karte löschen?')){await deleteSaved(c.id);toast('Lokal gelöscht')}}]
    ]);
  }]);
  showDialog('Lokale Kartenbibliothek ('+rows.length+')',null,buttons);
 }catch(e){toast('Bibliothek nicht verfügbar: '+e.message)}
};
window.addEventListener('error',e=>{console.error('TCG Fehler:',e.message);toast('App-Fehler: '+e.message)});

// ---- Main menu and local deckbuilder ----
let builderDeck=null,builderStage='heroes',builderCards=[];
function showPage(page){for(const id of ['home','lobby','deckbuilder','game'])$(id).hidden=id!==page;window.scrollTo(0,0)}
$('goBattle').onclick=()=>{showPage('lobby');if(lastRoom)$('code').value=lastRoom};
$('goBuilder').onclick=()=>{showPage('deckbuilder');showDeckList()};
$('battleBack').onclick=()=>showPage('home');
$('builderBack').onclick=()=>{if(!$('deckEditor').hidden){$('deckEditor').hidden=true;$('deckList').hidden=false}else showPage('home')};
$('gameHome').onclick=()=>showPage('home');
function dbRequest(store,mode,work){return dbOpen().then(db=>new Promise((resolve,reject)=>{const tx=db.transaction(store,mode);let result;try{result=work(tx.objectStore(store))}catch(e){db.close();reject(e);return}tx.oncomplete=()=>{db.close();resolve(result?.result)};tx.onerror=()=>{db.close();reject(tx.error)}}))}
const getDecks=()=>dbRequest('decks','readonly',store=>store.getAll());
const putDeck=d=>dbRequest('decks','readwrite',store=>store.put(d));
const removeDeck=id=>dbRequest('decks','readwrite',store=>store.delete(id));
function makeButton(label,fn){const b=document.createElement('button');b.textContent=label;b.onclick=fn;return b}
async function showDeckList(){
 $('deckEditor').hidden=true;$('deckList').hidden=false;const target=$('deckList');target.replaceChildren();
 target.append(makeButton('＋ Neues Deck erstellen',()=>editDeck(null)));
 try{const decks=await getDecks();if(!decks.length){const p=document.createElement('p');p.className='hint';p.textContent='Noch keine Decks angelegt.';target.append(p)}
 for(const d of decks){const row=document.createElement('div');row.className='deck-row';const name=document.createElement('strong');name.textContent=d.name;const count=document.createElement('span');count.textContent=`${d.heroes.length}/10 Charaktere · ${d.effects.length}/50 Effektkarten`;row.append(name,count,makeButton('Bearbeiten',()=>editDeck(d)),makeButton('Löschen',async()=>{if(confirm(`Deck „${d.name}“ löschen?`)){await removeDeck(d.id);showDeckList()}}));target.append(row)}}catch(e){toast('Decks konnten nicht geladen werden: '+e.message)}
}
async function editDeck(existing){
 try{builderCards=await getSaved();builderDeck=existing?structuredClone(existing):{id:(crypto.randomUUID?.()||String(Date.now())+'-'+Math.random()),name:'Neues Deck',heroes:[],effects:[]};builderStage='heroes';$('deckName').value=builderDeck.name;$('deckList').hidden=true;$('deckEditor').hidden=false;renderBuilder()}catch(e){toast('Kartenbibliothek nicht verfügbar: '+e.message)}
}
function countEffects(id){return builderDeck.effects.filter(x=>x===id).length}
function renderBuilder(){
 const heroStage=builderStage==='heroes';$('builderStep').textContent=heroStage?'1 / 2 · CHARAKTERE AUSWÄHLEN':'2 / 2 · EFFEKTFKARTEN AUSWÄHLEN';
 $('builderHint').textContent=heroStage?'Bis zu 10 verschiedene Charaktere auswählen.':'Bis zu 50 Effektkarten auswählen, maximal 2 Kopien je Karte.';
 $('builderSelected').textContent=heroStage?`${builderDeck.heroes.length} / 10 Charaktere`:`${builderDeck.effects.length} / 50 Effektkarten`;
 $('builderPrevious').hidden=heroStage;$('builderNext').hidden=!heroStage;$('builderSave').hidden=heroStage;
 $('builderUploadLabel').textContent=heroStage?'＋ Charakterkarten hochladen':'＋ Effektkarten hochladen';
 const grid=$('builderGrid');grid.replaceChildren();const cards=builderCards.filter(c=>c.type===(heroStage?'hero':'action'));
 if(!cards.length){const msg=document.createElement('p');msg.className='hint';msg.textContent='Noch keine passenden Karten gespeichert. Lade sie oben direkt hoch.';grid.append(msg)}
 for(const c of cards){const selected=heroStage?builderDeck.heroes.includes(c.id):countEffects(c.id)>0;const item=document.createElement('button');item.className='builder-card'+(selected?' selected':'');item.type='button';const img=document.createElement('img');img.src=c.image;img.alt=c.name;item.append(img);const label=document.createElement('span');label.textContent=c.name;item.append(label);const counter=document.createElement('b');counter.textContent=heroStage?(selected?'✓':'＋'):`${countEffects(c.id)}/2`;item.append(counter);
 item.onclick=()=>{if(heroStage){if(selected)builderDeck.heroes=builderDeck.heroes.filter(x=>x!==c.id);else if(builderDeck.heroes.length<10)builderDeck.heroes.push(c.id);else return toast('Maximal 10 Charaktere')}else{const n=countEffects(c.id);if(n>=2)builderDeck.effects.splice(builderDeck.effects.indexOf(c.id),1);else if(builderDeck.effects.length<50)builderDeck.effects.push(c.id);else return toast('Maximal 50 Effektkarten')}renderBuilder()};grid.append(item)}
}
$('builderNext').onclick=()=>{builderStage='effects';renderBuilder()};$('builderPrevious').onclick=()=>{builderStage='heroes';renderBuilder()};$('builderCancel').onclick=showDeckList;
$('builderSave').onclick=async()=>{const name=$('deckName').value.trim();if(!name)return toast('Bitte einen Decknamen eingeben');if(builderDeck.heroes.length>10||builderDeck.effects.length>50)return toast('Decklimit überschritten');builderDeck.name=name;await putDeck(builderDeck);toast('Deck gespeichert: '+name);showDeckList()};
async function chooseDeck(){
 if(!state||seat===undefined)return toast('Bitte zuerst einer Lobby beitreten');
 const decks=await getDecks();if(!decks.length)return toast('Erstelle zuerst ein Deck im Deckbuilder');
 const buttons=decks.map(d=>[`${d.name} (${d.heroes.length} Charaktere / ${d.effects.length} Effekte)`,()=>loadSavedDeck(d)]);
 showDialog('Fertiges Deck laden',null,buttons);
}
$('loadDeck').onclick=()=>chooseDeck().catch(e=>toast(e.message));
function waitForState(sendAction){return new Promise((resolve,reject)=>{
 if(ws?.readyState!==WebSocket.OPEN)return reject(Error('Keine Serververbindung'));
 const timeout=setTimeout(()=>{ws.removeEventListener('message',handler);reject(Error('Server antwortet nicht'))},20000);
 function handler(e){let m;try{m=JSON.parse(e.data)}catch{return}if(m.type!=='state'&&m.type!=='error')return;clearTimeout(timeout);ws.removeEventListener('message',handler);m.type==='error'?reject(Error(m.message)):resolve()}
 ws.addEventListener('message',handler);sendAction();
})}
async function loadSavedDeck(deck){
 const cards=await getSaved();const byId=new Map(cards.map(c=>[c.id,c]));const selected=[...deck.heroes,...deck.effects].map(id=>byId.get(id));
 if(selected.some(c=>!c))return toast('Einige Karten fehlen in der Bibliothek. Bitte Deck bearbeiten.');
 if(!confirm(`„${deck.name}“ laden? Deine bisherigen Karten im aktuellen Raum werden ersetzt.`))return;
 $('loadDeck').disabled=true;
 try{
  await waitForState(()=>act('clearMyCards'));
  let i=0;for(const c of selected){await waitForState(()=>act('import',{cards:[{name:c.name,image:c.image,type:c.type,attack:c.attack,hp:c.hp}]}));i++;if(i%5===0||i===selected.length)toast(`Deck wird geladen: ${i}/${selected.length}`)}
  toast(`Deck „${deck.name}“ geladen`);
 }catch(e){toast('Laden unterbrochen: '+e.message+' (erneut laden)')}finally{$('loadDeck').disabled=false}
}


// Deckbuilder: import cards into the local library without a battle room.
$('builderUploadFiles').addEventListener('change',async function(event){
 const input=event.target,files=Array.from(input.files||[]);
 const type=builderStage==='heroes'?'hero':'action';
 if(files.length>30){toast('Maximal 30 Bilder gleichzeitig');input.value='';return}
 input.disabled=true;let saved=0,failed=0,skipped=0;
 try{
  for(let i=0;i<files.length;i++){
   const f=files[i];
   const proposed=f.name.replace(/\.[^.]+$/,'').trim()||'Neue Karte';
   const nameText=prompt(`Karte ${i+1}/${files.length} – Kartenname`,proposed);
   if(nameText===null){skipped++;continue}
   const name=nameText.trim();
   if(!name||name.length>80){failed++;toast('Name muss 1–80 Zeichen haben');continue}
   let attack=0,hp=1;
   if(type==='hero'){
    const a=prompt(`${name} – Angriff (0–99)`,'5');
    if(a===null){skipped++;continue}
    const h=prompt(`${name} – maximale Lebenspunkte (1–99)`,'15');
    if(h===null){skipped++;continue}
    if(!/^\d+$/.test(a.trim())||!/^\d+$/.test(h.trim())){failed++;toast('Bitte ganze Zahlen eingeben');continue}
    attack=Number(a);hp=Number(h);
    if(attack>99||hp<1||hp>99){failed++;toast('Ungültige Werte für '+name);continue}
   }
   try{
    toast(`${name} wird gespeichert (${i+1}/${files.length}) …`);
    const image=await compressCard(f);
    await dbRequest('cards','readwrite',store=>store.add({name,image,type,attack,hp}));
    saved++;
   }catch(error){failed++;toast(`${name}: ${error.message||'Fehler'}`)}
  }
  builderCards=await getSaved();
  if(builderDeck&&!$('deckEditor').hidden)renderBuilder();
  toast(`${saved} Karte(n) gespeichert${failed?`, ${failed} fehlgeschlagen`:''}${skipped?`, ${skipped} übersprungen`:''}`);
 }catch(error){toast('Importfehler: '+error.message)}
 finally{input.disabled=false;input.value=''}
});
