import PyPDF2
import io
import re
from typing import Optional, List, Dict
from openai import OpenAI

class DocumentProcessor:
    """Process documents and extract text content"""
    
    def __init__(self):
        self.max_chars_per_page = 10000  # Limit chars per page to avoid memory issues
        self.openai_client = OpenAI()  # Initialize OpenAI client for Whisper
    
    def extract_pdf_text(self, file_path: str) -> Optional[str]:
        """Extract text from PDF file"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                # Check if PDF is encrypted
                if pdf_reader.is_encrypted:
                    # Try to decrypt with empty password
                    if not pdf_reader.decrypt(''):
                        return "[Encrypted PDF - Unable to extract text]"
                
                text_content = []
                num_pages = len(pdf_reader.pages)
                
                # Extract text from each page
                for page_num in range(min(num_pages, 100)):  # Limit to first 100 pages
                    try:
                        page = pdf_reader.pages[page_num]
                        page_text = page.extract_text()
                        
                        if page_text:
                            # Clean up text
                            page_text = self.clean_text(page_text)
                            # Limit text per page
                            if len(page_text) > self.max_chars_per_page:
                                page_text = page_text[:self.max_chars_per_page] + "..."
                            text_content.append(f"[Page {page_num + 1}]\n{page_text}")
                    except Exception as e:
                        text_content.append(f"[Page {page_num + 1}] Error extracting text: {str(e)}")
                
                if not text_content:
                    return "[PDF appears to be empty or contains only images]"
                
                return "\n\n".join(text_content)
        
        except Exception as e:
            return f"[Error processing PDF: {str(e)}]"
    
    def transcribe_audio(self, file_path: str) -> Optional[str]:
        """Transcribe audio file using OpenAI Whisper"""
        try:
            with open(file_path, "rb") as audio_file:
                transcript = self.openai_client.audio.transcriptions.create(
                    model="whisper-1",
                    file=audio_file,
                    response_format="text"
                )
            
            # Clean the transcribed text
            if isinstance(transcript, str):
                cleaned_text = self.clean_text(transcript)
                return f"[Audio Transcript]\n{cleaned_text}"
            else:
                # Handle case where transcript is an object with text property
                cleaned_text = self.clean_text(str(transcript))
                return f"[Audio Transcript]\n{cleaned_text}"
        
        except Exception as e:
            return f"[Error transcribing audio: {str(e)}]"
    
    def get_pdf_page_count(self, file_path: str) -> int:
        """Get number of pages in PDF"""
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                return len(pdf_reader.pages)
        except:
            return 0
    
    def clean_text(self, text: str) -> str:
        """Clean extracted text"""
        # Remove excessive whitespace
        text = re.sub(r'\s+', ' ', text)
        # Remove non-printable characters
        text = ''.join(char for char in text if char.isprintable() or char in '\n\t')
        # Fix common OCR issues
        text = text.replace('ﬁ', 'fi').replace('ﬂ', 'fl')
        return text.strip()
    
    def extract_metadata(self, file_path: str) -> Dict:
        """Extract PDF metadata"""
        metadata = {}
        try:
            with open(file_path, 'rb') as file:
                pdf_reader = PyPDF2.PdfReader(file)
                
                if pdf_reader.metadata:
                    metadata = {
                        'title': pdf_reader.metadata.get('/Title', ''),
                        'author': pdf_reader.metadata.get('/Author', ''),
                        'subject': pdf_reader.metadata.get('/Subject', ''),
                        'creator': pdf_reader.metadata.get('/Creator', ''),
                        'producer': pdf_reader.metadata.get('/Producer', ''),
                        'creation_date': str(pdf_reader.metadata.get('/CreationDate', '')),
                        'modification_date': str(pdf_reader.metadata.get('/ModDate', ''))
                    }
                
                metadata['pages'] = len(pdf_reader.pages)
                metadata['encrypted'] = pdf_reader.is_encrypted
        except:
            pass
        
        return metadata
    
    def extract_legal_entities(self, text: str) -> Dict[str, List[str]]:
        """Extract legal entities from text (basic implementation)"""
        entities = {
            'case_numbers': [],
            'dates': [],
            'parties': [],
            'statutes': []
        }
        
        # Extract case numbers (basic pattern)
        case_pattern = r'\b\d{1,4}[-\s]?[A-Z]{2}[-\s]?\d{1,6}\b'
        entities['case_numbers'] = list(set(re.findall(case_pattern, text)))
        
        # Extract dates (MM/DD/YYYY or Month DD, YYYY)
        date_pattern = r'\b(?:\d{1,2}/\d{1,2}/\d{4}|\w+ \d{1,2}, \d{4})\b'
        entities['dates'] = list(set(re.findall(date_pattern, text)))
        
        # Extract potential party names (v. or vs.)
        party_pattern = r'([A-Z][A-Za-z\s]+?)\s+v\.?\s+([A-Z][A-Za-z\s]+?)(?:\,|\.|$)'
        matches = re.findall(party_pattern, text)
        for match in matches:
            entities['parties'].extend(match)
        entities['parties'] = list(set(entities['parties']))
        
        # Extract statute references (basic)
        statute_pattern = r'\b\d+\s+U\.?S\.?C\.?\s+§?\s*\d+\b'
        entities['statutes'] = list(set(re.findall(statute_pattern, text)))
        
        return entities
    
    def chunk_text(self, text: str, chunk_size: int = 1000, overlap: int = 200) -> List[str]:
        """Split text into overlapping chunks for processing"""
        chunks = []
        start = 0
        text_length = len(text)
        
        while start < text_length:
            end = start + chunk_size
            
            # Try to break at sentence boundary
            if end < text_length:
                # Look for sentence end
                sentence_end = text.rfind('. ', start, end)
                if sentence_end != -1:
                    end = sentence_end + 1
            
            chunk = text[start:end].strip()
            if chunk:
                chunks.append(chunk)
            
            # Move start position with overlap
            start = end - overlap if end < text_length else text_length
        
        return chunks
    
    def summarize_document(self, text: str, max_length: int = 500) -> str:
        """Create a basic summary of document (without LLM)"""
        # This is a very basic implementation
        # In production, you'd use an LLM for this
        
        # Take first few sentences
        sentences = text.split('. ')
        summary = []
        current_length = 0
        
        for sentence in sentences[:10]:  # First 10 sentences
            sentence = sentence.strip()
            if sentence and current_length + len(sentence) < max_length:
                summary.append(sentence)
                current_length += len(sentence)
        
        return '. '.join(summary) + '.' if summary else text[:max_length]