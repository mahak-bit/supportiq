from __future__ import annotations

import logging

from fastapi import APIRouter, BackgroundTasks, Depends, File, HTTPException, Response, UploadFile
from sqlalchemy import select
from sqlalchemy.orm import Session, selectinload

from app.config import get_settings
from app.db import SessionLocal, get_db
from app.generation.reply import ReplyContext, generate_reply
from app.llm.providers import get_llm
from app.models import Chunk, KnowledgeDocument, User
from app.rag.embeddings import get_embedder
from app.rag.extract import ExtractionError
from app.rag.ingest import create_document, process_document, refresh_index, sha256
from app.rag.retriever import min_score, retrieve
from app.schemas import AskIn, AskOut, DocumentDetail, DocumentOut, PassageOut, SearchIn, SearchOut
from app.security import ai_rate_limit, current_user, require_role

router = APIRouter(prefix="/api/knowledge", tags=["knowledge"])
log = logging.getLogger("supportiq.knowledge")


def _process_in_background(doc_id: int, data: bytes) -> None:
    with SessionLocal() as db:
        process_document(db, doc_id, data)


@router.get("/documents", response_model=list[DocumentOut])
def list_documents(db: Session = Depends(get_db), _: User = Depends(current_user)) -> list[KnowledgeDocument]:
    return list(db.scalars(select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())))


@router.post("/documents", response_model=DocumentOut, status_code=202)
async def upload_document(background: BackgroundTasks, file: UploadFile = File(...), db: Session = Depends(get_db),
                          user: User = Depends(current_user)) -> KnowledgeDocument:
    limit = get_settings().max_upload_mb * 1024 * 1024
    data = await file.read(limit + 1)  # never buffer more than the limit
    if len(data) > limit:
        raise HTTPException(413, f"File exceeds the {get_settings().max_upload_mb} MB limit.")
    existing = db.scalar(select(KnowledgeDocument).where(KnowledgeDocument.sha256 == sha256(data), KnowledgeDocument.status != "failed"))
    if existing:
        raise HTTPException(409, f"This file is already in the knowledge base as “{existing.title}”.")
    try:
        doc = create_document(db, file.filename or "upload", data, user_id=user.id)
    except ExtractionError as exc:
        raise HTTPException(422, str(exc)) from None
    if get_settings().inline_ingest:
        return process_document(db, doc.id, data)
    background.add_task(_process_in_background, doc.id, data)
    return doc


@router.get("/documents/{doc_id}", response_model=DocumentDetail)
def get_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(current_user)) -> KnowledgeDocument:
    doc = db.scalar(select(KnowledgeDocument).options(selectinload(KnowledgeDocument.chunks)).where(KnowledgeDocument.id == doc_id))
    if doc is None:
        raise HTTPException(404, "Document not found.")
    return doc


@router.delete("/documents/{doc_id}", status_code=204, response_class=Response, response_model=None)
def delete_document(doc_id: int, db: Session = Depends(get_db), _: User = Depends(require_role("lead"))) -> Response:
    doc = db.get(KnowledgeDocument, doc_id)
    if doc is None:
        raise HTTPException(404, "Document not found.")
    db.delete(doc)
    db.commit()
    refresh_index(db)
    return Response(status_code=204)


@router.post("/reindex", response_model=list[DocumentOut])
def reindex(db: Session = Depends(get_db), _: User = Depends(require_role("lead"))) -> list[KnowledgeDocument]:
    """Re-embed every stored chunk with the currently configured embedding model."""
    embedder = get_embedder()
    docs = list(db.scalars(select(KnowledgeDocument).options(selectinload(KnowledgeDocument.chunks))
                           .where(KnowledgeDocument.status == "indexed")))
    for doc in docs:
        chunks: list[Chunk] = doc.chunks
        vecs = embedder.embed_documents([f"{c.section}\n{c.text}" if c.section else c.text for c in chunks])
        for c, v in zip(chunks, vecs):
            c.embedding = v.astype("float32").tobytes()
        doc.embedding_model = embedder.name
    db.commit()
    refresh_index(db)
    return list(db.scalars(select(KnowledgeDocument).order_by(KnowledgeDocument.created_at.desc())))


@router.post("/search", response_model=SearchOut)
def search(body: SearchIn, db: Session = Depends(get_db), _: User = Depends(current_user)) -> SearchOut:
    floor = min_score()
    results = retrieve(db, body.query, body.k, apply_threshold=False)
    return SearchOut(query=body.query, threshold=floor,
                     results=[PassageOut(**p.to_dict(), above_threshold=p.score >= floor) for p in results])


@router.post("/ask", response_model=AskOut)
def ask(body: AskIn, db: Session = Depends(get_db), user: User = Depends(ai_rate_limit)) -> AskOut:
    passages = retrieve(db, body.question)
    ctx = ReplyContext(customer_name="", customer_message=body.question, agent_name=user.name.split()[0], tone=body.tone,
                       passages=passages, audience="agent")
    r = generate_reply(ctx, get_llm())
    floor = min_score()
    return AskOut(answer=r.body, citations=r.citations, validation=r.validation, insufficient_evidence=r.insufficient_evidence,
                  confidence=r.confidence, provider=r.provider, model=r.model,
                  retrieved=[PassageOut(**p.to_dict(), above_threshold=p.score >= floor) for p in passages])
