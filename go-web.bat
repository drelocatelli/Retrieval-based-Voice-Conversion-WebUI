start /B "" runtime\python.exe infer-web.py --pycmd runtime\python.exe --port 7897
timeout /t 5 >nul 2>&1
start /B "" cmd /c "cd file_uploader && npm run start --host localhost --port 3000"
start "" "http://localhost:3000"
