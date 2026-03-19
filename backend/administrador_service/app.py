from flask import Flask, request, jsonify, g
from flask_cors import CORS
from keycloak import KeycloakOpenID
from functools import wraps
import sys
import os
import jwt as pyjwt
from datetime import datetime
from bson.timestamp import Timestamp

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_usuarios_collection,
    get_cursos_collection,
    get_matriculas_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

app = Flask(__name__)
app.secret_key = "admin_secret_key"

# 🔧 CORS CONFIGURACIÓN COMPLETA
CORS(app, resources={
    r"/*": {
        "origins": ["http://localhost:4200"],
        "methods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"],
        "expose_headers": ["Content-Type", "Authorization"],
        "supports_credentials": True
    }
})
@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        response = app.make_default_options_response()
        headers = {
            'Access-Control-Allow-Origin': 'http://localhost:4200',
            'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, Authorization',
            'Access-Control-Max-Age': '3600'
        }
        response.headers.update(headers)
        return response

# Keycloak config
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


def tiene_rol(token_info, cliente_id, rol_requerido):
    """Comprueba si los claims del token contienen el rol requerido.

    Busca tanto en realm_access como en resource_access[cliente_id].
    """
    try:
        # 1. Buscar en realm_access (roles globales del realm)
        realm_roles = token_info.get('realm_access', {}).get('roles', [])
        if rol_requerido in realm_roles:
            print(f"✓ Rol '{rol_requerido}' encontrado en realm_access")
            return True
        
        # 2. Buscar en resource_access para el cliente específico
        if cliente_id and cliente_id in token_info.get('resource_access', {}):
            client_roles = token_info.get('resource_access', {}).get(cliente_id, {}).get('roles', [])
            if rol_requerido in client_roles:
                print(f"✓ Rol '{rol_requerido}' encontrado en resource_access[{cliente_id}]")
                return True
        
        # 3. Buscar en TODOS los clientes (fallback)
        resource_access = token_info.get('resource_access', {})
        for client_id, client_data in resource_access.items():
            client_roles = client_data.get('roles', [])
            if rol_requerido in client_roles:
                print(f"✓ Rol '{rol_requerido}' encontrado en resource_access[{client_id}]")
                return True
        
        print(f"✗ Rol '{rol_requerido}' NO encontrado. Realm roles: {realm_roles}, Resource access: {list(resource_access.keys())}")
        return False
        
    except Exception as e:
        print(f"Error al verificar rol: {e}")
        import traceback
        traceback.print_exc()
        return False


def token_required(rol_requerido):
    """Decorador que valida la presencia del token y del rol requerido."""
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            # Modo desarrollo: permitir token mock
            if keycloak_openid is None:
                auth = request.headers.get('Authorization', '')
                if auth.startswith('Bearer mock-access-token') or auth.startswith('Bearer mock-token-for-admin'):
                    g.userinfo = {'sub': 'admin', 'roles': ['administrador']}
                    return f(*args, **kwargs)
                return jsonify({'error': 'Keycloak no configurado'}), 500

            auth_header = request.headers.get('Authorization', None)
            if not auth_header:
                print("✗ No se encontró header Authorization")
                return jsonify({'error': 'Token Requerido'}), 401
                
            try:
                token = auth_header.split(' ')[1]
                print(f"🔑 Token recibido: {token[:50]}...")
                
                # Intentar decodificar con Keycloak (modo producción)
                try:
                    public_key_pem = f"-----BEGIN PUBLIC KEY-----\n{keycloak_openid.public_key()}\n-----END PUBLIC KEY-----"
                    
                    userinfo = keycloak_openid.decode_token(
                        token,
                        key=public_key_pem,
                        options={
                            "verify_signature": True,
                            "verify_aud": False,
                            "verify_exp": True
                        }
                    )
                    print(f"✅ Token decodificado con Keycloak")
                    print(f"   Usuario: {userinfo.get('preferred_username', 'N/A')}")
                    print(f"   Email: {userinfo.get('email', 'N/A')}")
                    
                except Exception as decode_error:
                    print(f"⚠️ Error decodificando con Keycloak: {decode_error}")
                    # Fallback: decodificar sin verificar firma
                    userinfo = pyjwt.decode(token, options={"verify_signature": False})
                    print("⚠️ Token decodificado SIN verificar firma (modo desarrollo)")
                
            except pyjwt.ExpiredSignatureError:
                print("✗ Token expirado")
                return jsonify({'error': 'Token expirado'}), 401
            except pyjwt.InvalidTokenError as e:
                print(f"✗ Token inválido: {e}")
                return jsonify({'error': 'Token inválido'}), 401
            except Exception as e:
                print(f"✗ Error al decodificar token: {e}")
                import traceback
                traceback.print_exc()
                return jsonify({'error': 'Token inválido o expirado'}), 401
                
            if not tiene_rol(userinfo, KEYCLOAK_CLIENT_ID, rol_requerido):
                print(f"✗ Acceso denegado: se requiere rol '{rol_requerido}'")
                return jsonify({'error': f"Acceso denegado: se requiere el rol '{rol_requerido}'"}), 403

            g.userinfo = userinfo
            return f(*args, **kwargs)
        
        return decorated
    return decorator

@app.route('/')
def home():
    return jsonify({
        'service': 'Administrator Service',
        'version': '2.0.0',
        'database': 'MongoDB'
    })


@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'administrator', 'database': 'MongoDB'})


@app.route('/dashboard')
@token_required('administrador')
def dashboard():
    # ejemplo original para administradores (mantener compatibilidad)
    return jsonify({'message': 'Administrator dashboard', 'time': datetime.utcnow().isoformat() + 'Z'})


@app.route('/admin/pending-tasks')
@token_required('administrador')
def admin_pending_tasks():
    """Tareas pendientes del administrador"""
    try:
        matriculas = get_matriculas_collection()
        usuarios = get_usuarios_collection()
        
        # Contar matrículas pendientes (ejemplo: estado = 'pendiente')
        pending_enrollments = matriculas.count_documents({'estado': 'pendiente'})
        
        # Contar usuarios inactivos que necesitan revisión
        inactive_users = usuarios.count_documents({'activo': False})
        
        tasks = [
            {
                'id': 't1',
                'title': 'Revisión de matrículas pendientes',
                'count': pending_enrollments,
                'severity': 'urgent' if pending_enrollments > 10 else 'normal'
            },
            {
                'id': 't2',
                'title': 'Aprobación de certificados',
                'count': 8,  # Mock por ahora
                'severity': 'normal'
            },
            {
                'id': 't3',
                'title': 'Validación de documentos',
                'count': inactive_users,
                'severity': 'normal'
            },
            {
                'id': 't4',
                'title': 'Asignación de docentes',
                'count': 5,  # Mock por ahora
                'severity': 'urgent'
            }
        ]
        
        return jsonify({'tasks': tasks}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    

@app.route('/admin/campuses')
@token_required('administrador')
def admin_campuses():
    """Información de sedes (mock mejorado con datos reales en futuro)"""
    try:
        usuarios = get_usuarios_collection()
        
        # Por ahora mock, pero podrías agregar un campo 'sede' en usuarios
        total_students = usuarios.count_documents({'rol': 'estudiante', 'activo': True})
        
        campuses = [
            {
                'name': 'Sede Principal',
                'students': int(total_students * 0.45),
                'occupancy_pct': 89,
                'status': 'Activa'
            },
            {
                'name': 'Sede Norte',
                'students': int(total_students * 0.35),
                'occupancy_pct': 76,
                'status': 'Activa'
            },
            {
                'name': 'Sede Sur',
                'students': int(total_students * 0.20),
                'occupancy_pct': 45,
                'status': 'Activa'
            }
        ]
        
        return jsonify({'campuses': campuses}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/recent-stats')
@token_required('administrador')
def admin_recent_stats():
    """Estadísticas recientes de matrículas"""
    try:
        matriculas = get_matriculas_collection()
        
        # Agregación por mes (últimos 3 meses)
        pipeline = [
            {
                '$match': {
                    'fecha_matricula': {'$exists': True}
                }
            },
            {
                '$project': {
                    'year': {'$year': '$fecha_matricula'},
                    'month': {'$month': '$fecha_matricula'},
                    'estado': 1
                }
            },
            {
                '$group': {
                    '_id': {
                        'year': '$year',
                        'month': '$month'
                    },
                    'total': {'$sum': 1},
                    'activas': {
                        '$sum': {'$cond': [{'$eq': ['$estado', 'activo']}, 1, 0]}
                    },
                    'retiradas': {
                        '$sum': {'$cond': [{'$eq': ['$estado', 'retirado']}, 1, 0]}
                    }
                }
            },
            {
                '$sort': {'_id.year': -1, '_id.month': -1}
            },
            {
                '$limit': 3
            }
        ]
        
        results = list(matriculas.aggregate(pipeline))
        
        # Formatear resultados
        month_names = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic']
        recent = []
        
        for r in results:
            month_num = r['_id']['month']
            year = r['_id']['year']
            recent.append({
                'month': f"{month_names[month_num-1]} {year}",
                'enrollments': r.get('activas', 0),
                'dropouts': r.get('retiradas', 0),
                'avg': 4.1  # Mock, calcular promedio real si tienes calificaciones
            })
        
        # Si no hay datos, devolver mock
        if not recent:
            recent = [
                {'month': 'Nov 2024', 'enrollments': 45, 'dropouts': 3, 'avg': 4.1},
                {'month': 'Oct 2024', 'enrollments': 32, 'dropouts': 7, 'avg': 4.0},
                {'month': 'Sep 2024', 'enrollments': 52, 'dropouts': 5, 'avg': 4.2}
            ]
        
        return jsonify({'recent': recent}), 200
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/admin/statistics', methods=['GET'])
@token_required('administrador')
def get_statistics():
    """Obtener estadísticas completas del sistema"""
    try:
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        matriculas = get_matriculas_collection()
        
        # Contar usuarios por rol
        total_estudiantes = usuarios.count_documents({'rol': 'estudiante', 'activo': True})
        total_docentes = usuarios.count_documents({'rol': 'docente', 'activo': True})
        total_administradores = usuarios.count_documents({'rol': 'administrador', 'activo': True})
        
        # Contar cursos activos
        total_cursos = cursos.count_documents({'activo': True})
        
        # Contar matrículas activas
        total_matriculas = matriculas.count_documents({'estado': 'activo'})
        
        # Estadísticas por periodo
        periodos_stats = []
        for periodo in ['1', '2', '3', '4']:
            cursos_periodo = cursos.count_documents({'periodo': periodo, 'activo': True})
            periodos_stats.append({
                'periodo': periodo,
                'cursos': cursos_periodo
            })
        
        return jsonify({
            'success': True,
            'statistics': {
                'usuarios': {
                    'estudiantes': total_estudiantes,
                    'docentes': total_docentes,
                    'administradores': total_administradores,
                    'total': total_estudiantes + total_docentes + total_administradores
                },
                'cursos': {
                    'total': total_cursos,
                    'por_periodo': periodos_stats
                },
                'matriculas': {
                    'activas': total_matriculas
                }
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/users', methods=['GET'])
@token_required('administrador')
def get_all_users():
    """Obtener todos los usuarios del sistema"""
    try:
        usuarios = get_usuarios_collection()
        
        # Filtros opcionales
        rol = request.args.get('rol')
        status = request.args.get('status')
        
        # Construir query
        query = {}
        
        if rol:
            query['rol'] = rol
        if status:
            query['activo'] = (status.lower() == 'active')
        
        # Buscar usuarios
        users = list(usuarios.find(query))
        
        return jsonify({
            'success': True,
            'users': serialize_doc(users),
            'count': len(users)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/audit', methods=['GET'])
@token_required('administrador')
def get_audit_logs():
    """Obtener logs de auditoría"""
    try:
        auditoria = get_auditoria_collection()
        
        # Filtros opcionales
        accion = request.args.get('accion')
        entidad = request.args.get('entidad')
        limit = int(request.args.get('limit', 100))
        
        # Construir query
        query = {}
        
        if accion:
            query['accion'] = accion
        if entidad:
            query['entidad_afectada'] = entidad
        
        # Buscar logs ordenados por fecha descendente
        logs = list(auditoria.find(query).sort('fecha', -1).limit(limit))
        
        return jsonify({
            'success': True,
            'logs': serialize_doc(logs),
            'count': len(logs)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/reports', methods=['GET'])
@token_required('administrador')
def get_reports():
    """Obtener reportes generados"""
    try:
        reportes = get_reportes_collection()
        
        # Filtros opcionales
        tipo = request.args.get('tipo')
        limit = int(request.args.get('limit', 50))
        
        # Construir query
        query = {}
        
        if tipo:
            query['tipo_reporte'] = tipo
        
        # Buscar reportes ordenados por fecha descendente
        reports = list(reportes.find(query).sort('fecha_generado', -1).limit(limit))
        
        return jsonify({
            'success': True,
            'reports': serialize_doc(reports),
            'count': len(reports)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/users/<user_id>/status', methods=['PUT'])
@token_required('administrador')
def update_user_status(user_id):
    """Activar/Desactivar un usuario"""
    try:
        data = request.get_json()
        
        if not data or 'activo' not in data:
            return jsonify({'success': False, 'error': 'Se requiere el campo activo'}), 400
        
        usuarios = get_usuarios_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(user_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el usuario existe
        usuario = usuarios.find_one({'_id': obj_id})
        if not usuario:
            return jsonify({'success': False, 'error': 'Usuario no encontrado'}), 404
        
        # Actualizar estado
        resultado = usuarios.update_one(
            {'_id': obj_id},
            {'$set': {'activo': data['activo']}}
        )
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=g.get('userinfo', {}).get('sub'),
            accion='cambiar_estado_usuario',
            entidad_afectada='usuarios',
            id_entidad=user_id,
            detalles=f"Estado cambiado a: {'activo' if data['activo'] else 'inactivo'}"
        )
        
        return jsonify({
            'success': True,
            'message': f"Usuario {'activado' if data['activo'] else 'desactivado'} exitosamente"
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


@app.route('/admin/dashboard', methods=['GET'])
@token_required('administrador')
def get_dashboard():
    """Obtener datos para el dashboard administrativo"""
    try:
        usuarios = get_usuarios_collection()
        cursos = get_cursos_collection()
        matriculas = get_matriculas_collection()
        
        # Estadísticas rápidas
        stats = {
            'usuarios_activos': usuarios.count_documents({'activo': True}),
            'cursos_activos': cursos.count_documents({'activo': True}),
            'matriculas_activas': matriculas.count_documents({'estado': 'activo'}),
            'estudiantes_totales': usuarios.count_documents({'rol': 'estudiante', 'activo': True}),
            'docentes_totales': usuarios.count_documents({'rol': 'docente', 'activo': True})
        }
        
        # Cursos más populares (con más estudiantes)
        pipeline = [
            {'$match': {'estado': 'activo'}},
            {'$group': {
                '_id': '$id_curso',
                'total_estudiantes': {'$sum': 1},
                'curso_info': {'$first': '$curso_info'}
            }},
            {'$sort': {'total_estudiantes': -1}},
            {'$limit': 5}
        ]
        
        cursos_populares = list(matriculas.aggregate(pipeline))
        
        return jsonify({
            'success': True,
            'dashboard': {
                'statistics': stats,
                'popular_courses': serialize_doc(cursos_populares)
            }
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500


def _extract_roles_from_userinfo(userinfo):
    roles = set()
    # caso mock (g.userinfo puede contener 'roles')
    if isinstance(userinfo, dict):
        if 'roles' in userinfo and isinstance(userinfo.get('roles'), (list, tuple)):
            for r in userinfo.get('roles', []):
                roles.add(str(r))

        # realm access
        realm_roles = userinfo.get('realm_access', {}).get('roles', []) if userinfo.get('realm_access') else []
        for r in realm_roles:
            roles.add(str(r))

        # resource access: iterar recursos
        resource_access = userinfo.get('resource_access', {}) or {}
        for client, info in resource_access.items():
            for r in info.get('roles', []):
                roles.add(str(r))

    return roles


def _get_primary_role(userinfo):
    # prioridad: administrador > docente > estudiante
    roles = _extract_roles_from_userinfo(userinfo)
    if 'administrador' in roles or 'admin' in roles:
        return 'administrador'
    if 'docente' in roles or 'teacher' in roles:
        return 'docente'
    if 'estudiante' in roles or 'student' in roles:
        return 'estudiante'
    return None


def _extract_username(userinfo):
    if not isinstance(userinfo, dict):
        return None
    # common claim names
    return userinfo.get('preferred_username') or userinfo.get('username') or userinfo.get('sub')


def auth_required_any(f):
    """Decorador que exige autenticación (cualquier rol), útil para dashboards generales."""
    @wraps(f)
    def decorated(*args, **kwargs):
        # development mock if keycloak not configured
        allowed_roles = {'administrador', 'docente', 'estudiante'}
        if keycloak_openid is None:
            auth = request.headers.get('Authorization', '')
            if auth.startswith('Bearer mock-access-token'):
                g.userinfo = {'sub': 'dev-user', 'roles': ['estudiante']}
            elif auth.startswith('Bearer mock-token-for-admin'):
                g.userinfo = {'sub': 'admin', 'roles': ['administrador']}
            elif auth.startswith('Bearer mock-token-for-docente'):
                g.userinfo = {'sub': 'doc1', 'roles': ['docente']}
            else:
                return jsonify({'error': 'Keycloak no configurado o token mock faltante'}), 500

            # validar rol permitido
            primary = _get_primary_role(g.userinfo)
            if not primary or primary not in allowed_roles:
                return jsonify({'error': 'Acceso denegado: rol no autorizado', 'role': primary}), 403
            return f(*args, **kwargs)

        auth_header = request.headers.get('Authorization', None)
        if not auth_header:
            return jsonify({'error': 'Token Requerido'}), 401
        try:
            token = auth_header.split(' ')[1]
            userinfo = keycloak_openid.decode_token(token)
        except Exception:
            return jsonify({'error': 'Token inválido o expirado'}), 401

        # validar que el usuario tenga un rol reconocido y permitido
        primary = _get_primary_role(userinfo)
        if not primary or primary not in allowed_roles:
            return jsonify({'error': 'Acceso denegado: rol no autorizado', 'role': primary}), 403

        g.userinfo = userinfo
        return f(*args, **kwargs)

    return decorated


@app.route('/dashboard-general')
@auth_required_any
def dashboard_general():
    """Endpoint general que saluda según el rol del usuario autenticado.

    Responde con JSON: { message, role, user, time }
    """
    userinfo = getattr(g, 'userinfo', {}) or {}
    role = _get_primary_role(userinfo) or 'usuario'
    user = _extract_username(userinfo) or 'desconocido'
    mensaje = f"Bienvenido {role}" if role != 'usuario' else 'Bienvenido usuario'
    return jsonify({'message': mensaje, 'role': role, 'user': user, 'time': datetime.utcnow().isoformat() + 'Z'})


# Manejo de errores
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint no encontrado'}), 404


@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500
