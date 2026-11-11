const $=id=>document.getElementById(id);let ws,seat,code,state,selected=null;
function toast(s){$('toast').textContent=s;$('toast').style.display='block';setTimeout(()=>$('toast').style.display='none',3500)}
function send(o){if(ws?.readyState===1)ws.send(JSON.stringify(o))}function act(action,extra={}){send({type:'action',action,...extra})}
$('join').onclick=()=>{let requested=$('code').value.trim().toUpperCase();ws=new WebSocket((location.protocol==='https:'?'wss://':'ws://')+location.host);ws.onopen=()=>send({type:'join',code:requested,token:requested?localStorage.getItem('tcg-token-'+requested):null});ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='error')return toast(m.message);if(m.type==='joined'){seat=m.seat;code=m.code;localStorage.setItem('tcg-token-'+code,m.token);$('room').textContent='Raum: '+code+' · Du bist Spieler '+(seat+1);$('lobby').hidden=true;$('game').hidden=false;$('status').textContent='Online'}if(m.type==='state'){state=m;render()}};ws.onclose=()=>{$('status').textContent='Verbindung getrennt';toast('Serververbindung verloren. Seite neu laden zum Wiederverbinden.')}};
function cardEl(c,fn){let el=document.createElement('div');el.className='card'+(c.exhausted?' exhausted':'');let img=document.createElement('img');img.src=c.image;img.alt=c.name;el.append(img);if(c.type==='hero'){let st=document.createElement('div');st.className='stats';st.textContent=`⚔ ${c.effectiveAttack??c.attack} · ♥ ${c.hp}/${c.maxHp} · 🛡 ${c.armor}`;el.append(st)}if(c.type==='hero'&&Object.keys(c.counters||{}).length){let tags=document.createElement('div');tags.className='status-tags';tags.textContent=Object.entries(c.counters).map(([k,v])=>`${k}: ${v}`).join(' | ');el.append(tags)}if(c.type==='hero'&&c.statuses?.length){let tags=document.createElement('div');tags.className='status-tags';tags.textContent=c.statuses.map(x=>`${x.name}: ${x.amount>0?'+':''}${x.amount} ${x.stat==='attack'?'ATK':x.stat==='damageBonus'?'Schaden':'Reduktion'}${x.remaining?' ('+x.remaining+')':''}`).join(' | ');el.append(tags)}el.title=c.name;el.onclick=fn;return el}
function renderBoard(player,id){let target=$(id);target.replaceChildren();let p=state.players[player];let title=document.createElement('div');title.textContent=(player===seat?'DEINE HELDEN':'GEGNER')+' · '+(p.connected?'verbunden':'offline');target.append(title);for(let line=0;line<2;line++){let row=document.createElement('div');row.className='line';for(let col=0;col<3;col++){let slot=line*3+col;let div=document.createElement('div');div.className='slot';let h=p.heroes[slot];if(h)div.append(cardEl(h,()=>openHero(player,slot,h)));else{div.classList.add('empty');div.textContent=(line===0?'Front':'Rück')+' '+(col+1);div.onclick=()=>{if(player===seat&&selected){act('place',{player,slot,cardId:selected});selected=null}}}row.append(div)}target.append(row)}}
function render(){renderBoard(1-seat,'enemy');renderBoard(seat,'self');let p=state.players[seat];$('turn').textContent=`Runde ${state.round} · Spieler ${state.turn+1} am Zug`;$('end').disabled=state.turn!==seat;$('energy').textContent=`Energie ${p.energy}/${p.maxEnergy}`;$('playerCounters').textContent=Object.entries(p.counters||{}).map(([k,v])=>`${k}: ${v}`).join(' · ')||'Keine eigenen Counter';$('piles').textContent=`Deck ${p.deckCount} · Ablage ${p.discard.length}`;$('hand').replaceChildren();for(const c of p.hand){let el=cardEl(c,()=>openHand(c));if(selected===c.id)el.style.outline='3px solid yellow';$('hand').append(el)}$('log').replaceChildren(...state.log.map(s=>{let el=document.createElement('p');el.textContent=s;return el}))}
function showDialog(title,image,buttons){$('details').replaceChildren();let h=document.createElement('h3');h.textContent=title;$('details').append(h);if(image){let im=document.createElement('img');im.src=image;$('details').append(im)}$('actions').replaceChildren();for(let [label,fn] of buttons){let b=document.createElement('button');b.textContent=label;b.onclick=()=>{fn();$('cardDialog').close()};$('actions').append(b)}$('cardDialog').showModal()}
function openHand(c){let buttons=[['Ausspielen → Ablage',()=>act('play',{cardId:c.id})]];if(c.type==='hero')buttons.unshift(['Auf freien Platz setzen',()=>{selected=c.id;render();toast('Wähle jetzt eine freie Position auf deiner Seite')}]);showDialog(c.name,c.image,buttons)}
function openHero(player,slot,h){const x={player,slot};showDialog(h.name,h.image,[
['Werte frei bearbeiten',()=>{const stat=prompt('Wert: hp, maxHp, attack oder armor','hp');if(!stat)return;const value=prompt('Neuer Wert (direkt setzen)',String(h[stat]??0));if(value!==null)act('setStat',{...x,stat,value:Number(value)})}],
['Counter hinzufügen / bearbeiten',()=>{const name=prompt('Countername (z.B. Gift, Schild, Blutung)');if(!name)return;const value=prompt('Counterwert (auch negativ möglich)','1');if(value!==null)act('counter',{...x,scope:'hero',name,value:Number(value)})}],
...Object.keys(h.counters||{}).map(name=>['Counter entfernen: '+name,()=>act('counter',{...x,scope:'hero',name,remove:true})]),
['Angriff mit eigenem Helden',()=>{if(player===seat)return toast('Wähle einen gegnerischen Helden als Ziel');let from=prompt('Dein Angreifer: Position 1–3 Front, 4–6 Rück');if(from!==null&&Number(from)>=1&&Number(from)<=6)act('attack',{...x,from:Number(from)-1})}],
['Buff / Debuff hinzufügen',()=>{let name=prompt('Effektname (z.B. Arkaner Segen)','Magieeffekt');if(name===null)return;let stat=prompt('Art: attack, damageBonus oder damageReduction','attack');if(stat===null)return;let amount=prompt('Wert (z.B. +3 oder -2)','3');if(amount===null)return;let duration=prompt('Dauer: 0 = dauerhaft, sonst Anzahl eigener Zugenden des betroffenen Spielers','0');if(duration===null)return;act('addStatus',{...x,name,stat,amount:Number(amount),duration:Number(duration)})}],
...(h.statuses||[]).map(e=>['Entfernen: '+e.name+' ('+(e.amount>0?'+':'')+e.amount+')',()=>act('removeStatus',{...x,statusId:e.id})]),
['−1 Schaden',()=>act('damage',{...x,amount:1})],['−3 Schaden',()=>act('damage',{...x,amount:3})],['+2 Heilung',()=>act('heal',{...x,amount:2})],['+1 Rüstung',()=>act('armor',{...x,amount:1})],['−1 Rüstung',()=>act('armor',{...x,amount:-1})],['Aktiv / Erschöpft',()=>act('exhaust',x)],...(player===seat?[['Bewegen',()=>{let v=prompt('Neue Position (1–3 Front, 4–6 Rück):');if(v)act('move',{...x,to:Number(v)-1})}]]:[])])}
$('close').onclick=()=>$('cardDialog').close();$('end').onclick=()=>act('endTurn');$('draw').onclick=()=>act('draw');$('shuffle').onclick=()=>act('shuffle');$('energyMinus').onclick=()=>act('energy',{player:seat,amount:-1});$('energyPlus').onclick=()=>act('energy',{player:seat,amount:1});$('maxPlus').onclick=()=>act('maxEnergy',{player:seat,amount:1});
// Convert large iPhone photos to compact WebP/JPEG before sending them to the room.
// Server currently limits each data URL to 650,000 characters; keep well below that.
async function compressCard(file){
  if(!file.type.startsWith('image/'))throw Error('Keine Bilddatei');
  const source=await createImageBitmap(file);
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
  }finally{source.close?.()}
}
$('files').onchange=async e=>{
  const input=e.target;const files=[...input.files];
  if(files.length>30){toast('Maximal 30 Karten pro Import');input.value='';return}
  const type=$('cardType').value,attack=Number($('attack').value),hp=Number($('hp').value);
  input.disabled=true;
  let done=0,failed=0;
  try{
    for(const f of files){
      toast(`Karte ${done+failed+1}/${files.length} wird komprimiert …`);
      try{
        const image=await compressCard(f);
        // Send cards separately to avoid oversized WebSocket messages.
        act('import',{cards:[{name:f.name.replace(/\.[^.]+$/,''),image,type,attack,hp}]});
        done++;
      }catch(err){failed++;toast(`${f.name}: ${err.message}`)}
      await new Promise(resolve=>setTimeout(resolve,120));
    }
    toast(`${done} Karte(n) importiert${failed?`, ${failed} fehlgeschlagen`:''}`);
  }finally{input.disabled=false;input.value=''}
};

$('roll20').onclick=()=>act('roll',{sides:20});$('rollCustom').onclick=()=>{const sides=prompt('Würfel-Seitenzahl','6');if(sides!==null)act('roll',{sides:Number(sides)})};$('setEnergy').onclick=()=>{const v=prompt('Energie direkt setzen',state.players[seat].energy);if(v!==null)act('setEnergy',{player:seat,stat:'energy',value:Number(v)})};$('setMaxEnergy').onclick=()=>{const v=prompt('Maximale Energie direkt setzen',state.players[seat].maxEnergy);if(v!==null)act('setEnergy',{player:seat,stat:'maxEnergy',value:Number(v)})};$('playerCounter').onclick=()=>{const name=prompt('Name des Spieler-Counters');if(!name)return;const value=prompt('Wert (auch negativ)','1');if(value!==null)act('counter',{player:seat,scope:'player',name,value:Number(value)})};
