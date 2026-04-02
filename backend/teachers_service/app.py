from flask import Flask, request, jsonify, g
from flask_cors import CORS
from datetime import datetime
from keycloak import KeycloakOpenID
from functools import wraps
import jwt as pyjwt
import sys
import os
from bson.timestamp import Timestamp

# Agregar el path del backend para importar db_config
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), '..')))
from database.db_config import (
    get_usuarios_collection,
    get_cursos_collection,
    get_groups_collection,
    get_matriculas_collection,
    get_asistencia_collection,
    get_observaciones_collection,
    get_asignaciones_collection,
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
