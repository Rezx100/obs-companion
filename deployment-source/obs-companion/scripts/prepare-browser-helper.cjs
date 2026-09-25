const{execFileSync}=require('node:child_process');
execFileSync(process.execPath,[require.resolve('playwright/cli'),'install','ffmpeg'],{stdio:'inherit',env:{...process.env,PLAYWRIGHT_HOST_PLATFORM_OVERRIDE:'win64',PLAYWRIGHT_BROWSERS_PATH:require('path').resolve('resources/browsers')}});
