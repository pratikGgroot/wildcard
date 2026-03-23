# Story 02.3: OCR for Scanned PDF Resumes

## User Story
**As a** system  
**I want to** run OCR on scanned PDF resumes  
**So that** image-based resumes are converted to text and can be parsed like native PDFs

## BRD Requirements Covered
- FR-RP-02: Parse resumes using AI to extract structured data
- BRD Section 8.1: OCR pipeline using Tesseract or AWS Textract for scanned PDFs

## Acceptance Criteria
1. **Given** a scanned PDF is detected (no native text)  
   **When** OCR is triggered  
   **Then** AWS Textract (or Tesseract fallback) processes the file and returns extracted text

2. **Given** OCR completes  
   **When** text quality is assessed  
   **Then** a confidence score is attached; if confidence < 0.6, the file is flagged for manual review

3. **Given** OCR succeeds  
   **When** text is extracted  
   **Then** it is stored and passed to the LLM extraction pipeline (Story 02.4)

4. **Given** OCR fails (API error or timeout)  
   **When** failure occurs  
   **Then** the system retries once with Tesseract fallback; if both fail, the file is flagged with error

5. **Given** OCR processing takes longer than 30 seconds  
   **When** timeout occurs  
   **Then** the job is flagged as "OCR timeout — manual review required"

## Priority
**P0 — Must Have**

## Estimated Effort
**5 story points**

## NFR / Tech Notes
- **Primary OCR:** AWS Textract (higher accuracy for complex layouts)
- **Fallback OCR:** Tesseract (open-source, lower cost)
- **OCR Latency:** ≤30 seconds per page (AWS Textract async)
- **Confidence Threshold:** Flag files with OCR confidence < 0.6
- **Cost Control:** Use Textract async API for multi-page documents

### SLA Requirements
- **OCR Processing:** ≤30 seconds per document (P95)
- **Fallback Trigger:** Within 5 seconds of primary OCR failure

## Technical Design

### OCR Pipeline
```python
class OCRService:
    async def process(self, file_key: str) -> dict:
        # Try AWS Textract first
        try:
            result = await self._textract_async(file_key)
            if result['confidence'] >= 0.6:
                return result
        except Exception:
            pass
        
        # Fallback to Tesseract
        file_bytes = await download_from_s3(file_key)
        return self._tesseract_ocr(file_bytes)
    
    async def _textract_async(self, file_key: str) -> dict:
        client = boto3.client('textract')
        response = client.start_document_text_detection(
            DocumentLocation={'S3Object': {'Bucket': BUCKET, 'Name': file_key}}
        )
        job_id = response['JobId']
        # Poll for completion
        text, confidence = await self._poll_textract(job_id)
        return {'text': text, 'confidence': confidence, 'method': 'textract'}
```

## Sub-Tasks
- [ ] 02.3.a — Implement AWS Textract async integration
- [ ] 02.3.b — Implement Tesseract fallback
- [ ] 02.3.c — Implement confidence scoring and flagging
- [ ] 02.3.d — Implement OCR timeout handling

## Testing Strategy
- Unit: Confidence scoring, fallback trigger logic
- Integration: AWS Textract with sample scanned PDFs
- Performance: ≤30 second SLA for multi-page documents
- Fallback: Verify Tesseract activates when Textract fails

## Dependencies
- Story 02.2 (Text extraction — scanned detection)
- AWS Textract access (Epic 15)
