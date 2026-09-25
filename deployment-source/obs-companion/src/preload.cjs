const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('companion',{call:async(method,args={})=>{const result=await ipcRenderer.invoke('companion',{method,args});if(!result.ok)throw new Error(result.error);return result.value;}});
