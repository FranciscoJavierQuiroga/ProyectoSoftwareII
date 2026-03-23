from flask import Flask, request, jsonify, g
from flask_cors import CORS
from datetime import datetime
from keycloak import KeycloakOpenID
from functools import wraps
import sys
import os
from bson.timestamp import Timestamp

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_cursos_collection,
    get_usuarios_collection,
    get_matriculas_collection,
    serialize_doc,
    string_to_objectid,
    registrar_auditoria
)

app = Flask(__name__)
app.secret_key = "PlataformaColegios"

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

# ...existing code...

keycloak_openid = KeycloakOpenID(
    server_url="http://localhost:8082",
    client_id="01",
    realm_name="platamaformaInstitucional",
    client_secret_key="wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz"
)

def tiene_rol(token_info, cliente_id, rol_requerido):
    try:
        # Revisar roles a nivel de realm
        realm_roles = token_info.get("realm_access", {}).get("roles", [])
        if rol_requerido in realm_roles:
            return True

        # Revisar roles a nivel de cliente (resource_access)
        resource_roles = token_info.get("resource_access", {}).get(cliente_id, {}).get("roles", [])
        if rol_requerido in resource_roles:
            return True

        return False
    except Exception:
        return False

def token_required(rol_requerido):
    def decorator(f):
        @wraps(f)
        def decorated(*args, **kwargs):
            auth_header = request.headers.get('Authorization', None)
            if not auth_header:
                print("❌ No se encontró header Authorization")
                return jsonify({"error": "Token Requerido"}), 401
            
            try:
                token = auth_header.split(" ")[1]
                print(f"🔑 Token recibido: {token[:50]}...")
                
                # Intentar decodificar con Keycloak
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
                    
                except Exception as decode_error:
                    print(f"⚠️ Error con Keycloak: {decode_error}")
                    import jwt as pyjwt
                    userinfo = pyjwt.decode(token, options={"verify_signature": False})
                    print("⚠️ Fallback a decodificación sin firma")
                    
            except Exception as e:
                print(f"❌ Error procesando token: {e}")
                return jsonify({"error": "Token inválido o expirado"}), 401
            
            if not tiene_rol(userinfo, keycloak_openid.client_id, rol_requerido):
                print(f"❌ Acceso denegado: se requiere rol '{rol_requerido}'")
                return jsonify({"error": f"Acceso denegado: se requiere el rol '{rol_requerido}'"}), 403
            
            print(f"✅ Acceso permitido para rol '{rol_requerido}'")
            g.userinfo = userinfo
            return f(*args, **kwargs)
        
        return decorated
    return decorator

@app.route('/')
def home():
    return jsonify({
        'service': 'Groups Service',
        'version': '2.0.0',
        'database': 'MongoDB',
        'endpoints': {
            'get_all': 'GET /groups',
            'get_one': 'GET /groups/{id}',
            'create': 'POST /groups',
            'update': 'PUT /groups/{id}',
            'delete': 'DELETE /groups/{id}',
            'students': 'GET /groups/{id}/students',
            'add_student': 'POST /groups/{id}/students',
            'remove_student': 'DELETE /groups/{id}/students/{student_id}'
        }
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'groups', 'database': 'MongoDB'})

@app.route('/groups', methods=['GET'])
def get_groups():
    """Obtener todos los grupos/cursos"""
    try:
        cursos = get_cursos_collection()
        
        # Filtros opcionales
        grado = request.args.get('grado') or request.args.get('grade_level')
        periodo = request.args.get('periodo')
        subject = request.args.get('subject')
        teacher_id = request.args.get('teacher_id')
        status = request.args.get('status')
        
        # Construir query
        query = {}
        
        if grado:
            query['grado'] = grado
        if periodo:
            query['periodo'] = periodo
        if subject:
            query['especialidad'] = {'$regex': subject, '$options': 'i'}
        if teacher_id:
            obj_id = string_to_objectid(teacher_id)
            if obj_id:
                query['id_docente'] = obj_id
        if status:
            query['activo'] = (status.lower() == 'active')
        
        # Buscar cursos
        grupos = list(cursos.find(query))
        
        # Serializar documentos
        grupos_serializados = serialize_doc(grupos)
        
        return jsonify({
            'success': True,
            'groups': grupos_serializados,
            'count': len(grupos_serializados)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/groups/<group_id>', methods=['GET'])
def get_group(group_id):
    """Obtener un grupo específico"""
    try:
        cursos = get_cursos_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(group_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Buscar curso
        grupo = cursos.find_one({'_id': obj_id})
        
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        return jsonify({
            'success': True,
            'group': serialize_doc(grupo)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/groups', methods=['POST'])
def create_group():
    """Crear un nuevo grupo/curso"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['nombre_curso', 'codigo_curso', 'periodo']
        for field in required_fields:
            if field not in data or not data[field]:
                # Soporte para nombres alternativos
                if field == 'nombre_curso' and 'name' in data:
                    data['nombre_curso'] = data['name']
                else:
                    return jsonify({
                        'success': False,
                        'error': f'El campo {field} es requerido'
                    }), 400

        cursos = get_cursos_collection()
        
        # Verificar si el código de curso ya existe
        if cursos.find_one({'codigo_curso': data['codigo_curso']}):
            return jsonify({
                'success': False,
                'error': 'El código de curso ya está registrado'
            }), 400
        
        # Crear documento del curso
        nuevo_curso = {
            'nombre_curso': data['nombre_curso'],
            'codigo_curso': data['codigo_curso'],
            'periodo': data['periodo'],
            'activo': data.get('activo', True) if 'activo' in data else (data.get('status') == 'active')
        }
        
        # Campos opcionales
        if 'grado' in data:
            nuevo_curso['grado'] = data['grado']
        elif 'grade_level' in data:
            nuevo_curso['grado'] = data['grade_level']
            
        if 'capacidad_max' in data:
            nuevo_curso['capacidad_max'] = int(data['capacidad_max'])
        elif 'max_students' in data:
            nuevo_curso['capacidad_max'] = int(data['max_students'])
        
        # Si se proporciona un docente
        teacher_id = data.get('id_docente') or data.get('teacher_id')
        if teacher_id:
            docente_id = string_to_objectid(teacher_id)
            if docente_id:
                nuevo_curso['id_docente'] = docente_id
                
                # Obtener datos del docente para denormalizar
                usuarios = get_usuarios_collection()
                docente = usuarios.find_one({'_id': docente_id, 'rol': 'docente'})
                
                if docente:
                    nuevo_curso['docente_info'] = {
                        'nombres': docente.get('nombres'),
                        'apellidos': docente.get('apellidos'),
                        'especialidad': docente.get('especialidad')
                    }
        
        # Insertar en la base de datos
        resultado = cursos.insert_one(nuevo_curso)
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='crear_curso',
            entidad_afectada='cursos',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Curso creado: {data['nombre_curso']}"
        )
        
        # Obtener el documento insertado
        curso_creado = cursos.find_one({'_id': resultado.inserted_id})
        
        return jsonify({
            'success': True,
            'message': 'Grupo creado exitosamente',
            'group': serialize_doc(curso_creado)
        }), 201
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/groups/<group_id>', methods=['PUT'])
def update_group(group_id):
    """Actualizar un grupo"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        cursos = get_cursos_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(group_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el grupo existe
        grupo_existente = cursos.find_one({'_id': obj_id})
        if not grupo_existente:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        # Preparar datos para actualizar
        campos_no_modificables = {'_id', 'codigo_curso'}
        datos_actualizacion = {}
        
        # Mapear nombres de campos alternativos
        field_mapping = {
            'name': 'nombre_curso',
            'grade_level': 'grado',
            'max_students': 'capacidad_max',
            'status': 'activo'
        }
        
        for key, value in data.items():
            if key in campos_no_modificables:
                continue
            mapped_key = field_mapping.get(key, key)
            
            # Convertir status a activo
            if key == 'status':
                datos_actualizacion['activo'] = (value == 'active')
            else:
                datos_actualizacion[mapped_key] = value
        
        # Si se actualiza el docente
        teacher_id = data.get('id_docente') or data.get('teacher_id')
        if teacher_id:
            docente_id = string_to_objectid(teacher_id)
            if docente_id:
                datos_actualizacion['id_docente'] = docente_id
                
                # Actualizar datos denormalizados del docente
                usuarios = get_usuarios_collection()
                docente = usuarios.find_one({'_id': docente_id, 'rol': 'docente'})
                
                if docente:
                    datos_actualizacion['docente_info'] = {
                        'nombres': docente.get('nombres'),
                        'apellidos': docente.get('apellidos'),
                        'especialidad': docente.get('especialidad')
                    }
        
        # Actualizar
        if datos_actualizacion:
            resultado = cursos.update_one(
                {'_id': obj_id},
                {'$set': datos_actualizacion}
            )
            
            if resultado.modified_count > 0:
                # Registrar en auditoría
                registrar_auditoria(
                    id_usuario=None,
                    accion='actualizar_curso',
                    entidad_afectada='cursos',
                    id_entidad=group_id,
                    detalles=f"Campos actualizados: {', '.join(datos_actualizacion.keys())}"
                )
        
        # Obtener documento actualizado
        grupo_actualizado = cursos.find_one({'_id': obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Grupo actualizado exitosamente',
            'group': serialize_doc(grupo_actualizado)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500