"""
Simple OCR processing with EasyOCR
"""
import os
import tempfile
from typing import Dict, Any

import easyocr
from fastapi import UploadFile

# Initialize EasyOCR reader
reader = easyocr.Reader(['en'])

async def process_image(file: UploadFile) -> Dict[str, Any]:
    """Process an image file using EasyOCR for text extraction."""
    try:
        # Read file content
        content = await file.read()
        
        # Create a temporary file
        with tempfile.NamedTemporaryFile(delete=False, suffix='.png') as temp_file:
            temp_file.write(content)
            temp_file_path = temp_file.name
        
        try:
            # Process with EasyOCR
            result = reader.readtext(temp_file_path)
            extracted_text = "\n".join([text for _, text, _ in result])
            
            # Return the result
            return {
                "filename": file.filename,
                "text": extracted_text,
                "success": True
            }
        except Exception as e:
            return {
                "filename": file.filename,
                "text": "",
                "success": False,
                "error": f"Error processing image: {str(e)}"
            }
        finally:
            # Clean up the temporary file
            if os.path.exists(temp_file_path):
                os.unlink(temp_file_path)
    except Exception as e:
        return {
            "filename": file.filename,
            "text": "",
            "success": False,
            "error": f"Error processing file: {str(e)}"
        }