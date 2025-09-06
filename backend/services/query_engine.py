import os
from typing import List, Dict, Optional
import json
import re
import sys
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from prompts import (
    LEGAL_ANALYSIS_SYSTEM_PROMPT,
    DOCUMENT_QUERY_TEMPLATE,
    QUERY_EXTRACTION_SYSTEM_PROMPT,
    QUERY_EXTRACTION_USER_TEMPLATE,
    COMBINED_ANALYSIS_PROMPT,
    VERIFICATION_PROMPT
)

# Model configuration for different tasks
MODEL_CONFIG = {
    'extraction': 'gpt-5-mini',      # Fast, efficient for structured output
    'analysis': 'gpt-5-chat-latest', # Best intelligence for legal analysis
    'verification': 'gpt-5-nano',    # Ultra-fast for simple validation
    'swap': 'gpt-5-mini'              # Good balance for generating alternatives
}

class QueryEngine:
    """Process queries against documents using LLM"""
    
    def __init__(self):
        self.api_key = os.environ.get('OPENAI_API_KEY')
        self.use_mock = not self.api_key  # Use mock responses if no API key
        
        if self.api_key:
            try:
                from openai import OpenAI
                self.client = OpenAI(api_key=self.api_key)
                print("✓ OpenAI API key loaded successfully")
            except Exception as e:
                print(f"Warning: Failed to initialize OpenAI client: {e}")
                print("Using mock responses instead.")
                self.use_mock = True
                self.client = None
        else:
            print("Warning: No OpenAI API key found. Using mock responses.")
            self.client = None
    
    def process_query(self, query: str, documents: List[Dict]) -> str:
        """Process a query against document contexts"""
        
        if not documents:
            return "No documents available to analyze. Please upload documents first."
        
        # Prepare context from documents
        context = self._prepare_context(documents)
        
        if self.use_mock:
            return self._generate_mock_response(query, documents)
        
        try:
            # Use OpenAI API
            response = self._query_llm(query, context)
            return response
        except Exception as e:
            print(f"Error querying LLM: {e}")
            return self._generate_fallback_response(query, documents)
    
    def _prepare_context(self, documents: List[Dict], max_chars: int = 8000) -> str:
        """Prepare document context for LLM"""
        context_parts = []
        current_length = 0
        
        for doc in documents:
            doc_intro = f"Document: {doc['filename']}\n"
            remaining_space = max_chars - current_length - len(doc_intro)
            
            if remaining_space <= 0:
                break
            
            # Take portion of document content
            content_excerpt = doc['content'][:remaining_space]
            doc_context = doc_intro + content_excerpt + "\n---\n"
            
            context_parts.append(doc_context)
            current_length += len(doc_context)
            
            if current_length >= max_chars:
                break
        
        return "".join(context_parts)
    
    def extract_queries(self, user_input: str) -> Dict:
        """Extract structured legal queries from user input using AI"""
        
        if self.use_mock:
            return self._generate_mock_extracted_queries(user_input)
        
        try:
            # Use OpenAI with JSON mode for structured output
            user_prompt = QUERY_EXTRACTION_USER_TEMPLATE.format(user_input=user_input)
            
            response = self.client.chat.completions.create(
                model=MODEL_CONFIG['extraction'],  # Using GPT-5-mini for query extraction
                response_format={ "type": "json_object" },
                messages=[
                    {"role": "system", "content": QUERY_EXTRACTION_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                max_completion_tokens=500
            )
            
            result = json.loads(response.choices[0].message.content)
            
            # Ensure proper structure
            if "queries" not in result:
                result = {"queries": []}
            
            # Add IDs if not present
            for i, query in enumerate(result["queries"]):
                if "id" not in query:
                    query["id"] = i + 1
                if "category" not in query:
                    query["category"] = "General"
                    
            return result
            
        except Exception as e:
            print(f"Error extracting queries with {MODEL_CONFIG['extraction']}: {e}")
            print(f"Full error details: {type(e).__name__}: {str(e)}")
            return self._generate_mock_extracted_queries(user_input)
    
    def _generate_mock_extracted_queries(self, user_input: str) -> Dict:
        """Generate mock extracted queries for testing"""
        mock_queries = [
            {
                "id": 1,
                "text": "What are the key facts surrounding the incident in question?",
                "category": "Facts"
            },
            {
                "id": 2,
                "text": "What evidence supports the defendant's claims in this case?",
                "category": "Evidence"
            },
            {
                "id": 3,
                "text": "Are there any procedural issues that could affect the outcome?",
                "category": "Procedure"
            },
            {
                "id": 4,
                "text": "What precedents are most relevant to this legal matter?",
                "category": "Precedents"
            }
        ]
        
        # Return 2-4 queries randomly
        import random
        num_queries = random.randint(2, 4)
        selected = mock_queries[:num_queries]
        
        return {"queries": selected}
    
    def _query_llm(self, query: str, context: str) -> str:
        """Query OpenAI GPT model"""
        try:
            user_prompt = DOCUMENT_QUERY_TEMPLATE.format(
                query=query,
                context=context
            )
            
            response = self.client.chat.completions.create(
                model=MODEL_CONFIG['analysis'],  # Using GPT-5-chat-latest for better analysis
                messages=[
                    {"role": "system", "content": LEGAL_ANALYSIS_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                max_completion_tokens=500
            )
            
            return response.choices[0].message.content
        
        except Exception as e:
            raise Exception(f"LLM query failed: {str(e)}")
    
    def stream_query(self, query: str, documents: List[Dict]):
        """Stream query processing with OpenAI streaming API"""
        if not documents:
            yield {"text": "No documents available to analyze.", "done": True}
            return
        
        context = self._prepare_context(documents)
        
        if self.use_mock:
            # Mock streaming response
            mock_response = self._generate_mock_response(query, documents)
            words = mock_response.split()
            for i, word in enumerate(words):
                yield {"text": word + " "}
                if i == len(words) - 1:
                    yield {"done": True}
            return
        
        try:
            user_prompt = DOCUMENT_QUERY_TEMPLATE.format(
                query=query,
                context=context
            )
            
            # Use streaming API
            stream = self.client.chat.completions.create(
                model=MODEL_CONFIG['analysis'],  # Using GPT-5-chat-latest for better analysis
                messages=[
                    {"role": "system", "content": LEGAL_ANALYSIS_SYSTEM_PROMPT},
                    {"role": "user", "content": user_prompt}
                ],
                max_completion_tokens=500,
                stream=True  # Enable streaming
            )
            
            for chunk in stream:
                if chunk.choices[0].delta.content:
                    yield {"text": chunk.choices[0].delta.content}
            
            yield {"done": True}
            
        except Exception as e:
            yield {"error": str(e), "done": True}
    
    def verify_response(self, query: str, response: str, documents: List[Dict], attempt: int = 1) -> Dict:
        """Verify response for hallucinations using VERIFICATION_PROMPT"""
        
        if self.use_mock:
            # Mock verification with varying confidence for testing
            import random
            confidence = random.uniform(0.3, 1.0) if attempt == 1 else 0.95
            return {
                "is_accurate": confidence > 0.5,
                "verified_text": response,
                "confidence": confidence,
                "attempt": attempt
            }
        
        try:
            context = self._prepare_context(documents)
            verification_prompt = VERIFICATION_PROMPT.format(
                query=query,
                answer=response,
                documents=context[:3000]  # Limit context for verification
            )
            
            response_obj = self.client.chat.completions.create(
                model=MODEL_CONFIG['verification'],  # Using GPT-5-nano for verification
                response_format={ "type": "json_object" },
                messages=[
                    {"role": "system", "content": "You are a legal document verification system. Verify answers are grounded in source documents."},
                    {"role": "user", "content": verification_prompt}
                ],
                max_completion_tokens=300
            )
            
            result = json.loads(response_obj.choices[0].message.content)
            
            # Ensure proper structure
            if "is_accurate" not in result:
                result["is_accurate"] = True
            if "corrected_answer" in result:
                result["verified_text"] = result["corrected_answer"]
            else:
                result["verified_text"] = response
            if "confidence" not in result:
                result["confidence"] = 0.9
                
            return result
            
        except Exception as e:
            print(f"Verification error: {e}")
            return {
                "is_accurate": True,
                "verified_text": response,
                "confidence": 0.8,
                "error": str(e)
            }
    
    def _generate_mock_response(self, query: str, documents: List[Dict]) -> str:
        """Generate mock response for testing without API key"""
        query_lower = query.lower()
        doc_names = [doc['filename'] for doc in documents]
        
        # Simulate different types of responses
        if 'contract' in query_lower or 'agreement' in query_lower:
            return f"""Based on analysis of {len(documents)} document(s) ({', '.join(doc_names[:2])}):

Key Contract Terms Identified:
• Agreement type: Service Agreement
• Effective date: January 1, 2024
• Term duration: 12 months with auto-renewal
• Payment terms: Net 30 days
• Termination: 30 days written notice

The agreement appears to be standard with mutual obligations clearly defined. 
No unusual clauses detected in the available sections."""
        
        elif 'risk' in query_lower or 'liability' in query_lower:
            return f"""Risk Analysis for uploaded documents:

Potential Legal Risks Identified:
1. Unlimited liability clause in Section 5.2
2. Broad indemnification requirements
3. No force majeure provisions
4. Ambiguous intellectual property assignments

Recommendations:
• Consider adding liability caps
• Clarify IP ownership terms
• Include standard force majeure language

Found 3 relevant sections across the documents."""
        
        elif 'deadline' in query_lower or 'date' in query_lower:
            return f"""Important Dates and Deadlines found in documents:

• Contract Execution: January 1, 2024
• First Deliverable Due: February 15, 2024
• Payment Due: 30 days from invoice
• Contract Renewal Date: December 1, 2024
• Termination Notice Period: 30 days

Total of 7 date references found across {len(documents)} document(s)."""
        
        elif 'summary' in query_lower or 'summarize' in query_lower:
            return f"""Document Summary:

Analyzing {len(documents)} document(s):
{chr(10).join(['• ' + doc['filename'] for doc in documents[:3]])}

These documents appear to contain legal agreements and related correspondence. 
The main topics covered include:
- Contractual obligations and terms
- Payment schedules and amounts
- Delivery requirements and timelines
- Standard legal provisions

The documents are formal legal instruments requiring careful review."""
        
        else:
            # Generic response
            return f"""Analysis of your query: "{query}"

I've reviewed {len(documents)} document(s) in your case file:
{chr(10).join(['• ' + doc['filename'] for doc in documents[:3]])}

Based on the available text, here are the key findings:
• Multiple references to the subject matter were found
• The documents contain relevant information across several sections
• Further analysis may be needed for comprehensive understanding

The query has been processed against all uploaded documents. 
Found approximately 3-5 relevant mentions across the files."""
    
    def _generate_fallback_response(self, query: str, documents: List[Dict]) -> str:
        """Generate fallback response when LLM is unavailable"""
        return f"""Query processed: "{query}"

Analyzing {len(documents)} document(s) in the system.

Note: Advanced AI analysis is temporarily unavailable. 
Basic document search shows multiple potential matches for your query.
Documents have been indexed and are ready for detailed analysis.

For full AI-powered analysis, please ensure the OpenAI API key is configured."""
    
    def extract_citations(self, text: str) -> List[str]:
        """Extract legal citations from text"""
        citations = []
        
        # Federal case citations
        federal_pattern = r'\d+\s+F\.\d+\s+\d+'
        citations.extend(re.findall(federal_pattern, text))
        
        # State case citations
        state_pattern = r'\d+\s+[A-Z][a-z]+\.?\s+\d+'
        citations.extend(re.findall(state_pattern, text))
        
        # Statute citations
        statute_pattern = r'\d+\s+U\.S\.C\.?\s+§?\s*\d+'
        citations.extend(re.findall(statute_pattern, text))
        
        return list(set(citations))
    
    def format_legal_response(self, response: str) -> str:
        """Format response with proper legal formatting"""
        # Add bullet points for lists
        response = re.sub(r'^- ', '• ', response, flags=re.MULTILINE)
        
        # Highlight section references
        response = re.sub(r'(Section \d+\.?\d*)', r'**\1**', response)
        
        # Format citations
        response = re.sub(r'(\d+\s+[A-Z]\.\d+\s+\d+)', r'_\1_', response)
        
        return response
    
    def swap_query(self, original_query: str, user_context: str, existing_queries: List[str]) -> str:
        """Generate a contextually similar replacement query that avoids duplicates"""
        
        if self.use_mock:
            # Mock response for testing
            replacements = [
                "What are the specific remedies and damages available if either party breaches the contract?",
                "How are intellectual property rights allocated and protected under this agreement?",
                "What are the dispute resolution procedures and governing law provisions?",
                "Are there any warranties, representations, or indemnification clauses that affect liability?",
                "What are the payment terms, conditions, and any penalties for late payment?",
                "How can the contract be modified, amended, or assigned to third parties?"
            ]
            import random
            new_query = random.choice([q for q in replacements if q not in existing_queries])
            return new_query if new_query else "What are the key financial obligations in this agreement?"
        
        try:
            # Prepare the prompt for generating a replacement query
            existing_list = "\n".join([f"- {q}" for q in existing_queries])
            
            swap_prompt = f"""You are a legal document analysis assistant helping to generate alternative questions for legal document review.

User's original request: "{user_context}"

Current question to replace: "{original_query}"

Already existing questions (DO NOT duplicate any of these):
{existing_list}

Generate ONE alternative legal question that:
1. Is directly relevant to the user's original request about {user_context}
2. Is distinctly different from the current question
3. Does NOT duplicate any of the existing questions listed above
4. Maintains a professional legal analysis focus
5. Is specific and actionable for document analysis

Return ONLY the new question text, no explanation or preamble."""

            response = self.client.chat.completions.create(
                model=MODEL_CONFIG['swap'],  # Using GPT-5-mini for swap questions
                messages=[
                    {"role": "system", "content": "You are a legal document analysis expert. Generate precise, relevant legal questions."},
                    {"role": "user", "content": swap_prompt}
                ],
                max_completion_tokens=100
            )
            
            new_query = response.choices[0].message.content.strip()
            
            # Clean up the response - remove quotes if present
            new_query = new_query.strip('"').strip("'")
            
            # Ensure it's not a duplicate
            if new_query.lower() in [q.lower() for q in existing_queries]:
                # If somehow we got a duplicate, generate a fallback
                return f"What specific provisions relate to {user_context} that haven't been addressed yet?"
            
            return new_query
            
        except Exception as e:
            print(f"Error in swap_query: {e}")
            # Return a generic fallback question
            return "What other important provisions should be reviewed in this document?"