#!/usr/bin/env python
# /// script
# dependencies = ["fastapi","uvicorn[standard]","pydantic","python-dotenv"]
# ///
"""Minimal signaling server for Milestone 1 & extended for Milestone 2 (multi-peer star topology, non-trickle ICE).
Run with: uv run signaling_server.py (Astral uv)

Endpoints:
POST /session -> { code }
Legacy (Milestone 1) 1:1 endpoints:
POST /session/{code}/offer  body: {"type":"offer","sdp":"..."}
GET  /session/{code}/offer  -> offer or 404
POST /session/{code}/answer body: {"type":"answer","sdp":"..."}
GET  /session/{code}/answer -> answer or 404

Milestone 2 multi-peer star topology endpoints:
POST /session/{code}/join -> { participant_id }
GET  /session/{code}/participants -> [{"id": pid, "offer": bool, "answer": bool, "updated_at": ts}]
POST /session/{code}/peer/{pid}/offer  body: SDPModel
GET  /session/{code}/peer/{pid}/offer
POST /session/{code}/peer/{pid}/answer body: SDPModel
GET  /session/{code}/peer/{pid}/answer
GET  /health -> { status: "ok" }

In-memory ephemeral storage; sessions expire after TTL (default 600s).
"""
from __future__ import annotations

import secrets
import string
import time
from typing import Dict, Optional

from fastapi import FastAPI, HTTPException, BackgroundTasks, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

SESSION_TTL_SECONDS = 1800  # 30 minutes default TTL (extended from original 10 min)
SESSION_CODE_LEN = 6  # base32 alphabet subset for readability
CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"  # omit easily confused chars

class SDPModel(BaseModel):
    type: str
    sdp: str

class Participant:
    __slots__ = ("participant_id", "created_at", "updated_at", "offer", "answer", "display_name")

    def __init__(self, participant_id: str, display_name: Optional[str] = None):
        now = time.time()
        self.participant_id = participant_id
        self.created_at = now
        self.updated_at = now
        self.offer: Optional[SDPModel] = None  # legacy host -> participant offer (star)
        self.answer: Optional[SDPModel] = None  # legacy participant -> host answer (star)
        self.display_name = display_name or participant_id

    def touch(self):
        self.updated_at = time.time()

class Session:
    __slots__ = ("code", "created_at", "offer", "answer", "updated_at", "participants", "pair_offers", "pair_answers", "pair_candidates")
    def __init__(self, code: str):
        self.code = code
        now = time.time()
        self.created_at = now
        self.updated_at = now
        # Legacy single-offer storage (host <-> first peer) remains for backward compatibility
        self.offer: Optional[SDPModel] = None
        self.answer: Optional[SDPModel] = None
        # participants map id -> Participant
        self.participants: Dict[str, Participant] = {}
        # Full-mesh pair signaling maps (from_id, to_id) -> SDPModel
        self.pair_offers: Dict[tuple, SDPModel] = {}
        self.pair_answers: Dict[tuple, SDPModel] = {}
        # Trickle ICE candidates: (from_id, to_id) -> [CandidateModel,...]
        self.pair_candidates: Dict[tuple, list[CandidateModel]] = {}

    def touch(self):
        self.updated_at = time.time()

sessions: Dict[str, Session] = {}
_cleanup_task = None  # asyncio Task handle for periodic cleanup

app = FastAPI(title="Group Play Signaling", version="0.1.0")

# Allow all origins for development; tighten later if desired
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

def generate_code() -> str:
    return "".join(secrets.choice(CODE_ALPHABET) for _ in range(SESSION_CODE_LEN))

def cleanup_expired():
    now = time.time()
    to_delete = [c for c, s in sessions.items() if (now - s.updated_at) > SESSION_TTL_SECONDS]
    for code in to_delete:
        sessions.pop(code, None)

@app.on_event("startup")
async def _on_startup():
    """Start periodic background cleanup loop."""
    import asyncio, logging
    logger = logging.getLogger("signaling")
    async def periodic_cleanup():
        while True:
            try:
                cleanup_expired()
            except Exception as e:  # pragma: no cover (best effort)
                logger.warning("cleanup loop failure: %s", e)
            await asyncio.sleep(60)  # run every 60s
    global _cleanup_task
    # Launch detached task
    try:
        loop = asyncio.get_running_loop()
        _cleanup_task = loop.create_task(periodic_cleanup())
    except RuntimeError:
        # Fallback: run one immediate cleanup if loop acquisition fails
        cleanup_expired()

@app.on_event("shutdown")
async def _on_shutdown():
    global _cleanup_task
    if _cleanup_task and not _cleanup_task.done():
        _cleanup_task.cancel()
        try:
            await _cleanup_task
        except Exception:  # pragma: no cover
            pass

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/session")
async def create_session(background_tasks: BackgroundTasks):
    # Cleanup opportunistically
    cleanup_expired()
    for _ in range(5):
        code = generate_code()
        if code not in sessions:
            sessions[code] = Session(code)
            break
    else:
        raise HTTPException(status_code=500, detail="Failed to allocate session code")
    background_tasks.add_task(cleanup_expired)
    return {"code": code}

@app.post("/session/{code}/offer")
async def post_offer(code: str, offer: SDPModel, background_tasks: BackgroundTasks):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.offer is not None:
        raise HTTPException(status_code=409, detail="Offer already set")
    if offer.type.lower() != "offer":
        raise HTTPException(status_code=400, detail="Type must be 'offer'")
    sess.offer = offer
    sess.touch()
    background_tasks.add_task(cleanup_expired)
    return {"status": "ok"}

@app.get("/session/{code}/offer")
async def get_offer(code: str):
    sess = sessions.get(code)
    if not sess or not sess.offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    return sess.offer

@app.post("/session/{code}/answer")
async def post_answer(code: str, answer: SDPModel, background_tasks: BackgroundTasks):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if sess.offer is None:
        raise HTTPException(status_code=400, detail="Offer not yet set")
    if sess.answer is not None:
        raise HTTPException(status_code=409, detail="Answer already set")
    if answer.type.lower() != "answer":
        raise HTTPException(status_code=400, detail="Type must be 'answer'")
    sess.answer = answer
    sess.touch()
    background_tasks.add_task(cleanup_expired)
    return {"status": "ok"}

@app.get("/session/{code}/answer")
async def get_answer(code: str):
    sess = sessions.get(code)
    if not sess or not sess.answer:
        raise HTTPException(status_code=404, detail="Answer not found")
    return sess.answer

# ---------------- Milestone 2 Multi-Peer Endpoints ----------------

def _generate_participant_id() -> str:
    return generate_code()  # reuse same alphabet & length

@app.post("/session/{code}/join")
async def join_session(code: str, background_tasks: BackgroundTasks, payload: dict | None = None):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    # create participant
    for _ in range(5):
        pid = _generate_participant_id()
        if pid not in sess.participants:
            display_name = None
            if payload and isinstance(payload, dict):
                display_name = payload.get("display_name")
            participant = Participant(pid, display_name=display_name)
            sess.participants[pid] = participant
            sess.touch()
            background_tasks.add_task(cleanup_expired)
            return {"participant_id": pid, "display_name": participant.display_name}
    raise HTTPException(status_code=500, detail="Failed to allocate participant id")

@app.get("/session/{code}/participants")
async def list_participants(code: str):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    out = []
    for pid, p in sess.participants.items():
        out.append({
            "id": pid,
            "offer": p.offer is not None,
            "answer": p.answer is not None,
            "updated_at": p.updated_at,
            "display_name": p.display_name
        })
    return out

def _get_participant(sess: Session, pid: str) -> Participant:
    part = sess.participants.get(pid)
    if not part:
        raise HTTPException(status_code=404, detail="Participant not found")
    return part

def _sanitize_display_name(raw: Optional[str], fallback: str) -> str:
    if not raw:
        return fallback
    # Allow alphanumerics, space, underscore, dash, period
    filtered = ''.join(ch for ch in raw if ch.isalnum() or ch in (' ','_','-','.'))
    # Collapse multiple spaces
    import re
    filtered = re.sub(r'\s+', ' ', filtered).strip()
    if not filtered:
        return fallback
    return filtered[:24]

@app.post("/session/{code}/participant/{pid}/name")
async def update_participant_name(code: str, pid: str, payload: dict | None = None, background_tasks: BackgroundTasks = None):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    part = _get_participant(sess, pid)
    if not payload or 'display_name' not in payload:
        raise HTTPException(status_code=400, detail="Missing display_name")
    new_name = _sanitize_display_name(str(payload.get('display_name', '')) , part.participant_id)
    part.display_name = new_name
    part.touch(); sess.touch()
    if background_tasks:
        background_tasks.add_task(cleanup_expired)
    return {"participant_id": pid, "display_name": new_name}

@app.post("/session/{code}/peer/{pid}/offer")
async def post_peer_offer(code: str, pid: str, offer: SDPModel, background_tasks: BackgroundTasks):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    part = _get_participant(sess, pid)
    if part.offer is not None:
        raise HTTPException(status_code=409, detail="Offer already set for participant")
    if offer.type.lower() != 'offer':
        raise HTTPException(status_code=400, detail="Type must be 'offer'")
    part.offer = offer
    part.touch()
    sess.touch()
    background_tasks.add_task(cleanup_expired)
    return {"status": "ok"}

@app.get("/session/{code}/peer/{pid}/offer")
async def get_peer_offer(code: str, pid: str):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    part = _get_participant(sess, pid)
    if part.offer is None:
        raise HTTPException(status_code=404, detail="Offer not found")
    return part.offer

@app.post("/session/{code}/peer/{pid}/answer")
async def post_peer_answer(code: str, pid: str, answer: SDPModel, background_tasks: BackgroundTasks):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    part = _get_participant(sess, pid)
    if part.offer is None:
        raise HTTPException(status_code=400, detail="Offer not yet set for participant")
    if part.answer is not None:
        raise HTTPException(status_code=409, detail="Answer already set for participant")
    if answer.type.lower() != 'answer':
        raise HTTPException(status_code=400, detail="Type must be 'answer'")
    part.answer = answer
    part.touch()
    sess.touch()
    background_tasks.add_task(cleanup_expired)
    return {"status": "ok"}

@app.get("/session/{code}/peer/{pid}/answer")
async def get_peer_answer(code: str, pid: str):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    part = _get_participant(sess, pid)
    if part.answer is None:
        raise HTTPException(status_code=404, detail="Answer not found")
    return part.answer

# ---------------- Full Mesh Pairwise Signaling (Milestone 2 Mesh) ----------------

class PairModel(BaseModel):  # reuse SDPModel type semantics
    from_id: str
    to_id: str
    type: str
    sdp: str
    replace: bool | None = False  # when true, overwrite existing offer (renegotiation)

class CandidateModel(BaseModel):
    from_id: str
    to_id: str
    candidate: Optional[str] = None  # None or empty indicates end-of-candidates when end_of_candidates true
    sdpMid: Optional[str] = None
    sdpMLineIndex: Optional[int] = None
    end_of_candidates: bool | None = False

def _validate_pair(sess: Session, from_id: str, to_id: str):
    if from_id == to_id:
        raise HTTPException(status_code=400, detail="from_id and to_id must differ")
    if from_id not in sess.participants or to_id not in sess.participants:
        raise HTTPException(status_code=404, detail="Participant not found in session")
    return True

@app.post("/session/{code}/pair/offer")
async def post_pair_offer(code: str, payload: PairModel, background_tasks: BackgroundTasks):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if payload.type.lower() != 'offer':
        raise HTTPException(status_code=400, detail="Type must be 'offer'")
    _validate_pair(sess, payload.from_id, payload.to_id)
    key = (payload.from_id, payload.to_id)
    if key in sess.pair_offers:
        if not payload.replace:
            raise HTTPException(status_code=409, detail="Offer already exists for pair")
        # Replace existing offer (renegotiation): clear previous answer if any so answerer re-answers
        ans_key = (payload.to_id, payload.from_id)
        if ans_key in sess.pair_answers:
            sess.pair_answers.pop(ans_key, None)
    sess.pair_offers[key] = SDPModel(type='offer', sdp=payload.sdp)
    sess.touch()
    background_tasks.add_task(cleanup_expired)
    return {"status": "ok"}

@app.get("/session/{code}/pair/offer/{from_id}/{to_id}")
async def get_pair_offer(code: str, from_id: str, to_id: str):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    # Validate participants exist
    if from_id not in sess.participants or to_id not in sess.participants:
        raise HTTPException(status_code=404, detail="Participant not found in session")
    key = (from_id, to_id)
    offer = sess.pair_offers.get(key)
    if not offer:
        # 204 indicates valid pair but offer not yet posted
        return Response(status_code=204)
    return offer

@app.post("/session/{code}/pair/answer")
async def post_pair_answer(code: str, payload: PairModel, background_tasks: BackgroundTasks):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if payload.type.lower() != 'answer':
        raise HTTPException(status_code=400, detail="Type must be 'answer'")
    _validate_pair(sess, payload.from_id, payload.to_id)
    offer_key = (payload.to_id, payload.from_id)  # ensure offer existed from opposite direction
    if offer_key not in sess.pair_offers:
        raise HTTPException(status_code=400, detail="Offer for pair does not exist")
    ans_key = (payload.from_id, payload.to_id)
    if ans_key in sess.pair_answers:
        raise HTTPException(status_code=409, detail="Answer already exists for pair")
    sess.pair_answers[ans_key] = SDPModel(type='answer', sdp=payload.sdp)
    sess.touch()
    background_tasks.add_task(cleanup_expired)
    return {"status": "ok"}

@app.get("/session/{code}/pair/answer/{from_id}/{to_id}")
async def get_pair_answer(code: str, from_id: str, to_id: str):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if from_id not in sess.participants or to_id not in sess.participants:
        raise HTTPException(status_code=404, detail="Participant not found in session")
    key = (from_id, to_id)
    answer = sess.pair_answers.get(key)
    if not answer:
        return Response(status_code=204)
    return answer

# ---------------- Trickle ICE (Milestone 3 Task C) ----------------

@app.post("/session/{code}/pair/candidate")
async def post_pair_candidate(code: str, payload: CandidateModel, background_tasks: BackgroundTasks):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    _validate_pair(sess, payload.from_id, payload.to_id)
    key = (payload.from_id, payload.to_id)
    bucket = sess.pair_candidates.get(key)
    if bucket is None:
        bucket = []
        sess.pair_candidates[key] = bucket
    # Avoid duplicate exact candidate lines (can occur with retries)
    if payload.candidate:
        for existing in bucket:
            if existing.candidate == payload.candidate:
                return {"status": "duplicate"}
    bucket.append(payload)
    sess.touch()
    background_tasks.add_task(cleanup_expired)
    return {"status": "ok"}

@app.get("/session/{code}/pair/candidates/{from_id}/{to_id}")
async def get_pair_candidates(code: str, from_id: str, to_id: str):
    sess = sessions.get(code)
    if not sess:
        raise HTTPException(status_code=404, detail="Session not found")
    if from_id not in sess.participants or to_id not in sess.participants:
        raise HTTPException(status_code=404, detail="Participant not found in session")
    key = (from_id, to_id)
    bucket = sess.pair_candidates.get(key, [])
    # Always return list (may be empty) for idempotent polling
    return [c.dict() for c in bucket]

# For local quick run without specifying uvicorn from CLI (optional)
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("signaling_server:app", host="0.0.0.0", port=8000, reload=False)
