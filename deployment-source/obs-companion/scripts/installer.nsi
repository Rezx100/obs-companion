Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
Name "OBS Companion"
OutFile "..\dist\OBS-Companion-0.1.0-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\OBS Companion"
RequestExecutionLevel user
SetCompressor /SOLID zlib
!define MUI_ABORTWARNING
!define MUI_ICON "..\resources\icon.ico"
!insertmacro MUI_PAGE_WELCOME
!insertmacro MUI_PAGE_LICENSE "..\LICENSE"
!insertmacro MUI_PAGE_DIRECTORY
!insertmacro MUI_PAGE_INSTFILES
!insertmacro MUI_PAGE_FINISH
!insertmacro MUI_UNPAGE_CONFIRM
!insertmacro MUI_UNPAGE_INSTFILES
!insertmacro MUI_LANGUAGE "English"
Function .onInit
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "OBS Companion requires 64-bit Windows 10 or later."
  Abort
 ${EndIf}
FunctionEnd
Section "OBS Companion" SecMain
 SetOutPath "$INSTDIR"
 File /r "..\dist\win-unpacked\*"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\OBS Companion"
 CreateShortcut "$SMPROGRAMS\OBS Companion\OBS Companion.lnk" "$INSTDIR\OBS Companion.exe"
 CreateShortcut "$DESKTOP\OBS Companion.lnk" "$INSTDIR\OBS Companion.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "DisplayName" "OBS Companion"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "DisplayVersion" "0.1.0"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "Publisher" "OBS Companion contributors"
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "NoRepair" 1
SectionEnd
Section "Uninstall"
 Delete "$DESKTOP\OBS Companion.lnk"
 Delete "$SMPROGRAMS\OBS Companion\OBS Companion.lnk"
 RMDir "$SMPROGRAMS\OBS Companion"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion"
 !include "uninstall-files.nsh"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 ; User projects and protected credentials are intentionally retained.
SectionEnd
