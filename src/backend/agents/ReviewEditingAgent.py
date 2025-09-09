"""Review Editing Agent - Production-ready implementation for formatting and style enhancement"""

from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session
from langchain.prompts import PromptTemplate
from langchain.schema.output_parser import StrOutputParser
from langchain_groq import ChatGroq
from langchain_community.chat_models import ChatOpenAI
from langchain.llms.base import LLM
from langchain.callbacks.manager import CallbackManagerForLLMRun
import re
import uuid
import asyncio
import tenacity
import logging

from .base_agent import BaseAgent
from .DocumentIngestionAgent import DocumentIngestionAgent
from ..config import settings

logger = logging.getLogger(__name__)

class MockReviewLLM(LLM):
    """Mock LLM for review editing when API keys are not available"""
    
    @property
    def _llm_type(self) -> str:
        return "mock_review"
    
    def _call(self, prompt: str, stop: Optional[List[str]] = None, run_manager: Optional[CallbackManagerForLLMRun] = None, **kwargs: Any) -> str:
        content_match = re.search(r'Content to review:(.*?)(?=Style Profile:|Feedback:|$)', prompt, re.DOTALL)
        content = content_match.group(1).strip() if content_match else prompt
        # Simple formatting improvements
        improved = re.sub(r'\n{3,}', '\n\n', content)
        improved = re.sub(r'([.!?])\s*([A-Z])', r'\1 \2', improved)
        return improved

class ReviewEditingAgent(BaseAgent):
    """Production-ready Review Editing Agent for formatting and style enhancement"""
    
    def __init__(self):
        super().__init__(name="review_editing", description="Enhances formatting, ensures professional style")
        # Initialize LLM based on available API keys
        if settings.groq_api_key:
            self.llm = ChatGroq(
                groq_api_key=settings.groq_api_key,
                model_name=settings.llm_model,
                temperature=0.1,  # Low temperature for consistent formatting
                max_tokens=8192  # NEW: Increased max_tokens for complete reviews
            )
        else:
            self.llm = MockReviewLLM()
            
        # Import difflib for generating detailed diffs
        import difflib
        self.difflib = difflib
        
        # Create prompt templates for different review types
        self.formatting_template = PromptTemplate.from_template(
            "You are an expert editor specializing in technical document formatting and style. "
            "Review and improve the following document content:\n\n"
            "Content to review:\n{content}\n\n"
            "Style Profile:\n{style_profile}\n\n"
            "Please ensure:\n"
            "1. Proper Markdown formatting with consistent headers\n"
            "2. Correct section numbering\n"
            "3. Well-aligned tables\n"
            "4. Standardized code blocks\n"
            "5. Professional tone and clarity\n\n"
            "Return ONLY the improved content in proper Markdown format."
        )
        
        self.feedback_template = PromptTemplate.from_template(
            "You are an expert editor addressing specific feedback on a document. "
            "Review and improve the following content based on the feedback provided:\n\n"
            "Content to review:\n{content}\n\n"
            "Feedback to address:\n{feedback}\n\n"
            "Please address all feedback points while maintaining document quality and formatting.\n"
            "Return ONLY the improved content in proper Markdown format."
        )
        
        self.formatting_chain = self.formatting_template | self.llm | StrOutputParser()
        self.feedback_chain = self.feedback_template | self.llm | StrOutputParser()
    
    def _format_style_profile(self, style_profile: Dict[str, Any]) -> str:
        """Format style profile for use in prompts"""
        if not style_profile:
            return "Professional technical writing style with clear structure"
        
        formatted = []
        if "tone_analysis" in style_profile:
            tone = style_profile["tone_analysis"]
            dominant_tone = max(tone, key=tone.get) if tone else "professional"
            formatted.append(f"Primary tone: {dominant_tone}")
        
        if "heading_patterns" in style_profile:
            headings = style_profile["heading_patterns"]
            preferred = max(headings, key=headings.get) if headings else "hash_headers"
            formatted.append(f"Heading style: {preferred}")
        
        if "list_indicators" in style_profile:
            lists = style_profile["list_indicators"]
            preferred = max(lists, key=lists.get) if lists else "bullet_points"
            formatted.append(f"List style: {preferred}")
        
        return "; ".join(formatted) if formatted else "Professional technical writing style"
    
    def _post_process_formatting(self, content: str) -> str:
        """Apply final formatting improvements"""
        # Ensure proper spacing around headers
        lines = content.split('\n')
        processed_lines = []
        
        for i, line in enumerate(lines):
            if line.startswith('#'):
                # Add blank line before header if not at start
                if processed_lines and processed_lines[-1].strip():
                    processed_lines.append('')
                processed_lines.append(line)
                # Add blank line after header if not at end
                if i < len(lines) - 1 and lines[i + 1].strip():
                    processed_lines.append('')
            else:
                processed_lines.append(line)
        
        # Limit consecutive blank lines to 2
        final_lines = []
        blank_count = 0
        
        for line in processed_lines:
            if not line.strip():
                blank_count += 1
                if blank_count <= 2:
                    final_lines.append(line)
            else:
                blank_count = 0
                final_lines.append(line)
        
        # Fix punctuation spacing
        content = '\n'.join(final_lines)
        content = re.sub(r'([.!?])\s*([A-Z])', r'\1 \2', content)
        
        return content.strip()
        
    def _generate_diff_details(self, original_content: str, improved_content: str) -> dict:
        """Generate detailed diff information between original and improved content"""
        # Split content into lines for comparison
        original_lines = original_content.split('\n')
        improved_lines = improved_content.split('\n')
        
        # Generate unified diff
        diff = list(self.difflib.unified_diff(
            original_lines,
            improved_lines,
            lineterm='',
            n=2  # Context lines
        ))
        
        # Skip the header lines (first 3 lines of unified diff)
        if len(diff) > 2:
            diff = diff[3:]
        
        # Process the diff to create a more readable format
        removed_lines = []
        added_lines = []
        
        for line in diff:
            if line.startswith('+') and not line.startswith('+++'):
                added_lines.append(line[1:])
            elif line.startswith('-') and not line.startswith('---'):
                removed_lines.append(line[1:])
        
        # Create a summary of changes
        changes_summary = []
        if removed_lines and added_lines:
            changes_summary.append("Content was revised with both removals and additions.")
        elif removed_lines:
            changes_summary.append("Content was streamlined with some text removed.")
        elif added_lines:
            changes_summary.append("Content was enhanced with additional information.")
        
        # Return structured diff information
        return {
            "removed": removed_lines,
            "added": added_lines,
            "summary": changes_summary,
            "unified_diff": diff[:100] if len(diff) > 100 else diff  # Limit diff size
        }
    
    @tenacity.retry(
        stop=tenacity.stop_after_attempt(3),
        wait=tenacity.wait_exponential(multiplier=1, min=4, max=10),
        retry=tenacity.retry_if_exception_type(Exception)
    )
    async def execute(
        self, 
        content: str, 
        doc_type: str = "SRS",
        style_profile: Optional[Dict[str, Any]] = None,
        feedback: Optional[List[str]] = None,
        review_type: str = "formatting",  # formatting, feedback, or both
        approved: bool = False,
        feedback_score: int = 3,
        db_session: Optional[Session] = None
    ) -> Dict[str, Any]:
        """Execute the review and editing process"""
        try:
            logger.info(f"ReviewEditingAgent executing with content length: {len(content)}")
            improved_content = content
            changes_made = []
            
            # Apply formatting improvements
            if review_type in ["formatting", "both"]:
                style_text = self._format_style_profile(style_profile or {})
                improved_content = await self.formatting_chain.ainvoke({
                    "content": improved_content,
                    "style_profile": style_text
                })
                changes_made.append("Applied formatting improvements")
            
            # Address feedback if provided
            if feedback and review_type in ["feedback", "both"]:
                feedback_text = "\n".join([f"- {item}" for item in feedback])
                improved_content = await self.feedback_chain.ainvoke({
                    "content": improved_content,
                    "feedback": feedback_text
                })
                changes_made.append(f"Addressed {len(feedback)} feedback items")
            
            # Apply final post-processing
            final_content = self._post_process_formatting(improved_content)
            
            # Store in database if approved
            document_id = None
            if approved and db_session:
                ingestion_agent = DocumentIngestionAgent()
                ingest_result = await ingestion_agent.execute(
                    db=db_session,
                    filename=f"reviewed_{doc_type}_{uuid.uuid4().hex[:8]}.md",
                    content=final_content,
                    doc_type=doc_type,
                    approved=approved,
                    feedback_score=feedback_score
                )
                document_id = ingest_result.get("document_id")
            
            # Generate detailed diff of changes
            diff_details = self._generate_diff_details(content, final_content)
            
            return {
                "status": "success",
                "document_id": document_id,
                "improved_content": final_content,
                "changes_made": changes_made,
                "diff_details": diff_details,
                "original_word_count": len(content.split()),
                "final_word_count": len(final_content.split())
            }
            
        except Exception as e:
            logger.error(f"ReviewEditingAgent execution failed: {e}")
            return {
                "status": "error",
                "message": str(e),
                "improved_content": content,
                "changes_made": [],
                "original_word_count": len(content.split()),
                "final_word_count": len(content.split())
            }