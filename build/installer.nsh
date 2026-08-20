; Personalização NSIS do ControlOne
; - Detecta instalação existente e trata como atualização
; - Na desinstalação, pergunta se quer limpar os dados

!macro customInit
  ${If} ${isUpdated}
    MessageBox MB_OKCANCEL|MB_ICONINFORMATION \
      "Atualização do ControlOne$\r$\n$\r$\n\
Uma versão anterior já está instalada neste computador.$\r$\n$\r$\n\
Este instalador irá atualizar o aplicativo para a nova versão.$\r$\n\
Seus dados (vendas, estoque, clientes e licença) serão mantidos.$\r$\n$\r$\n\
Clique em OK para continuar a atualização." \
      /SD IDOK IDOK continue_update IDCANCEL abort_update

    abort_update:
      Quit
    continue_update:
  ${EndIf}
!macroend

!macro customWelcomePage
  !define MUI_WELCOMEPAGE_TITLE "Bem-vindo ao ControlOne"
  !define MUI_WELCOMEPAGE_TEXT "Este assistente vai instalar ou atualizar o ControlOne no seu computador.$\r$\n$\r$\n\
• Se for a primeira instalação, o app será configurado do zero.$\r$\n\
• Se já existir uma versão instalada, ela será atualizada e seus dados serão preservados.$\r$\n$\r$\n\
Clique em Avançar para continuar."
  !insertmacro MUI_PAGE_WELCOME
!macroend

!macro customInstall
  ${If} ${isUpdated}
    DetailPrint "Atualizando ControlOne (dados do usuário serão mantidos)..."
  ${Else}
    DetailPrint "Instalando ControlOne..."
  ${EndIf}
!macroend

!macro customUnInstall
  ; Não perguntar em atualizações (o instalador novo remove a versão antiga)
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
