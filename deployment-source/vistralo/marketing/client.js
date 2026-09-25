import {gsap} from 'gsap';
import {ScrollTrigger} from 'gsap/ScrollTrigger';
import {FrameLoader,sceneAt,thresholdIndex} from './frame-loader.js';
const $=(s,root=document)=>root.querySelector(s), $$=(s,root=document)=>Array.from(root.querySelectorAll(s));
const reduce=matchMedia('(prefers-reduced-motion: reduce)'), mobile=matchMedia('(max-width: 600px)');
let config=null;
const configReady=fetch('/story.json',{signal:AbortSignal.timeout(8000)}).then(r=>{if(!r.ok)throw Error('Story unavailable');return r.json();}).then(value=>(config=value)).catch(()=>null);
const seen=new Set();
function track(name,data={},once=false) {
  const key=name+JSON.stringify(data);if(once&&seen.has(key))return;seen.add(key);
  // No identifiers, cookies or storage. Collector must be explicitly configured.
  const event={name,...data};document.dispatchEvent(new CustomEvent('vistralo:analytics',{detail:event}));
  const endpoint=config?.analytics?.endpoint;
  if(!endpoint||navigator.doNotTrack==='1'||navigator.globalPrivacyControl)return;
  try{const url=new URL(endpoint,location.origin);if(url.origin!==location.origin)return;
    const body=new Blob([JSON.stringify(event)],{type:'application/json'});
    if(!navigator.sendBeacon(url.pathname,body))fetch(url.pathname,{method:'POST',body,keepalive:true,credentials:'omit'}).catch(()=>{});
  }catch{/* Analytics never interrupts navigation. */}
}
new IntersectionObserver(([entry])=>$('.nav').classList.toggle('scrolled',!entry.isIntersecting),{threshold:0}).observe($('#nav-sentinel'));
$$('[data-cta]').forEach(a=>a.addEventListener('click',()=>track('cta_clicked',{location:a.dataset.cta})));
const pricing=$('#pricing');if(pricing)new IntersectionObserver((entries,observer)=>{if(entries.some(x=>x.isIntersecting)){track('pricing_viewed',{},true);observer.disconnect();}},{threshold:.2}).observe(pricing);
$$('.faq details').forEach(item=>item.addEventListener('toggle',()=>{if(item.open){$$('.faq details').forEach(other=>{if(other!==item)other.open=false;});track('faq_opened',{question:Number(item.dataset.question)});}}));
$$('a[href^="#"]').forEach(a=>a.addEventListener('click',e=>{const target=$(a.getAttribute('href'));if(!target)return;e.preventDefault();target.scrollIntoView({behavior:reduce.matches?'instant':'smooth',block:'start'});if(a.classList.contains('story-skip')){track('story_skipped',{scene:$('.story')?.dataset.scene||'capture'});target.focus({preventScroll:true});}else if(target.id==='main')target.focus({preventScroll:true});}));
const comparisons=$$('[data-compare]');
function setCompare(el,value){const position=Math.min(100,Math.max(0,value)),images=$('.compare-images',el);el.style.setProperty('--compare-position',position+'%');el.style.setProperty('--compare-px',(images.clientWidth*position/100)+'px');$('input',el).value=String(position);$('input',el).setAttribute('aria-valuetext',`${Math.round(position)}% original recording`);}
comparisons.forEach(el=>{
 const input=$('input',el);el.classList.add('is-interactive');setCompare(el,50);
 input.addEventListener('input',()=>{el.dataset.manual='true';setCompare(el,Number(input.value));track('compare_dragged',{},true);});
 const images=$('.compare-images',el);let active=false;
 function pointer(event){if(!active)return;const box=images.getBoundingClientRect();el.dataset.manual='true';setCompare(el,(event.clientX-box.left)/box.width*100);track('compare_dragged',{},true);}
 images.addEventListener('pointerdown',event=>{active=true;images.setPointerCapture(event.pointerId);pointer(event);});images.addEventListener('pointermove',pointer);images.addEventListener('pointerup',()=>active=false);images.addEventListener('pointercancel',()=>active=false);
 new ResizeObserver(()=>setCompare(el,Number(input.value))).observe(images);
});
// Native dialog supplies modal focus isolation, Escape handling and return focus.
const dialog=$('#narration'),fallback=$('.narration-fallback'),video=$('video',fallback||document);
if(dialog&&video){let trigger=null;const home=video.parentElement,slot=$('.video-slot',dialog);
 $$('.listen').forEach(button=>button.addEventListener('click',()=>{trigger=button;slot.append(video);dialog.showModal();$('.close-dialog',dialog).focus();for(const t of video.textTracks)t.mode='showing';}));
 $('.close-dialog',dialog).addEventListener('click',()=>dialog.close());
 dialog.addEventListener('close',()=>{video.pause();home.insertBefore(video,home.querySelector('p'));trigger?.focus();});
 video.addEventListener('play',()=>track('narration_played',{},true));video.addEventListener('error',()=>$('.video-error',dialog).hidden=false);
}
await configReady;
const root=$('.story');
if(root&&config){
 const scenes=config.scenes.filter(s=>s.enabled);gsap.registerPlugin(ScrollTrigger);
 const media=gsap.matchMedia();
 media.add({motion:'(prefers-reduced-motion: no-preference)',small:'(max-width: 600px)',large:'(min-width: 601px)'},context=>{
  if(!context.conditions.motion||!scenes.length)return;
  const isMobile=context.conditions.small,stage=$('#stage'),canvas=$('canvas',stage),ctx=canvas.getContext('2d'),poster=$('.stage-poster',stage);
  if(!ctx)return;
  let disposed=false,loader=null,tween=null,frameRequest=0,lastFrame=-1,desiredFrame=-1,activeScene=-1,activeCaption=-1,judgmentManual=false;const calloutState=new Set(),opening=$('.story-opening',root),slot=$('.hero-stage-slot',root),flip={x:0,y:0,sx:1,sy:1};
  const total=scenes.reduce((sum,s)=>sum+s.scrollVh,0),state={progress:0};
  const headings=$('.story-heading'),captions=$('.captions'),skip=$('.story-skip'),overlay=$('.callouts',stage),compare=$('.stage-compare'),judgment=$('.judgment-wipe');
  const frameConfig=isMobile?config.frames.mobile:config.frames.desktop;overlay.setAttribute('viewBox',`0 0 ${frameConfig.width} ${frameConfig.height}`);
  const width=Math.min(frameConfig.width,Math.round(Math.max(240,Math.min(root.clientWidth,(innerHeight-310)*(isMobile?.5625:1.6)))*Math.min(devicePixelRatio,1.5)));
  canvas.width=width;canvas.height=Math.round(width*frameConfig.height/frameConfig.width);loader=new FrameLoader(frameConfig,width,10);
  function draw(index){loader.retainIndex=index;desiredFrame=index;if(index===lastFrame)return;const version=++frameRequest;
   loader.get(index).then(frame=>{if(disposed||version!==frameRequest||!frame)return;requestAnimationFrame(()=>{if(disposed||index!==desiredFrame)return;ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(frame,0,0,canvas.width,canvas.height);lastFrame=index;poster.hidden=true;});});
  }
  function callouts(scene,p){
   overlay.replaceChildren();const visible=scene.callouts.filter((c,i)=>{const key=scene.id+i,was=calloutState.has(key),start=c.start+(was?-.03:.03),end=(c.end??1)+(was?.03:-.03),active=p>=start&&p<end;if(active)calloutState.add(key);else calloutState.delete(key);return active&&(!isMobile||c.mobile);});
   for(const c of (isMobile?visible.slice(0,1):visible)){
    const ns='http://www.w3.org/2000/svg',group=document.createElementNS(ns,'g'),rect=document.createElementNS(ns,'rect'),text=document.createElementNS(ns,'text'),plate=document.createElementNS(ns,'rect');
    const geometry=isMobile?c.mobile:c;const x=geometry.x??40,y=geometry.y??80,w=geometry.width??280,h=geometry.height??100,progress=Math.min(1,(p-c.start)/.06),length=2*(w+h);
    for(const [k,v]of Object.entries({x,y,width:w,height:h,rx:4,'stroke-dasharray':length,'stroke-dashoffset':length*(1-progress)}))rect.setAttribute(k,String(v));
    for(const [k,v]of Object.entries({x,y:y+h+12,width:Math.min(580,c.label.length*11+24),height:40,rx:4,class:'label-plate'}))plate.setAttribute(k,String(v));
    text.setAttribute('x',String(x+12));text.setAttribute('y',String(y+h+39));text.textContent=c.label;
    if(isMobile){const fontSize=Math.round(16*frameConfig.width/Math.max(stage.clientWidth,200));text.style.fontSize=fontSize+'px';}
    const opacity=String(Math.max(0,Math.min(1,(p-c.start-.06)/.03)));text.style.opacity=opacity;plate.style.opacity=opacity;group.append(rect,plate,text);overlay.append(group);
   }
  }
  function render(){
   const {scene,index,progress:p}=sceneAt(scenes,state.progress);
   if(opening){const heroP=index===0?p:1,t=scene.id==='capture'?Math.max(0,Math.min(1,(heroP-.35)/.65)):Math.min(1,heroP/.35),opacity=scene.id==='capture'?1-Math.max(0,Math.min(1,(heroP-.6)/.3)):1-Math.min(1,heroP/.3);gsap.set(stage,{x:flip.x*(1-t),y:flip.y*(1-t),scaleX:flip.sx+(1-flip.sx)*t,scaleY:flip.sy+(1-flip.sy)*t,transformOrigin:'0 0'});opening.style.opacity=String(opacity);opening.inert=opacity===0;headings.style.opacity=String(1-opacity);$('.caption-strip',root).style.opacity=String(1-opacity);}

   if(index!==activeScene){activeScene=index;activeCaption=-1;judgmentManual=false;root.dataset.scene=scene.id;poster.hidden=false;const posterImage=$('img',poster),posterSource=$('source',poster);posterImage.src=scene.desktopPoster;posterSource.srcset=scene.mobilePoster;
    $('.scene-number',headings).textContent=`${String(index+1).padStart(2,'0')} / ${String(scenes.length).padStart(2,'0')}`;$('h2',headings).textContent=scene.title;$('.scene-support',headings).textContent=scene.support;
    calloutState.clear();canvas.setAttribute('aria-label',`Scene ${index+1} of ${scenes.length}: ${scene.title}`);captions.replaceChildren(...scene.captions.map(c=>{const line=document.createElement('p');line.textContent=c.text;line.hidden=true;return line;}));
    comparisons.forEach(el=>delete el.dataset.manual);if(root.getBoundingClientRect().top<innerHeight&&root.getBoundingClientRect().bottom>56)track('story_scene_reached',{scene:scene.id},true);
   }
   let next=thresholdIndex(scene.captions,p,activeCaption);if(next>=0&&scene.captions[next].end!=null&&p>scene.captions[next].end+.03)next=-1;
   if(next!==activeCaption){activeCaption=next;$$('p',captions).forEach((line,i)=>{line.hidden=i!==next;});if(next>=0)$('p:not([hidden])',captions)?.animate([{opacity:0,transform:'translateY(6px)'},{opacity:1,transform:'translateY(0)'}],{duration:200,easing:'cubic-bezier(0.2,0,0,1)'});}
   const frameProgress=scene.id==='build'?Math.min(1,p*2):scene.id==='capture'?Math.min(1,p/.55):p;
   draw(Math.round(scene.range[0]+(scene.range[1]-scene.range[0])*frameProgress));
   const activeLine=scene.captions[next];$('.timecode').textContent=activeLine?.timecode||'';
   callouts(scene,p);$('.story-progress span').style.transform=`scaleX(${state.progress})`;
   const comparing=scene.id==='build'&&p>=.5&&!!$('[data-compare]',compare);compare.hidden=!comparing;
   if(comparing){const el=$('[data-compare]',compare);if(el&&!el.dataset.manual)setCompare(el,15+70*((p-.5)*2));}
   judgment.hidden=scene.id!=='judgment';if(scene.id==='judgment'){if(!isMobile&&!judgmentManual)judgment.style.setProperty('--wipe',p*100+'%');$('.specific-caption',judgment).textContent=scene.captions[0]?.text||'';}
  }
  const handlers=[];$$('[data-judgment]',judgment).forEach(btn=>{const handler=()=>{judgmentManual=true;judgment.style.setProperty('--wipe',Number(btn.dataset.judgment)*100+'%');$$('[data-judgment]',judgment).forEach(b=>b.setAttribute('aria-pressed',String(b===btn)));};btn.addEventListener('click',handler);handlers.push([btn,handler]);});
  loader.get(scenes[0].range[0]).then(frame=>{
   if(disposed||!frame){loader.close();return;}
   root.classList.add('is-enhanced');
   const measure=()=>{gsap.set(stage,{clearProps:'transform'});const a=stage.getBoundingClientRect(),b=slot.getBoundingClientRect();flip.x=b.left-a.left;flip.y=b.top-a.top;flip.sx=b.width/a.width;flip.sy=b.height/a.height;render();};measure();
   tween=gsap.to(state,{progress:1,ease:'none',onUpdate:render,scrollTrigger:{trigger:root,pin:$('.story-pin',root),start:'top 56px',end:()=>'+='+Math.round(innerHeight*total/100*(isMobile?.5:1)),scrub:.6,invalidateOnRefresh:true,onRefresh:measure,onToggle:self=>skip.hidden=!self.isActive}});
   // Warm compressed network cache near the start; decoded cache remains bounded.
   const warm=()=>loader.warm(Array.from({length:Math.min(24,config.frames.count)},(_,i)=>i));
   if('requestIdleCallback'in window)requestIdleCallback(warm,{timeout:1200});else setTimeout(warm,200);
  });
  return()=>{disposed=true;tween?.scrollTrigger?.kill();tween?.kill();loader?.close();root.classList.remove('is-enhanced');gsap.set(stage,{clearProps:'transform'});if(opening){opening.style.opacity='';opening.inert=false;}headings.style.opacity='';$('.caption-strip',root).style.opacity='';poster.hidden=false;skip.hidden=true;handlers.forEach(([el,fn])=>el.removeEventListener('click',fn));};
 });
}
