from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import datetime
import json
try:
    from keycloak import KeycloakOpenID
    import jwt
except Exception:
    KeycloakOpenID = None
    jwt = None

app = Flask(__name__)
app.secret_key = os.getenv('APP_SECRET', 'plataforma_secret')
CORS(app)

# Keycloak configuration (from env)
KEYCLOAK_SERVER = os.getenv('KEYCLOAK_SERVER_URL', 'http://localhost:8082')
KEYCLOAK_CLIENT_ID = os.getenv('KEYCLOAK_CLIENT_ID', '01')
KEYCLOAK_REALM = os.getenv('KEYCLOAK_REALM', 'plataformaInstitucional')
KEYCLOAK_CLIENT_SECRET = os.getenv('KEYCLOAK_CLIENT_SECRET', 'wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz')

keycloak_openid = None
if KeycloakOpenID is not None:
    try:
        keycloak_openid = KeycloakOpenID(
            server_url=KEYCLOAK_SERVER,
            client_id=KEYCLOAK_CLIENT_ID,
            realm_name=KEYCLOAK_REALM,
            client_secret_key=KEYCLOAK_CLIENT_SECRET
        )
    except Exception:
        keycloak_openid = None


@app.route('/')
def home():
    return jsonify({
        'service': 'Login Service',
        'version': '1.0.0',
        'endpoints': {
            'login': 'POST /login',
            'logout': 'GET /logout',
            'health': 'GET /health'
        }
    })


@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'login'})