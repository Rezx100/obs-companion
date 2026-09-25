Unicode true
!include "MUI2.nsh"
!include "x64.nsh"
!include "FileFunc.nsh"
Name "Vistralo"
OutFile "..\dist\Vistralo-${APP_VERSION}-Setup.exe"
InstallDir "$LOCALAPPDATA\Programs\Vistralo"
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
 ReadRegStr $0 HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "UninstallString"
 ${If} $0 != ""
  StrCpy $0 $0 -1 1
  ${GetParent} $0 $1
  IfFileExists "$1\OBS Companion.exe" 0 +2
  StrCpy $INSTDIR $1
 ${EndIf}
 ${IfNot} ${RunningX64}
  MessageBox MB_ICONSTOP "Vistralo requires 64-bit Windows 10 or later."
  Abort
 ${EndIf}
FunctionEnd
Section "Vistralo" SecMain
 SetOutPath "$INSTDIR"
 File /r "..\dist\win-unpacked\*"
 Delete "$INSTDIR\OBS Companion.exe"
 Delete "$DESKTOP\OBS Companion.lnk"
 Delete "$SMPROGRAMS\OBS Companion\OBS Companion.lnk"
 RMDir "$SMPROGRAMS\OBS Companion"
 WriteUninstaller "$INSTDIR\Uninstall.exe"
 CreateDirectory "$SMPROGRAMS\Vistralo"
 CreateShortcut "$SMPROGRAMS\Vistralo\Vistralo.lnk" "$INSTDIR\Vistralo.exe"
 CreateShortcut "$DESKTOP\Vistralo.lnk" "$INSTDIR\Vistralo.exe"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "DisplayName" "Vistralo"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "InstallLocation" "$INSTDIR"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "UninstallString" '"$INSTDIR\Uninstall.exe"'
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "DisplayVersion" "${APP_VERSION}"
 WriteRegStr HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "Publisher" "Dynamix LTD"
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "NoModify" 1
 WriteRegDWORD HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion" "NoRepair" 1
SectionEnd
Section "Uninstall"
 Delete "$DESKTOP\Vistralo.lnk"
 Delete "$DESKTOP\OBS Companion.lnk"
 Delete "$SMPROGRAMS\Vistralo\Vistralo.lnk"
 Delete "$SMPROGRAMS\OBS Companion\OBS Companion.lnk"
 RMDir "$SMPROGRAMS\OBS Companion"
 RMDir "$SMPROGRAMS\Vistralo"
 DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\OBSCompanion"
 !include "uninstall-files.nsh"
 Delete "$INSTDIR\Uninstall.exe"
 RMDir "$INSTDIR"
 ; User projects and protected credentials are intentionally retained.
SectionEnd
