from flask import Flask, jsonify, request
import requests
from datetime import datetime, timedelta
import base64
import os
from flask_cors import CORS  # Importez Flask-CORS
from collections import Counter, defaultdict
from functools import lru_cache
from time import time
from pymongo import MongoClient, errors
from dotenv import load_dotenv
import threading
import time

load_dotenv()  # charge les variables depuis .env

# --- Configuration via .env ---
JIRA_URL = os.getenv("JIRA_URL")
JIRA_USERNAME = os.getenv("JIRA_USERNAME")
JIRA_TOKEN = os.getenv("JIRA_TOKEN")
# Liste d'IDs séparés par virgule dans .env
JIRA_ASSIGNEES = os.getenv("JIRA_ASSIGNEES", "").split(",")
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "studiapijira")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "stats")

# Connexion MongoDB Atlas avec réessai automatique
mongo_ok = False
while not mongo_ok:
    try:
        mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        mongo_db = mongo_client[MONGODB_DB]
        mongo_stats = mongo_db[MONGODB_COLLECTION]
        mongo_client.server_info()  # Test connexion
        mongo_ok = True
        print('[MongoDB] Connexion réussie')
    except Exception as e:
        print(f"[MongoDB] Connexion échouée : {e}. Nouvelle tentative dans 5s...")
        time.sleep(5)

app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app)  # Activez CORS pour toutes les routes (ou configurez des options spécifiques)

# --- Fonctions utilitaires minimales pour éviter les erreurs ---
def fetch_jira_issues(jql, fields=None, max_results=100):
    """
    Récupère les issues Jira correspondant au JQL donné, avec pagination.
    fields: string séparé par virgule ou None (tous les champs)
    Retourne une liste de tickets (dicts)
    """
    url = JIRA_URL.rstrip('/') + '/rest/api/3/search'
    auth = (JIRA_USERNAME, JIRA_TOKEN)
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    params = {
        'jql': jql,
        'maxResults': max_results,
        'startAt': 0
    }
    if fields:
        params['fields'] = fields
    all_issues = []
    while True:
        resp = requests.get(url, headers=headers, params=params, auth=auth)
        if resp.status_code != 200:
            print(f"[Jira] Erreur {resp.status_code}: {resp.text}")
            break
        data = resp.json()
        issues = data.get('issues', [])
        all_issues.extend(issues)
        if len(issues) < max_results:
            break
        params['startAt'] += max_results
    return all_issues

def get_resolved_tickets():
    """
    Retourne les tickets résolus (statusCategory = Done) sur les 30 derniers jours.
    """
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    jql = f'project = HEL AND assignee IN ({assignees_str}) AND statusCategory = Done AND resolved >= -30d'
    return fetch_jira_issues(jql, fields='assignee,resolutiondate,status')

# --- FONCTION POUR METTRE À JOUR LES STATS DASHBOARD EN BASE ---
def update_dashboard_stats():
    print("[Jira] Début de la mise à jour des stats depuis Jira...")


    # Calcul des stats comme dans /api/kpis
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    jql_total = f'project = HEL AND assignee IN ({assignees_str}) AND createdDate > -30d'
    total_issues = fetch_jira_issues(jql_total, fields='id')
    total_tickets = len(total_issues)
    print(f"[Jira] Tickets totaux (30j): {total_tickets}")
    resolved_tickets = get_resolved_tickets()
    tickets_resolved = len(resolved_tickets)
    print(f"[Jira] Tickets résolus (30j): {tickets_resolved}")
    support_health = int((tickets_resolved / total_tickets) * 100) if total_tickets else 0
    support_health_label = 'Bon' if support_health >= 70 else 'Moyen' if support_health >= 40 else 'Critique'
    objectif = 500
    progress = int((tickets_resolved / objectif) * 100) if objectif else 0
    leaderboard = []
    resolved_by_user = {}
    for ticket in resolved_tickets:
        assignee = ticket['fields'].get('assignee')
        if assignee and isinstance(assignee, dict):
            name = assignee.get('displayName') or assignee.get('name') or assignee.get('emailAddress') or 'Inconnu'
        else:
            name = 'Inconnu'
        if name != 'Inconnu':
            resolved_by_user[name] = resolved_by_user.get(name, 0) + 1
    for name, score in sorted(resolved_by_user.items(), key=lambda x: x[1], reverse=True):
        leaderboard.append({'name': name, 'score': score})


    # Tickets par statut
    jql_status = f'project = HEL AND assignee IN ({assignees_str}) AND createdDate > -30d'
    issues_status = fetch_jira_issues(jql_status, fields='status')
    print(f"[Jira] Tickets par statut récupérés: {len(issues_status)}")
    status_counts = Counter()
    for ticket in issues_status:
        status = ticket['fields'].get('status', {}).get('name', 'Inconnu')
        status_counts[status] += 1


    # Tickets par pôle
    jql_dept = f'project = HEL AND assignee IN ({assignees_str}) AND createdDate > -30d AND "Départements / Pôles[Select List (cascading)]" IS NOT EMPTY'
    issues_dept = fetch_jira_issues(jql_dept, fields='customfield_12002')
    print(f"[Jira] Tickets par pôle récupérés: {len(issues_dept)}")
    department_counts = Counter()
    for ticket in issues_dept:
        department = ticket['fields'].get('customfield_12002', 'Autre')
        if isinstance(department, dict):
            department = department.get('value', 'Autre')
        department_counts[department] += 1


    # Tickets par étiquette
    jql_label = f'project = HEL AND assignee IN ({assignees_str}) AND createdDate > -30d AND status = Closed ORDER BY created ASC'
    issues_label = fetch_jira_issues(jql_label, fields='labels')
    print(f"[Jira] Tickets par étiquette récupérés: {len(issues_label)}")
    label_counts = Counter()
    for ticket in issues_label:
        labels = ticket['fields'].get('labels', [])
        for label in labels:
            label_counts[label] += 1


    # Tickets créés vs résolus (filtre sur 30j)
    date_30d = (datetime.utcnow() - timedelta(days=30)).strftime('%Y-%m-%d')
    jql_cr = f'project = HEL AND assignee IN ({assignees_str}) AND (created >= "{date_30d}" OR resolutiondate >= "{date_30d}")'
    issues_cr = fetch_jira_issues(jql_cr, fields='created,resolutiondate')
    print(f"[Jira] Tickets créés/résolus récupérés (30j): {len(issues_cr)}")
    created_per_day = defaultdict(int)
    resolved_per_day = defaultdict(int)
    for ticket in issues_cr:
        created_str = ticket['fields'].get('created')
        resolved_str = ticket['fields'].get('resolutiondate')
        if created_str:
            created_date = created_str[:10]
            created_per_day[created_date] += 1
        if resolved_str:
            resolved_date = resolved_str[:10]
            resolved_per_day[resolved_date] += 1

    # Tickets non résolus par jour (filtre sur 30j)
    jql_unresolved = f'project = HEL AND assignee IN ({assignees_str}) AND created >= "{date_30d}" AND statusCategory != Done'
    issues_unresolved = fetch_jira_issues(jql_unresolved, fields='created')
    print(f"[Jira] Tickets non résolus récupérés (30j): {len(issues_unresolved)}")
    unresolved_per_day = defaultdict(int)
    for ticket in issues_unresolved:
        created_str = ticket['fields'].get('created')
        if created_str:
            created_date = created_str[:10]
            unresolved_per_day[created_date] += 1

    # Tickets relancés et clôturés
    jql_relaunched = f'project = HEL AND assignee IN ({assignees_str}) AND labels = RelanceEnvoyee'
    relaunched = len(fetch_jira_issues(jql_relaunched, fields='labels'))
    jql_closed = f'project = HEL AND assignee IN ({assignees_str}) AND labels = "RelanceClose" AND updatedDate > -30d'
    closed = len(fetch_jira_issues(jql_closed, fields='labels'))

    # Stockage en base
    stats = {
        'total_tickets': total_tickets,
        'tickets_resolved': tickets_resolved,
        'support_health': support_health,
        'support_health_label': support_health_label,
        'progress': progress,
        'leaderboard': leaderboard,
        'workload': leaderboard,
        'status_counts': dict(status_counts),
        'department_counts': dict(department_counts),
        'label_counts': dict(label_counts),
        'created_vs_resolved': {
            'created': dict(created_per_day),
            'resolved': dict(resolved_per_day)
        },
        'relaunch_sent': relaunched,
        'relaunch_closed': closed,
        'unresolved_tickets': dict(unresolved_per_day),
        'updated_at': datetime.utcnow()
    }
    if mongo_ok:
        mongo_stats.replace_one({'_id': 'dashboard'}, {**stats, '_id': 'dashboard'}, upsert=True)
        print('[MongoDB] Stats dashboard sauvegardées.')
    else:
        print('[MongoDB] Non accessible, stats non persistées')

# --- ROUTES QUI LISENT LA DB ---
@app.route('/api/kpis')
def api_kpis():
    if not mongo_ok:
        return jsonify({'error': 'MongoDB non accessible'}), 500
    # Lecture des stats depuis MongoDB
    stats = mongo_stats.find_one({'_id': 'dashboard'})
    if not stats:
        return jsonify({'error': 'Stats non trouvées'}), 404
    return jsonify(stats)

@app.route('/api/stats')
def api_stats():
    if not mongo_ok:
        return jsonify({'error': 'MongoDB non accessible'}), 500
    # Lecture des stats depuis MongoDB
    stats = mongo_stats.find_one({'_id': 'dashboard'})
    if not stats:
        return jsonify({'error': 'Stats non trouvées'}), 404
    # Ne pas retourner les données sensibles
    stats.pop('support_health_label', None)
    stats.pop('updated_at', None)
    return jsonify(stats)

# Routes pour fournir les données individuelles aux anciens endpoints front-end
@app.route('/tickets_created_vs_resolved')
def get_chart_created_vs_resolved():
    stats = mongo_stats.find_one({'_id': 'dashboard'}) or {}
    return jsonify(stats.get('created_vs_resolved', {}))

@app.route('/tickets_by_department')
def get_chart_by_department():
    stats = mongo_stats.find_one({'_id': 'dashboard'}) or {}
    return jsonify(stats.get('department_counts', {}))

@app.route('/tickets_by_label')
def get_chart_by_label():
    stats = mongo_stats.find_one({'_id': 'dashboard'}) or {}
    return jsonify(stats.get('label_counts', {}))

@app.route('/tickets_by_status')
def get_chart_by_status():
    stats = mongo_stats.find_one({'_id': 'dashboard'}) or {}
    return jsonify(stats.get('status_counts', {}))

# --- ROUTE DE TEST POUR FORCER LA MISE À JOUR DES STATS ---
@app.route('/api/update_stats')
def api_update_stats():
    threading.Thread(target=update_dashboard_stats).start()
    return jsonify({'status': 'Mise à jour des stats lancée'}), 202

# --- ROUTE POUR TESTER LA CONNEXION À JIRA ---
@app.route('/api/jira/test')
def api_jira_test():
    url = JIRA_URL.rstrip('/') + '/rest/api/3/myself'
    auth = (JIRA_USERNAME, JIRA_TOKEN)
    headers = {
        'Accept': 'application/json',
        'Content-Type': 'application/json'
    }
    resp = requests.get(url, headers=headers, auth=auth)
    if resp.status_code == 200:
        return jsonify({'status': 'Connexion à Jira réussie', 'data': resp.json()})
    else:
        return jsonify({'status': 'Erreur de connexion à Jira', 'error': resp.text}), resp.status_code

# --- ROUTE POUR TESTER LA CONNEXION À MONGODB ---
@app.route('/api/mongo/test')
def api_mongo_test():
    if mongo_ok:
        return jsonify({'status': 'Connexion à MongoDB réussie'})
    else:
        return jsonify({'status': 'Erreur de connexion à MongoDB'}), 500

# New endpoint: generate report data for given date range
@app.route('/api/reports')
def api_reports():
    start = request.args.get('startDate')
    end = request.args.get('endDate')
    if not start or not end:
        return jsonify({'error':'Paramètres startDate et endDate requis'}),400
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    
    # Labels
    jql_labels = f'project = HEL AND assignee IN ({assignees_str}) AND createdDate >= {start} AND createdDate <= {end} AND status = Closed'
    issues_labels = fetch_jira_issues(jql_labels, fields='labels')
    label_counts = Counter()
    for t in issues_labels:
        for l in t['fields'].get('labels',[]): label_counts[l]+=1

    # Statuses
    jql_status = f'project = HEL AND assignee IN ({assignees_str}) AND createdDate >= {start} AND createdDate <= {end}'
    issues_status = fetch_jira_issues(jql_status, fields='status')
    status_counts = Counter()
    for t in issues_status:
        s = t['fields'].get('status',{}).get('name','Inconnu'); status_counts[s]+=1

    # Departments
    jql_dept = f'project = HEL AND assignee IN ({assignees_str}) AND createdDate >= {start} AND createdDate <= {end}'
    issues_dept = fetch_jira_issues(jql_dept, fields='customfield_12002')
    dept_counts = Counter()
    for t in issues_dept:
        d = t['fields'].get('customfield_12002')
        if isinstance(d,dict): v=d.get('value','Autre')
        else: v='Autre'
        dept_counts[v]+=1
    return jsonify({
        'labels': dict(label_counts),
        'statuses': dict(status_counts),
        'departments': dict(dept_counts)
    })

# --- ROUTE POUR SERVIR LA PAGE D'ACCUEIL ---
@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

if __name__ == '__main__':
    # --- CHARGEMENT DES VARIABLES D'ENVIRONNEMENT ---
    load_dotenv()
    PORT = int(os.getenv("PORT", 5000))
    # --- DÉBUT DE L'APPLICATION ---
    print("[Serveur] Démarrage de l'application...")
    update_dashboard_stats()  # Préremplissage des statistiques au démarrage
    app.run(host="0.0.0.0", port=PORT, debug=True)