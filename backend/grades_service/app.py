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

# 🔧 CORS CONFIGURACIÓN
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

# Keycloak Configuration
keycloak_openid = KeycloakOpenID(
    server_url="http://localhost:8082",
    client_id="01",
    realm_name="platamaformaInstitucional",
    client_secret_key="wP8EhQnsdaYcCSyFTnD2wu4n0dssApUz"
)

def tiene_rol(token_info, cliente_id, rol_requerido):
    try:
        realm_roles = token_info.get("realm_access", {}).get("roles", [])
        if rol_requerido in realm_roles:
            return True
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

# ==================== ENDPOINTS ====================

@app.route('/')
def home():
    return jsonify({
        'service': 'Grades Service',
        'version': '1.0.0',
        'database': 'MongoDB',
        'endpoints': {
            'get_course_grades': 'GET /grades/course/<course_id>',
            'get_student_grades': 'GET /grades/student/<student_id>',
            'add_grade': 'POST /grades',
            'update_grade': 'PUT /grades/<enrollment_id>',
            'delete_grade': 'DELETE /grades/<enrollment_id>/<grade_index>',
            'calculate_average': 'GET /grades/average/<enrollment_id>',
            'bulk_upload': 'POST /grades/bulk'
        }
    })

@app.route('/health')
def health():
    return jsonify({'status': 'healthy', 'service': 'grades', 'database': 'MongoDB'})

@app.route('/grades/course/<course_id>', methods=['GET'])
def get_course_grades(course_id):
    """Obtener todas las calificaciones de un curso"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        curso_obj_id = string_to_objectid(course_id)
        if not curso_obj_id:
            return jsonify({'success': False, 'error': 'ID de curso inválido'}), 400
        
        # Buscar todas las matrículas del curso
        enrollments = list(matriculas.find({
            'id_curso': curso_obj_id,
            'estado': 'activo'
        }))
        
        # Formatear datos
        grades_data = []
        for enrollment in enrollments:
            student_info = enrollment.get('estudiante_info', {})
            calificaciones = enrollment.get('calificaciones', [])
            
            # Calcular promedio
            promedio = 0
            if calificaciones:
                total = sum(c.get('nota', 0) * c.get('peso', 0) for c in calificaciones)
                promedio = round(total, 2)
            
            grades_data.append({
                'enrollment_id': str(enrollment['_id']),
                'student_id': str(enrollment['id_estudiante']),
                'student_name': f"{student_info.get('nombres', '')} {student_info.get('apellidos', '')}",
                'student_code': student_info.get('codigo_est', ''),
                'grades': serialize_doc(calificaciones),
                'average': promedio
            })
        
        return jsonify({
            'success': True,
            'course_id': course_id,
            'students': grades_data,
            'count': len(grades_data)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/grades/student/<student_id>', methods=['GET'])
def get_student_grades(student_id):
    """Obtener todas las calificaciones de un estudiante"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        estudiante_obj_id = string_to_objectid(student_id)
        if not estudiante_obj_id:
            return jsonify({'success': False, 'error': 'ID de estudiante inválido'}), 400
        
        # Filtros opcionales
        periodo = request.args.get('periodo')
        curso_id = request.args.get('course_id')
        
        # Construir query
        query = {'id_estudiante': estudiante_obj_id}
        
        if periodo:
            query['curso_info.periodo'] = periodo
        if curso_id:
            curso_obj_id = string_to_objectid(curso_id)
            if curso_obj_id:
                query['id_curso'] = curso_obj_id
        
        # Buscar matrículas
        enrollments = list(matriculas.find(query))
        
        # Formatear datos
        courses_grades = []
        total_average = 0
        count_courses = 0
        
        for enrollment in enrollments:
            curso_info = enrollment.get('curso_info', {})
            calificaciones = enrollment.get('calificaciones', [])
            
            # Calcular promedio del curso
            promedio_curso = 0
            if calificaciones:
                total = sum(c.get('nota', 0) * c.get('peso', 0) for c in calificaciones)
                promedio_curso = round(total, 2)
                total_average += promedio_curso
                count_courses += 1
            
            courses_grades.append({
                'enrollment_id': str(enrollment['_id']),
                'course_id': str(enrollment['id_curso']),
                'course_name': curso_info.get('nombre_curso', ''),
                'course_code': curso_info.get('codigo_curso', ''),
                'period': curso_info.get('periodo', ''),
                'grades': serialize_doc(calificaciones),
                'average': promedio_curso,
                'status': enrollment.get('estado', 'activo')
            })
        
        # Calcular promedio general
        promedio_general = round(total_average / count_courses, 2) if count_courses > 0 else 0
        
        return jsonify({
            'success': True,
            'student_id': student_id,
            'courses': courses_grades,
            'general_average': promedio_general,
            'count': len(courses_grades)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/grades', methods=['POST'])
def add_grade():
    """Agregar una calificación a una matrícula"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar campos requeridos
        required_fields = ['enrollment_id', 'tipo', 'nota', 'peso']
        for field in required_fields:
            if field not in data:
                return jsonify({
                    'success': False,
                    'error': f'El campo {field} es requerido'
                }), 400
        
        # Validar nota
        nota = float(data['nota'])
        nota_maxima = float(data.get('nota_maxima', 5.0))
        peso = float(data['peso'])
        
        if nota < 0 or nota > nota_maxima:
            return jsonify({
                'success': False,
                'error': f'La nota debe estar entre 0 y {nota_maxima}'
            }), 400
        
        if peso < 0 or peso > 1:
            return jsonify({
                'success': False,
                'error': 'El peso debe estar entre 0 y 1'
            }), 400
        
        matriculas = get_matriculas_collection()
        
        # Convertir enrollment_id a ObjectId
        enrollment_obj_id = string_to_objectid(data['enrollment_id'])
        if not enrollment_obj_id:
            return jsonify({'success': False, 'error': 'ID de matrícula inválido'}), 400
        
        # Verificar que la matrícula existe
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Crear objeto de calificación
        nueva_calificacion = {
            'tipo': data['tipo'],
            'nota': nota,
            'nota_maxima': nota_maxima,
            'peso': peso,
            'fecha_eval': datetime.utcnow(),
            'comentarios': data.get('comentarios', '')
        }
        
        # Agregar calificación
        resultado = matriculas.update_one(
            {'_id': enrollment_obj_id},
            {'$push': {'calificaciones': nueva_calificacion}}
        )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='agregar_calificacion',
            entidad_afectada='matriculas',
            id_entidad=data['enrollment_id'],
            detalles=f"Calificación agregada: {data['tipo']} - Nota: {nota}"
        )
        
        # Obtener matrícula actualizada
        matricula_actualizada = matriculas.find_one({'_id': enrollment_obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Calificación agregada exitosamente',
            'enrollment': serialize_doc(matricula_actualizada)
        }), 201
        
    except ValueError as ve:
        return jsonify({'success': False, 'error': 'Valores numéricos inválidos'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/grades/<enrollment_id>', methods=['PUT'])
def update_grade(enrollment_id):
    """Actualizar una calificación específica"""
    try:
        data = request.get_json()
        
        if not data:
            return jsonify({'success': False, 'error': 'No se proporcionaron datos'}), 400
        
        # Validar grade_index
        if 'grade_index' not in data:
            return jsonify({'success': False, 'error': 'Se requiere grade_index'}), 400
        
        grade_index = int(data['grade_index'])
        
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        enrollment_obj_id = string_to_objectid(enrollment_id)
        if not enrollment_obj_id:
            return jsonify({'success': False, 'error': 'ID de matrícula inválido'}), 400
        
        # Verificar que la matrícula existe
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Verificar que el índice existe
        calificaciones = matricula.get('calificaciones', [])
        if grade_index < 0 or grade_index >= len(calificaciones):
            return jsonify({'success': False, 'error': 'Índice de calificación inválido'}), 400
        
        # Construir actualización
        update_fields = {}
        
        if 'nota' in data:
            nota = float(data['nota'])
            nota_maxima = calificaciones[grade_index].get('nota_maxima', 5.0)
            if nota < 0 or nota > nota_maxima:
                return jsonify({
                    'success': False,
                    'error': f'La nota debe estar entre 0 y {nota_maxima}'
                }), 400
            update_fields[f'calificaciones.{grade_index}.nota'] = nota
        
        if 'peso' in data:
            peso = float(data['peso'])
            if peso < 0 or peso > 1:
                return jsonify({'success': False, 'error': 'El peso debe estar entre 0 y 1'}), 400
            update_fields[f'calificaciones.{grade_index}.peso'] = peso
        
        if 'comentarios' in data:
            update_fields[f'calificaciones.{grade_index}.comentarios'] = data['comentarios']
        
        if 'tipo' in data:
            update_fields[f'calificaciones.{grade_index}.tipo'] = data['tipo']
        
        # Actualizar
        if update_fields:
            resultado = matriculas.update_one(
                {'_id': enrollment_obj_id},
                {'$set': update_fields}
            )
            
            # Registrar auditoría
            registrar_auditoria(
                id_usuario=None,
                accion='actualizar_calificacion',
                entidad_afectada='matriculas',
                id_entidad=enrollment_id,
                detalles=f"Calificación actualizada en índice {grade_index}"
            )
        
        # Obtener matrícula actualizada
        matricula_actualizada = matriculas.find_one({'_id': enrollment_obj_id})
        
        return jsonify({
            'success': True,
            'message': 'Calificación actualizada exitosamente',
            'enrollment': serialize_doc(matricula_actualizada)
        }), 200
        
    except ValueError:
        return jsonify({'success': False, 'error': 'Valores numéricos inválidos'}), 400
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500
    
@app.route('/grades/<enrollment_id>/<int:grade_index>', methods=['DELETE'])
def delete_grade(enrollment_id, grade_index):
    """Eliminar una calificación específica"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        enrollment_obj_id = string_to_objectid(enrollment_id)
        if not enrollment_obj_id:
            return jsonify({'success': False, 'error': 'ID de matrícula inválido'}), 400
        
        # Verificar que la matrícula existe
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        # Verificar que el índice existe
        calificaciones = matricula.get('calificaciones', [])
        if grade_index < 0 or grade_index >= len(calificaciones):
            return jsonify({'success': False, 'error': 'Índice de calificación inválido'}), 400
        
        # Eliminar calificación
        calificaciones.pop(grade_index)
        
        resultado = matriculas.update_one(
            {'_id': enrollment_obj_id},
            {'$set': {'calificaciones': calificaciones}}
        )
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='eliminar_calificacion',
            entidad_afectada='matriculas',
            id_entidad=enrollment_id,
            detalles=f"Calificación eliminada en índice {grade_index}"
        )
        
        return jsonify({
            'success': True,
            'message': 'Calificación eliminada exitosamente'
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/grades/average/<enrollment_id>', methods=['GET'])
def calculate_average(enrollment_id):
    """Calcular el promedio de una matrícula"""
    try:
        matriculas = get_matriculas_collection()
        
        # Convertir ID a ObjectId
        enrollment_obj_id = string_to_objectid(enrollment_id)
        if not enrollment_obj_id:
            return jsonify({'success': False, 'error': 'ID de matrícula inválido'}), 400
        
        # Buscar matrícula
        matricula = matriculas.find_one({'_id': enrollment_obj_id})
        if not matricula:
            return jsonify({'success': False, 'error': 'Matrícula no encontrada'}), 404
        
        calificaciones = matricula.get('calificaciones', [])
        
        if not calificaciones:
            return jsonify({
                'success': True,
                'enrollment_id': enrollment_id,
                'average': 0,
                'total_grades': 0
            }), 200
        
        # Calcular promedio ponderado
        total = sum(c.get('nota', 0) * c.get('peso', 0) for c in calificaciones)
        total_peso = sum(c.get('peso', 0) for c in calificaciones)
        
        promedio = round(total / total_peso, 2) if total_peso > 0 else 0
        
        # Determinar estado
        estado = 'aprobado' if promedio >= 3.0 else 'reprobado'
        
        return jsonify({
            'success': True,
            'enrollment_id': enrollment_id,
            'average': promedio,
            'total_grades': len(calificaciones),
            'status': estado,
            'grades': serialize_doc(calificaciones)
        }), 200
        
    except Exception as e:
        return jsonify({'success': False, 'error': str(e)}), 500

@app.route('/grades/bulk', methods=['POST'])
def bulk_upload_grades():
    """Carga masiva de calificaciones para un curso"""
    try:
        data = request.get_json()
        
        if not data or 'grades' not in data:
            return jsonify({'success': False, 'error': 'No se proporcionaron calificaciones'}), 400
        
        course_id = data.get('course_id')
        periodo = data.get('periodo')
        tipo_evaluacion = data.get('tipo', 'Evaluación')
        peso = float(data.get('peso', 0.33))
        
        if not course_id:
            return jsonify({'success': False, 'error': 'Se requiere course_id'}), 400
        
        matriculas = get_matriculas_collection()
        curso_obj_id = string_to_objectid(course_id)
        
        successful = 0
        failed = 0
        errors = []
        
        # Procesar cada calificación
        for grade_entry in data['grades']:
            try:
                student_id = grade_entry.get('student_id')
                nota = float(grade_entry.get('nota', 0))
                comentarios = grade_entry.get('comentarios', '')
                
                if not student_id:
                    failed += 1
                    errors.append({'error': 'student_id requerido', 'entry': grade_entry})
                    continue
                
                student_obj_id = string_to_objectid(student_id)
                
                # Buscar matrícula
                query = {
                    'id_curso': curso_obj_id,
                    'id_estudiante': student_obj_id
                }
                
                if periodo:
                    query['curso_info.periodo'] = periodo
                
                matricula = matriculas.find_one(query)
                
                if not matricula:
                    failed += 1
                    errors.append({'error': 'Matrícula no encontrada', 'student_id': student_id})
                    continue
                
                # Agregar calificación
                nueva_calificacion = {
                    'tipo': tipo_evaluacion,
                    'nota': nota,
                    'nota_maxima': 5.0,
                    'peso': peso,
                    'fecha_eval': datetime.utcnow(),
                    'comentarios': comentarios
                }
                
                matriculas.update_one(
                    {'_id': matricula['_id']},
                    {'$push': {'calificaciones': nueva_calificacion}}
                )
                
                successful += 1
                
            except Exception as e:
                failed += 1
                errors.append({'error': str(e), 'entry': grade_entry})
        
        # Registrar auditoría
        registrar_auditoria(
            id_usuario=None,
            accion='carga_masiva_calificaciones',
            entidad_afectada='matriculas',
            id_entidad=course_id,
            detalles=f"Carga masiva: {successful} exitosas, {failed} fallidas"
        )
        
        return jsonify({
            'success': True,
            'message': 'Carga masiva completada',
            'successful': successful,
            'failed': failed,
            'errors': errors if errors else None
        }), 200 if failed == 0 else 207  # 207 = Multi-Status
        
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
    app.run(debug=True, host='0.0.0.0', port=5005)