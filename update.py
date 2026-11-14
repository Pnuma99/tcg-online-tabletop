from pathlib import Path
from PIL import Image,ImageDraw,ImageFont
import numpy as np,cv2,re
root=Path('/mnt/data/tcg_next');p=root/'public/editor.html';s=p.read_text();assets=root/'public/editor-assets'
ref=np.array(Image.open('/mnt/data/5EBB116A-523C-498D-8224-A85DD4D57C14(2).jpeg').convert('RGB'))
# Extract the original sword and heart from the provided reference using color/foreground segmentation.
for name,box in [('sword',(78,840,145,907)),('heart',(946,843,1019,904))]:
 x1,y1,x2,y2=box;rgb=ref[y1:y2,x1:x2].copy();h,w=rgb.shape[:2];hsv=cv2.cvtColor(rgb,cv2.COLOR_RGB2HSV)
 if name=='sword':
  bg=((rgb[:,:,0]>rgb[:,:,1]*1.30)&(rgb[:,:,0]>rgb[:,:,2]*1.28))
 else: bg=((rgb[:,:,1]>rgb[:,:,0]*1.15)&(rgb[:,:,1]>rgb[:,:,2]*1.12))
 white=(rgb.min(axis=2)>145)&(rgb.max(axis=2)-rgb.min(axis=2)<100)&(~bg)
 # black outlines and white interiors, constrained to central part; grabcut refines edge
 mask=np.full((h,w),cv2.GC_PR_BGD,np.uint8)
 mask[white]=cv2.GC_FGD
 mask[bg]=cv2.GC_BGD
 # any dark pixel near white symbol is probable foreground
 near=cv2.dilate(white.astype(np.uint8),np.ones((9,9),np.uint8),iterations=1).astype(bool)
 dark=(rgb.max(axis=2)<115)
 mask[near&dark]=cv2.GC_PR_FGD
 mask[0,:]=mask[-1,:]=mask[:,0]=mask[:,-1]=cv2.GC_BGD
 bmodel=np.zeros((1,65),np.float64);fmodel=np.zeros((1,65),np.float64)
 try:cv2.grabCut(cv2.cvtColor(rgb,cv2.COLOR_RGB2BGR),mask,None,bmodel,fmodel,6,cv2.GC_INIT_WITH_MASK)
 except cv2.error:pass
 alpha=np.where((mask==cv2.GC_FGD)|(mask==cv2.GC_PR_FGD),255,0).astype('uint8')
 n,lab,stats,cent=cv2.connectedComponentsWithStats(alpha)
 if n>1:
  best=1+np.argmax(stats[1:,cv2.CC_STAT_AREA]);alpha=np.where(lab==best,alpha,0).astype('uint8')
 alpha=cv2.GaussianBlur(alpha,(3,3),.55)
 ys,xs=np.where(alpha>20)
 if len(xs):
  pad=2; xx1=max(0,xs.min()-pad);xx2=min(w,xs.max()+pad+1);yy1=max(0,ys.min()-pad);yy2=min(h,ys.max()+pad+1)
  out=Image.fromarray(np.dstack((rgb,alpha)),'RGBA').crop((xx1,yy1,xx2,yy2))
  out.resize((out.width*4,out.height*4),Image.Resampling.LANCZOS).save(assets/(name+'-symbol.png'))
# Pre-render permanent labels inside the purple badge image assets.
fontfile='/usr/share/fonts/truetype/dejavu/DejaVuSans-Oblique.ttf'
for key,label in [('passive','Passive Fähigkeit:'),('active','Aktive Fähigkeit:'),('rage','Zorn-Effekt:')]:
 font=ImageFont.truetype(fontfile,48)
 bbox=font.getbbox(label);w=int(font.getlength(label))+60;h=82
 img=Image.new('RGBA',(w,h));pix=img.load()
 colors=[(187,91,200),(113,34,148),(60,12,88)]
 for y in range(h):
  t=y/(h-1)*2;i=min(1,int(t));u=t-i
  color=tuple(round(colors[i][k]*(1-u)+colors[i+1][k]*u) for k in range(3))
  for x in range(w):pix[x,y]=(*color,255)
 mask=Image.new('L',(w,h));d=ImageDraw.Draw(mask);d.rounded_rectangle((1,1,w-2,h-2),radius=37,fill=255)
 img.putalpha(mask);d=ImageDraw.Draw(img)
 d.text(((w-font.getlength(label))/2,(h-(bbox[3]-bbox[1]))/2-bbox[1]),label,font=font,fill='white',stroke_width=0)
 img.save(assets/(key+'.png'))
# Dynamic width matches the image's aspect ratio, no duplicate text painted by canvas.
s=s.replace('<option value="heiler">Heiler – Kreuz</option>','<option value="heiler">Supporter – Kreuz</option>')
s=s.replace('title="Heiler"','title="Supporter"')
s=s.replace('function badgeWidth(label,fs){ctx.font=`italic ${fs*.76}px "${family}"`;return Math.ceil(ctx.measureText(label).width)+22}',"function badgeWidth(label,fs){const k=label.startsWith('Passive')?'passive':label.startsWith('Aktive')?'active':'rage';const im=badgeImages[k];return im?.naturalWidth?Math.ceil((Math.max(23,fs+5))*im.naturalWidth/im.naturalHeight):Math.ceil(ctx.measureText(label).width)+22}")
s=s.replace("drawFit(label,59,y+1,bw-18,fs*.76,'white','left',family,'italic');",'')
s=s.replace('sword(88,714);heart(710,714);',"if(badgeImages.swordSymbol)ctx.drawImage(badgeImages.swordSymbol,70,689,39,49);else sword(88,714);if(badgeImages.heartSymbol)ctx.drawImage(badgeImages.heartSymbol,681,687,55,51);else heart(710,714);")
s=s.replace("for(const key of ['attack','hp','combat','passive','active','rage']){","for(const key of ['attack','hp','combat','passive','active','rage','swordSymbol','heartSymbol']){")
s=s.replace("img.src='/editor-assets/'+key+'.png';","img.src='/editor-assets/'+({'swordSymbol':'sword-symbol','heartSymbol':'heart-symbol'}[key]||key)+'.png';")
p.write_text(s)
server=root/'server.js';t=server.read_text()
t=t.replace("'rage'].map(x=>'editor-assets/'+x+'.png')","'rage','sword-symbol','heart-symbol'].map(x=>'editor-assets/'+x+'.png')")
server.write_text(t)
print('done')
