const $=id=>document.getElementById(id);let ws,seat,code,state,selected=null;
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
    if(m.type==='joined'){seat=m.seat;code=m.code;manualCode=code;localStorage.setItem('tcg-token-'+code,m.token);localStorage.setItem('tcg-last-room',code);$('room').textContent='Lobby '+code+' · Spieler '+(seat+1);$('lobby').hidden=true;$('game').hidden=false;$('status').textContent='Online';if(reconnectTimer){clearTimeout(reconnectTimer);reconnectTimer=null}}
    if(m.type==='state'){state=m;render();renderApproval()}
    if(m.type==='notice')toast(m.message)
  };
  ws.onclose=()=>{$('status').textContent='Verbindung getrennt';if(manualCode){reconnectTimer=setTimeout(()=>connect(manualCode),3000)}};
}
$('join').onclick=()=>connect($('code').value.trim().toUpperCase());
const lastRoom=localStorage.getItem('tcg-last-room');
if(lastRoom){$('code').value=lastRoom;connect(lastRoom)}
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
function showDialog(title,image,buttons){if($('cardDialog').open)$('cardDialog').close();const details=$('details');details.replaceChildren();const h=document.createElement('h3');h.textContent=title;details.append(h);if(image){const im=document.createElement('img');im.src=image;im.alt=title;im.onclick=()=>im.classList.toggle('zoomed');details.append(im)}$('actions').replaceChildren();for(const [label,fn] of buttons){const b=document.createElement('button');b.textContent=label;b.onclick=()=>{$('cardDialog').close();fn()};$('actions').append(b)}$('cardDialog').showModal()}
function openHand(c){showDialog(c.name,c.image,[['Auf Magiefeld ausspielen',()=>act('play',{cardId:c.id})],['Karte löschen',()=>{if(confirm('Karte löschen?'))act('deleteCard',{cardId:c.id,zone:'hand'})}]] )}
function openHero(player,slot,h){const x={player,slot};const mine=player===seat;const details=$('details');details.replaceChildren();const heading=document.createElement('h3');heading.textContent=h.name;details.append(heading);const img=document.createElement('img');img.src=h.image;img.alt=h.name;img.onclick=()=>img.classList.toggle('zoomed');details.append(img);
 for(const [label,stat,val] of [['Angriff','attack',h.attack],['KP','hp',h.hp],['Rüstung','armor',h.armor]]){
 const row=document.createElement('div');row.className='stat-row';const minus=document.createElement('button');minus.textContent='−';minus.onclick=()=>act('setStat',{...x,stat,value:val-1});const text=document.createElement('strong');text.textContent=label+' '+(stat==='attack'?`${h.effectiveAttack??val}/${h.attack}`:stat==='hp'?`${h.hp}/${h.maxHp}`:val);const plus=document.createElement('button');plus.textContent='+';plus.onclick=()=>act('setStat',{...x,stat,value:val+1});row.append(minus,text,plus);details.append(row)}
 for(const effect of h.statuses||[]){const el=document.createElement('div');el.className='effect-chip';el.textContent=`${effect.name}: ${effect.amount>0?'+':''}${effect.amount} ${effect.stat} · ${effect.remaining===0?'dauerhaft':effect.remaining+' Runden'}`;details.append(el)}
 const buttons=[['Aktiv / Erschöpft',()=>act('exhaust',x)],['Buff / Nerf hinzufügen',()=>{const name=prompt('Name des Effekts');if(!name)return;const stat=prompt('Werttyp: attack, damageBonus, damageReduction','attack');if(!stat)return;const amount=prompt('Wert, z.B. 3 oder -2','3');if(amount===null)return;const duration=prompt('Dauer in eigenen Zugenden, 0 = dauerhaft','2');if(duration===null)return;act('addStatus',{...x,name,stat,amount:Number(amount),duration:Number(duration)})}],...((h.statuses||[]).map(e=>['Effekt entfernen: '+e.name,()=>act('removeStatus',{...x,statusId:e.id})])),['Verbrennung / Gift',()=>{const kind=prompt('burn oder poison','poison');if(!kind)return;const value=prompt('Stärke','1');if(value!==null)act('condition',{...x,kind,value:Number(value)})}]];
 if(mine)buttons.push(['Bewegen',()=>{const to=prompt('Zielposition 1–3 Front, 4–6 Rück');if(to)act('move',{...x,to:Number(to)-1})}],['Zurück zum Charakterstapel (Anfrage)',()=>act('requestReturnHero',x)]);
 else buttons.push(['Angreifen',()=>{const from=prompt('Eigener Angreifer: 1–3 Front, 4–6 Rück');if(from)act('attack',{...x,from:Number(from)-1})}]);
 $('actions').replaceChildren();for(const [label,fn] of buttons){const btn=document.createElement('button');btn.textContent=label;btn.onclick=()=>{fn();$('cardDialog').close()};$('actions').append(btn)}$('cardDialog').showModal();}
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
  const input=e.target;const files=[...input.files];
  if(files.length>30){toast('Maximal 30 Karten pro Import');input.value='';return}
  const attack=Number($('attack').value),hp=Number($('hp').value);
  input.disabled=true;
  let done=0,failed=0;
  try{
    for(const f of files){
      toast(`Karte ${done+failed+1}/${files.length} wird komprimiert …`);
      try{
        const image=await compressCard(f);
        // Send cards separately to avoid oversized WebSocket messages.
        act('import',{cards:[{name:f.name.replace(/\.[^.]+$/,''),image,type,attack,hp}]});
        await saveCard({name:f.name.replace(/\.[^.]+$/,''),image,type,attack,hp});
        done++;
      }catch(err){failed++;toast(`${f.name}: ${err.message}`)}
      await new Promise(resolve=>setTimeout(resolve,120));
    }
    toast(`${done} Karte(n) importiert${failed?`, ${failed} fehlgeschlagen`:''}`);
  }finally{input.disabled=false;input.value=''}
}
$('heroFiles').onchange=e=>importFiles(e,'hero');$('actionFiles').onchange=e=>importFiles(e,'action');

// Browser-local library: survives refreshes, not device changes or clearing site data.
function dbOpen(){return new Promise((resolve,reject)=>{const req=indexedDB.open('tcg-card-library',1);req.onupgradeneeded=()=>req.result.createObjectStore('cards',{keyPath:'id',autoIncrement:true});req.onsuccess=()=>resolve(req.result);req.onerror=()=>reject(req.error)})}
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
