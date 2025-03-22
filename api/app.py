from flask import Flask, request, jsonify
from flask_cors import CORS
from flask_limiter import Limiter
from flask_limiter.util import get_remote_address
import joblib
import re
import logging
from pathlib import Path

# Initialize Flask app
app = Flask(__name__)
CORS(app)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger("VulnerabilityDetector")

# Rate limiting configuration
limiter = Limiter(
    app=app,
    key_func=get_remote_address,
    default_limits=["200 per day", "50 per hour"]
)

# Global variables
pipeline = None
CORRECTIONS = {
    r'\bstrcpy\(': 'strncpy(dest, src, sizeof(dest))',
    r'\bsprintf\(': 'snprintf(dest, sizeof(dest), "%s", src)',
    r'\[\d+\]': '[BUFFER_SIZE]',
    r'while\(\*src\)': 'while(n-- > 0 && *src)'
}

def load_model(model_path: str = "logreg_pipeline_20250322_211548.pkl"):
    """Load the machine learning model"""
    global pipeline
    try:
        if not Path(model_path).exists():
            raise FileNotFoundError(f"Model file {model_path} not found")
            
        pipeline = joblib.load(model_path)
        logger.info(f"Successfully loaded model from {model_path}")
        
        # Warm-up test prediction
        _ = pipeline.predict([""])
        logger.info("Model warm-up completed")
        
    except Exception as e:
        logger.error(f"Critical model loading error: {str(e)}")
        raise

def generate_correction(code: str) -> str:
    """Generate secure code suggestions"""
    for pattern, fix in CORRECTIONS.items():
        code = re.sub(pattern, fix, code, flags=re.IGNORECASE)
    return code

@app.route('/analyze', methods=['POST'])
@limiter.limit("10/minute")
def analyze():
    """Main analysis endpoint"""
    try:
        # Get and validate input
        code = request.json.get('code', '')
        
        if not code or len(code) > 100000:  # 100KB max
            return jsonify({'error': 'Invalid input'}), 400
        
        # Make prediction
        prediction = pipeline.predict([code])[0]
        confidence = float(pipeline.predict_proba([code])[0][1])
        
        # Generate correction if vulnerable
        correction = generate_correction(code) if prediction else code
        
        return jsonify({
            'vulnerable': bool(prediction),
            'confidence': confidence,
            'original': code,
            'corrected': correction,
            'issues': list(CORRECTIONS.keys()) if prediction else []
        })
        
    except Exception as e:
        logger.error(f"Analysis error: {str(e)}")
        return jsonify({'error': str(e)}), 500

@app.route('/health')
@limiter.exempt
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy' if pipeline else 'unhealthy',
        'model_loaded': bool(pipeline)
    })

# Load model when app starts
with app.app_context():
    load_model()

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False, threaded=True)