@echo off
:: start_server.bat
:: Installe les dépendances Python, lance le backend Flask et ouvre le front-end dans le navigateur

REM Installation des dépendances Python
pip install -r requirements.txt

REM Démarrage du serveur Flask en tâche de fond
start "" python main.py

REM Ouverture automatique du dashboard dans le browser
start "" "http://127.0.0.1:5000/index.html"
