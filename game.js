const canvas = document.querySelector('#road');
const ctx = canvas.getContext('2d');
const cover = document.querySelector('#cover');
const startButton = document.querySelector('#start');
const title = document.querySelector('#cover-title');
const copy = document.querySelector('#cover-copy');
const hud = document.querySelector('#hud');
const distanceEl = document.querySelector('#distance');
const bestEl = document.querySelector('#best');
const distanceUnitEl = document.querySelector('#distance-unit');
const unitsToggle = document.querySelector('#units-toggle');
const unitChoice = document.querySelector('#unit-choice');
const touchControls = document.querySelector('.touch-controls');
const speedometer = document.querySelector('#speedometer');
const speedValueEl = document.querySelector('#speed-value');
const speedUnitEl = document.querySelector('#speed-unit');
const speedBar = document.querySelector('#speed-bar');
const honkButton = document.querySelector('#honk-button');
const cheatStatus = document.querySelector('#cheat-status');
const soundToggle = document.querySelector('#sound-toggle');
const soundPanel = document.querySelector('#sound-panel');
const musicSlider = document.querySelector('#music-volume');
const effectsSlider = document.querySelector('#effects-volume');
const musicValue = document.querySelector('#music-value');
const effectsValue = document.querySelector('#effects-value');
const fullscreenToggle = document.querySelector('#fullscreen-toggle');
const hornSound = new Audio('sfx/honk.wav');
hornSound.preload = 'auto';
const backgroundMusic = new Audio('uploads/Forward_Pulse.mp3');
backgroundMusic.loop = true;
backgroundMusic.preload = 'auto';
const savedMusicVolume=localStorage.getItem('freeway-music-volume');
const savedEffectsVolume=localStorage.getItem('freeway-effects-volume');
backgroundMusic.volume=savedMusicVolume===null ? 0.38 : Number(savedMusicVolume);
hornSound.volume=savedEffectsVolume===null ? 0.8 : Number(savedEffectsVolume);
musicSlider.value=backgroundMusic.volume;effectsSlider.value=hornSound.volume;
function updateVolumeLabels(){musicValue.textContent=Math.round(backgroundMusic.volume*100)+'%';effectsValue.textContent=Math.round(hornSound.volume*100)+'%';}
updateVolumeLabels();
function honk(){if(state!=='playing')return;hornSound.currentTime=0;hornSound.play().catch(()=>{});}

const sources = {
  road: 'uploads/Empty_Highway_from_Above.png',
  player: 'uploads/redsportscar.png',
  traffic: ['uploads/graysportscar.png','uploads/darkcar.png','uploads/lilghtgraycar.png','uploads/white_car.png']
};
const loadImage = src => new Promise(resolve => { const img=new Image(); img.onload=()=>resolve(img); img.onerror=()=>resolve(null); img.src=src; });
const images = {};
let ready = false;
const W = 576, H = 1024;
const laneFractions = [.238,.42,.58,.764];
let width=0,height=0,dpr=1, roadScale=1, roadX=0, roadY=0, roadH=0;
let state='ready', last=0, elapsed=0, spawnTimer=0, scroll=0, meters=0, best=Number(localStorage.getItem('freeway-best')||0);
let metric=localStorage.getItem('freeway-metric')!=='false';
let difficulty=['easy','normal','hard'].includes(localStorage.getItem('freeway-difficulty'))?localStorage.getItem('freeway-difficulty'):'normal';
const modeSettings={easy:{density:.65},normal:{density:1},hard:{density:1.6}};
let playerX=0, playerTurn=0, playerTurnDir=0, cars=[], explosions=[], crashTimer=0, shake=0, swipeX=null, vehicleSpeed=320;
const heldKeys=new Set();
const noclipCode='waaasssdddqfqfww';
let cheatBuffer='', noclip=false;
function formatDistance(value){
 if(metric){return value>=1000?{value:(value/1000).toFixed(1),unit:'km'}:{value:Math.floor(value),unit:'m'}}
 const feet=value*3.28084;
 return feet>=5280?{value:(value/1609.344).toFixed(1),unit:'mi'}:{value:Math.floor(feet),unit:'ft'};
}
function showBest(){bestEl.textContent=formatDistance(best).value+' '+formatDistance(best).unit}
function syncOptions(){
 document.querySelectorAll('[data-mode]').forEach(button=>{const selected=button.dataset.mode===difficulty;button.classList.toggle('selected',selected);button.setAttribute('aria-pressed',String(selected))});
 unitsToggle.setAttribute('aria-pressed',String(metric));unitChoice.firstChild.textContent=metric?'METRIC ':'IMPERIAL ';
 showBest();const d=formatDistance(meters);distanceEl.textContent=d.value;distanceUnitEl.textContent=d.unit;
}
syncOptions();

function resize(){
  dpr=Math.min(devicePixelRatio||1,2); width=innerWidth; height=innerHeight;
  canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);
  ctx.setTransform(dpr,0,0,dpr,0,0);
  roadScale=Math.min(width/W,650/W); roadH=H*roadScale; roadX=(width-W*roadScale)/2; roadY=0;
}
window.addEventListener('resize',resize);resize();

function lanes(){return laneFractions.map(f=>roadX+W*roadScale*f)}
function playerInLane(lane){
 const centers=lanes(), left=lane===0?roadX+W*roadScale*.19:(centers[lane-1]+centers[lane])/2, right=lane===centers.length-1?roadX+W*roadScale*.81:(centers[lane]+centers[lane+1])/2;
 const halfCar=carDims().w*.28;
 return playerX+halfCar>left&&playerX-halfCar<right;
}
function carDims(){return {w:W*roadScale*.105,h:W*roadScale*.205}}
function draw(){
  ctx.setTransform(dpr,0,0,dpr,0,0);
  ctx.fillStyle='#17211d';ctx.fillRect(0,0,width,height);
  if(images.road){
    // The supplied overhead highway is the entire playing field; loop it for endless road.
    const offset=((scroll*roadScale)%roadH);
    for(let y=offset-roadH;y<height+roadH;y+=roadH)ctx.drawImage(images.road,roadX,y,W*roadScale,roadH);
  }
  if(roadX>0){ctx.fillStyle='rgba(8,15,12,.28)';ctx.fillRect(0,0,roadX,height);ctx.fillRect(roadX+W*roadScale,0,roadX,height)}
  const {w,h}=carDims();
  for(const c of cars){const img=images.traffic[c.image],signaling=c.signaling||c.changing;if(img)drawCar(img,c.x,c.y,w,h,c.tilt||0,signaling?c.turnDir:0,signaling&&Math.floor(elapsed*4)%2===0)}
  const px=playerX;
  const playerAngle=playerTurnDir*Math.sin((1-playerTurn)*Math.PI)*.2;
  if(images.player&&state!=='crashing')drawCar(images.player,playerX,height*.77,w,h,playerAngle,playerTurnDir,playerTurn>0&&Math.floor(elapsed*4)%2===0);
  drawExplosions();
  if(shake>0){shake*=.86;if(shake<.3)shake=0}
}
function drawCar(img,x,y,w,h,angle=0,signalDir=0,signalOn=false){
 const drawW=h*(img.naturalWidth/img.naturalHeight);
 ctx.save();ctx.translate(x,y);ctx.rotate(angle);ctx.shadowColor='rgba(0,0,0,.48)';ctx.shadowBlur=11;ctx.shadowOffsetY=5;ctx.drawImage(img,-drawW/2,-h/2,drawW,h);
 if(signalDir&&signalOn){
   const side=signalDir<0?-1:1;ctx.fillStyle='#ffbf50';ctx.shadowColor='#ffb52c';ctx.shadowBlur=8;
   for(const yPos of [-h*.36,h*.36]){ctx.beginPath();ctx.ellipse(side*drawW*.39,yPos,Math.max(1.5,drawW*.035),Math.max(2,h*.022),0,0,Math.PI*2);ctx.fill()}
 }
 ctx.restore();
}
function startGame(){
 if(!ready)return;
 backgroundMusic.currentTime=0;
 backgroundMusic.play().catch(()=>{});
 state='playing';noclip=false;cheatStatus.classList.remove('active');cover.classList.add('hidden');hud.classList.add('visible');speedometer.classList.add('visible');touchControls.classList.add('active');
 elapsed=0;spawnTimer=.25;scroll=0;meters=0;cars=[];explosions=[];crashTimer=0;playerX=roadX+W*roadScale*.5;playerTurn=0;playerTurnDir=0;vehicleSpeed=320;last=performance.now();
}
function endGame(){state='over';backgroundMusic.pause();backgroundMusic.currentTime=0;touchControls.classList.remove('active');cover.classList.remove('hidden');title.textContent='WIPEOUT';const finalDistance=formatDistance(meters);copy.textContent=finalDistance.value+' '+finalDistance.unit+' covered';startButton.innerHTML='Run it back <span aria-hidden="true">↗</span>';if(!noclip){best=Math.max(best,Math.floor(meters));localStorage.setItem('freeway-best',best);showBest();}}
function steer(dir){if(state==='ready'||state==='over'){startGame();return}if(state!=='playing')return;const {w}=carDims();const edge=roadX+W*roadScale*.19+w*.55;playerX=Math.max(edge,Math.min(roadX+W*roadScale*.81-w*.55,playerX+dir*W*roadScale*.18));playerTurnDir=dir;playerTurn=1;}
function spawnCar(){
 const free=lanes().map((_,i)=>i).filter(i=>!cars.some(c=>Math.abs(c.x-lanes()[i])<28*roadScale&&c.y<height*.28));
 if(!free.length)return;
 const lane=free[Math.floor(Math.random()*free.length)], dims=carDims();
 const turnOptions=[lane-1,lane+1].filter(l=>l>=0&&l<4&&!cars.some(o=>o.lane===l&&Math.abs(o.y+dims.h)<dims.h*2.4));
 const target=turnOptions.length?turnOptions[Math.floor(Math.random()*turnOptions.length)]:lane;
 const willTurn=Math.random()<.05&&target!==lane;
 const signalAt=elapsed+.25+Math.random()*.35;
 cars.push({lane,x:lanes()[lane],y:height*.1,trafficMph:55+Math.random()*20,image:Math.floor(Math.random()*sources.traffic.length),willTurn,signalAt,turnAt:signalAt+.65,signaling:false,turnDuration:1.05,turnDir:willTurn?Math.sign(lanes()[target]-lanes()[lane]):0,changing:false,target,turning:0,tilt:0});
}
function update(dt){
 if(state!=='playing')return;
 elapsed+=dt;playerTurn=Math.max(0,playerTurn-dt/0.72);
 const steerDir=(heldKeys.has('right')?1:0)-(heldKeys.has('left')?1:0);
 if(steerDir){const {w}=carDims(),edge=roadX+W*roadScale*.19+w*.55;playerX=Math.max(edge,Math.min(roadX+W*roadScale*.81-w*.55,playerX+steerDir*W*roadScale*.72*dt));playerTurnDir=steerDir;playerTurn=1;}
 if(heldKeys.has('w'))vehicleSpeed=Math.min(700,vehicleSpeed+180*dt);
 else if(heldKeys.has('s'))vehicleSpeed=Math.max(-260,vehicleSpeed-230*dt);
 else if(heldKeys.has('q'))vehicleSpeed=vehicleSpeed>0?Math.max(0,vehicleSpeed-280*dt):Math.min(0,vehicleSpeed+280*dt);
 else if(vehicleSpeed>0)vehicleSpeed=Math.max(0,vehicleSpeed-25*dt);
 scroll+=vehicleSpeed*dt/roadScale;meters+=Math.max(0,vehicleSpeed)*dt*.075;
 const distance=formatDistance(meters);distanceEl.textContent=distance.value;distanceUnitEl.textContent=distance.unit;
 const speedRatio=Math.min(1,Math.abs(vehicleSpeed)/700);speedValueEl.textContent=Math.round(speedRatio*(metric?180:112));speedUnitEl.textContent=metric?'km/h':'mph';speedBar.style.width=(speedRatio*100)+'%';
 spawnTimer-=dt;if(spawnTimer<=0){spawnCar();spawnTimer=(.58+Math.random()*.22-Math.min(.08,meters/3000))/modeSettings[difficulty].density}
 const dims=carDims(), px=playerX, py=height*.77;
 for(let i=cars.length-1;i>=0;i--){
   const c=cars[i]; c.y+=(vehicleSpeed-700*c.trafficMph/112)*dt;
   if(!c.changing&&c.willTurn&&!c.signaling&&elapsed>=c.signalAt)c.signaling=true;
   if(c.signaling&&elapsed>=c.turnAt){
     const targetBlocked=cars.some(o=>o!==c&&(o.lane===c.target||(o.changing&&o.target===c.target))&&Math.abs(o.y-c.y)<dims.h*2.4);
     const waitingForPlayer=playerInLane(c.target)&&c.y<py+dims.h*1.1;
     if(targetBlocked||waitingForPlayer){
       // Keep signaling and retry; never cut into the player's lane before they've passed.
       c.turnAt=elapsed+.22;
     }else{
       c.signaling=false;c.willTurn=false;c.changing=true;c.turning=0;
     }
   }
   if(c.changing){
     c.turning=Math.min(1,c.turning+dt/c.turnDuration);
     const from=lanes()[c.lane],to=lanes()[c.target],ease=c.turning*c.turning*(3-2*c.turning);
     c.x=from+(to-from)*ease;c.tilt=c.turnDir*Math.sin(c.turning*Math.PI)*.16;
     if(c.turning>=1){c.lane=c.target;c.changing=false;c.tilt=0}
   }
   if(c.y>height+dims.h||c.y < -dims.h)cars.splice(i,1);
 }
 // Traffic that overlaps gets wrecked in a burst and disappears from the road.
 for(let i=0;i<cars.length;i++){
   let destroyed=false;
   for(let j=i+1;j<cars.length;j++){
     const a=cars[i],b=cars[j];
     if(Math.abs(a.x-b.x)<dims.w*.78&&Math.abs(a.y-b.y)<dims.h*.72){
       createExplosion((a.x+b.x)/2,(a.y+b.y)/2,.78);cars.splice(j,1);cars.splice(i,1);i--;destroyed=true;break;
     }
   }
   if(destroyed)continue;
 }
 const hitIndex=cars.findIndex(c=>Math.abs(c.x-px)<dims.w*.72&&Math.abs(c.y-py)<dims.h*.78);
 if(!noclip&&hitIndex>=0){
   const hit=cars.splice(hitIndex,1)[0];createExplosion(px,py,1.25);createExplosion(hit.x,hit.y,1);
   state='crashing';crashTimer=1.02;vehicleSpeed=0;heldKeys.clear();touchControls.classList.remove('active');
 }
}
function createExplosion(x,y,scale=1){
 const colors=['#fff8cf','#ffe66c','#ff9b37','#f34c3f','#a7332f'];
 const particles=Array.from({length:28},()=>{const a=Math.random()*Math.PI*2,s=(70+Math.random()*210)*scale;return{x:0,y:0,vx:Math.cos(a)*s,vy:Math.sin(a)*s,size:(1.5+Math.random()*4)*scale,color:colors[Math.floor(Math.random()*colors.length)]}});
 explosions.push({x,y,age:0,duration:.78*scale,scale,particles});
}
function updateExplosions(dt){
 for(let i=explosions.length-1;i>=0;i--){const e=explosions[i];e.age+=dt;for(const p of e.particles){p.x+=p.vx*dt;p.y+=p.vy*dt;p.vx*=.985;p.vy*=.985}if(e.age>=e.duration)explosions.splice(i,1)}
}
function drawExplosions(){
 for(const e of explosions){
   const t=e.age/e.duration,alpha=Math.max(0,1-t);ctx.save();ctx.translate(e.x,e.y);ctx.globalCompositeOperation='lighter';ctx.globalAlpha=alpha;
   ctx.strokeStyle='#ffb43d';ctx.lineWidth=Math.max(1,3*(1-t));ctx.beginPath();ctx.arc(0,0,(12+t*75)*e.scale,0,Math.PI*2);ctx.stroke();
   for(const p of e.particles){ctx.fillStyle=p.color;ctx.shadowColor=p.color;ctx.shadowBlur=10*alpha;ctx.beginPath();ctx.arc(p.x,p.y,p.size*(1-t*.5),0,Math.PI*2);ctx.fill()}
   const core=14*(1-t)*e.scale;if(core>0){ctx.fillStyle='#fff4b3';ctx.shadowColor='#ff7b30';ctx.shadowBlur=24*alpha;ctx.beginPath();ctx.arc(0,0,core,0,Math.PI*2);ctx.fill()}
   ctx.restore();
 }
}
function frame(now){
 const dt=Math.min((now-last)/1000||0,.04);last=now;
 if(state==='playing')update(dt);
 else if(state==='ready')scroll+=35*dt/roadScale;
 else if(state==='crashing'){crashTimer-=dt;if(crashTimer<=0)endGame()}
 updateExplosions(dt);draw();requestAnimationFrame(frame)
}

window.addEventListener('keydown',e=>{
 const key=e.key.toLowerCase();
 if(['arrowleft','arrowright','a','d','w','q','s','f',' ','enter'].includes(key))e.preventDefault();
 if(!e.repeat&&/^[a-z]$/.test(key)){
   cheatBuffer=(cheatBuffer+key).slice(-noclipCode.length);
   if(cheatBuffer===noclipCode){noclip=true;cheatStatus.classList.add('active');cheatBuffer='';}
 }
 if(key==='f'&&!e.repeat)honk();
 if(e.key==='ArrowLeft'||key==='a'){if(state==='ready'||state==='over')startGame();heldKeys.add('left')}
 if(e.key==='ArrowRight'||key==='d'){if(state==='ready'||state==='over')startGame();heldKeys.add('right')}
 if(['w','q','s'].includes(key)){
   heldKeys.add(key);
   if(state==='ready'||state==='over')startGame();
 }
 if((e.key===' '||e.key==='Enter')&&state!=='playing')startGame();
});
window.addEventListener('keyup',e=>{const key=e.key.toLowerCase();heldKeys.delete(key);if(e.key==='ArrowLeft'||key==='a')heldKeys.delete('left');if(e.key==='ArrowRight'||key==='d')heldKeys.delete('right')});
window.addEventListener('blur',()=>heldKeys.clear());
document.querySelectorAll('[data-mode]').forEach(button=>button.addEventListener('click',()=>{
 difficulty=button.dataset.mode;localStorage.setItem('freeway-difficulty',difficulty);syncOptions();
}));
unitsToggle.addEventListener('click',()=>{metric=!metric;localStorage.setItem('freeway-metric',String(metric));syncOptions()});
startButton.addEventListener('click',startGame);
honkButton.addEventListener('click',honk);
soundToggle.addEventListener('click',()=>{const opening=soundPanel.hidden;soundPanel.hidden=!opening;soundToggle.setAttribute('aria-expanded',String(opening))});
musicSlider.addEventListener('input',()=>{backgroundMusic.volume=Number(musicSlider.value);localStorage.setItem('freeway-music-volume',musicSlider.value);updateVolumeLabels()});
effectsSlider.addEventListener('input',()=>{hornSound.volume=Number(effectsSlider.value);localStorage.setItem('freeway-effects-volume',effectsSlider.value);updateVolumeLabels()});
fullscreenToggle.addEventListener('click',async()=>{try{if(document.fullscreenElement)await document.exitFullscreen();else await document.documentElement.requestFullscreen()}catch(error){console.warn('Fullscreen unavailable',error)}});
document.addEventListener('fullscreenchange',()=>{const active=!!document.fullscreenElement;fullscreenToggle.setAttribute('aria-label',active?'Exit fullscreen':'Enter fullscreen');fullscreenToggle.querySelector('span').textContent=active?'Exit fullscreen':'Fullscreen'});
document.querySelectorAll('[data-steer]').forEach(b=>{
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(state==='ready'||state==='over')startGame();heldKeys.add(Number(b.dataset.steer)<0?'left':'right');b.setPointerCapture(e.pointerId)});
 const release=()=>{heldKeys.delete(Number(b.dataset.steer)<0?'left':'right')};
 b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
});
document.querySelectorAll('[data-pedal]').forEach(b=>{
 const key=b.dataset.pedal;
 b.addEventListener('pointerdown',e=>{e.preventDefault();if(state==='ready'||state==='over')startGame();heldKeys.add(key);b.setPointerCapture(e.pointerId)});
 const release=()=>heldKeys.delete(key);
 b.addEventListener('pointerup',release);b.addEventListener('pointercancel',release);b.addEventListener('lostpointercapture',release);
});
canvas.addEventListener('pointerdown',e=>{swipeX=e.clientX});
canvas.addEventListener('pointerup',e=>{if(swipeX!==null&&Math.abs(e.clientX-swipeX)>24)steer(e.clientX>swipeX?1:-1);swipeX=null});

Promise.all([loadImage(sources.road),loadImage(sources.player),...sources.traffic.map(loadImage)]).then(([road,player,...traffic])=>{
 images.road=road;images.player=player;images.traffic=traffic;ready=!!road&&!!player;
 startButton.disabled=!ready;
 requestAnimationFrame(frame);
});
