from flask import Flask, jsonify, request, session, redirect, url_for
from flask_cors import CORS
from flask_session import Session
from pymongo import MongoClient
from dotenv import load_dotenv
import os
import sys
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
from google.oauth2 import service_account
from googleapiclient.discovery import build
from googleapiclient.http import MediaIoBaseUpload
import io

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
# Configuration CORS plus détaillée
CORS(app, resources={
    r"/api/*": {
        "origins": "*",
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})
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
REDIRECT_URI = os.getenv('GOOGLE_REDIRECT_URI', 'http://localhost:80/api/login/google/callback')
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
    jql = f'project = {proj} AND assignee IN ({assignees_str}) AND status = Closed AND createdDate >= -30d'
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
    # Récupère les tickets résolus des 30 derniers jours
    resolved_tickets = get_resolved_tickets()
    tickets_resolved = len(resolved_tickets)
    
    # Récupère tous les tickets non résolus (sans limite de date)
    # Récupère les tickets avec status = Closed
    jql_closed = f'project = {proj} AND assignee IN ({assignees_str}) AND status = Closed AND createdDate > -30d'
    closed_issues = fetch_jira_issues(jql_closed, fields='id,status,created')
    tickets_closed = len(closed_issues)
    
    # Les tickets ouverts sont tous les tickets moins les fermés
    jql_total = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate > -30d'
    total_issues = fetch_jira_issues(jql_total, fields='id')
    tickets_open = len(total_issues) - tickets_closed
    
    # Le total est la somme des tickets ouverts et fermés
    total_tickets = len(total_issues)
    print(f"[Jira] Tickets totaux: {total_tickets} (ouverts: {tickets_open}, fermés: {tickets_closed})")
    
    # Calcul de la santé du support : 100% = tous les tickets sont fermés, 0% = aucun ticket fermé
    support_health = int((tickets_closed / total_tickets) * 100) if total_tickets else 100
    if support_health >= 80:
        support_health_label = 'Good'  # 80-100% des tickets sont résolus
    elif support_health >= 60:
        support_health_label = 'Fair'  # 60-79% des tickets sont résolus
    elif support_health >= 40:
        support_health_label = 'Warning'  # 40-59% des tickets sont résolus
    elif support_health >= 20:
        support_health_label = 'Bad'  # 20-39% des tickets sont résolus
    else:
        support_health_label = 'Critical'  # 0-19% des tickets sont résolus
    objectif = 500
    progress = int((tickets_resolved / objectif) * 100) if objectif else 0
    # Tickets par Type de Demande (remplace le leaderboard)
    # NOTE: 'customfield_10001' est une supposition pour "Type de Demande"
    # À ajuster si l'ID du champ personnalisé est différent.
    jql_request_type = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate > -30d AND "Request Type" IS NOT EMPTY'
    # Le champ pour "Request Type" peut varier, on essaie les plus courants
    issues_request_type = fetch_jira_issues(jql_request_type, fields='customfield_10001,customfield_10002,issuetype')
    print(f"[Jira] Tickets par type de demande récupérés: {len(issues_request_type)}")
    
    request_type_counts = Counter()
    for ticket in issues_request_type:
        # On cherche le bon champ dans les données du ticket
        request_type_field = ticket['fields'].get('customfield_10001') or ticket['fields'].get('customfield_10002')
        
        if request_type_field and isinstance(request_type_field, dict):
            # Structure standard pour les champs de type select list
            name = request_type_field.get('value') or request_type_field.get('name', 'Inconnu')
        elif isinstance(request_type_field, str):
            # Si le champ est une simple chaîne
            name = request_type_field
        else:
            # En dernier recours, on utilise le type de ticket (Issue Type)
            issuetype_field = ticket['fields'].get('issuetype')
            if issuetype_field and isinstance(issuetype_field, dict):
                name = issuetype_field.get('name', 'Inconnu')
            else:
                name = 'Inconnu'

        if name != 'Inconnu':
            request_type_counts[name] += 1

    # Traiter les données pour le top 5 + "Autre"
    sorted_types = request_type_counts.most_common()
    top_5_types = sorted_types[:5]
    other_types = sorted_types[5:]

    request_types_data = [{'name': name, 'score': score} for name, score in top_5_types]

    if other_types:
        other_score = sum(score for _, score in other_types)
        # Le tooltip sera généré côté client, on envoie juste les détails
        other_details = [{'name': name, 'score': score} for name, score in other_types]
        request_types_data.append({'name': 'Autre', 'score': other_score, 'details': other_details})


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
    jql_cr = f'project = {proj} AND assignee IN ({assignees_str}) AND created > -30d'
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
    jql_unresolved = f'project = {proj} AND assignee IN ({assignees_str}) AND created > -30d AND status != Closed'
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
    jql_closed = f'project = {proj} AND assignee IN ({assignees_str}) AND labels = "RelanceClose" AND resolved < -30d'
    closed = len(fetch_jira_issues(jql_closed, fields='labels'))

    # Stockage en base
    stats = {
        'total_tickets': total_tickets,
        'total_open_tickets': tickets_open,
        'tickets_closed': tickets_closed,
        'support_health': support_health,
        'support_health_label': support_health_label,
        'progress': progress,
        'request_types': request_types_data,
        'workload': request_types_data, # Gardé pour compatibilité si l'ancien nom est utilisé ailleurs
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

from functools import wraps

def admin_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentification requise'}), 401
        
        # Vérifier si l'utilisateur est admin
        user = users_collection.find_one({
            '$or': [
                {'username': session['user']},
                {'email': session['user']}
            ]
        })
        
        if not user or user.get('role') != 'admin':
            return jsonify({'error': 'Accès non autorisé'}), 403
            
        return f(*args, **kwargs)
    return decorated_function

def login_required(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        if 'user' not in session:
            return jsonify({'error': 'Authentification requise'}), 401
        return f(*args, **kwargs)
    return decorated_function

# --- ROUTES QUI LISENT LA DB ---
def get_default_stats_id():
    """Computes the default ID for stats based on .env config."""
    proj = os.getenv("JIRA_PROJECT_DEFAULT", "HEL")
    assignees_list = os.getenv("JIRA_ASSIGNEES", "").split(",")
    return f"{proj}_{'_'.join(assignees_list)}"

@app.route('/api/kpis')
@login_required
def api_kpis():
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
@login_required
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
@login_required
def get_chart_created_vs_resolved():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    return jsonify(stats.get('created_vs_resolved', {}))

@app.route('/tickets_by_department')
@login_required
def get_chart_by_department():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    return jsonify(stats.get('department_counts', {}))

@app.route('/tickets_by_label')
@login_required
def get_chart_by_label():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    return jsonify(stats.get('label_counts', {}))

@app.route('/tickets_by_status')
@login_required
def get_chart_by_status():
    id_key = get_default_stats_id()
    stats = mongo_stats.find_one({'_id': id_key}) or {}
    return jsonify(stats.get('status_counts', {}))

# --- ROUTE DE TEST POUR FORCER LA MISE À JOUR DES STATS ---
@app.route('/api/update_stats')
@login_required
def api_update_stats():
    threading.Thread(target=update_dashboard_stats).start()
    return jsonify({'status': 'Mise à jour des stats lancée'}), 202

# --- ROUTE POUR TESTER LA CONNEXION À JIRA ---
@app.route('/api/jira/test')
@login_required
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
@login_required
def api_reports():
    start = request.args.get('startDate')
    end = request.args.get('endDate')
    if not start or not end:
        return jsonify({'error':'Paramètres startDate et endDate requis'}),400
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    proj = JIRA_PROJECT_DEFAULT
    
    # Labels
    jql_labels = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate >= {start} AND createdDate <= {end} AND status = Closed'
    issues_labels = fetch_jira_issues(jql_labels, fields='labels')
    label_counts = Counter()
    for t in issues_labels:
        for l in t['fields'].get('labels',[]): label_counts[l]+=1

    # Statuses
    jql_status = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate >= {start} AND createdDate <= {end}'
    issues_status = fetch_jira_issues(jql_status, fields='status')
    status_counts = Counter()
    for t in issues_status:
        s = t['fields'].get('status',{}).get('name','Inconnu'); status_counts[s]+=1

    # Departments
    jql_dept = f'project = {proj} AND assignee IN ({assignees_str}) AND createdDate >= {start} AND createdDate <= {end}'
    issues_dept = fetch_jira_issues(jql_dept, fields='customfield_12002')
    dept_counts = Counter()
    for t in issues_dept:
        d = t['fields'].get('customfield_12002')
        if isinstance(d,dict): v=d.get('value','Autre')
        else: v='Autre'
        dept_counts[v]+=1
    # Formatter les données pour correspondre à la structure attendue par le front-end
    report_sheets = [
        {
            "name": "Par Étiquette",
            "columns": ["Étiquette", "Nombre"],
            "data": list(label_counts.items())
        },
        {
            "name": "Par Statut",
            "columns": ["Statut", "Nombre"],
            "data": list(status_counts.items())
        },
        {
            "name": "Par Pôle",
            "columns": ["Pôle", "Nombre"],
            "data": list(dept_counts.items())
        }
    ]
    return jsonify(report_sheets)

@app.route('/api/projects')
def api_projects():
    # Liste des projets Jira accessiblse
    url = f"{JIRA_URL.rstrip('/')}/rest/api/3/project/search?orderBy=key"
    resp = requests.get(url, auth=(JIRA_USERNAME, JIRA_TOKEN))
    if resp.status_code != 200:
        return jsonify({'error':'jira error','details':resp.text}), resp.status_code
    data = resp.json().get('values', [])
    return jsonify([{ 'key': p.get('key'), 'name': p.get('name') } for p in data])

@app.route('/api/tickets/recent')
@admin_required
def api_tickets_recent():
    """Retourne les tickets des 30 derniers jours"""
    projectKey = os.getenv('JIRA_PROJECT_DEFAULT', JIRA_PROJECT_DEFAULT)
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    jql = f'project = {projectKey} AND assignee IN ({assignees_str}) AND status = Closed AND resolved >= -30d ORDER BY created DESC'
    issues = fetch_jira_issues(jql, fields='key,summary,status,assignee,created,updated')
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

@app.route('/api/tickets/all')
@admin_required
def api_tickets_all():
    """Retourne tous les tickets sans limite de date"""
    projectKey = os.getenv('JIRA_PROJECT_DEFAULT', JIRA_PROJECT_DEFAULT)
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    jql = f'project = {projectKey} AND assignee IN ({assignees_str}) AND status != Closed ORDER BY created DESC'
    issues = fetch_jira_issues(jql, fields='key,summary,status,assignee,created,updated')
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

@app.route('/api/export/drive', methods=['POST'])
@login_required
def export_to_drive():
   if 'file' not in request.files:
       return jsonify({'error': 'Aucun fichier fourni'}), 400
   
   folder_id = request.form.get('folderId')
   file_name = request.form.get('fileName')
   
   if not folder_id or not file_name:
       return jsonify({'error': 'ID du dossier et nom du fichier requis'}), 400

   file_storage = request.files['file']
   
   # Lire le contenu du fichier en mémoire
   file_content = file_storage.read()
   
   credentials_path = os.getenv('GOOGLE_API_CREDENTIALS_PATH')
   if not credentials_path or not os.path.exists(credentials_path):
       print(f"Erreur: Le fichier de credentials '{credentials_path}' est introuvable.")
       return jsonify({'error': 'Configuration du serveur Google Drive incomplète.'}), 500

   try:
       creds = service_account.Credentials.from_service_account_file(
           credentials_path,
           scopes=['https://www.googleapis.com/auth/drive']
       )
       service = build('drive', 'v3', credentials=creds)
       
       file_metadata = {
           'name': file_name,
           'parents': [folder_id]
       }
       
       media = MediaIoBaseUpload(
           io.BytesIO(file_content),
           mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
           resumable=True
       )
       
       file = service.files().create(
           body=file_metadata,
           media_body=media,
           fields='id, webViewLink'
       ).execute()
       
       print(f"Fichier uploadé avec succès. ID: {file.get('id')}")
       
       return jsonify({
           'success': True,
           'file_id': file.get('id'),
           'file_url': file.get('webViewLink')
       })

   except Exception as e:
       print(f"Erreur lors de l'export vers Google Drive: {e}")
       return jsonify({'error': f'Une erreur est survenue: {e}'}), 500

@app.route('/api/stats/relance/current')
def api_stats_relance_current():
    """Statistiques de relance pour la période courante (30 derniers jours)"""
    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    proj = JIRA_PROJECT_DEFAULT
    
    # Tickets relancés dans les 30 derniers jours
    jql_relanced = f'project = {proj} AND assignee IN ({assignees_str}) AND labels = RelanceEnvoyee AND createdDate >= -30d'
    relanced_issues = fetch_jira_issues(jql_relanced, fields='id')
    relanced_count = len(relanced_issues)

    # Nombre de tickets totaux fermés dans les 30 derniers jours
    jql_total = f'project = {proj} AND assignee IN ({assignees_str}) AND status = Closed AND createdDate >= -30d'
    total_issues = fetch_jira_issues(jql_total, fields='id')
    total_count = len(total_issues)

    # Tickets clôturés avec relance
    jql_closed_with_relance = f'project = {proj} AND assignee IN ({assignees_str}) AND labels = "RelanceClose" AND resolved < -30d'
    closed_with_relance_issues = fetch_jira_issues(jql_closed_with_relance, fields='id')
    closed_with_relance_count = len(closed_with_relance_issues)

    # Calcul du pourcentage
    if relanced_count > 0:
        percentage = (relanced_count / total_count) * 100
    else:
        percentage = 0

    return jsonify({
        'relanced_tickets': relanced_count,
        'closed_with_relance': closed_with_relance_count,
        'total_tickets': total_count,
        'percentage': percentage
    })

@app.route('/api/stats/relance/period')
def api_stats_relance_period():
    """Statistiques de relance pour une période personnalisée"""
    start = request.args.get('startDate')
    end = request.args.get('endDate')
    if not start or not end:
        return jsonify({'error': 'Paramètres startDate et endDate requis'}), 400

    assignees_str = ','.join([f'"{a}"' for a in JIRA_ASSIGNEES])
    proj = JIRA_PROJECT_DEFAULT
    
    # Tickets relancés dans la période
    jql_relanced = f'project = {proj} AND assignee IN ({assignees_str}) AND labels = RelanceEnvoyee AND createdDate >= "{start}" AND createdDate <= "{end}"'
    relanced_issues = fetch_jira_issues(jql_relanced, fields='id')
    relanced_count = len(relanced_issues)

    # Nombre de tickets totaux fermés dans la période
    jql_total = f'project = {proj} AND assignee IN ({assignees_str}) AND status = Closed AND createdDate >= "{start}" AND createdDate <= "{end}"'
    total_issues = fetch_jira_issues(jql_total, fields='id')
    total_count = len(total_issues)

    # Tickets clôturés avec relance dans la période
    jql_closed_with_relance = f'project = {proj} AND assignee IN ({assignees_str}) AND labels = "RelanceClose" AND resolved >= "{start}" AND resolved <= "{end}"'
    closed_with_relance_issues = fetch_jira_issues(jql_closed_with_relance, fields='id')
    closed_with_relance_count = len(closed_with_relance_issues)

    # Calcul du pourcentage
    if relanced_count > 0:
        percentage = (relanced_count / total_count) * 100
    else:
        percentage = 0

    return jsonify({
        'relanced_tickets': relanced_count,
        'closed_with_relance': closed_with_relance_count,
        'total_tickets': total_count,
        'percentage': percentage
    })

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
@login_required
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
@login_required
def get_users():
    users = list(users_collection.find())
    return jsonify([user_to_dict(u) for u in users])

@app.route('/api/users', methods=['POST'])
@admin_required
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
@login_required
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
@login_required
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

# --- GET GOOGLE DRIVE EMAIL ---
@app.route('/api/get-google-drive-email')
def get_google_drive_email():
    """Retourne l'email du compte Google Drive configuré."""
    google_drive_email = os.getenv('GOOGLE_DRIVE_SHARE_EMAIL')
    return jsonify({"email": google_drive_email})

@app.route('/api/restart', methods=['POST'])
@admin_required
def restart_server():
    """Redémarre le serveur Python via une commande système"""
    try:
        # Envoyer une réponse au client avant de redémarrer
        response = jsonify({"success": True, "message": "Serveur en cours de redémarrage"})
        response.status_code = 200
        
        def restart_logic():
            time.sleep(1)  # Attendre avant de redémarrer
            if os.name == 'nt':
                os.system(f'start /B python {os.path.abspath(__file__)}')
                os._exit(0)
            else:
                os.system(f'nohup python {os.path.abspath(__file__)} &')
                os._exit(0)
        
        threading.Thread(target=restart_logic).start()
        return response
    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500

@app.route('/api/restart', methods=['OPTIONS'])
def restart_server_options():
    """Gère les requêtes OPTIONS pour /api/restart"""
    response = jsonify({'success': True})
    response.headers.add('Access-Control-Allow-Methods', 'POST, OPTIONS')
    response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
    response.headers.add('Access-Control-Allow-Origin', '*')
    return response

if __name__ == '__main__':
    load_dotenv()
    PORT = int(os.getenv("PORT", 80))
    # --- DÉBUT DE L'APPLICATION ---
    print(f"[Serveur] Démarrage du serveur de production sur http://0.0.0.0:{PORT}")
    # Lancement du worker dans un thread séparé
    worker_thread = threading.Thread(target=stats_update_worker, daemon=True)
    worker_thread.start()
    serve(app, host="0.0.0.0", port=PORT, threads=10)