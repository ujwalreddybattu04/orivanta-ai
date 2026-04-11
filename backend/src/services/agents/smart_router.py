"""
Smart Router Agent — the brain of Corten AI.

Analyzes every query to determine:
1. What TYPE of query is it (factual, comparison, news, creative, etc.)
2. How COMPLEX is it (simple lookup vs multi-step research)
3. What STRATEGY should be used (quick search, deep research, direct answer, etc.)
4. What TOOLS should be invoked (web_search, calculator, weather, etc.)

This replaces the basic 3-intent router with an intelligent classifier
that can route queries to the right pipeline for world-class answers.
"""

import json
import logging
from typing import Dict, Any, List

from src.config.settings import settings

logger = logging.getLogger(__name__)

# ── Route Strategies ──────────────────────────────────────────────────────────
# Each strategy maps to a different execution pipeline in the orchestrator.

STRATEGY_DIRECT = "direct"          # No search needed — greetings, math, identity
STRATEGY_QUICK = "quick"            # Single fast search — simple factual questions
STRATEGY_STANDARD = "standard"      # Current behavior — search + plan + answer
STRATEGY_DEEP_RESEARCH = "deep"     # Multi-step iterative research — complex queries

SMART_ROUTER_PROMPT = (
    "You are the Intelligence Router for a world-class AI search engine.\n\n"
    "Analyze the user's query and classify it for optimal handling.\n\n"
    "OUTPUT JSON with these fields:\n"
    "{{\n"
    '  "strategy": "direct" | "quick" | "standard" | "deep",\n'
    '  "complexity": 1-5,\n'
    '  "query_type": "greeting" | "identity" | "math" | "factual" | "definition" | "how_to" | "comparison" | "analysis" | "news" | "opinion" | "creative" | "code" | "multi_part",\n'
    '  "reasoning": "brief explanation",\n'
    '  "sub_questions": ["q1", "q2", ...] or []\n'
    "}}\n\n"
    "STRATEGY RULES:\n"
    '- "direct": Greetings (hi, hello, thanks), simple math (2+2), questions about {brand_name}/{company_name}, or trivial logic.\n'
    '- "quick": Simple factual lookups with ONE clear answer. "What is X?", "Who is Y?", "When did Z happen?", definitions, single-entity questions.\n'
    '- "standard": Most queries — news, how-to, explanations, opinions, code help, or anything needing web sources for a solid answer.\n'
    '- "deep": ONLY for genuinely complex queries that need multi-step research: comparisons of 2+ entities, multi-faceted analysis, "best X for Y" evaluations, investment/strategy questions, queries with "compare", "vs", "pros and cons", "should I", "analyze", "in-depth", research reports, or questions that clearly have multiple angles requiring separate searches.\n\n'
    "COMPLEXITY GUIDE:\n"
    "1 = Trivial (greeting, identity, simple math)\n"
    "2 = Simple lookup (single fact, definition, who/what/when)\n"
    "3 = Moderate (explanation, how-to, current news, code snippet)\n"
    "4 = Complex (comparison, multi-angle analysis, evaluation)\n"
    "5 = Deep research (investment analysis, multi-entity comparison, strategy, comprehensive report)\n\n"
    "SUB-QUESTIONS RULES:\n"
    '- For "deep" strategy: Break the query into 2-4 specific sub-questions that each need separate research.\n'
    '- For other strategies: Return empty array [].\n'
    "- Sub-questions should be concrete, searchable queries — not vague.\n"
    "- Each sub-question should cover a DIFFERENT angle/aspect of the main query.\n\n"
    "EXAMPLES:\n"
    '"Hi there" → {{"strategy":"direct","complexity":1,"query_type":"greeting","reasoning":"Social greeting","sub_questions":[]}}\n'
    '"What is photosynthesis?" → {{"strategy":"quick","complexity":2,"query_type":"definition","reasoning":"Simple scientific definition","sub_questions":[]}}\n'
    '"Latest news on AI regulation" → {{"strategy":"standard","complexity":3,"query_type":"news","reasoning":"Current events requiring fresh sources","sub_questions":[]}}\n'
    '"Compare iPhone 16 vs Samsung S25 for photography" → {{"strategy":"deep","complexity":4,"query_type":"comparison","reasoning":"Multi-entity comparison needing separate research per device","sub_questions":["iPhone 16 Pro camera specs and photography features 2025","Samsung Galaxy S25 Ultra camera specs and photography features 2025","iPhone 16 vs Samsung S25 camera comparison expert reviews"]}}\n'
    '"Should I invest in NVIDIA stock right now?" → {{"strategy":"deep","complexity":5,"query_type":"analysis","reasoning":"Investment analysis requiring financial data, analyst opinions, market context","sub_questions":["NVIDIA stock price performance and earnings 2025","NVIDIA AI chip demand and market outlook","NVIDIA stock analyst ratings and price targets 2025","NVIDIA competitors AMD Intel AI chip market share"]}}\n'
)


class SmartRouter:
    """
    Advanced query router that classifies intent, complexity, and strategy.
    Returns routing decision that the orchestrator uses to pick the right pipeline.
    """

    async def route(self, query: str) -> Dict[str, Any]:
        """
        Analyze query and return routing decision.

        Returns:
            {
                "strategy": "direct" | "quick" | "standard" | "deep",
                "complexity": 1-5,
                "query_type": str,
                "reasoning": str,
                "sub_questions": list[str]
            }
        """
        from src.services.llm_service import groq_llm_service

        if not groq_llm_service.client:
            return self._fallback(query)

        system_prompt = SMART_ROUTER_PROMPT.format(
            brand_name=settings.BRAND_NAME,
            company_name=settings.COMPANY_NAME,
        )

        try:
            response = await groq_llm_service.client.chat.completions.create(
                messages=[
                    {"role": "system", "content": system_prompt},
                    {"role": "user", "content": query},
                ],
                model=settings.ROUTER_MODEL,
                temperature=0.0,
                max_tokens=300,
                response_format={"type": "json_object"},
            )

            result = json.loads(response.choices[0].message.content)

            # Validate and normalize
            strategy = result.get("strategy", "standard")
            if strategy not in (STRATEGY_DIRECT, STRATEGY_QUICK, STRATEGY_STANDARD, STRATEGY_DEEP_RESEARCH):
                strategy = STRATEGY_STANDARD

            complexity = result.get("complexity", 3)
            if not isinstance(complexity, (int, float)) or complexity < 1:
                complexity = 3
            complexity = min(int(complexity), 5)

            sub_questions = result.get("sub_questions", [])
            if not isinstance(sub_questions, list):
                sub_questions = []
            # Ensure sub-questions are strings and cap at 4
            sub_questions = [str(q) for q in sub_questions if q][:4]

            # Safety: deep strategy MUST have sub-questions
            if strategy == STRATEGY_DEEP_RESEARCH and len(sub_questions) < 2:
                # Downgrade to standard if router didn't provide sub-questions
                strategy = STRATEGY_STANDARD
                sub_questions = []

            query_type = result.get("query_type", "factual")

            # ── TOOL SELECTION ────────────────────────────────────────────
            # Use the tool registry to pick the right tools for this query
            selected_tools = self._select_tools(query, query_type, complexity, strategy)

            route_result = {
                "strategy": strategy,
                "complexity": complexity,
                "query_type": query_type,
                "reasoning": result.get("reasoning", ""),
                "sub_questions": sub_questions,
                "tools": selected_tools,
            }

            logger.info(
                f"[SmartRouter] '{query[:60]}' → strategy={strategy} "
                f"complexity={complexity} type={query_type} "
                f"tools={selected_tools} subs={len(sub_questions)}"
            )
            return route_result

        except Exception as e:
            logger.error(f"[SmartRouter] Routing failed for '{query}': {e}")
            return self._fallback(query)

    def _select_tools(
        self, query: str, query_type: str, complexity: int, strategy: str
    ) -> List[str]:
        """
        Use the tool registry to select which tools should handle this query.
        Returns list of tool names. Fast — no LLM call, just pattern matching.
        """
        from src.tools import tool_registry, ToolContext

        context = ToolContext(
            query=query,
            query_type=query_type,
            complexity=complexity,
            strategy=strategy,
        )

        selected = tool_registry.select_tools(context)
        return [t.name for t in selected]

    def _fallback(self, query: str) -> Dict[str, Any]:
        """Robust fallback — always routes to standard search."""
        tools = self._select_tools(query, "factual", 3, STRATEGY_STANDARD)
        return {
            "strategy": STRATEGY_STANDARD,
            "complexity": 3,
            "query_type": "factual",
            "reasoning": "Fallback due to routing error",
            "sub_questions": [],
            "tools": tools,
        }


smart_router = SmartRouter()
