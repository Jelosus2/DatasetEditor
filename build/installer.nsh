!include "LogicLib.nsh"
!include "WinMessages.nsh"
!include "FileFunc.nsh"

!macro customHeader
    ShowInstDetails show
    ShowUninstDetails show
!macroend

!macro customInstall
    DetailPrint "Starting installation..."

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
        DetailPrint "Refreshing embedded_python bundle files"
        SetOverwrite on
        Push "$SourceTaggerDir\embedded_python"
        Push "$TargetTaggerDir\embedded_python"
        Call CopyDirRecursive
        SetOverwrite ifnewer
    next_tagger_dir:
        FindNext $R0 $R1
        Goto loop_tagger_dirs
    done_tagger_dirs:
    FindClose $R0

    StrCpy $SourceTaggerDir ""
    StrCpy $TargetTaggerDir ""

    Var /GLOBAL ScopeMarkerPath
    Var /GLOBAL CurrentAppData
    Var /GLOBAL AllUsersAppData

    StrCpy $ScopeMarkerPath "$INSTDIR\install-scope.json"
    StrCpy $CurrentAppData "$APPDATA"

    SetShellVarContext all
    StrCpy $AllUsersAppData "$APPDATA"

    ${If} $CurrentAppData == $AllUsersAppData
        DetailPrint "Writing machine install scope marker..."
        FileOpen $0 $ScopeMarkerPath w
        FileWrite $0 '{"scope":"machine"}'
        FileClose $0
        nsExec::Exec 'icacls "$APPDATA\${APP_PACKAGE_NAME}" /grant *S-1-5-32-545:(OI)(CI)M /T'
    ${Else}
        DetailPrint "Writing user install scope marker..."
        SetShellVarContext current
        FileOpen $0 $ScopeMarkerPath w
        FileWrite $0 '{"scope":"user"}'
        FileClose $0
    ${EndIf}
    
    ${If} $CurrentAppData == $AllUsersAppData
        SetShellVarContext all
    ${Else}
        SetShellVarContext current
    ${EndIf}

    StrCpy $ScopeMarkerPath ""
!macroend

!macro customUnInstall
    DetailPrint "Starting uninstall..."

    ${IfNot} ${isUpdated}
        IfSilent UninstallDone

        MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to remove the tagger and its dependencies?$\nChoosing 'No' will keep it for a future installation." IDYES RemoveAppData
        DetailPrint "User chose not to remove tagger."
        Goto UninstallDone

    RemoveAppData:
        DetailPrint "User chose to remove application data."

        Var /GLOBAL TargetTaggerDir

        StrCpy $TargetTaggerDir "$APPDATA\${APP_PACKAGE_NAME}\tagger"

        DetailPrint "Removing directory $TargetTaggerDir..."
        RMDir /r /REBOOTOK "$TargetTaggerDir"

        StrCpy $TargetTaggerDir ""
    UninstallDone:
    ${EndIf}
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

!define CT_TEXT_LABEL 1006

Function IsInstDirWritable
    StrCpy $0 "$INSTDIR"

find_parent:
    IfFileExists "$0\*.*" parent_found
    ${GetParent} "$0" $0
    ${If} "$0" == ""
        Push 0
        Return
    ${EndIf}
    Goto find_parent

parent_found:
    StrCpy $1 "$0\.de_write_probe"
    StrCpy $2 "$1\probe.temp"

    ClearErrors
    CreateDirectory "$1"
    IfErrors not_writeable

    ClearErrors
    FileOpen $3 "$2" w
    IfErrors cleanup_not_writeable
    FileWrite $3 "ok"
    FileClose $3

    Delete "$2"
    RMDir "$1"
    Push 1
    Return

cleanup_not_writeable:
    Delete "$2"
    RMDir "$1"

not_writeable:
    Push 0
FunctionEnd

Function .onVerifyInstDir
    ; 1. Check permissions
    Call IsInstDirWritable
    Pop $0
    
    ; 2. Find the Inner Dialog Window (where the controls live)
    FindWindow $1 "#32770" "" $HWNDPARENT
    
    ; 3. Get the handle for the Top Text Label (ID 1006)
    GetDlgItem $2 $1 ${CT_TEXT_LABEL}

    ${If} $0 == 0
        ; --- BAD FOLDER CASE ---
        ; Change text to warn the user
        SendMessage $2 ${WM_SETTEXT} 0 "STR:PERMISSION ERROR: Cannot write to this folder.$\r$\nPlease select a User folder or run installer as Admin."
        
        ; Disable the Next/Install button
        Abort
        
    ${Else}
        ; --- GOOD FOLDER CASE ---
        ; Restore the normal text (using the product name variable)
        SendMessage $2 ${WM_SETTEXT} 0 "STR:Setup will install ${PRODUCT_NAME} in the following folder."
    ${EndIf}
FunctionEnd
