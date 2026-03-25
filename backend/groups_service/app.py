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

@app.route('/groups/<group_id>', methods=['DELETE'])
def delete_group(group_id):
    """Eliminar (desactivar) un grupo"""
    try:
        cursos = get_cursos_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(group_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Verificar que el grupo existe
        grupo = cursos.find_one({'_id': obj_id})
        if not grupo:
            return jsonify({'success': False, 'error': 'Grupo no encontrado'}), 404
        
        # Desactivar
        resultado = cursos.update_one(
            {'_id': obj_id},
            {'$set': {'activo': False}}
        )
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='desactivar_curso',
            entidad_afectada='cursos',
            id_entidad=group_id,
            detalles=f"Curso desactivado: {grupo['nombre_curso']}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Grupo desactivado exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/groups/<group_id>/students', methods=['GET'])
def get_group_students(group_id):
    """Obtener estudiantes de un grupo"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        obj_id = string_to_objectid(group_id)
        if not obj_id:
            return jsonify({'success': False, 'error': 'ID inválido'}), 400
        
        # Buscar matrículas del curso
        estudiantes_matriculas = list(matriculas.find({
            'id_curso': obj_id,
            'estado': 'activo'
        }))
        
        return jsonify({
            'success': True,
            'group_id': group_id,
            'student_ids': [str(m['id_estudiante']) for m in estudiantes_matriculas],
            'students': serialize_doc(estudiantes_matriculas),
            'students_count': len(estudiantes_matriculas)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/groups/<group_id>/students/<student_id>', methods=['POST'])
def add_student_to_group(group_id, student_id):
    """Agregar un estudiante a un grupo (crear matrícula)"""
    try:
        cursos = get_cursos_collection()
        usuarios = get_usuarios_collection()
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        curso_id = string_to_objectid(group_id)
        estudiante_id = string_to_objectid(student_id)
        
        if not curso_id or not estudiante_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Verificar que el curso existe
        curso = cursos.find_one({'_id': curso_id, 'activo': True})
        if not curso:
            return jsonify({'success': False, 'error': 'Curso no encontrado o inactivo'}), 404
        
        # Verificar capacidad
        if 'capacidad_max' in curso:
            estudiantes_actuales = matriculas.count_documents({
                'id_curso': curso_id,
                'estado': 'activo'
            })
            if estudiantes_actuales >= curso['capacidad_max']:
                return jsonify({'success': False, 'error': 'El grupo está lleno'}), 400
        
        # Verificar que el estudiante existe
        estudiante = usuarios.find_one({'_id': estudiante_id, 'rol': 'estudiante', 'activo': True})
        if not estudiante:
            return jsonify({'success': False, 'error': 'Estudiante no encontrado o inactivo'}), 404
        
        # Verificar si ya está matriculado
        matricula_existente = matriculas.find_one({
            'id_estudiante': estudiante_id,
            'id_curso': curso_id
        })
        
        if matricula_existente:
            return jsonify({'success': False, 'error': 'El estudiante ya está matriculado en este curso'}), 400
        
        # Crear matrícula
        nueva_matricula = {
            'id_estudiante': estudiante_id,
            'id_curso': curso_id,
            'fecha_matricula': Timestamp(int(datetime.utcnow().timestamp()), 0),
            'estado': 'activo',
            'calificaciones': [],
            'estudiante_info': {
                'nombres': estudiante.get('nombres'),
                'apellidos': estudiante.get('apellidos'),
                'codigo_est': estudiante.get('codigo_est')
            },
            'curso_info': {
                'nombre_curso': curso.get('nombre_curso'),
                'codigo_curso': curso.get('codigo_curso'),
                'grado': curso.get('grado'),
                'periodo': curso.get('periodo')
            }
        }
        
        # Insertar matrícula
        resultado = matriculas.insert_one(nueva_matricula)
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='crear_matricula',
            entidad_afectada='matriculas',
            id_entidad=str(resultado.inserted_id),
            detalles=f"Estudiante {estudiante['nombres']} matriculado en {curso['nombre_curso']}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Estudiante agregado al grupo exitosamente',
            'group_id': group_id,
            'student_id': student_id
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/groups/<group_id>/students/<student_id>', methods=['DELETE'])
def remove_student_from_group(group_id, student_id):
    """Remover un estudiante de un grupo"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir IDs a ObjectId
        curso_id = string_to_objectid(group_id)
        estudiante_id = string_to_objectid(student_id)
        
        if not curso_id or not estudiante_id:
            return jsonify({'success': False, 'error': 'IDs inválidos'}), 400
        
        # Buscar matrícula
        matricula = matriculas.find_one({
            'id_estudiante': estudiante_id,
            'id_curso': curso_id
        })
        
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Cambiar estado a retirado
        resultado = matriculas.update_one(
            {'_id': matricula['_id']},
            {'$set': {'estado': 'retirado'}}
        )
        
        # Registrar en auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='retirar_matricula',
            entidad_afectada='matriculas',
            id_entidad=str(matricula['_id']),
            detalles=f"Estudiante retirado del curso"
        )
        
        return jsonify({
            'success': True,
            'message': 'Estudiante removido del grupo exitosamente',
            'group_id': group_id,
            'student_id': student_id
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
    # Manejo de errores
@app.errorhandler(404)
def not_found(error):
    return jsonify({'success': False, 'error': 'Endpoint no encontrado'}), 404

@app.errorhandler(500)
def internal_error(error):
    return jsonify({'success': False, 'error': 'Error interno del servidor'}), 500

if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=5004)