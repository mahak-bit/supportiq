"""Offline evaluation of the RAG pipeline against a labelled dataset.

Usage (from backend/):  python -m eval.run_eval [--out eval/results.json]

Uses a throwaway database containing only the seeded policy documents, with whatever
embedding and LLM providers are configured in the environment. Metrics:

- retrieval hit@k / MRR: is a chunk from the expected section among the retrieved passages?
- answer correctness: does the answer contain every `must_include` phrase (case-insensitive)?
- citation accuracy: share of citations that point at the expected section (answerable items)
- abstention: answerable questions should be answered; unanswerable ones should abstain
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import tempfile
import time
from pathlib import Path

HERE = Path(__file__).resolve().parent
_tmp = Path(tempfile.mkdtemp(prefix="supportiq-eval-"))
os.environ["DATABASE_URL"] = f"sqlite:///{(_tmp / 'eval.db').as_posix()}"
os.environ.setdefault("SEED_ON_STARTUP", "false")
sys.path.insert(0, str(HERE.parent))

from app.db import SessionLocal  # noqa: E402
from app.generation.reply import ReplyContext, generate_reply  # noqa: E402
from app.llm.providers import get_llm  # noqa: E402
from app.migrations import upgrade_db  # noqa: E402
from app.rag.embeddings import get_embedder  # noqa: E402
from app.rag.retriever import min_score, retrieve  # noqa: E402
from app.seed import seed_documents  # noqa: E402


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--out", default=str(HERE / "results.json"))
    args = ap.parse_args()

    items = [json.loads(line) for line in (HERE / "dataset.jsonl").read_text(encoding="utf-8").splitlines() if line.strip()]
    upgrade_db()
    llm = get_llm()
    rows = []
    with SessionLocal() as db:
        seed_documents(db)
        for it in items:
            t0 = time.monotonic()
            passages = retrieve(db, it["question"])
            ranks = [i + 1 for i, p in enumerate(passages) if it.get("expected_section") and p.section == it["expected_section"]]
            ctx = ReplyContext(customer_name="", customer_message=it["question"], agent_name="Eval", passages=passages, audience="agent")
            r = generate_reply(ctx, llm)
            answered = not r.insufficient_evidence
            passage_cites = [c for c in r.citations if c["kind"] == "passage"]
            correct_cites = [c for c in passage_cites if c.get("section") == it.get("expected_section")]
            rows.append({
                "id": it["id"],
                "answerable": it["answerable"],
                "retrieved_sections": [p.section for p in passages],
                "hit": bool(ranks),
                "rr": 1 / ranks[0] if ranks else 0.0,
                "answered": answered,
                "correct": answered and all(s.lower() in r.body.lower() for s in it.get("must_include", [])),
                "citations": len(passage_cites),
                "correct_citations": len(correct_cites),
                "validation_passed": r.validation["passed"],
                "latency_ms": int((time.monotonic() - t0) * 1000),
                "answer": r.body,
            })

    ans = [r for r in rows if r["answerable"]]
    unans = [r for r in rows if not r["answerable"]]
    total_cites = sum(r["citations"] for r in ans)
    summary = {
        "embedding": get_embedder().name,
        "llm": f"{llm.name}:{llm.model}",
        "min_score": min_score(),
        "n": len(rows),
        "retrieval_hit_at_k": round(sum(r["hit"] for r in ans) / len(ans), 3),
        "retrieval_mrr": round(sum(r["rr"] for r in ans) / len(ans), 3),
        "answer_correctness": round(sum(r["correct"] for r in ans) / len(ans), 3),
        "citation_precision": round(sum(r["correct_citations"] for r in ans) / total_cites, 3) if total_cites else None,
        "answered_when_answerable": round(sum(r["answered"] for r in ans) / len(ans), 3),
        "abstained_when_unanswerable": round(sum(not r["answered"] for r in unans) / len(unans), 3) if unans else None,
        "validation_pass_rate": round(sum(r["validation_passed"] for r in rows) / len(rows), 3),
        "median_latency_ms": sorted(r["latency_ms"] for r in rows)[len(rows) // 2],
    }
    Path(args.out).write_text(json.dumps({"summary": summary, "rows": rows}, indent=2), encoding="utf-8")
    print(json.dumps(summary, indent=2))
    for r in rows:
        mark = "ok " if (r["correct"] if r["answerable"] else not r["answered"]) else "MISS"
        print(f"  {mark} {r['id']} hit={int(r['hit'])} answered={int(r['answered'])} cites={r['correct_citations']}/{r['citations']}")


if __name__ == "__main__":
    main()
