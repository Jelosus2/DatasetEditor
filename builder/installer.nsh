!macro customInstall
    Var /GLOBAL SourceTaggerDir
    Var /GLOBAL TargetTaggerDir

    StrCpy $SourceTaggerDir "$INSTDIR\resources\tagger"
    StrCpy $TargetTaggerDir "$APPDATA\${APP_PACKAGE_NAME}\tagger"

    DetailPrint "Copying tagger files..."
    CreateDirectory "$TargetTaggerDir"
    CopyFiles /SILENT "$SourceTaggerDir\*.*" "$TargetTaggerDir"

    Var /GLOBAL SourceDataDir
    Var /GLOBAL TargetDataDir

    StrCpy $SourceDataDir "$INSTDIR\resources\Data"
    StrCpy $TargetDataDir "$APPDATA\${APP_PACKAGE_NAME}\Data"

    DetailPrint "Copying data files..."
    CreateDirectory "$TargetDataDir"
    CopyFiles /SILENT "$SourceDataDir\*.*" "$TargetDataDir"

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
!macroend