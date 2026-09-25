const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('vistralo',{call:async(method,args={})=>{const result=await ipcRenderer.invoke('vistralo',{method,args});if(!result.ok)throw new Error(result.error);return result.value;}});
