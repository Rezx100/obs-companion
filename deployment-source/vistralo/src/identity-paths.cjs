'use strict';
const fs=require('node:fs'),path=require('node:path');
function selectRoots({appData,documents,override,env=process.env}){
 const oldUser=path.join(appData,'OBS Companion'),newUser=path.join(appData,'Vistralo');
 const oldProjects=path.join(documents,'OBS Companion'),newProjects=path.join(documents,'Vistralo');
 const populated=(dir,names)=>names.some(n=>fs.existsSync(path.join(dir,n)));
 const oldSettings=populated(oldUser,['settings.json','credentials.bin']);
 const newSettings=populated(newUser,['settings.json','credentials.bin']);
 const oldLibrary=populated(oldProjects,['projects.sqlite','projects.sqlite-wal']);
 const newLibrary=populated(newProjects,['projects.sqlite','projects.sqlite-wal']);
 if(oldSettings&&newSettings)throw Error('Both legacy and Vistralo settings exist; choose a root after resolving the conflict');
 if(!override&&oldLibrary&&newLibrary)throw Error('Both legacy and Vistralo project libraries exist; choose VISTRALO_TEST_ROOT after resolving the conflict');
 return {userData:oldSettings?oldUser:newUser,projects:override||(oldLibrary?oldProjects:newProjects)};
}
module.exports={selectRoots};
