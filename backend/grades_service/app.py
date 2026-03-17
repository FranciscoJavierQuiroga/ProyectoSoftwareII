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