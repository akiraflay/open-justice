import os
import uuid
from datetime import datetime
from werkzeug.utils import secure_filename
import hashlib

class FileHandler:
    """Handle file upload, storage, and management"""
    
    ALLOWED_EXTENSIONS = {
        'pdf', 'txt', 'doc', 'docx',  # Documents
        'png', 'jpg', 'jpeg', 'gif',   # Images
        'mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'wma',    # Audio
        'mp4', 'avi', 'mov', 'webm', 'mkv'    # Video
    }
    
    def __init__(self, upload_folder):
        self.upload_folder = upload_folder
        os.makedirs(upload_folder, exist_ok=True)
    
    def allowed_file(self, filename):
        """Check if file extension is allowed"""
        return '.' in filename and \
               filename.rsplit('.', 1)[1].lower() in self.ALLOWED_EXTENSIONS
    
    def get_file_type(self, filename):
        """Determine file type from extension"""
        ext = filename.rsplit('.', 1)[1].lower()
        
        if ext in ['pdf', 'txt', 'doc', 'docx']:
            return 'pdf' if ext == 'pdf' else 'document'
        elif ext in ['png', 'jpg', 'jpeg', 'gif']:
            return 'image'
        elif ext in ['mp3', 'wav', 'm4a', 'ogg', 'flac', 'aac', 'wma']:
            return 'audio'
        elif ext in ['mp4', 'avi', 'mov', 'webm', 'mkv']:
            return 'video'
        else:
            return 'unknown'
    
    def generate_file_hash(self, file):
        """Generate SHA-256 hash of file content"""
        sha256_hash = hashlib.sha256()
        file.seek(0)
        for byte_block in iter(lambda: file.read(4096), b""):
            sha256_hash.update(byte_block)
        file.seek(0)
        return sha256_hash.hexdigest()
    
    def save_file(self, file):
        """Save uploaded file and return file info"""
        if not file or file.filename == '':
            raise ValueError("No file provided")
        
        if not self.allowed_file(file.filename):
            raise ValueError(f"File type not allowed. Allowed types: {', '.join(self.ALLOWED_EXTENSIONS)}")
        
        # Generate unique filename
        original_filename = secure_filename(file.filename)
        file_id = str(uuid.uuid4())
        ext = original_filename.rsplit('.', 1)[1].lower()
        new_filename = f"{file_id}.{ext}"
        
        # Create subdirectory based on date
        date_folder = datetime.now().strftime('%Y%m%d')
        save_dir = os.path.join(self.upload_folder, date_folder)
        os.makedirs(save_dir, exist_ok=True)
        
        # Save file
        file_path = os.path.join(save_dir, new_filename)
        file.save(file_path)
        
        # Get file stats
        file_stats = os.stat(file_path)
        file_size = file_stats.st_size
        
        # Format size
        if file_size < 1024:
            size_str = f"{file_size} B"
        elif file_size < 1024 * 1024:
            size_str = f"{file_size / 1024:.1f} KB"
        else:
            size_str = f"{file_size / (1024 * 1024):.1f} MB"
        
        return {
            'id': file_id,
            'name': original_filename,
            'type': self.get_file_type(original_filename),
            'size': size_str,
            'size_bytes': file_size,
            'path': file_path,
            'uploadedAt': datetime.now().isoformat(),
            'extension': ext
        }
    
    def delete_file(self, file_path):
        """Delete a file from storage"""
        if os.path.exists(file_path):
            os.remove(file_path)
            # Try to remove empty date directory
            try:
                parent_dir = os.path.dirname(file_path)
                if not os.listdir(parent_dir):
                    os.rmdir(parent_dir)
            except:
                pass
            return True
        return False
    
    def get_file_path(self, file_id, extension):
        """Get full path for a file ID"""
        # Search in all date folders
        for date_folder in os.listdir(self.upload_folder):
            file_path = os.path.join(
                self.upload_folder,
                date_folder,
                f"{file_id}.{extension}"
            )
            if os.path.exists(file_path):
                return file_path
        return None
    
    def cleanup_old_files(self, days_old=7):
        """Clean up files older than specified days"""
        from datetime import timedelta
        
        cutoff_date = datetime.now() - timedelta(days=days_old)
        cleaned_count = 0
        
        for date_folder in os.listdir(self.upload_folder):
            folder_path = os.path.join(self.upload_folder, date_folder)
            if not os.path.isdir(folder_path):
                continue
            
            # Check folder date
            try:
                folder_date = datetime.strptime(date_folder, '%Y%m%d')
                if folder_date < cutoff_date:
                    # Delete all files in this folder
                    for filename in os.listdir(folder_path):
                        file_path = os.path.join(folder_path, filename)
                        os.remove(file_path)
                        cleaned_count += 1
                    # Remove empty folder
                    os.rmdir(folder_path)
            except:
                continue
        
        return cleaned_count