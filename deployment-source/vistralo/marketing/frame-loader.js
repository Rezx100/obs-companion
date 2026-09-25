/** Bounded decoded-frame cache. Sources are build-validated same-origin assets. */
export class FrameLoader {
  constructor(config, width, limit = 10) {
    this.config = config; this.width = width; this.limit = limit;
    this.cache = new Map(); this.pending = new Map(); this.controller = new AbortController(); this.closed = false;
  }
  url(template,index) { return template.replace('{frame}',String(index).padStart(4,'0')); }
  async get(index) {
    if (this.closed) return null;
    if (this.cache.has(index)) { const frame=this.cache.get(index); this.cache.delete(index); this.cache.set(index,frame); return frame; }
    if (this.pending.has(index)) return this.pending.get(index);
    const task=this.decode(index).then(frame=>{
      if(this.closed){frame?.close?.();return null;}
      if(frame){this.cache.set(index,frame);while(this.cache.size>this.limit){const key=[...this.cache.keys()].find(key=>key!==this.retainIndex);if(key===undefined)break;this.cache.get(key)?.close?.();this.cache.delete(key);}}
      return frame;
    }).finally(()=>this.pending.delete(index));
    this.pending.set(index,task);return task;
  }
  async decode(index) {
    for(const template of [this.config.template,this.config.fallback]) {
      if(!template)continue;
      try{
        const response=await fetch(this.url(template,index),{signal:this.controller.signal,credentials:'same-origin'});
        if(!response.ok)continue;
        const blob=await response.blob();
        if(typeof createImageBitmap==='function')return await createImageBitmap(blob,{resizeWidth:this.width,resizeQuality:'high'});
        const objectUrl=URL.createObjectURL(blob);
        try{const image=new Image();image.src=objectUrl;await image.decode();return image;}finally{URL.revokeObjectURL(objectUrl);}
      }catch(error){if(error.name==='AbortError')return null;}
    }
    return null;
  }
  async warm(indices) { // Sequential to keep mobile decode and memory pressure bounded.
    for(const i of indices){if(this.closed)return;await this.get(i);}
  }
  close() {this.closed=true;this.controller.abort();for(const frame of this.cache.values())frame.close?.();this.cache.clear();}
}
export function sceneAt(scenes,progress) {
  const total=scenes.reduce((sum,s)=>sum+s.scrollVh,0),position=Math.min(1,Math.max(0,progress))*total;
  let start=0;
  for(let i=0;i<scenes.length;i++){const s=scenes[i];if(position<=start+s.scrollVh||i===scenes.length-1)return {scene:s,index:i,progress:Math.min(1,Math.max(0,(position-start)/s.scrollVh))};start+=s.scrollVh;}
}
export function thresholdIndex(items,progress,current=-1,hysteresis=.03) {
  let next=-1;
  for(let i=0;i<items.length;i++)if(progress>=items[i].start)next=i;
  if(current>=0&&next!==current){const edge=next>current?items[next].start:items[current].start;if(Math.abs(progress-edge)<hysteresis)return current;}
  return next;
}
