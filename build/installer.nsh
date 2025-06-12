!include "LogicLib.nsh"

!macro customInstall
    Var /GLOBAL SourceTaggerDir
    Var /GLOBAL TargetTaggerDir

    StrCpy $SourceTaggerDir "$INSTDIR\resources\tagger"
    StrCpy $TargetTaggerDir "$APPDATA\${APP_PACKAGE_NAME}\tagger"

    DetailPrint "Copying tagger files..."
    CreateDirectory "$TargetTaggerDir"
    SetOverwrite ifnewer
    CopyFiles /SILENT /FILESONLY "$SourceTaggerDir\*.*" "$TargetTaggerDir"

    FindFirst $R0 $R1 "$SourceTaggerDir\*.*"
    loop_tagger_dirs:
        StrCmp $R1 "" done_tagger_dirs
        StrCmp $R1 "." next_tagger_dir
        StrCmp $R1 ".." next_tagger_dir
        IfFileExists "$SourceTaggerDir\$R1\*.*" 0 next_tagger_dir

        StrCmp $R1 "embedded_python" check_embedded_python
        DetailPrint "Recursively copying tagger subdirectory: $R1"
        Push "$SourceTaggerDir\$R1"
        Push "$TargetTaggerDir\$R1"
        Call CopyDirRecursive
        Goto next_tagger_dir

    check_embedded_python:
        ${IfNot} ${FileExists} "$TargetTaggerDir\embedded_python\*.*"
            DetailPrint "Copying embedded_python for first install"
            Push "$SourceTaggerDir\embedded_python"
            Push "$TargetTaggerDir\embedded_python"
            Call CopyDirRecursive
        ${EndIf}
    next_tagger_dir:
        FindNext $R0 $R1
        Goto loop_tagger_dirs
    done_tagger_dirs:
    FindClose $R0

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

Function CopyDirRecursive
    Exch $1
    Exch 1
    Exch $0

    Push $2
    Push $3

    CreateDirectory "$1"
    CopyFiles /SILENT /FILESONLY "$0\*.*" "$1"

    FindFirst $2 $3 "$0\*.*"
    copydir_loop:
        StrCmp $3 "" copydir_done
        StrCmp $3 "." copydir_next
        StrCmp $3 ".." copydir_next
        IfFileExists "$0\$3\*.*" 0 copydir_next
        Push "$0\$3"
        Push "$1\$3"
        Call CopyDirRecursive
    copydir_next:
        FindNext $2 $3
        Goto copydir_loop
    copydir_done:
    FindClose $2
    Pop $3
    Pop $2
    Pop $0
    Pop $1
FunctionEnd
