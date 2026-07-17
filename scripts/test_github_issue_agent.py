import json
import os
import sys
import unittest
from unittest.mock import MagicMock

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import github_issue_agent as agent


def build_gemini_client(payload: dict) -> MagicMock:
    client = MagicMock()
    client.models.generate_content.return_value.text = json.dumps(payload)
    return client


class AnalyzeIssueTest(unittest.TestCase):
    def test_returns_fixed_schema_from_gemini_response(self):
        payload = {"is_clear": False, "questions": ["Which OS?"], "needs_attention": True}
        client = build_gemini_client(payload)

        result = agent.analyze_issue(client, "Crash on launch", "It crashes", ["me too"])

        self.assertEqual(result, payload)

    def test_calls_gemini_with_configured_model_and_schema(self):
        client = build_gemini_client({"is_clear": True, "questions": [], "needs_attention": False})

        agent.analyze_issue(client, "title", "body", [])

        call = client.models.generate_content.call_args
        self.assertEqual(call.kwargs["model"], agent.MODEL)
        config = call.kwargs["config"]
        self.assertEqual(config.response_schema, agent.IssueAnalysis)
        self.assertEqual(config.response_mime_type, agent.RESPONSE_MIME_TYPE_JSON)

    def test_model_is_a_gemini_flash_lite_model(self):
        self.assertEqual(agent.MODEL, "gemini-3.1-flash-lite")


class ClarificationCommentTest(unittest.TestCase):
    def test_contains_marker_and_all_questions(self):
        questions = ["Which version?", "Any logs?"]

        body = agent.build_clarification_comment(questions)

        self.assertIn(agent.AGENT_COMMENT_MARKER, body)
        for question in questions:
            self.assertIn(question, body)


class CreateOrEditAgentCommentTest(unittest.TestCase):
    def _agent_comment(self, body: str) -> MagicMock:
        comment = MagicMock()
        comment.user.login = "github-actions[bot]"
        comment.body = body
        return comment

    def test_edits_existing_agent_comment_carrying_marker(self):
        existing = self._agent_comment(f"prefix {agent.AGENT_COMMENT_MARKER} ...")
        issue = MagicMock()

        agent.create_or_edit_agent_comment(issue, "updated body", [existing])

        existing.edit.assert_called_once_with("updated body")
        issue.create_comment.assert_not_called()

    def test_creates_new_comment_when_no_marker_comment_exists(self):
        human_comment = MagicMock()
        human_comment.user.login = "some-user"
        human_comment.body = "unrelated discussion"
        issue = MagicMock()

        agent.create_or_edit_agent_comment(issue, "new body", [human_comment])

        issue.create_comment.assert_called_once_with("new body")
        human_comment.edit.assert_not_called()


class NeedsAttentionLabelTest(unittest.TestCase):
    def test_needs_attention_label_name_is_fixed(self):
        self.assertEqual(agent.NEEDS_ATTENTION_LABEL, "needs-attention")


if __name__ == "__main__":
    unittest.main()
