; Personalização NSIS do ControlOne
; Pergunta se o usuário quer desinstalação limpa (apagar dados).

!macro customUnInstall
  ; Não perguntar em atualizações silenciosas
  ${IfNot} ${isUpdated}
    SetShellVarContext current

    MessageBox MB_YESNO|MB_ICONQUESTION \
      "Deseja fazer uma desinstalação limpa?$\r$\n$\r$\n\
Isso apaga o banco de dados, imagens, backups e configurações deste computador.$\r$\n$\r$\n\
Escolha Não para manter os dados (recomendado se for reinstalar depois)." \
      /SD IDNO IDNO skip_clean_uninstall IDYES do_clean_uninstall

    do_clean_uninstall:
      ; Dados do app (banco, imagens, backups, licença)
      RMDir /r "$APPDATA\controlone"
      RMDir /r "$APPDATA\ControlOne"
      ; Pasta legada (versões antigas Cleide Pratas)
      RMDir /r "$APPDATA\cleide-pratas"
      ; Cache local do Electron/Chromium
      RMDir /r "$LOCALAPPDATA\controlone"
      RMDir /r "$LOCALAPPDATA\ControlOne"
      Goto clean_uninstall_done

    skip_clean_uninstall:
      Goto clean_uninstall_done

    clean_uninstall_done:
  ${EndIf}
!macroend
