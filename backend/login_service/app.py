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

@app.route('/login', methods=['POST'])
def login():
    data = request.get_json() or {}
    username = data.get('username')
    password = data.get('password')

    if not username or not password:
        return jsonify({'error': 'Faltan credenciales'}), 400

    if keycloak_openid is not None:
        try:
            token = keycloak_openid.token(username, password)
            access = token.get('access_token')
            
            if jwt is None:
                return jsonify({'error': "Server error: missing dependency 'PyJWT'. Run: pip install PyJWT"}), 500

            # Decodificar token para obtener el rol
            decoded = jwt.decode(access, options={"verify_signature": False})
            
            # 🔍 DEBUG: Ver estructura completa del token
            print("=" * 80)
            print("TOKEN DECODIFICADO COMPLETO:")
            print(json.dumps(decoded, indent=2))
            print("=" * 80)
            
            # Extraer rol del token (buscar en realm_access Y resource_access)
            role = None
            
            # 1. Buscar en realm roles (roles globales del realm)
            if 'realm_access' in decoded and 'roles' in decoded['realm_access']:
                realm_roles = decoded['realm_access']['roles']
                print(f"Realm roles encontrados: {realm_roles}")
                for r in ['administrador', 'docente', 'estudiante']:
                    if r in realm_roles:
                        role = r
                        break

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)%   