from flask import Flask, request, jsonify, session, Response, stream_with_context
from flask_cors import CORS
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
import redis
import json
from dotenv import load_dotenv
from services.file_handler import FileHandler
from services.document_processor import DocumentProcessor
from services.query_engine import QueryEngine

# Load environment variables from .env file
load_dotenv()

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
app.config['UPLOAD_FOLDER'] = 'uploads'
app.config['MAX_CONTENT_LENGTH'] = 100 * 1024 * 1024  # 100MB max file size

# Enable CORS for frontend
CORS(app, 
     origins=['http://localhost:3000', 'http://127.0.0.1:3000'],
     supports_credentials=True,
     allow_headers=['Content-Type'],
     methods=['GET', 'POST', 'DELETE', 'OPTIONS'])

# Initialize Redis for session storage
try:
    redis_client = redis.Redis(
        host=os.environ.get('REDIS_HOST', 'localhost'),
        port=int(os.environ.get('REDIS_PORT', 6379)),
        db=0,
        decode_responses=True
    )
    redis_client.ping()
except:
    print("Warning: Redis not available, using in-memory storage")
    redis_client = None

# Initialize services
file_handler = FileHandler(app.config['UPLOAD_FOLDER'])
doc_processor = DocumentProcessor()
query_engine = QueryEngine()

# In-memory storage fallback
memory_storage = {}

def get_session_id():
    """Get or create session ID"""
    if 'session_id' not in session:
        session['session_id'] = str(uuid.uuid4())
    return session['session_id']

def get_session_data(session_id):
    """Get session data from Redis or memory"""
    if redis_client:
        data = redis_client.get(f"session:{session_id}")
        return json.loads(data) if data else {'files': [], 'queries': []}
    else:
        return memory_storage.get(session_id, {'files': [], 'queries': []})

def save_session_data(session_id, data):
    """Save session data to Redis or memory"""
    if redis_client:
        redis_client.setex(
            f"session:{session_id}",
            3600 * 24,  # 24 hour expiry
            json.dumps(data)
        )
    else:
        memory_storage[session_id] = data

@app.route('/api/health', methods=['GET'])
def health_check():
    """Health check endpoint"""
    return jsonify({
        'status': 'healthy',
        'redis': 'connected' if redis_client else 'unavailable',
        'timestamp': datetime.now().isoformat()
    })

@app.route('/api/session', methods=['GET'])
def get_session():
    """Get or create session"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    return jsonify({
        'session_id': session_id,
        'files': session_data['files'],
        'queries': session_data['queries']
    })

@app.route('/api/upload', methods=['POST'])
def upload_file():
    """Handle file upload"""
    session_id = get_session_id()
    
    if 'file' not in request.files:
        return jsonify({'error': 'No file provided'}), 400
    
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
    
    try:
        # Save file
        file_info = file_handler.save_file(file)
        
        # Process document (extract text if PDF)
        if file_info['type'] == 'pdf':
            text_content = doc_processor.extract_pdf_text(file_info['path'])
            file_info['text_preview'] = text_content[:500] if text_content else None
            file_info['page_count'] = doc_processor.get_pdf_page_count(file_info['path'])
        
        # Update session
        session_data = get_session_data(session_id)
        session_data['files'].append(file_info)
        save_session_data(session_id, session_data)
        
        return jsonify({
            'success': True,
            'file': file_info
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/files', methods=['GET'])
def list_files():
    """List uploaded files for session"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    return jsonify({'files': session_data['files']})

@app.route('/api/files/<file_id>', methods=['DELETE'])
def delete_file(file_id):
    """Delete a file"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    
    # Find and remove file
    file_to_delete = None
    for file in session_data['files']:
        if file['id'] == file_id:
            file_to_delete = file
            break
    
    if not file_to_delete:
        return jsonify({'error': 'File not found'}), 404
    
    # Delete physical file
    try:
        file_handler.delete_file(file_to_delete['path'])
        session_data['files'].remove(file_to_delete)
        save_session_data(session_id, session_data)
        return jsonify({'success': True})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/extract-queries', methods=['POST'])
def extract_queries():
    """Extract structured queries from user input using AI"""
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'No input text provided'}), 400
    
    user_input = data['text']
    
    try:
        # Use the query engine to extract queries
        extracted = query_engine.extract_queries(user_input)
        
        # Format the response for frontend
        queries = []
        for query in extracted.get('queries', []):
            queries.append({
                'id': str(query.get('id', len(queries) + 1)),
                'text': query.get('text', ''),
                'category': query.get('category', 'General'),
                'questionNumber': query.get('id', len(queries) + 1)
            })
        
        return jsonify({
            'success': True,
            'queries': queries
        })
        
    except Exception as e:
        print(f"Error extracting queries: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/swap-query', methods=['POST'])
def swap_query():
    """Generate a replacement query that's contextually similar but different"""
    data = request.json
    
    if not data:
        return jsonify({'error': 'No data provided'}), 400
    
    original_query = data.get('original_query', '')
    user_context = data.get('user_context', '')
    existing_queries = data.get('existing_queries', [])
    
    if not original_query:
        return jsonify({'error': 'No original query provided'}), 400
    
    try:
        # Use the query engine to generate a replacement query
        new_query = query_engine.swap_query(original_query, user_context, existing_queries)
        
        return jsonify({
            'success': True,
            'query': new_query
        })
        
    except Exception as e:
        print(f"Error swapping query: {e}")
        return jsonify({'error': str(e)}), 500

@app.route('/api/query', methods=['POST'])
def process_query():
    """Process a query against uploaded documents"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    
    data = request.json
    if not data or 'text' not in data:
        return jsonify({'error': 'No query text provided'}), 400
    
    query_text = data['text']
    
    # Check if files are uploaded
    if not session_data['files']:
        return jsonify({'error': 'No files uploaded'}), 400
    
    try:
        # Extract text from all documents
        all_texts = []
        for file in session_data['files']:
            if file['type'] == 'pdf':
                text = doc_processor.extract_pdf_text(file['path'])
                if text:
                    all_texts.append({
                        'filename': file['name'],
                        'content': text
                    })
        
        # Process query with LLM
        query_id = str(uuid.uuid4())
        query_record = {
            'id': query_id,
            'text': query_text,
            'status': 'processing',
            'timestamp': datetime.now().isoformat()
        }
        
        # Add to session
        session_data['queries'].append(query_record)
        save_session_data(session_id, session_data)
        
        # Get response from query engine
        response = query_engine.process_query(query_text, all_texts)
        
        # Update query with results
        for query in session_data['queries']:
            if query['id'] == query_id:
                query['status'] = 'completed'
                query['results'] = response
                break
        
        save_session_data(session_id, session_data)
        
        return jsonify({
            'success': True,
            'query_id': query_id,
            'results': response
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/api/query/stream', methods=['POST'])
def stream_query():
    """Stream query processing with real-time updates via SSE"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    data = request.get_json()
    
    if not data or 'text' not in data:
        return jsonify({'error': 'No query text provided'}), 400
    
    query_text = data['text']
    
    if not session_data['files']:
        return jsonify({'error': 'No files uploaded'}), 400
    
    def generate():
        """Generator function for SSE streaming with retry logic"""
        try:
            max_attempts = 3
            current_attempt = 1
            final_response = None
            
            while current_attempt <= max_attempts:
                # Send initial progress for this attempt
                yield f"data: {json.dumps({'progress': 10, 'status': 'analyzing_documents', 'message': f'Analyzing documents (Attempt {current_attempt}/{max_attempts})', 'attempt': f'{current_attempt}/{max_attempts}'})}\n\n"
                
                # Extract text from documents (only on first attempt)
                if current_attempt == 1:
                    all_texts = []
                    for file in session_data['files']:
                        if file['type'] == 'pdf':
                            text = doc_processor.extract_pdf_text(file['path'])
                            if text:
                                all_texts.append({
                                    'filename': file['name'],
                                    'content': text
                                })
                
                # Update progress
                base_progress = 20 + ((current_attempt - 1) * 25)
                yield f"data: {json.dumps({'progress': base_progress + 10, 'status': 'generating', 'message': f'Generating response {current_attempt}/{max_attempts}', 'attempt': f'{current_attempt}/{max_attempts}'})}\n\n"
                
                # Stream response from query engine
                response_text = ""
                chunk_count = 0
                for chunk in query_engine.stream_query(query_text, all_texts):
                    if chunk.get('text'):
                        response_text += chunk['text']
                        chunk_count += 1
                        # Send text chunks with progress
                        progress = min(base_progress + 10 + (chunk_count), base_progress + 50)
                        yield f"data: {json.dumps({'text': chunk['text'], 'progress': progress, 'attempt': f'{current_attempt}/{max_attempts}'})}\n\n"
                
                # Verification phase
                yield f"data: {json.dumps({'progress': base_progress + 60, 'status': 'verifying', 'message': f'Verifying accuracy {current_attempt}/{max_attempts}', 'attempt': f'{current_attempt}/{max_attempts}'})}\n\n"
                
                # Run hallucination check
                verification_result = query_engine.verify_response(query_text, response_text, all_texts, current_attempt)
                
                # Check if confidence is above threshold
                confidence = verification_result.get('confidence', 0)
                if confidence > 0.5:
                    # Success - send final result
                    yield f"data: {json.dumps({
                        'progress': 100,
                        'status': 'completed',
                        'done': True,
                        'final_text': verification_result.get('verified_text', response_text),
                        'confidence': confidence,
                        'is_verified': True,
                        'attempts': current_attempt,
                        'attempt': f'{current_attempt}/{max_attempts}'
                    })}\n\n"
                    return
                
                # Low confidence - retry if not at max attempts
                if current_attempt < max_attempts:
                    yield f"data: {json.dumps({'progress': base_progress + 70, 'status': 'retrying', 'message': f'Low confidence ({confidence:.0%}), retrying...', 'attempt': f'{current_attempt}/{max_attempts}'})}\n\n"
                    current_attempt += 1
                else:
                    # Max attempts reached - send failure result
                    yield f"data: {json.dumps({
                        'progress': 100,
                        'status': 'failed',
                        'done': True,
                        'final_text': 'Could not find a reliable answer after 3 attempts. Please try rephrasing your query.',
                        'confidence': confidence,
                        'is_verified': False,
                        'attempts': current_attempt,
                        'attempt': f'{current_attempt}/{max_attempts}',
                        'retry_available': True
                    })}\n\n"
                    return
            
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e), 'done': True})}\n\n"
    
    return Response(
        stream_with_context(generate()),
        mimetype='text/event-stream',
        headers={
            'Cache-Control': 'no-cache',
            'X-Accel-Buffering': 'no',
            'Connection': 'keep-alive',
        }
    )

@app.route('/api/combined-analysis', methods=['POST'])
def generate_combined_analysis():
    """Generate combined analysis for all queries on a document"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    data = request.get_json()
    
    if not data or 'file_id' not in data:
        return jsonify({'error': 'No file_id provided'}), 400
    
    file_id = data['file_id']
    print(f"DEBUG: Looking for file_id: {file_id}")
    print(f"DEBUG: Session files: {[f.get('id', 'no-id') for f in session_data.get('files', [])]}")
    
    # Find the file
    target_file = None
    for file in session_data['files']:
        if file['id'] == file_id:
            target_file = file
            break
    
    if not target_file:
        print(f"DEBUG: File {file_id} not found in session")
        return jsonify({'error': 'File not found'}), 404
    
    # Get queries from request data (sent by frontend) or fall back to session
    queries = data.get('queries', [])
    print(f"DEBUG: Received queries from request: {len(queries) if queries else 0}")
    if queries:
        print(f"DEBUG: First query sample: {queries[0] if queries else 'None'}")
    
    if not queries:
        # Fallback to session queries for backwards compatibility
        queries = session_data.get('queries', [])
        print(f"DEBUG: Fallback to session queries: {len(queries) if queries else 0}")
    
    if not queries:
        print("DEBUG: No queries found in either request or session")
        return jsonify({'error': 'No queries to analyze'}), 400
    
    try:
        # Extract document text
        doc_text = ""
        if target_file['type'] == 'pdf':
            try:
                doc_text = doc_processor.extract_pdf_text(target_file['path'])
                if not doc_text or doc_text.strip() == "":
                    doc_text = "[Document text could not be extracted]"
            except Exception as pdf_error:
                print(f"Error extracting PDF text: {pdf_error}")
                doc_text = "[Error extracting document text]"
        
        # Validate we have query results to analyze
        # Handle both frontend query structure and backend session structure
        queries_with_results = []
        for q in queries:
            if isinstance(q, dict):
                # Frontend structure: check for 'results' field
                if 'results' in q and q.get('results') and q.get('results').strip():
                    queries_with_results.append(q)
                # Backend session structure: check for 'results' field
                elif 'results' in q and q.get('results') and q.get('results').strip():
                    queries_with_results.append(q)
        
        if not queries_with_results:
            return jsonify({
                'error': 'No completed queries found for analysis',
                'details': f'Found {len(queries)} queries but none have results to analyze. Please run some queries first.'
            }), 400
        
        # Prepare query and results data for the new method
        queries_and_results = []
        for query in queries_with_results:
            # Handle both frontend and backend query structures
            query_text = query.get('text', query.get('query', 'Unknown query'))
            result_text = query.get('results', query.get('result', 'No result available'))
            
            queries_and_results.append({
                'query': query_text,
                'result': result_text
            })
        
        # Use the new dedicated combined analysis method
        result = query_engine.generate_combined_analysis(
            queries_and_results=queries_and_results,
            file_name=target_file['name'],
            document_content=doc_text[:3000] if doc_text else ""
        )
        
        if not result or result.strip() == "":
            return jsonify({
                'error': 'Combined analysis generation failed',
                'details': 'The analysis service returned an empty response. Please try again.'
            }), 500
        
        return jsonify({
            'success': True,
            'analysis': result,
            'file_id': file_id,
            'file_name': target_file['name'],
            'query_count': len(queries_with_results),
            'total_queries': len(queries)
        })
        
    except Exception as e:
        error_msg = str(e)
        print(f"Combined analysis error: {error_msg}")
        
        # Provide more specific error messages
        if "OpenAI" in error_msg or "API" in error_msg:
            return jsonify({
                'error': 'AI service temporarily unavailable',
                'details': 'The analysis service is currently experiencing issues. Please try again in a few moments.'
            }), 503
        elif "temperature" in error_msg.lower():
            return jsonify({
                'error': 'Configuration error',
                'details': 'AI model configuration needs updating. Please contact support.'
            }), 500
        else:
            return jsonify({
                'error': 'Analysis failed',
                'details': f'An unexpected error occurred: {error_msg}'
            }), 500

@app.route('/api/queries', methods=['GET'])
def list_queries():
    """Get query history for session"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    return jsonify({'queries': session_data['queries']})

@app.route('/api/clear-session', methods=['POST'])
def clear_session():
    """Clear all session data"""
    session_id = get_session_id()
    session_data = get_session_data(session_id)
    
    # Delete all files
    for file in session_data['files']:
        try:
            file_handler.delete_file(file['path'])
        except:
            pass
    
    # Clear session
    save_session_data(session_id, {'files': [], 'queries': []})
    return jsonify({'success': True})

if __name__ == '__main__':
    # Ensure upload directory exists
    os.makedirs(app.config['UPLOAD_FOLDER'], exist_ok=True)
    
    # Run the app
    app.run(
        host='0.0.0.0',
        port=5001,
        debug=os.environ.get('FLASK_ENV') == 'development'
    )