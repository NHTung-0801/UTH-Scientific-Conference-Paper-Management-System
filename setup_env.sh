@echo off
echo Dang khoi tao file .env cho du an...

:: Copy cho Frontend
copy frontend\.env.example frontend\.env

:: Copy cho các Backend Services
copy backend\identity-service\.env.example backend\identity-service\.env
copy backend\conference-service\.env.example backend\conference-service\.env
copy backend\submission-service\.env.example backend\submission-service\.env
copy backend\notification-service\.env.example backend\notification-service\.env
copy backend\intelligent-service\.env.example backend\intelligent-service\.env

echo ---------------------------------------------------
echo DA XONG!
echo ---------------------------------------------------
pause