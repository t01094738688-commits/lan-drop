!macro customInit
  nsExec::ExecToLog 'taskkill /IM "闪传本子.exe" /F /T'
  nsExec::ExecToLog 'taskkill /IM "LAN Drop.exe" /F /T'
!macroend

!macro customUnInit
  nsExec::ExecToLog 'taskkill /IM "闪传本子.exe" /F /T'
  nsExec::ExecToLog 'taskkill /IM "LAN Drop.exe" /F /T'
!macroend
