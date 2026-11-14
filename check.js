
const badgeImages={};
for(const key of ['attack','hp','combat','passive','active','rage','swordSymbol','heartSymbol']){
 const img=new Image();img.onload=()=>{badgeImages[key]=img;if(typeof render==='function')render()};
 img.src='/editor-assets/'+({'swordSymbol':'sword-symbol','heartSymbol':'heart-symbol'}[key]||key)+'.png';
}
function drawBadgeImage(key,x,y,w,h,fallback){
 if(badgeImages[key]?.complete&&badgeImages[key].naturalWidth){ctx.drawImage(badgeImages[key],x,y,w,h)}
 else fallback();
}
const ids=['presetRole','name','attack','hp','role','frame','brightness','zoom','iconZoom','artX','artY','passive','active','rage','flavor','font','line','spacing','style','nameFont','flavorFont','bleed','bleedMm','fontFamily','titleFamily'];const $=id=>document.getElementById(id);let artwork=null,roleIcon=null,artData=null,iconData=null;const C=$('card'),ctx=C.getContext('2d');const V=id=>$(id).value;const num=id=>+V(id);function rounded(x,y,w,h,r,fill,stroke,lw=2){ctx.beginPath();ctx.roundRect(x,y,w,h,r);if(fill){ctx.fillStyle=fill;ctx.fill()}if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}function text(t,x,y,size,color='#fff',align='left',style='italic'){ctx.fillStyle=color;ctx.textAlign=align;ctx.font=`${style} ${size}px Arial,sans-serif`;ctx.fillText(t,x,y)}function fit(t,max,size){while(size>14){ctx.font=`italic ${size}px Arial`;if(ctx.measureText(t).width<=max)break;size--}return size}function imageCover(img,x,y,w,h,zoom,dx,dy){if(!img)return;let sc=Math.max(w/img.width,h/img.height)*zoom;let iw=img.width*sc,ih=img.height*sc;ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();ctx.drawImage(img,x+(w-iw)/2+dx,y+(h-ih)/2+dy,iw,ih);ctx.restore()}
function wrapWords(t,x,y,width,size,lineH,maxY){ctx.font=`${V('style')} ${size}px Arial,sans-serif`;ctx.textAlign='left';ctx.fillStyle='#19151e';let words=t.split(/\s+/),line='';let letter=num('spacing');ctx.letterSpacing=letter+'px';for(const word of words){let test=line?line+' '+word:word;if(ctx.measureText(test).width>width&&line){ctx.fillText(line,x,y);y+=lineH;line=word;if(y>maxY)break}else line=test}if(y<=maxY)ctx.fillText(line,x,y);ctx.letterSpacing='0px';return y+lineH}
function polygon(points,fill,stroke,lw=3){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath();ctx.fillStyle=fill;ctx.fill();if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lw;ctx.stroke()}}
function gradient(y,h,top,mid,bottom){const g=ctx.createLinearGradient(0,y,0,y+h);g.addColorStop(0,top);g.addColorStop(.43,mid);g.addColorStop(1,bottom);return g}
function badge(x,y,w,h,colors){
 const pts=[[x+22,y],[x+w-22,y],[x+w,y+h/2],[x+w-22,y+h],[x+22,y+h],[x,y+h/2]];
 polygon(pts,'#0d0d10','#f5f5f5',5);
 const inner=pts.map(([px,py])=>[x+(px-x)*.96+w*.02,y+(py-y)*.90+h*.05]);
 polygon(inner,'#151518','#101014',5);
 ctx.save();ctx.beginPath();ctx.moveTo(x+25,y+8);ctx.lineTo(x+w-25,y+8);ctx.lineTo(x+w-10,y+h/2);ctx.lineTo(x+w-25,y+h-8);ctx.lineTo(x+25,y+h-8);ctx.lineTo(x+10,y+h/2);ctx.closePath();ctx.clip();
 ctx.fillStyle=gradient(y,h,...colors);ctx.fillRect(x,y,w,h);ctx.restore();
}
function sword(x,y){ctx.save();ctx.translate(x,y);ctx.rotate(.72);ctx.lineJoin='round';ctx.strokeStyle='#121216';ctx.lineWidth=3;ctx.fillStyle='#f4f4f5';ctx.beginPath();ctx.moveTo(-7,-24);ctx.lineTo(0,-37);ctx.lineTo(7,-24);ctx.lineTo(7,11);ctx.lineTo(-7,11);ctx.closePath();ctx.fill();ctx.stroke();ctx.beginPath();ctx.roundRect(-17,10,34,7,2);ctx.fill();ctx.stroke();ctx.beginPath();ctx.roundRect(-4,17,8,18,2);ctx.fill();ctx.stroke();ctx.restore()}
function heart(x,y){ctx.save();ctx.translate(x,y);ctx.beginPath();ctx.moveTo(0,22);ctx.bezierCurveTo(-12,12,-23,4,-23,-8);ctx.bezierCurveTo(-23,-24,-5,-24,0,-13);ctx.bezierCurveTo(5,-24,23,-24,23,-8);ctx.bezierCurveTo(23,4,12,12,0,22);ctx.closePath();ctx.fillStyle='#f9fff8';ctx.fill();ctx.strokeStyle='#141414';ctx.lineWidth=3;ctx.stroke();ctx.restore()}
function drawFit(t,x,y,maxW,size,color,align='left',family='Arial',style='italic'){ctx.textAlign=align;ctx.fillStyle=color;while(size>15){ctx.font=`${style} ${size}px "${family}"`;if(ctx.measureText(t).width<=maxW)break;size--}ctx.fillText(t,x,y)}
function frameTone(){
 const hex=V('frame').replace('#','');
 const rgb=[0,2,4].map(i=>parseInt(hex.slice(i,i+2),16));
 // The brightness slider controls how strongly the selected hue tints the dark card frame.
 const strength=.20+num('brightness')/100*.52;
 return 'rgb('+rgb.map(c=>Math.round(15*(1-strength)+c*strength)).join(',')+')';
}
function render(){
 const frameColor=frameTone();
 const W=791,H=1087;C.width=W;C.height=H;ctx.clearRect(0,0,W,H);
 ctx.fillStyle=frameColor;ctx.fillRect(0,0,W,H);
 rounded(8,8,775,1071,37,frameColor,'#8c8990',5);rounded(21,19,749,1048,29,frameColor,'#eee',2);
 rounded(32,30,725,72,26,frameColor,'#e5e5e5',2);
 drawFit(V('name'),70,78,590,num('nameFont'),'#fff','left',V('titleFamily'));
 // Artwork: square-corner image bounds are clipped with a rounded path, under a thin white frame.
 rounded(30,113,731,608,26,frameColor,'#e5e5e5',2);
 ctx.save();ctx.beginPath();ctx.roundRect(33,116,725,602,23);ctx.clip();
 if(artwork){imageCover(artwork,33,116,725,602,num('zoom')/100,num('artX')*2,num('artY')*2)}
 else{ctx.fillStyle='#695777';ctx.fillRect(33,116,725,602);drawFit('Artwork hochladen',395,415,600,32,'#fff','center')}
 ctx.restore();
 // The top-right circle is a role icon, not the combat-type label.
 rounded(660,18,96,96,48,'#202026','#e8e7e9',5);
 ctx.save();ctx.beginPath();ctx.arc(708,66,42,0,Math.PI*2);ctx.clip();
 if(roleIcon)imageCover(roleIcon,666,24,84,84,num('iconZoom')/100,0,0);
 else drawFit('◆',708,81,55,46,'#49bdf4','center','Arial','bold');ctx.restore();
 // Three taller aligned stat badges.
 drawBadgeImage('attack',31,672,214,83,()=>badge(31,672,214,83,['#ff8387','#f01928','#a40013']));
 drawBadgeImage('hp',544,672,214,83,()=>badge(544,672,214,83,['#b0ff8b','#2de93c','#08791a']));
 drawBadgeImage('combat',313,676,164,77,()=>badge(313,676,164,77,['#4a4a4b','#29292b','#18181a']));
 if(badgeImages.swordSymbol)ctx.drawImage(badgeImages.swordSymbol,70,689,39,49);else sword(88,714);if(badgeImages.heartSymbol)ctx.drawImage(badgeImages.heartSymbol,681,687,55,51);else heart(710,714);
 drawFit(V('attack'),171,735,100,58,'white','center','Arial','bold');
 drawFit(V('hp'),618,735,108,58,'white','center','Arial','bold');
 drawFit(V('role'),395,727,137,32,'white','center',V('fontFamily'));
 // Text panel, curved borders and purple pill badges.
 rounded(29,766,733,285,24,'#f5f2f6','#131316',4);
 const sz=num('font'),lh=sz*num('line')/100, family=V('fontFamily');
 const labels=[['passive','Passive Fähigkeit:'],['active','Aktive Fähigkeit:'],['rage','Zorn-Effekt:']];
 const panelTop=794, panelBottom=961, space=8;
 function badgeWidth(label,fs){const k=label.startsWith('Passive')?'passive':label.startsWith('Aktive')?'active':'rage';const im=badgeImages[k];return im?.naturalWidth?Math.ceil((Math.max(23,fs+5))*im.naturalWidth/im.naturalHeight):Math.ceil(ctx.measureText(label).width)+22}
 function measureEffect(id,label,fs){
  ctx.font=`${V('style')} ${fs}px "${family}"`;
  let x=49+badgeWidth(label,fs)+10, lines=1;
  for(const word of V(id).trim().split(/\s+/)){
   const w=ctx.measureText(word+' ').width;
   if(x+w>739){x=55;lines++}
   x+=w;
  }
  return lines*fs*num('line')/100+12;
 }
 let fs=sz;
 while(fs>14&&labels.reduce((n,[id,label])=>n+measureEffect(id,label,fs)+space+8,0)>panelBottom-panelTop)fs--;
 let y=panelTop+fs;
 for(const [index,[id,label]] of labels.entries()){
  const bw=badgeWidth(label,fs),bh=Math.max(23,fs+5);
  drawBadgeImage(id,49,y-fs+1,bw,bh,()=>rounded(49,y-fs+1,bw,bh,Math.min(13,bh/2),gradient(y-fs,bh,'#b65fc4','#79348c','#4d1b66')));
  
  ctx.fillStyle='#1a171c';ctx.textAlign='left';ctx.font=`${V('style')} ${fs}px "${family}"`;
  let x=49+bw+10,cy=y;
  for(const word of V(id).trim().split(/\s+/)){
   const width=ctx.measureText(word+' ').width;
   if(x+width>739){x=55;cy+=fs*num('line')/100}
   if(cy<=panelBottom)ctx.fillText(word,x,cy);
   x+=width;
  }
  const sepY=cy+Math.max(7,fs*.48);
  if(index<2 && sepY<panelBottom-4){
   ctx.strokeStyle='#b9a4c2';ctx.lineWidth=1.5;
   ctx.beginPath();ctx.moveTo(55,sepY);ctx.lineTo(735,sepY);ctx.stroke();
  }
  y=sepY+fs*.85+space;
 }
 ctx.strokeStyle=V('frame');ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(55,981);ctx.lineTo(735,981);ctx.stroke();
 // Diamond ornament.
 polygon([[395,973],[405,983],[395,993],[385,983]],'#f5f2f6',V('frame'),3);
 drawFit(V('flavor'),395,1021,663,num('flavorFont'),'#17151a','center',V('fontFamily'));
}
for(const id of ids)$(id).addEventListener('input',render);function readImage(id,cb){$(id).onchange=()=>{let f=$(id).files[0];if(!f)return;let url=URL.createObjectURL(f),im=new Image();im.onload=()=>{cb(im);URL.revokeObjectURL(url);render()};im.src=url;let reader=new FileReader();reader.onload=()=>{if(id==='art')artData=reader.result;else iconData=reader.result};reader.readAsDataURL(f)}}readImage('art',im=>artwork=im);readImage('icon',im=>roleIcon=im);
async function selectRoleIcon(key){if(!key)return;const url='/role-icons/'+key+'.png';const response=await fetch(url);if(!response.ok)throw Error('Icon nicht geladen');const blob=await response.blob();const reader=new FileReader();reader.onload=async()=>{iconData=reader.result;roleIcon=await loadEmbedded(iconData);render()};reader.readAsDataURL(blob)}
$('presetRole').addEventListener('change',()=>selectRoleIcon($('presetRole').value).catch(e=>alert(e.message)));
document.querySelectorAll('#roleChoices button').forEach(btn=>btn.addEventListener('click',()=>{$('presetRole').value=btn.dataset.icon;selectRoleIcon(btn.dataset.icon).catch(e=>alert(e.message))}));

$('download').onclick=()=>{render();let out=document.createElement('canvas'),mm=$('bleed').checked?num('bleedMm'):0,b=Math.round(mm/25.4*300);out.width=C.width+2*b;out.height=C.height+2*b;let c=out.getContext('2d');c.fillStyle=frameTone();c.fillRect(0,0,out.width,out.height);c.drawImage(C,b,b);out.toBlob(blob=>{let url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=(V('name').replace(/[^\wäöüÄÖÜ-]+/g,'_')||'TCG_Karte')+'.png';a.click();setTimeout(()=>URL.revokeObjectURL(url),3000)},'image/png')};$('downloadPdf').onclick=()=>{render();const mm=$('bleed').checked?num('bleedMm'):0;const w=67+mm*2,h=92+mm*2;const src=C.toDataURL('image/png');const win=window.open('','_blank');if(!win){alert('Bitte Pop-ups für den PDF-Export erlauben.');return;}win.document.write(`<!doctype html><html><head><meta name=viewport content="width=device-width,initial-scale=1"><style>@page{size:${w}mm ${h}mm;margin:0}html,body{margin:0;padding:0;width:${w}mm;height:${h}mm}img{display:block;position:absolute;left:${mm}mm;top:${mm}mm;width:67mm;height:92mm}body{background:${V('frame')}}</style></head><body><img src="${src}"><script>const pic=document.querySelector('img');pic.onload=()=>setTimeout(()=>window.print(),350);if(pic.complete)pic.onload()<\/script></body></html>`);win.document.close()};
$('save').onclick=()=>{let obj={version:2,artData,iconData,settings:Object.fromEntries(ids.map(id=>[id,$(id).type==='checkbox'?$(id).checked:V(id)]))};let a=document.createElement('a'),url=URL.createObjectURL(new Blob([JSON.stringify(obj,null,2)],{type:'application/json'}));a.href=url;a.download='tcg-kartenprojekt.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)};$('load').onclick=()=>{let i=document.createElement('input');i.type='file';i.accept='.json';i.onchange=async()=>{try{let obj=JSON.parse(await i.files[0].text());for(const [id,val] of Object.entries(obj.settings||{}))if($(id)){$(id).type==='checkbox'?$(id).checked=!!val:$(id).value=val}if(obj.artData){artData=obj.artData;artwork=await loadEmbedded(obj.artData)}if(obj.iconData){iconData=obj.iconData;roleIcon=await loadEmbedded(obj.iconData)}render()}catch(e){alert('Projekt konnte nicht geladen werden: '+e.message)}};i.click()};render();

function loadEmbedded(src){return new Promise((resolve,reject)=>{const im=new Image();im.onload=()=>resolve(im);im.onerror=reject;im.src=src})}
$('toLibrary').onclick=async()=>{
 const button=$('toLibrary');button.disabled=true;
 try{
  render();const image=C.toDataURL('image/webp',0.88);
  const name=V('name').trim();if(!name)throw Error('Bitte einen Kartennamen eingeben');
  const attack=Number(V('attack')),hp=Number(V('hp'));
  if(!Number.isInteger(attack)||attack<0||attack>99||!Number.isInteger(hp)||hp<1||hp>99)throw Error('Ungültige Angriff-/Lebenswerte');
  const db=await new Promise((resolve,reject)=>{const r=indexedDB.open('tcg-card-library',2);r.onupgradeneeded=()=>{const d=r.result;if(!d.objectStoreNames.contains('cards'))d.createObjectStore('cards',{keyPath:'id',autoIncrement:true});if(!d.objectStoreNames.contains('decks'))d.createObjectStore('decks',{keyPath:'id'})};r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error)});
  await new Promise((resolve,reject)=>{const tx=db.transaction('cards','readwrite');tx.objectStore('cards').add({name,image,type:'hero',attack,hp});tx.oncomplete=resolve;tx.onerror=()=>reject(tx.error)});db.close();alert('Karte gespeichert! Sie erscheint jetzt im Deckbuilder.');
 }catch(err){alert('Speichern fehlgeschlagen: '+err.message+'\nTipp: Bei vollem Gerätespeicher PNG exportieren.')}finally{button.disabled=false}
};
