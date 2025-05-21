!include "LogicLib.nsh"

!macro customInstall
    Var /GLOBAL SourceTaggerDir
    Var /GLOBAL TargetTaggerDir

    StrCpy $SourceTaggerDir "$INSTDIR\resources\tagger"
    StrCpy $TargetTaggerDir "$APPDATA\${APP_PACKAGE_NAME}\tagger"

    DetailPrint "Checking for existing tagger directory: $TargetTaggerDir"
    ${If} ${FileExists} "$TargetTaggerDir"
      DetailPrint "Tagger directory $TargetTaggerDir already exists. Skipping file copy."
    ${Else}
      DetailPrint "Copying tagger files..."
      CreateDirectory "$TargetTaggerDir"
      CopyFiles /SILENT "$SourceTaggerDir\*.*" "$TargetTaggerDir"
    ${EndIf}

    Var /GLOBAL SourceDataDir
    Var /GLOBAL TargetDataDir

    StrCpy $SourceDataDir "$INSTDIR\resources\Data"
    StrCpy $TargetDataDir "$APPDATA\${APP_PACKAGE_NAME}\Data"

    DetailPrint "Checking for existing Data directory: $TargetDataDir"
    ${If} ${FileExists} "$TargetDataDir"
      DetailPrint "Data directory $TargetDataDir already exists. Skipping file copy."
    ${Else}
      DetailPrint "Copying data files..."
      CreateDirectory "$TargetDataDir"
      CopyFiles /SILENT "$SourceDataDir\*.*" "$TargetDataDir"
    ${EndIf}

    DetailPrint "Removing directory $SourceTaggerDir..."
    RMDir /r /REBOOTOK "$SourceTaggerDir"

    DetailPrint "Removing directory $SourceDataDir..."
    RMDir /r /REBOOTOK "$SourceDataDir"

    StrCpy $SourceTaggerDir ""
    StrCpy $TargetTaggerDir ""
    StrCpy $SourceDataDir ""
    StrCpy $TargetDataDir ""
!macroend

!macro customUnInstall
  MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove all application data from your user profile (e.g., settings, tagger)?$\nChoosing 'No' will keep your data for a future installation." IDYES RemoveAppData
  DetailPrint "User chose not to remove application data."
  Goto UninstallDone

RemoveAppData:
  DetailPrint "User chose to remove application data."

  Var /GLOBAL TargetTaggerDir
  Var /GLOBAL TargetDataDir

  StrCpy $TargetTaggerDir "$APPDATA\${APP_PACKAGE_NAME}\tagger"
  StrCpy $TargetDataDir "$APPDATA\${APP_PACKAGE_NAME}\Data"

  DetailPrint "Removing directory $TargetTaggerDir..."
  RMDir /r /REBOOTOK "$TargetTaggerDir"

  DetailPrint "Removing directory $TargetDataDir..."
  RMDir /r /REBOOTOK "$TargetDataDir"

  StrCpy $TargetTaggerDir ""
  StrCpy $TargetDataDir ""
UninstallDone:
!macroend