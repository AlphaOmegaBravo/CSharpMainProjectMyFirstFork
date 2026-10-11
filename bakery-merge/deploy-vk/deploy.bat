@echo off
chcp 65001 >nul
title Пышка: пекарня-мёрдж - деплой в VK Mini Apps
cd /d "%~dp0"

echo ============================================
echo   Пышка: пекарня-мёрдж - деплой в VK
echo   ID приложения: 54817226
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [!] Node.js не найден. Установите версию LTS с https://nodejs.org
  echo     и запустите deploy.bat ещё раз.
  pause
  exit /b 1
)

if not exist "build\index.html" (
  echo [!] Не найден файл build\index.html
  pause
  exit /b 1
)

if not exist "node_modules\@vkontakte\vk-miniapps-deploy" (
  echo Устанавливаю инструмент деплоя VK, это один раз...
  call npm install --no-audit --no-fund
  if errorlevel 1 (
    echo [!] Не удалось установить зависимости. Проверьте интернет.
    pause
    exit /b 1
  )
)

echo.
echo Загружаю игру на хостинг VK...
echo Если появится ссылка - откройте её в браузере, войдите в VK
echo и разрешите доступ, затем нажмите Enter в этом окне.
echo Если VK пришлёт код подтверждения в сообщениях - введите его здесь.
echo.
call npx vk-miniapps-deploy
if errorlevel 1 (
  echo.
  echo [!] Деплой не удался. Сообщение об ошибке смотрите выше.
  echo     При ошибке "invalid session" удалите файл
  echo     %%USERPROFILE%%\.config\configstore\@vkontakte\vk-miniapps-deploy.json
  pause
  exit /b 1
)

echo.
echo Готово! Игра загружена. Проверьте её по ссылке из кабинета VK.
pause
