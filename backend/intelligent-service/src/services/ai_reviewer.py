import os
import httpx
from io import BytesIO
from typing import List, Optional
from pypdf import PdfReader

from langchain_core.prompts import PromptTemplate
from langchain_google_genai import ChatGoogleGenerativeAI
from langchain_core.output_parsers import JsonOutputParser
from pydantic import BaseModel, Field

from ..config import settings


# 1) Output schema
class AIReviewResponse(BaseModel):
    synopsis: str = Field(description="A neutral summary of the paper")
    key_points: List[str] = Field(description="List of 3-5 key extraction points (claims/methods)")


class AIReviewerService:
    def __init__(self):
        # Lấy API key từ settings
        api_key = (settings.GOOGLE_API_KEY or "").strip()

        # Key mẫu trong .env.example => coi như chưa cấu hình
        self.is_mock = (not api_key) or (api_key == "GeminiAPTkey")

        # Cho phép cấu hình model qua env; mặc định model mới (Sửa lại default là 1.5-flash cho chuẩn)
        self.model_name = os.getenv("GEMINI_MODEL", "gemini-1.5-flash").strip()

        self.llm: Optional[ChatGoogleGenerativeAI] = None
        self.parser: Optional[JsonOutputParser] = None

        if not self.is_mock:
            try:
                self.llm = ChatGoogleGenerativeAI(
                    model=self.model_name,
                    temperature=0.3,
                    google_api_key=api_key,
                    max_output_tokens=1024,
                )
                self.parser = JsonOutputParser(pydantic_object=AIReviewResponse)
            except Exception as e:
                print(f"❌ Failed to initialize Gemini LLM (model={self.model_name}): {e}")
                self.is_mock = True

    async def analyze_pdf_url(self, pdf_url: str):
        """
        Tải PDF từ URL -> Extract Text -> Gửi cho Gemini
        """
        if self.is_mock:
            print("⚠️ Using Mock data (Mock mode active).")
            return self._get_mock_response()

        # 1. Tải file PDF
        print(f"📥 Downloading PDF from: {pdf_url}")
        try:
            async with httpx.AsyncClient() as client:
                # Timeout 30s để tránh treo nếu mạng chậm
                resp = await client.get(pdf_url, follow_redirects=True, timeout=30.0)
                if resp.status_code != 200:
                    print(f"❌ Failed to download PDF. Status: {resp.status_code}")
                    return self._get_mock_response()
                pdf_bytes = BytesIO(resp.content)
        except Exception as e:
            print(f"❌ Download error: {e}")
            return self._get_mock_response()

        # 2. Extract Text từ PDF
        try:
            reader = PdfReader(pdf_bytes)
            text_content = ""
            # Lấy tối đa 5 trang đầu để tiết kiệm token và tăng tốc độ xử lý
            max_pages = 5
            for i, page in enumerate(reader.pages[:max_pages]):
                extracted = page.extract_text()
                if extracted:
                    text_content += extracted + "\n"
            
            print(f"✅ Extracted {len(text_content)} chars from PDF.")
            
            if not text_content.strip():
                print("⚠️ PDF extracted text is empty (maybe scanned image?).")
                return self._get_mock_response()

        except Exception as e:
            print(f"❌ PDF Parsing error: {e}")
            return self._get_mock_response()

        # 3. Gọi Gemini xử lý text
        return self._analyze_text_content(text_content)

    def analyze_paper_abstract(self, title: str, abstract: str):
        """
        Phân tích Abstract dùng Gemini AI (Logic cũ, dùng khi chỉ có Abstract)
        """
        if self.is_mock or self.llm is None or self.parser is None:
            print("⚠️ Using Mock data (missing API key or Gemini init failed).")
            return self._get_mock_response()

        prompt_template = PromptTemplate(
            template="""
You are an expert AI Assistant for an Academic Conference Reviewer.
Your task is to provide a neutral synopsis and extract key points from the following paper abstract.

Paper Title: {title}
Abstract: {abstract}

Output must be a valid JSON object with the following keys:
- "synopsis": A 3-4 sentence neutral summary of the paper (in Vietnamese if the input is Vietnamese, otherwise English).
- "key_points": A list of 3-5 bullet points covering main claims or methods.

{format_instructions}
""".strip(),
            input_variables=["title", "abstract"],
            partial_variables={"format_instructions": self.parser.get_format_instructions()},
        )

        chain = prompt_template | self.llm | self.parser

        try:
            return chain.invoke({"title": title, "abstract": abstract})
        except Exception as e:
            # Lỗi thường gặp: 404 model not found, 429 quota, timeout...
            print(f"🔥 Gemini AI Error (model={self.model_name}): {e}")
            return self._get_mock_response()

    def _analyze_text_content(self, text: str):
        """
        Hàm nội bộ: Gửi nội dung text dài (từ PDF) cho Gemini
        """
        if self.llm is None or self.parser is None:
             return self._get_mock_response()
             
        prompt_template = PromptTemplate(
            template="""
You are an expert AI Assistant. 
Your task is to provide a neutral synopsis and extract key points from the following academic paper content.

Paper Content (First few pages):
{text}

Output must be a valid JSON object with:
- "synopsis": A 3-4 sentence neutral summary (in Vietnamese).
- "key_points": A list of 3-5 bullet points covering main claims/methods (in Vietnamese).

{format_instructions}
""".strip(),
            input_variables=["text"],
            partial_variables={"format_instructions": self.parser.get_format_instructions()},
        )

        chain = prompt_template | self.llm | self.parser
        try:
            return chain.invoke({"text": text})
        except Exception as e:
            print(f"🔥 Gemini AI Error (PDF processing): {e}")
            return self._get_mock_response()

    def _get_mock_response(self):
        return {
            "synopsis": "[Mock] Bài báo này đề xuất kiến trúc Microservices sử dụng Gemini AI để hỗ trợ Reviewer. Tác giả tập trung vào việc tích hợp LangChain để xử lý ngôn ngữ tự nhiên.",
            "key_points": [
                "Tích hợp Google Gemini vào hệ thống quản lý hội nghị.",
                "Sử dụng LangChain để parse dữ liệu JSON tự động.",
                "Hỗ trợ Reviewer tóm tắt nội dung bài báo khoa học nhanh chóng.",
            ],
        }


# Singleton instance để sử dụng trong router
ai_service = AIReviewerService()