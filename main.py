from flask import Flask, jsonify, request, session, redirect, url_for
from flask_cors import CORS
from flask_session import Session
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import requests
from requests_oauthlib import OAuth2Session
from datetime import datetime, timedelta, timezone
from collections import Counter, defaultdict
import threading
import time
from oauthlib.oauth2 import WebApplicationClient
from bson import ObjectId
import bcrypt
from waitress import serve

load_dotenv()  # charge les variables depuis .env

# --- Configuration via .env ---
JIRA_URL = os.getenv("JIRA_URL")
JIRA_USERNAME = os.getenv("JIRA_USERNAME")
JIRA_TOKEN = os.getenv("JIRA_TOKEN")
JIRA_PROJECT_DEFAULT = os.getenv("JIRA_PROJECT_DEFAULT", "HEL")
# Liste d'IDs séparés par virgule dans .env
JIRA_ASSIGNEES = os.getenv("JIRA_ASSIGNEES", "").split(",")
MONGODB_URI = os.getenv("MONGODB_URI")
MONGODB_DB = os.getenv("MONGODB_DB", "studiapijira")
MONGODB_COLLECTION = os.getenv("MONGODB_COLLECTION", "stats")
USERS_DB = os.getenv("USERS_DB", "users")  # NEW: db for users
USERS_COLLECTION = os.getenv("USERS_COLLECTION", "users")  # NEW: collection for users
SESSION_DB = os.getenv("SESSION_DB", "users")  # NEW: db for sessions
SESSION_COLLECTION = os.getenv("SESSION_COLLECTION", "sessions")  # NEW: collection for sessions

# Connexion MongoDB Atlas avec réessai automatique
mongo_ok = False
while not mongo_ok:
    try:
        mongo_client = MongoClient(MONGODB_URI, serverSelectionTimeoutMS=3000)
        mongo_db = mongo_client[MONGODB_DB]
        mongo_stats = mongo_db[MONGODB_COLLECTION]
        users_db = mongo_client[USERS_DB]  # users db
        users_collection = users_db[USERS_COLLECTION]  # users collection
        session_db = mongo_client[SESSION_DB]  # session db
        mongo_client.server_info()  # Test connexion
        mongo_ok = True
        print('[MongoDB] Connexion réussie')
    except Exception as e:
        print(f"[MongoDB] Connexion échouée : {e}. Nouvelle tentative dans 5s...")
        time.sleep(5)

# --- Flask Session config for MongoDB ---
app = Flask(__name__, static_folder='.', static_url_path='')
CORS(app) # Active CORS pour toutes les routes
app.config['SESSION_TYPE'] = 'mongodb'
app.config['SESSION_MONGODB'] = mongo_client
app.config['SESSION_MONGODB_DB'] = SESSION_DB
app.config['SESSION_MONGODB_COLLECT'] = SESSION_COLLECTION
app.config['SESSION_PERMANENT'] = False
app.secret_key = os.getenv('SECRET_KEY', 'changeme')
Session(app)
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID')
GOOGLE_CLIENT_SECRET = os.getenv('GOOGLE_CLIENT_SECRET')
GOOGLE_DISCOVERY_URL = (
    "https://accounts.google.com/.well-known/openid-configuration"
)
REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:5000/api/login/google/callback')
client = WebApplicationClient(GOOGLE_CLIENT_ID)

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

def get_resolved_tickets(projectKey=None):
    """
    Retourne les tickets résolus (statusCategory = Done) sur les 30 derniers jours.
    """
    proj = projectKey or JIRA_PROJECT_DEFAULT
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    jql = f'project = {proj} AND assignee IN ({assignees_str}) AND statusCategory = Done AND resolved >= -30d'
    return fetch_jira_issues(jql, fields='assignee,resolutiondate,status')

# --- FONCTION POUR METTRE À JOUR LES STATS DASHBOARD EN BASE ---
def update_dashboard_stats(return_data=False, projectKey=None, assignees_override=None):
    """Retrieve stats, optionally for a specific project and assignees list"""
    proj = projectKey or JIRA_PROJECT_DEFAULT
    assignees_list = assignees_override if assignees_override is not None else JIRA_ASSIGNEES
    # Compute composite id for storage
    id_key = f"{proj}_{'_'.join(assignees_list)}"
    print(f"[Jira] Mise à jour des stats pour projet {proj} et assignees {assignees_list}")


    # Calcul des stats comme dans /api/kpis
    assignees_str = ','.join([f'"{a}"' for a in assignees_list])
    jql_total = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate > -30d'
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
    jql_status = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate > -30d'
    issues_status = fetch_jira_issues(jql_status, fields='status')
    print(f"[Jira] Tickets par statut récupérés: {len(issues_status)}")
    status_counts = Counter()
    for ticket in issues_status:
        status = ticket['fields'].get('status', {}).get('name', 'Inconnu')
        status_counts[status] += 1


    # Tickets par pôle
    jql_dept = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate > -30d AND "Départements / Pôles[Select List (cascading)]" IS NOT EMPTY'
    issues_dept = fetch_jira_issues(jql_dept, fields='customfield_12002')
    print(f"[Jira] Tickets par pôle récupérés: {len(issues_dept)}")
    department_counts = Counter()
    for ticket in issues_dept:
        department = ticket['fields'].get('customfield_12002', 'Autre')
        if isinstance(department, dict):
            department = department.get('value', 'Autre')
        department_counts[department] += 1


    # Tickets par étiquette
    jql_label = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate > -30d AND status = Closed ORDER BY created ASC'
    issues_label = fetch_jira_issues(jql_label, fields='labels')
    print(f"[Jira] Tickets par étiquette récupérés: {len(issues_label)}")
    label_counts = Counter()
    for ticket in issues_label:
        labels = ticket['fields'].get('labels', [])
        for label in labels:
            label_counts[label] += 1


    # Tickets créés vs résolus (filtre sur 30j)
    date_30d = (datetime.now(timezone.utc) - timedelta(days=30)).strftime('%Y-%m-%d')
    jql_cr = f'project = {proj} AND assignee IN ({assignees_str}) AND (created >= "{date_30d}" OR resolutiondate >= "{date_30d}")'
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
    jql_unresolved = f'project = {proj} AND assignee IN ({assignees_str}) AND created >= "{date_30d}" AND statusCategory != Done'
    issues_unresolved = fetch_jira_issues(jql_unresolved, fields='created')
    print(f"[Jira] Tickets non résolus récupérés (30j): {len(issues_unresolved)}")
    unresolved_per_day = defaultdict(int)
    for ticket in issues_unresolved:
        created_str = ticket['fields'].get('created')
        if created_str:
            created_date = created_str[:10]
            unresolved_per_day[created_date] += 1

    # Tickets relancés et clôturés
    jql_relaunched = f'project = {proj} AND assignee IN ({assignees_str}) AND labels = RelanceEnvoyee'
    relaunched = len(fetch_jira_issues(jql_relaunched, fields='labels'))
    jql_closed = f'project = {proj} AND assignee IN ({assignees_str}) AND labels = "RelanceClose" AND updatedDate > -30d'
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
        'updated_at': datetime.now(timezone.utc)
    }
    if mongo_ok and not return_data:
        # Store stats per project-team key
        mongo_stats.replace_one({'_id': id_key}, {**stats, '_id': id_key}, upsert=True)
        print(f'[MongoDB] Stats sauvegardées pour {id_key}.')
    if return_data:
        return stats

def user_to_dict(user):
    return {
        "id": str(user.get("_id")),
        "username": user.get("username", ""),
        # "password": user.get("password", ""),  # NE PAS exposer le mot de passe !
        "name": user.get("name") or user.get("nom") or user.get("username", ""),
        "prenom": user.get("prenom", ""),
        "email": user.get("email", ""),
        "type_connexion": user.get("type_connexion", ""),
        "role": user.get("role", "user")
    }

# --- ROUTES QUI LISENT LA DB ---
def get_default_stats_id():
    """Computes the default ID for stats based on .env config."""
    proj = os.getenv("JIRA_PROJECT_DEFAULT", "HEL")
    assignees_list = os.getenv("JIRA_ASSIGNEES", "").split(",")
    return f"{proj}_{'_'.join(assignees_list)}"

@app.route('/api/kpis')
def api_kpis():
    # Dynamic KPIs, optionally per projectKey
    projectKey = request.args.get('projectKey')
    if projectKey:
        # Return fresh stats for project
        stats = update_dashboard_stats(return_data=True, projectKey=projectKey)
        return jsonify(stats)
    # Fallback: read default dashboard stats from Mongo
    if not mongo_ok:
        return jsonify({'error': 'MongoDB non accessible'}), 500
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key})
    if not stats:
        # Try legacy key for backward compatibility
        stats = mongo_stats.find_one({'_id': 'dashboard'})
        if not stats:
            return jsonify({'error': 'Stats non trouvées'}), 404
    stats.pop('_id', None)
    return jsonify(stats)

@app.route('/api/stats')
def api_stats():
    if not mongo_ok:
        return jsonify({'error': 'MongoDB non accessible'}), 500
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    if not stats:
        stats = mongo_stats.find_one({'_id': 'dashboard'}) or {}
    if not stats:
        return jsonify({'error': 'Stats non trouvées'}), 404
    # Ne pas retourner les données sensibles
    stats.pop('support_health_label', None)
    stats.pop('updated_at', None)
    return jsonify(stats)

# Routes pour fournir les données individuelles aux anciens endpoints front-end
@app.route('/tickets_created_vs_resolved')
def get_chart_created_vs_resolved():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    return jsonify(stats.get('created_vs_resolved', {}))

@app.route('/tickets_by_department')
def get_chart_by_department():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    return jsonify(stats.get('department_counts', {}))

@app.route('/tickets_by_label')
def get_chart_by_label():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    return jsonify(stats.get('label_counts', {}))

@app.route('/tickets_by_status')
def get_chart_by_status():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
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

@app.route('/api/projects')
def api_projects():
    # Liste des projets Jira accessiblse
    url = f"{JIRA_URL.rstrip('/')}/rest/api/3/project/search?orderBy=key"
    resp = requests.get(url, auth=(JIRA_USERNAME, JIRA_TOKEN))
    if resp.status_code != 200:
        return jsonify({'error':'jira error','details':resp.text}), resp.status_code
    data = resp.json().get('values', [])
    return jsonify([{ 'key': p.get('key'), 'name': p.get('name') } for p in data])

@app.route('/api/tickets')
def api_tickets():
    projectKey = request.args.get('projectKey')
    teamId = request.args.get('teamId')
    if not projectKey or not teamId:
        return jsonify({'error':'projectKey and teamId required'}),400
    # Fetch team members via Jira REST API
    team_url = f"{JIRA_URL.rstrip('/')}/rest/api/3/people/team/{teamId}"
    resp = requests.get(team_url, auth=(JIRA_USERNAME, JIRA_TOKEN))
    if resp.status_code != 200:
        return jsonify({'error':'jira error','details':resp.text}), resp.status_code
    members = [m.get('accountId') for m in resp.json().get('values',[]) if m.get('accountId')]
    if not members:
        return jsonify([])  # no team members
    assignees_str = ','.join([f'"{a}"' for a in members])
    # Fetch issues from Jira
    jql = f'project = {projectKey} AND assignee IN ({assignees_str}) ORDER BY created DESC'
    issues = fetch_jira_issues(jql, fields='key,summary,status,assignee,created,updated', max_results=100)
    # Simplify payload
    tickets = []
    for t in issues:
        fields = t.get('fields', {})
        tickets.append({
            'key': t.get('key'),
            'summary': fields.get('summary'),
            'status': fields.get('status',{}).get('name'),
            'assignee': fields.get('assignee',{}).get('displayName'),
            'created': fields.get('created'),
            'updated': fields.get('updated'),
        })
    return jsonify(tickets)

# --- User login with MongoDB ---
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    username = data.get('username')
    password = data.get('password')
    user = users_collection.find_one({'username': username})
    if user and 'password' in user:
        stored_pw = user['password']
        # Handle both str and bytes
        if isinstance(stored_pw, bytes):
            stored_pw_str = stored_pw.decode('utf-8')
        else:
            stored_pw_str = stored_pw
        # If already bcrypt hash
        if stored_pw_str.startswith('$2a$') or stored_pw_str.startswith('$2b$'):
            stored_pw_bytes = stored_pw_str.encode('utf-8')
            if bcrypt.checkpw(password.encode('utf-8'), stored_pw_bytes):
                session['user'] = username
                return jsonify({'success': True, 'user': user_to_dict(user)})
        else:
            # Legacy: plaintext password in DB
            if password == stored_pw_str:
                # Upgrade: hash and store
                hashed = bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
                users_collection.update_one({'_id': user['_id']}, {'$set': {'password': hashed}})
                session['user'] = username
                return jsonify({'success': True, 'user': user_to_dict(user)})
    # Message neutre pour éviter l'énumération
    return jsonify({'success': False, 'error': 'Identifiants invalides'}), 401

@app.route('/api/logout')
def logout():
    session.pop('user', None)
    return jsonify({'success': True})

@app.route('/api/user')
def get_current_user():
    if 'user' not in session:
        return jsonify({'error': 'Non authentifié'}), 401
    # Cherche par username OU email (pour compatibilité SSO et comptes locaux)
    user = users_collection.find_one({
        '$or': [
            {'username': session['user']},
            {'email': session['user']}
        ]
    })
    if not user:
        # Si aucun user trouvé, retourne au moins le username pour compatibilité
        print('[API /api/user] Aucun utilisateur trouvé, retour minimal')
        return jsonify({'username': session['user']})
    return jsonify(user_to_dict(user))

# --- Google SSO ---
def get_google_provider_cfg():
    return requests.get(GOOGLE_DISCOVERY_URL).json()

@app.route('/api/login/google')
def google_login():
    google_provider_cfg = get_google_provider_cfg()
    authorization_endpoint = google_provider_cfg["authorization_endpoint"]
    oauth = OAuth2Session(GOOGLE_CLIENT_ID, redirect_uri=REDIRECT_URI, scope=["openid", "email", "profile"])
    authorization_url, state = oauth.authorization_url(authorization_endpoint, access_type="offline", prompt="consent")
    session['oauth_state'] = state
    return redirect(authorization_url)

@app.route('/api/login/google/callback')
def google_callback():
    oauth = OAuth2Session(GOOGLE_CLIENT_ID, redirect_uri=REDIRECT_URI, state=session.get('oauth_state'))
    google_provider_cfg = get_google_provider_cfg()
    token_endpoint = google_provider_cfg["token_endpoint"]
    token = oauth.fetch_token(
        token_endpoint,
        client_secret=GOOGLE_CLIENT_SECRET,
        authorization_response=request.url
    )
    userinfo_endpoint = google_provider_cfg["userinfo_endpoint"]
    resp = oauth.get(userinfo_endpoint)
    userinfo = resp.json()
    session['user'] = userinfo['email']
    # Optionally, create user in users db if not exists
    if not users_collection.find_one({'username': userinfo['email']}):
        users_collection.insert_one({'username': userinfo['email'], 'google': True})
    return redirect('/pages/dashboard.html')

# --- ROUTE POUR SERVIR LA PAGE D'ACCUEIL ---
@app.route('/')
def serve_index():
    return app.send_static_file('index.html')

@app.route('/api/users', methods=['GET'])
def get_users():
    users = list(users_collection.find())
    return jsonify([user_to_dict(u) for u in users])

@app.route('/api/users', methods=['POST'])
def add_user():
    data = request.json
    required_fields = ["name", "email", "username", "password", "role"]
    for field in required_fields:
        if not data.get(field):
            return jsonify({"error": f"Champ '{field}' requis"}), 400
    # Hash du mot de passe
    hashed = bcrypt.hashpw(data["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
    user = {
        "name": data["name"],
        "prenom": data.get("prenom", ""),
        "email": data["email"],
        "username": data["username"],
        "password": hashed,
        "type_connexion": data.get("type_connexion", ""),
        "role": data["role"]
    }
    result = users_collection.insert_one(user)
    user["_id"] = result.inserted_id
    return jsonify(user_to_dict(user)), 201

@app.route('/api/users/<user_id>', methods=['PUT'])
def update_user(user_id):
    data = request.json
    update = {}
    for field in ["name", "prenom", "email", "username", "type_connexion", "role"]:
        if field in data and data[field] != "":
            update[field] = data[field]
    # Password: only update if provided and not empty
    if "password" in data and data["password"]:
        hashed = bcrypt.hashpw(data["password"].encode('utf-8'), bcrypt.gensalt()).decode('utf-8')
        update["password"] = hashed
    if not update:
        return jsonify({"error": "Aucune donnée à mettre à jour"}), 400
    try:
        # Vérification stricte de l'ObjectId
        oid = ObjectId(user_id)
        users_collection.update_one({"_id": oid}, {"$set": update})
        user = users_collection.find_one({"_id": oid})
    except Exception:
        return jsonify({"error": "ID utilisateur invalide"}), 400
    return jsonify(user_to_dict(user))

@app.route('/api/users/<user_id>', methods=['DELETE'])
def delete_user(user_id):
    try:
        oid = ObjectId(user_id)
        users_collection.delete_one({"_id": oid})
    except Exception:
        return jsonify({"error": "ID utilisateur invalide"}), 400
    return jsonify({"success": True})

# --- TÂCHE DE FOND POUR LA MISE À JOUR DES STATS ---
def stats_update_worker():
    """Met à jour les stats toutes les 5 minutes."""
    while True:
        print("[Worker] Lancement de la mise à jour des statistiques...")
        try:
            update_dashboard_stats()
            print("[Worker] Mise à jour des statistiques terminée.")
        except Exception as e:
            print(f"[Worker] Erreur lors de la mise à jour : {e}")
        time.sleep(300) # 5 minutes

if __name__ == '__main__':
    load_dotenv()
    PORT = int(os.getenv("PORT", 80))
    # --- DÉBUT DE L'APPLICATION ---
    print(f"[Serveur] Démarrage du serveur de production sur http://0.0.0.0:{PORT}")
    # Lancement du worker dans un thread séparé
    worker_thread = threading.Thread(target=stats_update_worker, daemon=True)
    worker_thread.start()
    serve(app, host="0.0.0.0", port=PORT, threads=10)