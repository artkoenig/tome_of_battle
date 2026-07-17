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
    def test_returns_typed_issue_analysis_from_gemini_response(self):
        payload = {
            "is_clear": False,
            "needs_attention": True,
            "comment_body": "Welches Betriebssystem verwendest du?",
        }
        client = build_gemini_client(payload)

        result = agent.analyze_issue(client, "Crash on launch", "It crashes", ["me too"])

        self.assertIsInstance(result, agent.IssueAnalysis)
        self.assertEqual(result, agent.IssueAnalysis(**payload))
        self.assertFalse(result.is_clear)
        self.assertEqual(result.comment_body, "Welches Betriebssystem verwendest du?")
        self.assertTrue(result.needs_attention)

    def test_calls_gemini_with_configured_model_and_schema(self):
        client = build_gemini_client({"is_clear": True, "needs_attention": False, "comment_body": ""})

        agent.analyze_issue(client, "title", "body", [])

        call = client.models.generate_content.call_args
        self.assertEqual(call.kwargs["model"], agent.MODEL)
        config = call.kwargs["config"]
        self.assertEqual(config.response_schema, agent.IssueAnalysis)
        self.assertEqual(config.response_mime_type, agent.RESPONSE_MIME_TYPE_JSON)

    def test_model_is_a_gemini_flash_lite_model(self):
        self.assertEqual(agent.MODEL, "gemini-3.1-flash-lite")


class IssueAnalysisSchemaTest(unittest.TestCase):
    def test_has_expected_fields_and_no_questions_field(self):
        fields = agent.IssueAnalysis.model_fields
        self.assertEqual(set(fields), {"is_clear", "needs_attention", "comment_body"})
        self.assertNotIn("questions", fields)


class SystemInstructionTest(unittest.TestCase):
    def test_does_not_hardcode_english_and_detects_conversation_language(self):
        instruction = agent.ANALYSIS_SYSTEM_INSTRUCTION.lower()

        self.assertNotIn("must be written in english", instruction)
        self.assertIn("predominant language", instruction)
        self.assertIn("default to english", instruction)


class ClarificationCommentTest(unittest.TestCase):
    def test_appends_invisible_marker_to_comment_body(self):
        comment_body = "Bitte nenne die betroffene Version."

        result = agent.build_clarification_comment(comment_body)

        self.assertIn(agent.AGENT_COMMENT_MARKER, result)

    def test_marker_is_an_invisible_html_comment(self):
        self.assertTrue(agent.AGENT_COMMENT_MARKER.startswith("<!--"))
        self.assertTrue(agent.AGENT_COMMENT_MARKER.endswith("-->"))

    def test_passes_non_english_body_through_unmodified(self):
        comment_body = "Hallo! Welche Fraktion möchtest du hinzufügen? Bitte prüfe die Größe."

        result = agent.build_clarification_comment(comment_body)

        self.assertIn(comment_body, result)


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

    def test_edit_detection_is_independent_of_comment_language(self):
        german_body = f"Hallo! Welche Version nutzt du?\n\n{agent.AGENT_COMMENT_MARKER}"
        existing = self._agent_comment(german_body)
        issue = MagicMock()

        agent.create_or_edit_agent_comment(issue, "aktualisierter Text", [existing])

        existing.edit.assert_called_once_with("aktualisierter Text")
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


class HasAttentionLabelTest(unittest.TestCase):
    def test_true_when_needs_attention_label_present(self):
        self.assertTrue(agent.has_attention_label(["bug", agent.NEEDS_ATTENTION_LABEL]))

    def test_false_when_needs_attention_label_absent(self):
        self.assertFalse(agent.has_attention_label(["bug", "enhancement"]))

    def test_false_for_freshly_opened_issue_without_labels(self):
        self.assertFalse(agent.has_attention_label([]))


class IsBotAuthorTest(unittest.TestCase):
    def test_true_for_github_actions_bot_login(self):
        self.assertTrue(agent.is_bot_author("github-actions[bot]"))

    def test_true_for_any_login_containing_bot(self):
        self.assertTrue(agent.is_bot_author("some-other-bot"))

    def test_false_for_human_login(self):
        self.assertFalse(agent.is_bot_author("some-user"))

    def test_false_for_empty_login(self):
        self.assertFalse(agent.is_bot_author(""))

    def test_case_insensitive(self):
        self.assertTrue(agent.is_bot_author("GitHub-Actions[BOT]"))


class EnsureLabelTest(unittest.TestCase):
    def test_does_not_create_label_when_it_already_exists(self):
        repo = MagicMock()

        agent.ensure_label(repo, "needs-attention", "d93f0b")

        repo.get_label.assert_called_once_with("needs-attention")
        repo.create_label.assert_not_called()

    def test_creates_label_when_it_is_missing(self):
        try:
            from github.GithubException import UnknownObjectException
        except ImportError:
            self.skipTest("PyGithub is not installed in this environment")

        repo = MagicMock()
        repo.get_label.side_effect = UnknownObjectException(404, {"message": "Not Found"}, None)

        agent.ensure_label(repo, "needs-attention", "d93f0b")

        repo.create_label.assert_called_once_with("needs-attention", "d93f0b")

    def test_does_not_swallow_unrelated_errors(self):
        repo = MagicMock()
        repo.get_label.side_effect = RuntimeError("network blip")

        with self.assertRaises(RuntimeError):
            agent.ensure_label(repo, "needs-attention", "d93f0b")

        repo.create_label.assert_not_called()


class LoadAgentConfigTest(unittest.TestCase):
    REQUIRED_ENV_VARS = {
        "GEMINI_API_KEY": "test-api-key",
        "GITHUB_TOKEN": "test-token",
        "ISSUE_NUMBER": "42",
        "REPO_OWNER": "octocat",
        "REPO_NAME": "hello-world",
    }

    def _set_env(self, **overrides):
        values = {**self.REQUIRED_ENV_VARS, **overrides}
        for key, value in values.items():
            if value is None:
                os.environ.pop(key, None)
            else:
                os.environ[key] = value

    def tearDown(self):
        for key in [*self.REQUIRED_ENV_VARS, "ISSUE_EVENT", "COMMENT_BODY", "COMMENT_AUTHOR"]:
            os.environ.pop(key, None)

    def test_builds_config_from_environment(self):
        self._set_env()
        os.environ["ISSUE_EVENT"] = "issue_comment"
        os.environ["COMMENT_BODY"] = "hello"
        os.environ["COMMENT_AUTHOR"] = "some-user"

        config = agent.load_agent_config()

        self.assertEqual(config.api_key, "test-api-key")
        self.assertEqual(config.github_token, "test-token")
        self.assertEqual(config.issue_number, 42)
        self.assertEqual(config.repo_owner, "octocat")
        self.assertEqual(config.repo_name, "hello-world")
        self.assertEqual(config.event_name, "issue_comment")
        self.assertEqual(config.comment_body, "hello")
        self.assertEqual(config.comment_author, "some-user")

    def test_raises_when_a_required_variable_is_missing(self):
        self._set_env(GEMINI_API_KEY=None)

        with self.assertRaises(ValueError):
            agent.load_agent_config()


if __name__ == "__main__":
    unittest.main()
