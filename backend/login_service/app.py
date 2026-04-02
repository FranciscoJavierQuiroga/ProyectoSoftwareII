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


@app.route('/logout')
def logout():
    return jsonify({'message': 'Sesión cerrada'}), 200


def create_mock_jwt(username: str, role: str) -> str:
    """Genera un JWT mock para desarrollo sin Keycloak"""
    if jwt is None:
        return f'mock_token_{username}'
    
    payload = {
        'sub': username,
        'role': role,
        'username': username,
        'exp': datetime.datetime.utcnow() + datetime.timedelta(hours=8),
        'iat': datetime.datetime.utcnow(),
        'iss': 'mock-login-service',
        'realm_access': {
            'roles': [role]
        }
    }
    
    # Firmar con secret del app (en producción usar clave pública/privada)
    token = jwt.encode(payload, app.secret_key, algorithm='HS256')
    return token

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
             # 2. Si no se encuentra, buscar en client roles (roles específicos del cliente)
            if not role and 'resource_access' in decoded:
                print(f"Resource access keys: {list(decoded['resource_access'].keys())}")
                
                # Buscar en el cliente actual
                if KEYCLOAK_CLIENT_ID in decoded['resource_access']:
                    client_roles = decoded['resource_access'][KEYCLOAK_CLIENT_ID].get('roles', [])
                    print(f"Client roles para '{KEYCLOAK_CLIENT_ID}': {client_roles}")
                    for r in ['administrador', 'docente', 'estudiante']:
                        if r in client_roles:
                            role = r
                            break
                
                # Si aún no se encuentra, buscar en todos los clientes
                if not role:
                    for client_id, client_data in decoded['resource_access'].items():
                        client_roles = client_data.get('roles', [])
                        print(f"Roles en cliente '{client_id}': {client_roles}")
                        for r in ['administrador', 'docente', 'estudiante']:
                            if r in client_roles:
                                role = r
                                break
                        if role:
                            break

            print(f"Rol final detectado: {role}")
            
            return jsonify({
                'access_token': access,
                'refresh_token': token.get('refresh_token'),
                'expires_in': token.get('expires_in'),
                'token_type': 'Bearer',
                'role': role
            }), 200

        except Exception as e:
            print(f"Error en login: {str(e)}")
            import traceback
            traceback.print_exc()
            return jsonify({'error': str(e)}), 401

    if username == 'admin' and password == 'admin':
        mock_token = create_mock_jwt('admin', 'administrador')
        return jsonify({
            'access_token': mock_token,
            'role': 'administrador'
        }), 200

    if password == 'devpass':
        role = 'estudiante'
        if 'teacher' in username or 'profesor' in username:
            role = 'docente'
        elif 'admin' in username:
            role = 'administrador'

        mock_token = create_mock_jwt(username, role)
        return jsonify({
            'access_token': mock_token,
            'role': role
        }), 200

    return jsonify({'error': 'Credenciales inválidas'}), 401


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)